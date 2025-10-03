#!/usr/bin/env node
// cli.js
import fs from 'fs';
import { parseFileToTree, loadFileLines } from './parser.js';
import { lintLines } from './linter.js';
import { collectTasks, multiKeySort } from './utils.js';
import { serializeTasksToLines } from './serializer.js';
import { replaceTodoSection } from './fileSection.js';
import { formatAsTable } from './tableFormatter.js';

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

function printHelp() {
  console.log(`
NAME
       todo - A human-friendly task management system using Markdown

SYNOPSIS
       todo COMMAND [OPTIONS] [ARGUMENTS]
       todo { select | lint | help | --help | -h }

DESCRIPTION
       todo is a command-line task management system that uses Markdown bullet 
       lists as a schemaless hierarchical database. Tasks are stored as Markdown 
       bullets with support for multi-line descriptions, prefix macros, and 
       arbitrary key-value pairs.

       All tasks are organized under a ## TODO heading in Markdown files. 
       Non-bullet content is preserved but ignored during task processing.

COMMANDS
       select <file> [orderby <keys>] [--format <format>] [into <output>]
              Query and optionally sort tasks from a Markdown file.
              
              Without 'into', outputs tasks to stdout in the specified format.
              With 'into', writes sorted tasks back to the specified file
              while preserving the original file structure and hierarchy.
              
              Format options:
                json   - JSON output (default)
                table  - Markdown table format
              
              Examples:
                todo select tasks.md
                todo select tasks.md --format table
                todo select tasks.md orderby priority desc
                todo select tasks.md orderby priority asc, due desc --format table
                todo select tasks.md orderby weight desc into sorted.md

       lint <file>
              Validate a Markdown task file according to syntax rules.
              
              Checks for proper indentation, valid prefix macros, correct
              key:value format, and other structural requirements.
              
              Exit codes:
                0 - No issues found
                1 - Errors detected
              
              Examples:
                todo lint tasks.md

       help, --help, -h
              Display this help message and exit.

TASK SYNTAX
       Single-line task:
         - A @Alice #urgent "Fix authentication bug" due: 2025-10-01 weight: 10

       Multi-line task:
         - A @Alice #urgent
           title: "Fix authentication bug"  
           due: 2025-10-01
           weight: 10
           description: |
             The login system is failing for users with special
             characters in their passwords.
           notes: |
             Check with security team before deploying.

       Prefix macros (at start of task line):
         x         - completed: true
         -         - skipped: true  
         A-D       - priority (A=highest, D=lowest)
         @Name     - stakeholder: "Name"
         #tag      - adds to tags array

       Key-value pairs:
         key: value              - Simple scalar value
         key: "quoted value"     - Value with spaces
         key: |                  - Multi-line value (indented content follows)

ORDERING
       The orderby clause supports multiple keys with direction specifiers:
       
       orderby <key1> [asc|desc], <key2> [asc|desc], ...
       
       Available keys include any task field (title, due, weight, priority, etc.)
       plus the special 'parent' key for grouping subtasks.
       
       Default direction is ascending. Undefined values sort first.

FILE FORMAT
       Tasks must be under a ## TODO heading. The heading will be created if
       it doesn't exist. Content above and below the TODO section is preserved.
       
       Example file structure:
         # Project Documentation
         
         This is regular Markdown content.
         
         ## TODO
         
         - A @Alice "Task one" due: 2025-10-01
         - B @Bob "Task two"  
           - C "Subtask"
         
         ## Notes
         
         More regular Markdown content.

EXAMPLES
       List all tasks as JSON:
         todo select project.md

       List all tasks as a table:
         todo select project.md --format table

       Sort by priority then due date:
         todo select project.md orderby priority asc, due desc

       Sort by priority and display as table:
         todo select project.md orderby priority desc --format table

       Create a sorted version of the file:
         todo select project.md orderby weight desc into project-sorted.md

       Validate task syntax:
         todo lint project.md

EXIT STATUS
       0      Success
       1      Error (lint failures, file not found, syntax errors)
`);
}

function printUsageAndExit() {
  console.log(`Usage:
  todo select <file> [orderby <key [asc|desc], ...>] [--format <json|table>] [into <output_file>]
  todo lint <file>
  todo help
  
Use 'todo help' for detailed information.`);
  process.exit(1);
}

if (!cmd || argv.help || argv.h) {
  if (!cmd) {
    printUsageAndExit();
  } else {
    printHelp();
    process.exit(0);
  }
}

if (cmd === 'help') {
  printHelp();
  process.exit(0);
}

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

  // Parse orderby and format from arguments. Look for 'orderby' token and --format flag
  const rawArgs = process.argv.slice(2);
  let orderby = null;
  let format = 'json'; // default format
  let intoFile = null;
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === 'orderby') {
      orderby = rawArgs[i + 1]; i++;
    } else if (rawArgs[i] === '--format') {
      format = rawArgs[i + 1]; i++;
    } else if (rawArgs[i] === 'into') {
      intoFile = rawArgs[i + 1]; i++;
    }
  }

  // Validate format
  if (!['json', 'table'].includes(format)) {
    console.error(`Invalid format '${format}'. Supported formats: json, table`);
    process.exit(1);
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
    // Print flattened data in specified format
    const flatData = flat.map(n => ({
      id: n.id,
      parent: n.parent ?? null,
      ...n.data
    }));

    if (format === 'table') {
      console.log(formatAsTable(flatData));
    } else {
      console.log(JSON.stringify(flatData, null, 2));
    }
    process.exit(0);
  }
}

printUsageAndExit();
