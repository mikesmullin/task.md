// serializer.js
// Serialize the in-memory node tree back to Markdown bullets and ensure ID placement.
// When writing single-line tasks we append id at end of inline; for multi-line, emit id: <id> as last key.

// Helper function to wrap text at specified column width
function wrapText(text, maxWidth) {
  // First split by existing newlines, then wrap each line
  const existingLines = text.split('\n');
  const wrappedLines = [];

  for (const line of existingLines) {
    if (line.length <= maxWidth) {
      wrappedLines.push(line);
    } else {
      const words = line.split(/\s+/);
      let currentLine = '';

      for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) wrappedLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) wrappedLines.push(currentLine);
    }
  }

  return wrappedLines;
}

export function serializeTasksToLines(rootTasks, options = { indentSize: 2 }) {
  const lines = [];

  function writeNode(node, level) {
    const indent = ' '.repeat(level * options.indentSize);
    // Determine if node should use multi-line format
    // Check for long values (>25 chars) excluding title, or existing multi-line content
    const hasLongValues = Object.keys(node.data).some(k => {
      if (k === 'title' || k === 'id' || k === 'tags' || k === 'completed' || k === 'skipped' || k === 'priority' || k === 'stakeholders' || k === 'stakeholder') return false;
      const v = node.data[k];
      return typeof v === 'string' && (v.includes('\n') || v.length > 25);
    });
    const useMultiline = hasLongValues || !node.inline;

    // Build prefix tokens
    const prefixes = [];
    if (node.data.completed === true) prefixes.push('[x]');
    if (node.data.completed === false) prefixes.push('[_]');
    if (node.data.skipped) prefixes.push('[-]');
    if (node.data.priority) prefixes.push(node.data.priority);
    if (node.data.stakeholders) {
      if (Array.isArray(node.data.stakeholders) && node.data.stakeholders.length) {
        prefixes.push(...node.data.stakeholders.map(s => '@' + s));
      }
    }
    if (node.data.tags) {
      if (Array.isArray(node.data.tags) && node.data.tags.length) {
        prefixes.push(...node.data.tags.map(t => '#' + t));
      }
      // Note: if tags is a string from key:value parsing, it will be handled as regular key:value below
    }
    if (node.data.stakeholder) prefixes.push('@' + node.data.stakeholder);

    if (!useMultiline) {
      // single-line
      const parts = [];
      if (prefixes.length) parts.push(...prefixes);
      // prefer the first quoted string title if present
      if (node.data.title) {
        // if title contains spaces or quotes, use backtick if it contains double-quotes
        const title = node.data.title;
        const q = title.includes('"') ? '`' : '"';
        parts.push(`${q}${title}${q}`);
      }
      // include other inline key: value pairs excluding known prefix fields and long values
      for (const [k, v] of Object.entries(node.data)) {
        if (['completed', 'skipped', 'priority', 'stakeholders', 'stakeholder', 'tags', 'title', 'id'].includes(k)) continue;
        // skip multi-line values and long values (>25 chars)
        if (typeof v === 'string' && (v.includes('\n') || v.length > 25)) continue;
        const sval = typeof v === 'string' && /\s/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : String(v);
        parts.push(`${k}: ${sval}`);
      }
      // id should appear at end of line
      if (node.data.id) parts.push(`id: ${node.data.id}`);
      lines.push(indent + '- ' + parts.join(' '));
    } else {
      // multiline block
      const firstParts = [];
      if (prefixes.length) firstParts.push(...prefixes);
      // Include title inline if present
      if (node.data.title) {
        const title = node.data.title;
        const q = title.includes('"') ? '`' : '"';
        firstParts.push(`${q}${title}${q}`);
      }
      // Include id inline if present
      if (node.data.id) firstParts.push(`id: ${node.data.id}`);
      lines.push(indent + '- ' + firstParts.join(' '));

      // Emit other fields (except children)
      for (const [k, v] of Object.entries(node.data)) {
        if (['title', 'id'].includes(k)) continue;
        if (k === 'tags' && Array.isArray(v) && v.length) {
          // emit tags as repeated #tag prefix style? Simpler: emit tags: "a,b"
          lines.push(indent + ' '.repeat(options.indentSize) + `tags: "${v.join(',')}"`);
          continue;
        }
        if (k === 'stakeholders' && Array.isArray(v) && v.length) {
          // emit stakeholders as stakeholders: "a,b"
          lines.push(indent + ' '.repeat(options.indentSize) + `stakeholders: "${v.join(',')}"`);
          continue;
        }
        if (k === 'stakeholder') continue; // handled as prefix
        if (typeof v === 'string' && (v.includes('\n') || v.length > 25)) {
          // Use pipe format for long strings and wrap at 80 chars
          lines.push(indent + ' '.repeat(options.indentSize) + `${k}: |`);
          const wrappedLines = wrapText(v, 80);
          for (const line of wrappedLines) {
            lines.push(indent + ' '.repeat(options.indentSize * 2) + line);
          }
        } else {
          // simple scalar
          const sval = typeof v === 'string' && /\s/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : String(v);
          lines.push(indent + ' '.repeat(options.indentSize) + `${k}: ${sval}`);
        }
      }
    }

    // children
    if (node.children && node.children.length) {
      for (const c of node.children) writeNode(c, level + 1);
    }
  }

  for (const t of rootTasks) writeNode(t, 0);
  return lines;
}
