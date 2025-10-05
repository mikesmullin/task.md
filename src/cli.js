#!/usr/bin/env node
// cli.js
import fs from 'fs';
import { parseFileToTree, loadFileLines, ensureIdOnNode } from './parser.js';
import { lintLines } from './linter.js';
import { collectTasks, multiKeySort } from './utils.js';
import { serializeTasksToLines } from './serializer.js';
import { replaceTodoSection } from './fileSection.js';
import { formatAsTable } from './tableFormatter.js';

// Helper function to process escape sequences in parsed values
function processEscapeSequences(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

// Helper function to validate tag names
function validateTagName(tag) {
  // Tags must contain only alphanumeric characters, hyphens, and underscores
  // No spaces, no hash symbols (since # is the prefix), no other special characters
  const validTagRegex = /^[a-zA-Z0-9_-]+$/;
  if (!validTagRegex.test(tag)) {
    return false;
  }
  // Additional check: tags cannot be empty
  if (tag.length === 0) {
    return false;
  }
  return true;
}

// Helper function to validate stakeholder names
function validateStakeholderName(stakeholder) {
  // Stakeholders must contain only alphanumeric characters, hyphens, and underscores
  // No spaces, no @ symbols (since @ is the prefix), no other special characters
  const validStakeholderRegex = /^[a-zA-Z0-9_-]+$/;
  if (!validStakeholderRegex.test(stakeholder)) {
    return false;
  }
  // Additional check: stakeholders cannot be empty
  if (stakeholder.length === 0) {
    return false;
  }
  return true;
}

// Simple SQL-like query parser
function parseQuery(query) {
  // Tokenize, handling quotes
  const tokens = [];
  let i = 0;
  while (i < query.length) {
    if (query[i] === '"' || query[i] === "'") {
      const quote = query[i];
      i++;
      let str = '';
      while (i < query.length) {
        if (query[i] === '\\' && i + 1 < query.length) {
          // Handle backslash escaping
          const nextChar = query[i + 1];
          if (nextChar === quote || nextChar === '\\') {
            str += nextChar; // Add the escaped character
            i += 2; // Skip both backslash and escaped character
          } else {
            str += query[i]; // Just add the backslash as-is
            i++;
          }
        } else if (query[i] === quote) {
          // Check if next character is also the same quote (SQL-style escape sequence)
          if (i + 1 < query.length && query[i + 1] === quote) {
            str += quote; // Add the escaped quote to the string
            i += 2; // Skip both quote characters
          } else {
            // End of string
            i++; // Skip the closing quote
            break;
          }
        } else {
          str += query[i];
          i++;
        }
      }
      tokens.push(str);
    } else if (/\s/.test(query[i])) {
      i++;
    } else if (query[i] === ',') {
      tokens.push(',');
      i++;
    } else {
      let word = '';
      while (i < query.length && !/\s/.test(query[i]) && query[i] !== ',') {
        word += query[i];
        i++;
      }
      tokens.push(word);
    }
  }

  i = 0;

  function peek() { return tokens[i]; }
  function consume() { return tokens[i++]; }
  function expect(word) {
    if (peek()?.toUpperCase() !== word.toUpperCase()) throw new Error(`Expected '${word}', got '${peek()}'`);
    return consume();
  }

  const result = {};

  const command = consume().toUpperCase();
  result.command = command;

  if (command === 'SELECT') {
    result.fields = [];
    if (peek() === '*') {
      result.fields = ['*'];
      consume();
    } else {
      while (peek() && peek().toUpperCase() !== 'FROM') {
        result.fields.push(consume());
        if (peek() === ',') consume();
      }
    }
    expect('FROM');
    result.file = consume();
    if (peek() && peek().toUpperCase() === 'WHERE') {
      consume();
      const whereTokens = [];
      while (peek() && peek().toUpperCase() !== 'ORDER' && peek().toUpperCase() !== 'INTO') {
        whereTokens.push(consume());
      }
      result.where = whereTokens;
    }
    if (peek() && peek().toUpperCase() === 'ORDER') {
      expect('ORDER');
      expect('BY');
      result.orderBy = [];
      while (peek() && peek().toUpperCase() !== 'LIMIT' && peek().toUpperCase() !== 'INTO') {
        const key = consume();
        let dir = 'asc';
        if (peek() && (peek().toUpperCase() === 'ASC' || peek().toUpperCase() === 'DESC')) {
          dir = consume().toLowerCase();
        }
        result.orderBy.push({ key, dir });
        if (peek() === ',') consume();
      }
    }
    if (peek() && peek().toUpperCase() === 'LIMIT') {
      expect('LIMIT');
      result.limit = parseInt(consume());
      if (isNaN(result.limit)) throw new Error('LIMIT must be a number');
    }
    if (peek() && peek().toUpperCase() === 'INTO') {
      expect('INTO');
      result.into = consume();
    }
  } else if (command === 'UPDATE') {
    result.file = consume();
    expect('SET');
    result.set = [];
    while (peek() && peek().toUpperCase() !== 'WHERE') {
      const key = consume();
      const eq = consume();
      if (eq !== '=') throw new Error('Expected = in SET');
      const value = consume();
      result.set.push({ key, value });
      if (peek() === ',') consume();
    }
    if (peek() && peek().toUpperCase() === 'WHERE') {
      consume();
      const whereTokens = [];
      while (peek()) {
        whereTokens.push(consume());
      }
      result.where = whereTokens;
    }
  } else if (command === 'DELETE') {
    expect('FROM');
    result.file = consume();
    if (peek() && peek().toUpperCase() === 'WHERE') {
      consume();
      const whereTokens = [];
      while (peek()) {
        whereTokens.push(consume());
      }
      result.where = whereTokens;
    }
  } else if (command === 'INSERT') {
    expect('INTO');
    result.file = consume();
    expect('SET');
    result.set = [];
    while (peek()) {
      const key = consume();
      const eq = consume();
      if (eq !== '=') throw new Error('Expected = in SET');
      const value = consume();
      result.set.push({ key, value });
      if (peek() === ',') consume();
    }
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  return result;
}

// Simple WHERE evaluator
function evaluateWhere(task, whereTokens) {
  if (!whereTokens || whereTokens.length === 0) return true;

  // Handle IS NULL and IS NOT NULL operators
  if (whereTokens.length >= 3 && whereTokens[1].toUpperCase() === 'IS') {
    const key = whereTokens[0];
    let taskValue = task[key];
    if (taskValue === undefined && task.data) taskValue = task.data[key];
    // Special handling for boolean fields
    if ((key === 'completed' || key === 'skipped') && taskValue === undefined) {
      taskValue = false;
    }

    if (whereTokens[2].toUpperCase() === 'NULL') {
      // IS NULL: true if value is null, undefined, or false for boolean fields
      return taskValue === null || taskValue === undefined ||
        ((key === 'completed' || key === 'skipped') && taskValue === false);
    } else if (whereTokens.length >= 4 &&
      whereTokens[2].toUpperCase() === 'NOT' &&
      whereTokens[3].toUpperCase() === 'NULL') {
      // IS NOT NULL: true if value exists and is not false for boolean fields
      return taskValue !== null && taskValue !== undefined &&
        !((key === 'completed' || key === 'skipped') && taskValue === false);
    }
  }

  // Simple: key op value
  if (whereTokens.length >= 3) {
    const key = whereTokens[0];
    const op = whereTokens[1];
    let value = whereTokens[2];
    let taskValue = task[key];
    if (taskValue === undefined && task.data) taskValue = task.data[key];
    // Special handling for boolean fields
    if ((key === 'completed' || key === 'skipped') && taskValue === undefined) {
      taskValue = false;
    }
    let compareValue = value;
    if (value === 'true') compareValue = true;
    else if (value === 'false') compareValue = false;
    else if (!isNaN(value)) compareValue = Number(value);
    else compareValue = processEscapeSequences(value);
    if (op === '=') {
      return taskValue == compareValue;
    } else if (op === '>') {
      return taskValue > compareValue;
    } else if (op === '<') {
      return taskValue < compareValue;
    } else if (op.toUpperCase() === 'CONTAINS') {
      if (Array.isArray(taskValue)) {
        return taskValue.includes(compareValue);
      } else if (typeof taskValue === 'string') {
        return taskValue.includes(compareValue);
      }
      return false;
    }
  }
  return true;
}

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
       todo { query | lint | help }

DESCRIPTION
       todo is a command-line task management system that uses Markdown bullet 
       lists as a schemaless hierarchical database. Tasks are stored as Markdown 
       bullets with support for multi-line descriptions, prefix macros, and 
       arbitrary key-value pairs.

       All tasks are organized under a ## TODO heading in Markdown files. 
       Non-bullet content is preserved but ignored during task processing.

COMMANDS
       query <sql-query> [--format/-o/-o <format>]
              Execute a SQL-like query on a Markdown task file.
              
              Supported queries:
                SELECT [fields] FROM <file> [WHERE condition] [ORDER BY keys] [LIMIT n] [INTO <output>]
                UPDATE <file> SET assignments WHERE condition
                DELETE FROM <file> WHERE condition
                INSERT INTO <file> SET assignments
              
              Format options:
                table  - Markdown table format (default)
                json   - JSON output
              
              Examples:
                todo query "SELECT * FROM tasks.md"
                todo query "SELECT title, priority FROM tasks.md WHERE completed = false"
                todo query "SELECT * FROM tasks.md ORDER BY priority DESC"
                todo query "SELECT * FROM tasks.md ORDER BY priority ASC, due DESC LIMIT 5"
                todo query "SELECT * FROM tasks.md ORDER BY priority ASC, due DESC INTO sorted.md"
                todo query "UPDATE tasks.md SET priority = 'A' WHERE id = 1"
                todo query "DELETE FROM tasks.md WHERE completed = true"
                todo query "INSERT INTO tasks.md SET title = 'New Task', priority = 'A', stakeholders = 'Rosa, Bob'"
                todo query "SELECT * FROM tasks.md" --format/-o table
                todo query -o json "SELECT * FROM tasks.md WHERE completed = false"

       lint <file>
              Validate a Markdown task file according to syntax rules.
              
              Checks for proper indentation, valid prefix macros, correct
              key:value format, and other structural requirements.
              
              Exit codes:
                0 - No issues found
                1 - Errors detected
              
              Examples:
                todo lint tasks.md

       help
              Display this help message and exit.

TASK SYNTAX
       Single-line task:
         - [x] A @Alice #urgent "Fix authentication bug" due: 2025-10-01 weight: 10

       Multi-line task:
         - [x] A @Alice #urgent
           title: "Fix authentication bug"  
           due: 2025-10-01
           weight: 10
           description: |
             The login system is failing for users with special
             characters in their passwords.
           notes: |
             Check with security team before deploying.

       Prefix macros (at start of task line):
         [x] or x         - completed: true
         [_]              - completed: false (optional)
         [-] or -         - skipped: true  
         A-D              - priority (A=highest, D=lowest)
         @Name            - adds to stakeholders array
         #tag             - adds to tags array

       Key-value pairs:
         key: value              - Simple scalar value
         key: "quoted value"     - Value with spaces
         key: |                  - Multi-line value (indented content follows)

ORDERING
       The ORDER BY clause supports multiple keys with direction specifiers:
       
       ORDER BY <key1> [ASC|DESC], <key2> [ASC|DESC], ...
       
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
         todo query "SELECT * FROM project.md"

       List all tasks as a table:
         todo query "SELECT * FROM project.md" --format/-o table

       Filter and sort by priority then due date:
         todo query "SELECT * FROM project.md WHERE completed = false ORDER BY priority ASC, due DESC"

       Sort by priority and display as table:
         todo query "SELECT * FROM project.md ORDER BY priority DESC" --format/-o table

       Create a sorted version of the file:
         todo query "SELECT * FROM project.md ORDER BY weight DESC INTO project-sorted.md"

       Update task priority:
         todo query "UPDATE project.md SET priority = 'A' WHERE id = 1"

       Delete completed tasks:
         todo query "DELETE FROM project.md WHERE completed = true"

       Validate task syntax:
         todo lint project.md

       Get help:
         todo help

EXIT STATUS
       0      Success
       1      Error (lint failures, file not found, syntax errors)
`);
}

function printUsageAndExit() {
  console.log(`Usage:
  todo query <sql-query> [--format/-o <json|table>]
  todo lint <file>
  todo help
  
Use 'todo help' for detailed information.`);
  process.exit(1);
}

if (!cmd || argv.help || argv.h) {
  if (!cmd && !argv.query && !argv.q) {
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

// Handle query command
if (cmd === 'query') {
  const queryStr = argv._[1];
  if (!queryStr) {
    console.error('Query string required');
    process.exit(1);
  }
  let parsedQuery;
  try {
    parsedQuery = parseQuery(queryStr);
  } catch (err) {
    console.error(`Query parsing error: ${err.message}`);
    process.exit(1);
  }

  const format = argv.format || argv.o || 'table';
  if (!['json', 'table'].includes(format)) {
    console.error(`Invalid format '${format}'. Supported formats: json, table`);
    process.exit(1);
  }

  const file = parsedQuery.file;
  if (!file) {
    console.error('File required');
    process.exit(1);
  }

  let parsed;
  if (fs.existsSync(file)) {
    // Parse file -> throws on lint errors
    try {
      parsed = parseFileToTree(file, { indentSize: 2, lint: true });
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  } else {
    // For INSERT, allow creating new file
    if (parsedQuery.command !== 'INSERT') {
      console.error('File required and must exist');
      process.exit(1);
    }
    parsed = { tasks: [], lines: [] };
  }
  const rootTasks = parsed.tasks;

  if (parsedQuery.command === 'SELECT') {
    // Flatten tasks for query/sort
    let flat = collectTasks(rootTasks);

    // Apply ORDER BY
    if (parsedQuery.orderBy) {
      multiKeySort(flat, parsedQuery.orderBy);
    }

    let flatData = flat.map(n => ({
      id: n.id,
      parent: n.parent ?? null,
      ...n.data
    }));

    // Apply WHERE filter
    if (parsedQuery.where) {
      flatData = flatData.filter(task => evaluateWhere(task, parsedQuery.where));
    }

    // Apply LIMIT
    if (parsedQuery.limit) {
      flatData = flatData.slice(0, parsedQuery.limit);
    }

    // Apply field selection
    if (parsedQuery.fields && parsedQuery.fields[0] !== '*') {
      flatData = flatData.map(task => {
        const selected = { id: task.id, parent: task.parent };
        parsedQuery.fields.forEach(field => {
          if (task[field] !== undefined) selected[field] = task[field];
        });
        return selected;
      });
    }

    if (parsedQuery.into) {
      // Write to file, similar to before
      const idToNode = new Map();
      function mapNodes(nodes) {
        for (const n of nodes) { idToNode.set(n.id, n); if (n.children) mapNodes(n.children); }
      }
      mapNodes(rootTasks);

      const parentGroups = new Map();
      for (const n of flat) {
        const pid = n.parent ?? '__root';
        if (!parentGroups.has(pid)) parentGroups.set(pid, []);
        parentGroups.get(pid).push(n);
      }

      function buildTreeForParent(parentId) {
        const arr = [];
        const group = parentGroups.get(parentId) || [];
        for (const entry of group) {
          const node = idToNode.get(entry.id) || entry;
          node.children = buildTreeForParent(node.id);
          arr.push(node);
        }
        return arr;
      }
      const newRoot = buildTreeForParent('__root');

      const outTaskLines = serializeTasksToLines(newRoot, { indentSize: 2 });
      const targetPath = parsedQuery.into;
      let targetLines = [];
      if (fs.existsSync(file) && targetPath === file) targetLines = parsed.lines;
      else if (fs.existsSync(targetPath)) targetLines = loadFileLines(targetPath);
      else targetLines = loadFileLines(file);

      const replaced = replaceTodoSection(targetLines, outTaskLines);
      fs.writeFileSync(targetPath, replaced.join('\n'), 'utf8');
      console.log(`Saved tasks into ${targetPath}`);
      process.exit(0);
    } else {
      // Output to stdout
      if (format === 'table') {
        console.log(formatAsTable(flatData));
      } else {
        console.log(JSON.stringify(flatData, null, 2));
      }
      process.exit(0);
    }
  } else if (parsedQuery.command === 'UPDATE') {
    // For UPDATE, modify tasks in memory and write back
    let flat = collectTasks(rootTasks);
    let updatedCount = 0;

    // Validate assignments before applying them
    parsedQuery.set.forEach(assignment => {
      if (assignment.key === 'tags') {
        const value = processEscapeSequences(assignment.value);
        const tags = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        for (const tag of tags) {
          if (!validateTagName(tag)) {
            console.error(`Error: Invalid tag name '${tag}'. Tags may only contain letters, numbers, hyphens, and underscores. No spaces or # symbols are allowed.`);
            process.exit(1);
          }
        }
      }
      if (assignment.key === 'stakeholders') {
        const value = processEscapeSequences(assignment.value);
        const stakeholders = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        for (const stakeholder of stakeholders) {
          if (!validateStakeholderName(stakeholder)) {
            console.error(`Error: Invalid stakeholder name '${stakeholder}'. Stakeholders may only contain letters, numbers, hyphens, and underscores. No spaces or @ symbols are allowed.`);
            process.exit(1);
          }
        }
      }
    });

    flat.forEach(task => {
      if (evaluateWhere(task, parsedQuery.where)) {
        // Apply SET assignments
        parsedQuery.set.forEach(assignment => {
          const value = processEscapeSequences(assignment.value);
          if (assignment.key === 'stakeholders' || assignment.key === 'tags') {
            // Convert comma-separated string to array
            task.data[assignment.key] = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
          } else {
            // Convert boolean strings to actual booleans
            let convertedValue = value;
            if (value === 'true') convertedValue = true;
            else if (value === 'false') convertedValue = false;
            else if (!isNaN(value) && value !== '') convertedValue = Number(value);
            task.data[assignment.key] = convertedValue;
          }
        });
        updatedCount++;
      }
    });

    // Write back to file
    const idToNode = new Map();
    function mapNodes(nodes) {
      for (const n of nodes) { idToNode.set(n.id, n); if (n.children) mapNodes(n.children); }
    }
    mapNodes(rootTasks);

    const outTaskLines = serializeTasksToLines(rootTasks, { indentSize: 2 });
    const replaced = replaceTodoSection(parsed.lines, outTaskLines);
    fs.writeFileSync(file, replaced.join('\n'), 'utf8');
    console.log(`Updated ${updatedCount} tasks in ${file}`);
    process.exit(0);
  } else if (parsedQuery.command === 'DELETE') {
    // For DELETE, remove tasks and write back
    let flat = collectTasks(rootTasks);
    const toDelete = new Set();

    flat.forEach(task => {
      if (evaluateWhere(task, parsedQuery.where)) {
        toDelete.add(task.id);
      }
    });

    // Remove from tree
    function removeFromTree(nodes) {
      return nodes.filter(node => {
        if (toDelete.has(node.id)) return false;
        if (node.children) node.children = removeFromTree(node.children);
        return true;
      });
    }

    const newRoot = removeFromTree(rootTasks);
    const outTaskLines = serializeTasksToLines(newRoot, { indentSize: 2 });
    const replaced = replaceTodoSection(parsed.lines, outTaskLines);
    fs.writeFileSync(file, replaced.join('\n'), 'utf8');
    console.log(`Deleted ${toDelete.size} tasks from ${file}`);
    process.exit(0);
  } else if (parsedQuery.command === 'INSERT') {
    // Create new task
    const newNode = {
      data: {},
      children: [],
      indent: 0,
      inline: 'dummy'
    };

    // Apply SET assignments with validation
    parsedQuery.set.forEach(assignment => {
      const value = processEscapeSequences(assignment.value);
      if (assignment.key === 'stakeholders' || assignment.key === 'tags') {
        // Convert comma-separated string to array
        const items = value.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // Validate tags
        if (assignment.key === 'tags') {
          for (const tag of items) {
            if (!validateTagName(tag)) {
              console.error(`Error: Invalid tag name '${tag}'. Tags may only contain letters, numbers, hyphens, and underscores. No spaces or special characters are allowed.`);
              process.exit(1);
            }
          }
        }

        // Validate stakeholders
        if (assignment.key === 'stakeholders') {
          for (const stakeholder of items) {
            if (!validateStakeholderName(stakeholder)) {
              console.error(`Error: Invalid stakeholder name '${stakeholder}'. Stakeholders may only contain letters, numbers, hyphens, and underscores. No spaces or @ symbols are allowed.`);
              process.exit(1);
            }
          }
        }

        newNode.data[assignment.key] = items;
      } else {
        // Convert boolean strings to actual booleans
        let convertedValue = value;
        if (value === 'true') convertedValue = true;
        else if (value === 'false') convertedValue = false;
        else if (!isNaN(value) && value !== '') convertedValue = Number(value);
        newNode.data[assignment.key] = convertedValue;
      }
    });

    // Compute ID
    ensureIdOnNode(newNode);

    // Add to root tasks
    rootTasks.push(newNode);

    // Write back to file
    const outTaskLines = serializeTasksToLines(rootTasks, { indentSize: 2 });
    const replaced = replaceTodoSection(parsed.lines, outTaskLines);
    fs.writeFileSync(file, replaced.join('\n'), 'utf8');
    console.log(`Inserted task ${newNode.id} into ${file}`);
    process.exit(0);
  }
}

// Legacy select command for backward compatibility
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
