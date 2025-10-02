#!/usr/bin/env node
// cli.js
import fs from 'fs';
import { parseFileToTree, loadFileLines } from './parser.js';
import { lintLines } from './linter.js';
import { collectTasks, multiKeySort } from './utils.js';
import { serializeTasksToLines } from './serializer.js';
import { replaceTodoSection } from './fileSection.js';

// Simple argument parser to replace minimist
function parseArgs(args) {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[key] = args[i + 1];
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result[key] = args[i + 1];
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else {
      result._.push(arg);
      i++;
    }
  }
  return result;
}

const argv = parseArgs(process.argv.slice(2));
const cmd = argv._[0];

function printUsageAndExit() {
  console.log(`Usage:
  todo select <file> [orderby <key [asc|desc], ...>] [into <output_file>]
  todo lint <file>
`);
  process.exit(1);
}

if (!cmd) printUsageAndExit();

if (cmd === 'lint') {
  const file = argv._[1];
  if (!file || !fs.existsSync(file)) { console.error('File required and must exist'); process.exit(1); }
  const lines = loadFileLines(file);
  const { errors, warnings } = lintLines(lines, { indentSize: 2 });
  if (errors.length === 0 && warnings.length === 0) {
    console.log('No lint issues found.');
    process.exit(0);
  }
  for (const e of errors) console.error(`${file}:${e.line} ERROR: ${e.msg}`);
  for (const w of warnings) console.warn(`${file}:${w.line} WARN: ${w.msg}`);
  process.exit(errors.length ? 1 : 0);
}

if (cmd === 'select') {
  const file = argv._[1];
  if (!file || !fs.existsSync(file)) { console.error('input file is required and must exist'); process.exit(1); }

  // Parse orderby from arguments. Look for 'orderby' token
  const rawArgs = process.argv.slice(2);
  let orderby = null;
  let intoFile = null;
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === 'orderby') {
      orderby = rawArgs[i + 1]; i++;
    } else if (rawArgs[i] === 'into') {
      intoFile = rawArgs[i + 1]; i++;
    }
  }

  // Parse file -> throws on lint errors
  let parsed;
  try {
    parsed = parseFileToTree(file, { indentSize: 2, lint: true });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const rootTasks = parsed.tasks;

  // Flatten tasks for query/sort
  const flat = collectTasks(rootTasks);

  // Parse orderby spec into array [{key,dir}]
  let keySpec = [];
  if (orderby) {
    keySpec = orderby.split(',').map(s => {
      const parts = s.trim().split(/\s+/);
      return { key: parts[0], dir: (parts[1] || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc' };
    });
    // Sort flat array
    multiKeySort(flat, keySpec);
  }

  if (intoFile) {
    // We need to write hierarchical file preserving parent-child relationships.
    // The sorted 'flat' can be used to reorder the tree.
    // Approach: build map id->node from parsed tree, then reorder children arrays according to sorted flat order grouping by parent.
    const idToNode = new Map();
    function mapNodes(nodes) {
      for (const n of nodes) { idToNode.set(n.id, n); if (n.children) mapNodes(n.children); }
    }
    mapNodes(rootTasks);

    // Build new ordering by parent groups
    const parentGroups = new Map(); // parentId -> [node]
    for (const n of flat) {
      const pid = n.parent ?? '__root';
      if (!parentGroups.has(pid)) parentGroups.set(pid, []);
      parentGroups.get(pid).push(n);
    }

    // Reconstruct tree recursively from parentGroups
    function buildTreeForParent(parentId) {
      const arr = [];
      const group = parentGroups.get(parentId) || [];
      for (const entry of group) {
        // use existing node object (preserves children property)
        const node = idToNode.get(entry.id) || entry;
        node.children = buildTreeForParent(node.id);
        arr.push(node);
      }
      return arr;
    }
    const newRoot = buildTreeForParent('__root');

    // Serialize to lines and replace ## TODO section in original file (or intoFile file path)
    const outTaskLines = serializeTasksToLines(newRoot, { indentSize: 2 });

    // If intoFile is same as original file (overwrite), load original and replace section
    const targetPath = intoFile;
    let targetLines = [];
    if (fs.existsSync(file) && targetPath === file) targetLines = parsed.lines;
    else if (fs.existsSync(targetPath)) targetLines = loadFileLines(targetPath);
    else targetLines = loadFileLines(file); // base on source file if new file doesn't exist

    const replaced = replaceTodoSection(targetLines, outTaskLines);
    // Write file
    fs.writeFileSync(targetPath, replaced.join('\n'), 'utf8');
    console.log(`Saved sorted tasks into ${targetPath}`);
    process.exit(0);
  } else {
    // Print flattened JSON-ish view
    console.log(JSON.stringify(flat.map(n => ({
      id: n.id,
      parent: n.parent ?? null,
      ...n.data
    })), null, 2));
    process.exit(0);
  }
}

printUsageAndExit();
