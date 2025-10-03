// serializer.js
// Serialize the in-memory node tree back to Markdown bullets and ensure ID placement.
// When writing single-line tasks we append id at end of inline; for multi-line, emit id: <id> as last key.

export function serializeTasksToLines(rootTasks, options = { indentSize: 2 }) {
  const lines = [];

  function writeNode(node, level) {
    const indent = ' '.repeat(level * options.indentSize);
    // Determine if node originally had multi-line keys (node.data keys other than "inline" or simple single-line)
    // We'll choose multi-line format if node.inline is missing or node.data has multi-line fields or keys that are not inline-representable.
    const multiLineKeys = Object.keys(node.data).filter(k => {
      if (k === 'title' && node.inline && node.inline.includes('`')) return false;
      if (k === 'id' || k === 'tags' || k === 'completed' || k === 'skipped' || k === 'priority' || k === 'stakeholder') {
        // small keys we can include inline if desired; but to simplify, allow inline if node.inline exists
      }
      const v = node.data[k];
      if (typeof v === 'string' && v.includes('\n')) return true;
      return false;
    });
    const useMultiline = multiLineKeys.length > 0 || !node.inline;

    // Build prefix tokens
    const prefixes = [];
    if (node.data.completed === true) prefixes.push('[x]');
    if (node.data.completed === false) prefixes.push('[_]');
    if (node.data.skipped) prefixes.push('[-]');
    if (node.data.priority) prefixes.push(node.data.priority);
    if (node.data.stakeholder) prefixes.push('@' + node.data.stakeholder);
    if (node.data.tags) {
      if (Array.isArray(node.data.tags) && node.data.tags.length) {
        prefixes.push(...node.data.tags.map(t => '#' + t));
      }
      // Note: if tags is a string from key:value parsing, it will be handled as regular key:value below
    }

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
      // include other inline key: value pairs excluding known prefix fields
      for (const [k, v] of Object.entries(node.data)) {
        if (['completed', 'skipped', 'priority', 'stakeholder', 'tags', 'title', 'id'].includes(k)) continue;
        // skip multi-line values (none expected here)
        if (typeof v === 'string' && v.includes('\n')) continue;
        const sval = typeof v === 'string' && /\s/.test(v) ? `"${v}"` : String(v);
        parts.push(`${k}: ${sval}`);
      }
      // id should appear at end of line
      if (node.data.id) parts.push(`id: ${node.data.id}`);
      lines.push(indent + '- ' + parts.join(' '));
    } else {
      // multiline block
      const firstParts = [];
      if (prefixes.length) firstParts.push(...prefixes);
      lines.push(indent + '- ' + firstParts.join(' '));
      // Title: prefer explicit title key; we always emit title if present
      if (node.data.title) {
        const title = node.data.title;
        const q = title.includes('"') ? '`' : '"';
        lines.push(indent + ' '.repeat(options.indentSize) + `title: ${q}${title}${q}`);
      }
      // Emit other fields (except children)
      for (const [k, v] of Object.entries(node.data)) {
        if (['title'].includes(k)) continue;
        if (k === 'tags' && Array.isArray(v) && v.length) {
          // emit tags as repeated #tag prefix style? Simpler: emit tags: "a,b"
          lines.push(indent + ' '.repeat(options.indentSize) + `tags: "${v.join(',')}"`);
          continue;
        }
        if (k === 'id') continue; // we'll emit id at end
        if (typeof v === 'string' && v.includes('\n')) {
          lines.push(indent + ' '.repeat(options.indentSize) + `${k}: |`);
          const blockLines = v.split('\n');
          for (const bl of blockLines) {
            lines.push(indent + ' '.repeat(options.indentSize * 2) + bl);
          }
        } else {
          // simple scalar
          const sval = typeof v === 'string' && /\s/.test(v) ? `"${v}"` : String(v);
          lines.push(indent + ' '.repeat(options.indentSize) + `${k}: ${sval}`);
        }
      }
      // Emit id as last key line
      if (node.data.id) {
        lines.push(indent + ' '.repeat(options.indentSize) + `id: ${node.data.id}`);
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
