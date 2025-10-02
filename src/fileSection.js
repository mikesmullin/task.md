// fileSection.js
// Helpers to find/replace the ## TODO section in a markdown file.

export function replaceTodoSection(lines, taskLines) {
  const out = [...lines];
  const todoHeadingIdx = findTodoHeading(lines);
  if (todoHeadingIdx === -1) {
    // append at end with heading and blank line
    if (out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push('## TODO');
    out.push(...taskLines);
    return out;
  } else {
    // find where heading ends (next top-level heading of same or higher level '##' or '#')
    let endIdx = todoHeadingIdx + 1;
    while (endIdx < lines.length) {
      const l = lines[endIdx];
      if (l.trim().match(/^#{1,2}\s+/)) break; // next # or ## heading
      endIdx++;
    }
    // replace lines between todoHeadingIdx+1 .. endIdx-1 with taskLines (ensure a blank line before and after)
    const before = lines.slice(0, todoHeadingIdx + 1);
    const after = lines.slice(endIdx);
    // ensure a blank line after heading
    if (taskLines.length && taskLines[0].trim() !== '') {
      // no-op, taskLines are fine
    }
    const combined = [...before, ...taskLines, '', ...after];
    return combined;
  }
}

function findTodoHeading(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toUpperCase() === '## TODO') return i;
  }
  return -1;
}
