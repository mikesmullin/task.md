// linter.js
// Validate a Markdown task file according to the Version Three language rules.

export function lintLines(lines, opts = { indentSize: 2 }) {
  const errors = [];
  const warnings = [];
  const indentSize = opts.indentSize || 2;
  const idSet = new Set();

  const stack = []; // track indent levels and last bullet indent
  let insideMultilineBlock = null; // track when we're inside a multiline block { startLine, baseIndent, endIndent }

  function pushError(lineNo, msg) {
    errors.push({ line: lineNo + 1, msg });
  }
  function pushWarn(lineNo, msg) {
    warnings.push({ line: lineNo + 1, msg });
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, '  '); // no tabs
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1].length;

    // Check if we're ending a multiline block
    if (insideMultilineBlock && trimmed !== '') {
      if (indent <= insideMultilineBlock.baseIndent) {
        // We've exited the multiline block
        insideMultilineBlock = null;
      } else {
        // Still inside multiline block - skip validation
        continue;
      }
    }

    // Check for multi-line block content lines: they are validated when key: | is found
    if (trimmed === '') continue;

    if (trimmed.startsWith('-')) {
      // bullet line
      // indentation must be multiple of indentSize
      if (indent % indentSize !== 0) pushError(i, `Indentation ${indent} not multiple of ${indentSize} spaces`);
      const afterDash = trimmed.slice(1).trim();
      if (afterDash === '') pushError(i, 'Bullet line missing content');
      // prefixes are tokens before first quoted or first key:value (or EOL)
      // Basic scan for invalid prefix tokens
      const tokens = afterDash.split(/\s+/);
      for (const t of tokens) {
        if (t.includes(':') || t.startsWith('"') || t.startsWith('`')) break;
        if (/^#/.test(t) || /^@/.test(t) || /^[A-Dx\-]$/.test(t)) continue;
        // If token looks like key:value, stop scanning
        if (t.includes(':')) break;
        // else if token is like id:..., break
        // else token may be a bare string (title) - that's allowed if quoted
        if (/^`.*`$/.test(t) || /^".*"$/.test(t)) break;
        // anything else is suspicious
        // but allow alnum short tokens (we can't be overly strict)
      }

      // push stack frame: ensure nesting doesn't skip levels
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      if (stack.length) {
        const parentIndent = stack[stack.length - 1].indent;
        if (indent - parentIndent > indentSize && indent - parentIndent !== indentSize) {
          // allowed: exactly indentSize deeper; otherwise warn
          pushWarn(i, `Indentation jumped by ${indent - parentIndent} spaces (expected ${indentSize})`);
        }
      }
      stack.push({ indent, lineNo: i });
    } else {
      // non-bullet lines: could be markdown content, headings, or key:value pairs under tasks

      // Skip markdown headings (# ## ###), horizontal rules (---), and other markdown syntax
      if (trimmed.match(/^#{1,6}\s+/) || trimmed.match(/^-{3,}$/) || trimmed.match(/^={3,}$/) || trimmed === '') {
        continue; // Ignore markdown structure
      }

      // Find nearest preceding bullet to determine if this line should be part of a task
      const bulletIdx = findPrecedingBulletIndex(lines, i);
      if (bulletIdx === -1) {
        // No preceding bullet - this is general markdown content, not task-related
        continue; // Don't warn about general markdown content
      }

      // Check if this line is properly indented relative to the preceding bullet
      const bulletLine = lines[bulletIdx].replace(/\t/g, '  ');
      const bulletIndent = bulletLine.match(/^(\s*)/)[1].length;

      // Line should be indented more than the bullet to be part of the task
      if (indent <= bulletIndent) {
        // This line is at same or less indentation than bullet, so it's not part of the task
        continue; // Ignore lines that aren't part of tasks
      }

      // Check key:value format or continuation of a block
      const kvMatch = line.trim().match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!kvMatch) {
        pushError(i, 'Expected key: value or multi-line content indented under key with |');
        continue;
      }
      const key = kvMatch[1];
      const value = kvMatch[2];

      // If value is '|' then next lines must be indented more than current line
      if (value === '|') {
        const baseIndent = indent;
        let j = i + 1;
        let foundContent = false;
        while (j < lines.length) {
          const nxt = lines[j].replace(/\t/g, '  ');
          const nxtTrim = nxt.trim();
          const nxtIndent = nxt.match(/^(\s*)/)[1].length;
          if (nxtTrim === '') { j++; continue; }
          // if next non-empty line is a bullet or has indent <= baseIndent => block ended
          if (nxtTrim.startsWith('-') && nxtIndent <= baseIndent) break;
          if (nxtIndent <= baseIndent) break;
          foundContent = true;
          j++;
        }
        if (!foundContent) pushError(i, `Multi-line '|' for key '${key}' has no indented content`);
        // Mark that we're entering a multiline block
        insideMultilineBlock = { baseIndent, startLine: i };
      } else {
        // ensure keys are valid, values quoted if containing spaces (we allow unquoted dates but still warn)
        const hasSpace = /\s/.test(value);
        const isQuoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith('`') && value.endsWith('`'));
        if (hasSpace && !isQuoted) {
          // allow common date formats like 2025-10-05 (no spaces)
          pushWarn(i, `Unquoted value with spaces for key "${key}" (consider quoting)`);
        }
        // If key is id, check uniqueness
        if (key === 'id' && value) {
          if (idSet.has(value)) pushError(i, `Duplicate id '${value}'`);
          else idSet.add(value);
        }
      }
    }
  }

  return { errors, warnings };
}

function findPrecedingBulletIndex(lines, idx) {
  for (let k = idx - 1; k >= 0; k--) {
    if (lines[k].trim().startsWith('-')) return k;
    if (lines[k].trim() === '') continue;
    // if reach a heading at same or higher level, stop
    // but we still return last bullet
  }
  return -1;
}
