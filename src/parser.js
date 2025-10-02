// parser.js
import fs from 'fs';
import { computeDeterministicId } from './utils.js';
import { lintLines } from './linter.js';

const PREFIX_TOKEN_RE = /^([A-Dx\-]$)|^#(.+)$|^@(.+)$/; // simple check

export function loadFileLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split(/\r?\n/);
}

export function parseFileToTree(filePath, options = { indentSize: 2, lint: true }) {
  const lines = loadFileLines(filePath);
  if (options.lint) {
    const { errors, warnings } = lintLines(lines, { indentSize: options.indentSize });
    if (errors.length) {
      const message = errors.map(e => `${filePath}:${e.line}: ERROR: ${e.msg}`).join('\n');
      const warnMsg = warnings.length ? ('\nWarnings:\n' + warnings.map(w => `${filePath}:${w.line}: WARN: ${w.msg}`).join('\n')) : '';
      throw new Error(`Lint errors detected:\n${message}\n${warnMsg}`);
    }
  }

  // Parse: locate ## TODO section if any and parse only that if required?
  // We'll parse whole file but only tasks (bullets) are considered data.
  const tasks = [];
  const stack = []; // {indent, node}
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();

    if (!trimmed.startsWith('-')) { i++; continue; }

    // New bullet
    const indent = line.match(/^(\s*)/)[1].length;
    // create node
    const node = {
      data: {},    // parsed key/values and computed fields
      children: [],
      indent,
      sourceLineIndex: i,
      originalLine: trimmed // we will use this for serialization convenience
    };

    // Parse bullet line tokens (prefixes, optional first quoted string, and inline key: pairs)
    parseBulletLineInline(trimmed.slice(1).trim(), node);

    // Consume following indented key: lines and multi-line blocks
    i++;
    while (i < lines.length) {
      const nextRaw = lines[i].replace(/\t/g, '  ');
      const nextTrim = nextRaw.trim();
      if (nextTrim === '') { i++; continue; }
      const nextIndent = nextRaw.match(/^(\s*)/)[1].length;
      if (nextTrim.startsWith('-') && nextIndent <= indent) break; // sibling or parent bullet
      if (nextTrim.startsWith('-') && nextIndent > indent) break; // child bullet (child will be parsed in its own loop)
      // If line is key: value and indent > current indent, it's part of this node
      if (nextIndent > indent) {
        const kvMatch = nextTrim.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
        if (kvMatch) {
          const key = kvMatch[1];
          let val = kvMatch[2];
          if (val === '|') {
            // consume multi-line block: lines with indent > this line indent
            const blockIndent = nextRaw.match(/^(\s*)/)[1].length;
            const collected = [];
            i++;
            while (i < lines.length) {
              const contRaw = lines[i].replace(/\t/g, '  ');
              const contTrim = contRaw.trim();
              const contIndent = contRaw.match(/^(\s*)/)[1].length;
              if (contTrim === '') { collected.push(''); i++; continue; }
              if (contIndent <= blockIndent) break;
              collected.push(contRaw.slice(blockIndent + 2)); // remove extra indent
              i++;
            }
            val = collected.join('\n');
            node.data[key] = val;
            continue;
          } else {
            node.data[key] = parseValueToken(val);
            i++;
            continue;
          }
        } else {
          // not a kv line -> stop (safer to break)
          break;
        }
      } else {
        // not part of this bullet, stop
        break;
      }
    }

    // Determine parent by stack based on indentation
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      tasks.push(node);
    }
    stack.push({ indent, node });

    // assign deterministic ID if no id present
    ensureIdOnNode(node);

    // continue (i is already at next line to parse)
  }

  // After full parse, walk nodes to ensure all descendants have ids and set parent fields (in-memory only)
  const setParents = (nodes, parentId = null) => {
    for (const n of nodes) {
      n.parent = parentId;
      if (!n.id) ensureIdOnNode(n);
      n.id = n.data.id; // normalized
      if (n.children && n.children.length) setParents(n.children, n.id);
    }
  };
  setParents(tasks, null);

  return { tasks, lines };
}

// parse inline bullet line (prefix macros, first quoted string as title, inline key: pairs)
function parseBulletLineInline(afterDash, node) {
  // tokens separated by commas or spaces (commas optional)
  // But we must respect quoted strings. We'll tokenize with a simple state machine.
  const tokens = tokenizeRespectingQuotes(afterDash);
  // tokens are strings like: x, A, @Alice, #game, `Title...`, key:, key:value
  let i = 0;
  // parse prefixes until first key:value or quoted string consumed as title
  for (; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.includes(':')) break; // start of key:value pairs
    if (isQuotedString(tok)) {
      // first quoted string becomes title if no explicit title key present later
      if (!node.data.title) node.data.title = stripQuotes(tok);
      continue;
    }
    // handle prefixes
    if (tok === 'x') { node.data.completed = true; continue; }
    if (tok === '-') { node.data.skipped = true; continue; }
    if (/^[A-D]$/.test(tok)) { node.data.priority = tok; continue; }
    if (tok.startsWith('@')) { node.data.stakeholder = tok.slice(1); continue; }
    if (tok.startsWith('#')) {
      if (!node.data.tags) node.data.tags = [];
      node.data.tags.push(tok.slice(1));
      continue;
    }
    // otherwise could be a bare token (ignored), or we break
    // continue scanning until key:value found
  }

  // parse remaining as inline key:value pairs (tokens may include commas)
  const rest = tokens.slice(i);
  // join with space and parse regex for key: value pairs repeatedly
  const restStr = rest.join(' ');
  const kvRegex = /([A-Za-z_][A-Za-z0-9_-]*):\s*(`[^`]*`|"[^"]*"|[^\s,]+)/g;
  let m;
  while ((m = kvRegex.exec(restStr)) !== null) {
    const k = m[1];
    const vtoken = m[2];
    node.data[k] = parseValueToken(vtoken);
  }

  // store original inline representation for better serializing single-line
  node.inline = afterDash;
}

function tokenizeRespectingQuotes(s) {
  const out = [];
  let cur = '';
  let i = 0;
  let inDouble = false;
  let inBack = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' && !inBack) {
      cur += ch;
      if (inDouble) { // closing
        out.push(cur.trim()); cur = ''; inDouble = false;
      } else { inDouble = true; }
      i++; continue;
    }
    if (ch === '`' && !inDouble) {
      cur += ch;
      if (inBack) { out.push(cur.trim()); cur = ''; inBack = false; }
      else { inBack = true; }
      i++; continue;
    }
    if (!inDouble && !inBack && (ch === ',' || /\s/.test(ch))) {
      if (cur.trim() !== '') { out.push(cur.trim()); cur = ''; }
      i++;
      // skip extra spaces/commas
      while (i < s.length && (s[i] === ',' || /\s/.test(s[i]))) i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function isQuotedString(tok) {
  return (tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith('`') && tok.endsWith('`'));
}
function stripQuotes(tok) {
  if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith('`') && tok.endsWith('`'))) return tok.slice(1, -1);
  return tok;
}

function parseValueToken(tok) {
  if (!tok) return '';
  tok = tok.trim();
  if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith('`') && tok.endsWith('`'))) return tok.slice(1, -1);
  if (tok === 'true') return true;
  if (tok === 'false') return false;
  if (!isNaN(Number(tok))) return Number(tok);
  // unquoted date-like tokens or strings
  return tok;
}

function ensureIdOnNode(node) {
  // If node.data.id exists and non-empty: keep it (do not recompute)
  if (node.data && node.data.id) {
    node.id = String(node.data.id);
    return;
  }
  // Compute deterministic id from identity fields: title,tags,priority,stakeholder,due
  const identity = {
    title: node.data.title ?? '',
    tags: node.data.tags ?? [],
    priority: node.data.priority ?? null,
    stakeholder: node.data.stakeholder ?? null,
    due: node.data.due ?? null
  };
  const id = computeDeterministicId(identity);
  node.data.id = id;
  node.id = id;
}
