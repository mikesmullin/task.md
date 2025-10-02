// linter.js
// Validate a Markdown task file according to the Version Three language rules.

/**
 * Error codes for task.md linting
 */
const ERROR_CODES = {
  // Quote-related errors
  UNCLOSED_DOUBLE_QUOTE: 'TD001',
  UNCLOSED_SINGLE_QUOTE: 'TD002',
  UNCLOSED_BACKTICK_QUOTE: 'TD003',

  // Prefix/token placement errors
  MISPLACED_ASSIGNEE: 'TD010',
  MISPLACED_TAG: 'TD011',
  MISPLACED_PRIORITY: 'TD012',

  // Content structure errors
  UNQUOTED_TITLE_WITH_KV: 'TD020',
  VALUES_WITHOUT_KEYS: 'TD021',

  // Indentation errors
  INVALID_INDENTATION: 'TD030',
  BULLET_MISSING_CONTENT: 'TD031',
  INVALID_HIERARCHY: 'TD032',
  LARGE_INDENT_JUMP: 'TD033',

  // Multi-line content errors
  MULTILINE_WITHOUT_PIPE: 'TD040',
  INVALID_MULTILINE_CONTENT: 'TD041',
  MULTILINE_NO_CONTENT: 'TD042',

  // Duplicate/unique constraint errors
  DUPLICATE_ID: 'TD050',

  // Value formatting warnings
  UNQUOTED_SPACED_VALUE: 'TD100'
};

/**
 * Error code descriptions and help URLs
 */
const ERROR_INFO = {
  [ERROR_CODES.UNCLOSED_DOUBLE_QUOTE]: {
    description: 'Double quote is not properly closed',
    helpUrl: 'https://github.com/mikesmullin/task.md#quotes'
  },
  [ERROR_CODES.UNCLOSED_SINGLE_QUOTE]: {
    description: 'Single quote is not properly closed',
    helpUrl: 'https://github.com/mikesmullin/task.md#quotes'
  },
  [ERROR_CODES.UNCLOSED_BACKTICK_QUOTE]: {
    description: 'Backtick quote is not properly closed',
    helpUrl: 'https://github.com/mikesmullin/task.md#quotes'
  },
  [ERROR_CODES.MISPLACED_ASSIGNEE]: {
    description: '@assignee tags must appear at the beginning of task prefix',
    helpUrl: 'https://github.com/mikesmullin/task.md#assignees'
  },
  [ERROR_CODES.MISPLACED_TAG]: {
    description: '#tags must appear at the beginning of task prefix',
    helpUrl: 'https://github.com/mikesmullin/task.md#tags'
  },
  [ERROR_CODES.MISPLACED_PRIORITY]: {
    description: 'Priority shorthand (A-D, x, -) must appear at the beginning of task prefix',
    helpUrl: 'https://github.com/mikesmullin/task.md#priorities'
  },
  [ERROR_CODES.UNQUOTED_TITLE_WITH_KV]: {
    description: 'Unquoted strings followed by key:value pairs need to be quoted',
    helpUrl: 'https://github.com/mikesmullin/task.md#titles'
  },
  [ERROR_CODES.VALUES_WITHOUT_KEYS]: {
    description: 'Values without keys are not allowed outside of task prefix',
    helpUrl: 'https://github.com/mikesmullin/task.md#key-value-pairs'
  },
  [ERROR_CODES.INVALID_INDENTATION]: {
    description: 'Indentation must be a multiple of the configured indent size',
    helpUrl: 'https://github.com/mikesmullin/task.md#indentation'
  },
  [ERROR_CODES.BULLET_MISSING_CONTENT]: {
    description: 'Bullet lines must have content after the dash',
    helpUrl: 'https://github.com/mikesmullin/task.md#bullets'
  },
  [ERROR_CODES.INVALID_HIERARCHY]: {
    description: 'Child tasks must have a proper parent task at the correct indentation level',
    helpUrl: 'https://github.com/mikesmullin/task.md#hierarchy'
  },
  [ERROR_CODES.LARGE_INDENT_JUMP]: {
    description: 'Indentation should increase by the configured indent size',
    helpUrl: 'https://github.com/mikesmullin/task.md#indentation'
  },
  [ERROR_CODES.MULTILINE_WITHOUT_PIPE]: {
    description: 'Multi-line content requires a pipe (|) after the key',
    helpUrl: 'https://github.com/mikesmullin/task.md#multiline-content'
  },
  [ERROR_CODES.INVALID_MULTILINE_CONTENT]: {
    description: 'Invalid multi-line content structure',
    helpUrl: 'https://github.com/mikesmullin/task.md#multiline-content'
  },
  [ERROR_CODES.MULTILINE_NO_CONTENT]: {
    description: 'Multi-line blocks with pipe (|) must have indented content',
    helpUrl: 'https://github.com/mikesmullin/task.md#multiline-content'
  },
  [ERROR_CODES.DUPLICATE_ID]: {
    description: 'Task IDs must be unique within the document',
    helpUrl: 'https://github.com/mikesmullin/task.md#ids'
  },
  [ERROR_CODES.UNQUOTED_SPACED_VALUE]: {
    description: 'Values with spaces should be quoted for clarity',
    helpUrl: 'https://github.com/mikesmullin/task.md#quotes'
  }
};

function lintLines(lines, opts = { indentSize: 2 }) {
  const errors = [];
  const warnings = [];
  const indentSize = opts.indentSize || 2;
  const idSet = new Set();

  const stack = []; // track indent levels and last bullet indent
  let insideMultilineBlock = null; // track when we're inside a multiline block { startLine, baseIndent, endIndent }

  function pushError(lineNo, msg, startChar = 0, endChar = null, code = null) {
    errors.push({
      line: lineNo + 1,
      msg,
      startChar,
      endChar: endChar !== null ? endChar : (lines[lineNo] ? lines[lineNo].length : 0),
      code
    });
  }
  function pushWarn(lineNo, msg, startChar = 0, endChar = null, code = null) {
    warnings.push({
      line: lineNo + 1,
      msg,
      startChar,
      endChar: endChar !== null ? endChar : (lines[lineNo] ? lines[lineNo].length : 0),
      code
    });
  }

  // Helper function to validate quote/backtick matching
  function validateQuotes(text, lineNo, lineOffset = 0) {
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let inBacktick = false;
    let escapeNext = false;
    let lastDoubleQuotePos = -1;
    let lastSingleQuotePos = -1;
    let lastBacktickPos = -1;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !inSingleQuote && !inBacktick) {
        if (inDoubleQuote) {
          inDoubleQuote = false;
        } else {
          inDoubleQuote = true;
          lastDoubleQuotePos = lineOffset + i;
        }
      } else if (char === "'" && !inDoubleQuote && !inBacktick) {
        if (inSingleQuote) {
          inSingleQuote = false;
        } else {
          inSingleQuote = true;
          lastSingleQuotePos = lineOffset + i;
        }
      } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
        if (inBacktick) {
          inBacktick = false;
        } else {
          inBacktick = true;
          lastBacktickPos = lineOffset + i;
        }
      }
    }

    if (inDoubleQuote) {
      pushError(lineNo, 'Unclosed double quote', lastDoubleQuotePos, lastDoubleQuotePos + 1, ERROR_CODES.UNCLOSED_DOUBLE_QUOTE);
    }
    if (inSingleQuote) {
      pushError(lineNo, 'Unclosed single quote', lastSingleQuotePos, lastSingleQuotePos + 1, ERROR_CODES.UNCLOSED_SINGLE_QUOTE);
    }
    if (inBacktick) {
      pushError(lineNo, 'Unclosed backtick quote', lastBacktickPos, lastBacktickPos + 1, ERROR_CODES.UNCLOSED_BACKTICK_QUOTE);
    }
  }

  // Helper function to parse and validate bullet line content
  function validateBulletLine(content, lineNo, lineOffset = 0) {
    // Check for quote/backtick matching
    validateQuotes(content, lineNo, lineOffset);

    // Simple validation for misplaced prefix tokens and unquoted titles before key:value pairs
    // Split by spaces but respect quotes
    const tokens = [];
    let current = '';
    let currentStart = 0;
    let inQuote = false;
    let quoteChar = '';
    let escapeNext = false;

    // Tokenize respecting quotes and track positions
    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        current += char;
        continue;
      }

      if (!inQuote && (char === '"' || char === '`' || char === "'")) {
        inQuote = true;
        quoteChar = char;
        current += char;
      } else if (inQuote && char === quoteChar) {
        inQuote = false;
        current += char;
        quoteChar = '';
      } else if (!inQuote && /\s/.test(char)) {
        if (current.trim()) {
          tokens.push({
            text: current.trim(),
            start: lineOffset + currentStart,
            end: lineOffset + i
          });
          current = '';
        }
        // Skip whitespace to find start of next token
        while (i + 1 < content.length && /\s/.test(content[i + 1])) {
          i++;
        }
        currentStart = i + 1;
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      tokens.push({
        text: current.trim(),
        start: lineOffset + currentStart,
        end: lineOffset + content.length
      });
    }

    // Find the boundary between prefixes and content
    let prefixEnd = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const isPrefix = /^[A-Dx\-]$/.test(token.text) || token.text.startsWith('@') || token.text.startsWith('#');
      if (isPrefix) {
        prefixEnd = i + 1;
      } else {
        break;
      }
    }

    // Check for misplaced prefix tokens after the prefix section
    for (let i = prefixEnd; i < tokens.length; i++) {
      const token = tokens[i];

      // Skip quoted strings and key:value pairs
      const isQuoted = (token.text.startsWith('"') && token.text.endsWith('"')) ||
        (token.text.startsWith('`') && token.text.endsWith('`')) ||
        (token.text.startsWith("'") && token.text.endsWith("'"));
      const isKeyValue = token.text.match(/^[A-Za-z_][A-Za-z0-9_-]*:/);

      if (isQuoted || isKeyValue) {
        continue;
      }

      // Check for misplaced prefix tokens
      if (token.text.startsWith('@')) {
        pushError(lineNo, '@assignee tags are only allowed at beginning task prefix', token.start, token.end, ERROR_CODES.MISPLACED_ASSIGNEE);
      } else if (token.text.startsWith('#')) {
        pushError(lineNo, '#tags are only allowed at beginning task prefix', token.start, token.end, ERROR_CODES.MISPLACED_TAG);
      } else if (/^[A-Dx\-]$/.test(token.text)) {
        // Only flag single-letter priority tokens that are clearly misplaced
        // Don't flag them if they appear as values in key:value pairs
        const prevToken = i > 0 ? tokens[i - 1] : null;
        const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;

        // If this looks like it's a value for a previous key, don't flag it
        if (!(prevToken && prevToken.text.endsWith(':')) && !(nextToken && nextToken.text.startsWith(':'))) {
          pushError(lineNo, 'priority shorthand are only allowed at beginning task prefix', token.start, token.end, ERROR_CODES.MISPLACED_PRIORITY);
        }
      }
    }

    // Check for unquoted title followed by key:value pairs OR bare values in wrong places
    let foundTitle = false;
    let inKeyValueSection = false;

    for (let i = prefixEnd; i < tokens.length; i++) {
      const token = tokens[i];
      const isQuoted = (token.text.startsWith('"') && token.text.endsWith('"')) ||
        (token.text.startsWith('`') && token.text.endsWith('`')) ||
        (token.text.startsWith("'") && token.text.endsWith("'"));
      const isKeyValue = token.text.match(/^[A-Za-z_][A-Za-z0-9_-]*:/);

      if (isKeyValue) {
        inKeyValueSection = true;
        continue;
      }

      if (isQuoted) {
        foundTitle = true;
        continue;
      }

      // This is an unquoted token
      if (!foundTitle && !inKeyValueSection) {
        // This could be an unquoted title, check if there are key:value pairs after it
        const remainingTokens = tokens.slice(i + 1);
        const hasKVAfter = remainingTokens.some(t => t.text.match(/^[A-Za-z_][A-Za-z0-9_-]*:/));

        if (hasKVAfter) {
          pushError(lineNo, 'strings need to be quoted or the remainder of the line will be assumed to be the task title', 0, 0, ERROR_CODES.UNQUOTED_TITLE_WITH_KV);
        }
        foundTitle = true; // This becomes the title
      } else if (foundTitle && !inKeyValueSection) {
        // We already have a title, but this is another unquoted token before key:value section
        const remainingTokens = tokens.slice(i + 1);
        const hasKVAfter = remainingTokens.some(t => t.text.match(/^[A-Za-z_][A-Za-z0-9_-]*:/));

        if (hasKVAfter) {
          pushError(lineNo, `values without keys are not allowed (except in task prefix shorthand): ${token.text}`, 0, 0, ERROR_CODES.VALUES_WITHOUT_KEYS);
        }
      }
    }
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
      if (indent % indentSize !== 0) pushError(i, `Indentation ${indent} not multiple of ${indentSize} spaces`, indent, indent + 1, ERROR_CODES.INVALID_INDENTATION);
      const afterDash = trimmed.slice(1).trim();
      if (afterDash === '') pushError(i, 'Bullet line missing content', trimmed.length - 1, trimmed.length, ERROR_CODES.BULLET_MISSING_CONTENT);

      // Calculate offset of content after bullet and spaces
      const bulletOffset = indent + line.indexOf('-') + 1;
      const contentOffset = bulletOffset + (trimmed.slice(1).length - afterDash.length);

      // Validate bullet line content with enhanced checks
      validateBulletLine(afterDash, i, contentOffset);

      // push stack frame: ensure nesting doesn't skip levels
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      if (stack.length) {
        const parentIndent = stack[stack.length - 1].indent;
        if (indent - parentIndent > indentSize && indent - parentIndent !== indentSize) {
          // allowed: exactly indentSize deeper; otherwise warn
          pushWarn(i, `Indentation jumped by ${indent - parentIndent} spaces (expected ${indentSize})`, 0, 0, ERROR_CODES.LARGE_INDENT_JUMP);
        }
      } else {
        // This is a root-level bullet, check if it should be indented (child without parent)
        if (indent > 0) {
          pushError(i, 'bullet hierarchy is not indented correctly; child exists without parent', 0, 0, ERROR_CODES.INVALID_HIERARCHY);
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
        // This line doesn't match key:value format
        // Check if we're inside a multiline block (which is allowed)
        if (insideMultilineBlock) {
          // This is continuation of multiline content, which is fine
          continue;
        } else {
          // Check if this looks like orphaned content that should have used pipe
          // This heuristic: if the line has content and there are more indented lines following,
          // it might be multi-line content without proper pipe syntax
          let looksLikeMultilineContent = false;
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].replace(/\t/g, '  ');
            const nextTrimmed = nextLine.trim();
            const nextIndent = nextLine.match(/^(\s*)/)[1].length;

            if (nextTrimmed === '') continue;
            if (nextTrimmed.startsWith('-')) break;
            if (nextIndent <= indent) break;
            if (nextIndent > indent) {
              looksLikeMultilineContent = true;
              break;
            }
          }

          if (looksLikeMultilineContent) {
            pushError(i, 'multi-line string value indentation without pipe; unexpected lines appearing indented within task', 0, 0, ERROR_CODES.MULTILINE_WITHOUT_PIPE);
          } else {
            pushError(i, 'Expected key: value or multi-line content indented under key with |', 0, 0, ERROR_CODES.INVALID_MULTILINE_CONTENT);
          }
        }
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
        if (!foundContent) pushError(i, `Multi-line '|' for key '${key}' has no indented content`, 0, 0, ERROR_CODES.MULTILINE_NO_CONTENT);
        // Mark that we're entering a multiline block
        insideMultilineBlock = { baseIndent, startLine: i };
      } else if (value.trim() === '') {
        // Key with no value - check if there's indented content following (should use pipe)
        const baseIndent = indent;
        let j = i + 1;
        let foundIndentedContent = false;
        while (j < lines.length) {
          const nxt = lines[j].replace(/\t/g, '  ');
          const nxtTrim = nxt.trim();
          const nxtIndent = nxt.match(/^(\s*)/)[1].length;
          if (nxtTrim === '') { j++; continue; }
          // if next non-empty line is a bullet or has indent <= baseIndent => block ended
          if (nxtTrim.startsWith('-') && nxtIndent <= baseIndent) break;
          if (nxtIndent <= baseIndent) break;
          foundIndentedContent = true;
          break;
        }
        if (foundIndentedContent) {
          pushError(i, 'multi-line string value indentation without pipe; unexpected lines appearing indented within task', 0, 0, ERROR_CODES.MULTILINE_WITHOUT_PIPE);
          // Set up the multiline block state to skip validation of the following lines
          insideMultilineBlock = { baseIndent, startLine: i };
        }
      } else {
        // ensure keys are valid, values quoted if containing spaces (we allow unquoted dates but still warn)
        const hasSpace = /\s/.test(value);
        const isQuoted = (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith('`') && value.endsWith('`')) ||
          (value.startsWith("'") && value.endsWith("'"));
        if (hasSpace && !isQuoted) {
          // allow common date formats like 2025-10-05 (no spaces)
          pushWarn(i, `Unquoted value with spaces for key "${key}" (consider quoting)`, 0, 0, ERROR_CODES.UNQUOTED_SPACED_VALUE);
        }
        // If key is id, check uniqueness
        if (key === 'id' && value) {
          if (idSet.has(value)) pushError(i, `Duplicate id '${value}'`, 0, 0, ERROR_CODES.DUPLICATE_ID);
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

// Support both CommonJS and ES module imports
export { lintLines, ERROR_CODES, ERROR_INFO };

// CommonJS export for VS Code extension compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lintLines, ERROR_CODES, ERROR_INFO };
}
