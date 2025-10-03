// tableFormatter.js
// Utility to format task data as markdown tables with proper alignment

export function formatAsTable(tasks) {
  if (!tasks || tasks.length === 0) {
    return 'No tasks found.';
  }

  // Collect all unique keys from all tasks to determine columns
  const allKeys = new Set();
  tasks.forEach(task => {
    Object.keys(task).forEach(key => allKeys.add(key));
  });

  // Sort keys to have a consistent column order, with common ones first
  const commonKeys = ['id', 'parent', 'title', 'priority', 'stakeholders', 'completed', 'skipped', 'due', 'weight'];
  const sortedKeys = [
    ...commonKeys.filter(key => allKeys.has(key)),
    ...Array.from(allKeys).filter(key => !commonKeys.includes(key)).sort()
  ];

  // Process all data first to calculate column widths
  const processedData = tasks.map(task => {
    const row = {};
    sortedKeys.forEach(key => {
      const value = task[key];
      if (value === null || value === undefined) {
        row[key] = '';
      } else if (Array.isArray(value)) {
        row[key] = value.join(', ');
      } else if (typeof value === 'string' && value.includes('\n')) {
        // Handle multi-line strings - replace newlines with spaces
        row[key] = value.replace(/\n/g, ' ').trim();
      } else if (typeof value === 'boolean') {
        // Use emoji for booleans
        row[key] = value ? '✅' : '';
      } else {
        // Escape pipe characters in values to avoid breaking table format
        row[key] = String(value).replace(/\|/g, '\\|');
      }
    });
    return row;
  });

  // Calculate maximum width for each column
  const columnWidths = {};
  sortedKeys.forEach(key => {
    // Start with header width
    columnWidths[key] = key.length;
    // Check all data rows
    processedData.forEach(row => {
      const cellValue = String(row[key] || '');
      // Calculate display width accounting for emoji
      const displayWidth = getDisplayWidth(cellValue);
      if (displayWidth > columnWidths[key]) {
        columnWidths[key] = displayWidth;
      }
    });
    // Minimum width of 3 for readability
    columnWidths[key] = Math.max(columnWidths[key], 3);
  });

  // Helper function to calculate display width accounting for emoji
  function getDisplayWidth(str) {
    // Common emoji characters that take up 2 display units
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✅|❌|⭐|🔥/gu;
    const emojiCount = (str.match(emojiRegex) || []).length;
    // Each emoji takes 2 display units but is counted as 1 character in str.length
    // So we add the extra display width
    return str.length + emojiCount;
  }

  // Create header row with proper padding
  const header = '| ' + sortedKeys.map(key =>
    key.padEnd(columnWidths[key])
  ).join(' | ') + ' |';

  // Create separator row
  const separator = '| ' + sortedKeys.map(key =>
    '-'.repeat(columnWidths[key])
  ).join(' | ') + ' |';

  // Create data rows with proper padding accounting for emoji
  const rows = processedData.map(row => {
    const values = sortedKeys.map(key => {
      const value = row[key] || '';
      const str = String(value);
      const displayWidth = getDisplayWidth(str);
      const paddingNeeded = columnWidths[key] - displayWidth;
      return str + ' '.repeat(Math.max(0, paddingNeeded));
    });

    return '| ' + values.join(' | ') + ' |';
  });

  return [header, separator, ...rows].join('\n');
}