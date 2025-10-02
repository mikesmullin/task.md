// linter.js
// Validate a Markdown task file according to the Version Three language rules.

function lintLines(lines, opts = { indentSize: 2 }) {
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

  // Helper function to validate quote/backtick matching
  function validateQuotes(text, lineNo) {
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let inBacktick = false;
    let escapeNext = false;

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
        inDoubleQuote = !inDoubleQuote;
      } else if (char === "'" && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
        inBacktick = !inBacktick;
      }
    }

    if (inDoubleQuote) {
      pushError(lineNo, 'Unclosed double quote');
    }
    if (inSingleQuote) {
      pushError(lineNo, 'Unclosed single quote');
    }
    if (inBacktick) {
      pushError(lineNo, 'Unclosed backtick quote');
    }
  }

  // Helper function to parse and validate bullet line content
  function validateBulletLine(content, lineNo) {
    // Check for quote/backtick matching
    validateQuotes(content, lineNo);

    // Simple validation for misplaced prefix tokens and unquoted titles before key:value pairs
    // Split by spaces but respect quotes
    const tokens = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let escapeNext = false;

    // Tokenize respecting quotes
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
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      tokens.push(current.trim());
    }

    // Find the boundary between prefixes and content
    let prefixEnd = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const isPrefix = /^[A-Dx\-]$/.test(token) || token.startsWith('@') || token.startsWith('#');
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
      const isQuoted = (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith('`') && token.endsWith('`')) ||
        (token.startsWith("'") && token.endsWith("'"));
      const isKeyValue = token.match(/^[A-Za-z_][A-Za-z0-9_-]*:/);

      if (isQuoted || isKeyValue) {
        continue;
      }

      // Check for misplaced prefix tokens
      if (token.startsWith('@')) {
        pushError(lineNo, '@assignee tags are only allowed at beginning task prefix');
      } else if (token.startsWith('#')) {
        pushError(lineNo, '#tags are only allowed at beginning task prefix');
      } else if (/^[A-Dx\-]$/.test(token)) {
        // Only flag single-letter priority tokens that are clearly misplaced
        // Don't flag them if they appear as values in key:value pairs
        const prevToken = i > 0 ? tokens[i - 1] : '';
        const nextToken = i < tokens.length - 1 ? tokens[i + 1] : '';

        // If this looks like it's a value for a previous key, don't flag it
        if (!prevToken.endsWith(':') && !nextToken.startsWith(':')) {
          pushError(lineNo, 'priority shorthand are only allowed at beginning task prefix');
        }
      }
    }

    // Check for unquoted title followed by key:value pairs OR bare values in wrong places
    let foundTitle = false;
    let inKeyValueSection = false;

    for (let i = prefixEnd; i < tokens.length; i++) {
      const token = tokens[i];
      const isQuoted = (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith('`') && token.endsWith('`')) ||
        (token.startsWith("'") && token.endsWith("'"));
      const isKeyValue = token.match(/^[A-Za-z_][A-Za-z0-9_-]*:/);

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
        const hasKVAfter = remainingTokens.some(t => t.match(/^[A-Za-z_][A-Za-z0-9_-]*:/));

        if (hasKVAfter) {
          pushError(lineNo, 'strings need to be quoted or the remainder of the line will be assumed to be the task title');
        }
        foundTitle = true; // This becomes the title
      } else if (foundTitle && !inKeyValueSection) {
        // We already have a title, but this is another unquoted token before key:value section
        const remainingTokens = tokens.slice(i + 1);
        const hasKVAfter = remainingTokens.some(t => t.match(/^[A-Za-z_][A-Za-z0-9_-]*:/));

        if (hasKVAfter) {
          pushError(lineNo, `values without keys are not allowed (except in task prefix shorthand): ${token}`);
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
      if (indent % indentSize !== 0) pushError(i, `Indentation ${indent} not multiple of ${indentSize} spaces`);
      const afterDash = trimmed.slice(1).trim();
      if (afterDash === '') pushError(i, 'Bullet line missing content');

      // Validate bullet line content with enhanced checks
      validateBulletLine(afterDash, i);

      // push stack frame: ensure nesting doesn't skip levels
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      if (stack.length) {
        const parentIndent = stack[stack.length - 1].indent;
        if (indent - parentIndent > indentSize && indent - parentIndent !== indentSize) {
          // allowed: exactly indentSize deeper; otherwise warn
          pushWarn(i, `Indentation jumped by ${indent - parentIndent} spaces (expected ${indentSize})`);
        }
      } else {
        // This is a root-level bullet, check if it should be indented (child without parent)
        if (indent > 0) {
          pushError(i, 'bullet hierarchy is not indented correctly; child exists without parent');
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
            pushError(i, 'multi-line string value indentation without pipe; unexpected lines appearing indented within task');
          } else {
            pushError(i, 'Expected key: value or multi-line content indented under key with |');
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
        if (!foundContent) pushError(i, `Multi-line '|' for key '${key}' has no indented content`);
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
          pushError(i, 'multi-line string value indentation without pipe; unexpected lines appearing indented within task');
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

// Support both CommonJS and ES module imports
export { lintLines };

// CommonJS export for VS Code extension compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lintLines };
}
