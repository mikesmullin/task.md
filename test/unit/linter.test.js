// linter.test.js
import { lintLines } from '../../src/linter.js';

describe('Linter', () => {
  describe('lintLines', () => {
    test('should pass valid markdown with no errors', () => {
      const validLines = [
        '# Project',
        '',
        '## TODO',
        '',
        '- A @Alice #planning `Task one` due: 2025-10-01',
        '- B `Task two`',
        '  description: |',
        '    This is a longer description',
        '    with multiple lines'
      ];

      const result = lintLines(validLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should detect indentation errors', () => {
      const badIndentLines = [
        '- Task 1',
        '   - Bad indent task', // 3 spaces instead of 2
        '- Task 2'
      ];

      const result = lintLines(badIndentLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const indentError = result.errors.find(e => e.msg.includes('Indentation'));
      expect(indentError).toBeDefined();
    });

    test('should detect bullet lines missing content', () => {
      const emptyBulletLines = [
        '- Task 1',
        '-', // empty bullet
        '- Task 2'
      ];

      const result = lintLines(emptyBulletLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const contentError = result.errors.find(e => e.msg.includes('missing content'));
      expect(contentError).toBeDefined();
    });

    test('should detect invalid key:value format', () => {
      const invalidKVLines = [
        '- Task 1',
        '  invalidkeyvalue', // missing colon
        '- Task 2'
      ];

      const result = lintLines(invalidKVLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const kvError = result.errors.find(e => e.msg.includes('Expected key: value'));
      expect(kvError).toBeDefined();
    });

    test('should detect multi-line blocks without content', () => {
      const emptyMultilineLines = [
        '- Task 1',
        '  description: |',
        '- Task 2' // no indented content after |
      ];

      const result = lintLines(emptyMultilineLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const multilineError = result.errors.find(e => e.msg.includes('has no indented content'));
      expect(multilineError).toBeDefined();
    });

    test('should warn about unquoted values with spaces', () => {
      const unquotedSpaceLines = [
        '- Task 1',
        '  description: This has spaces but no quotes'
      ];

      const result = lintLines(unquotedSpaceLines, { indentSize: 2 });
      expect(result.warnings.length).toBeGreaterThan(0);

      const spaceWarning = result.warnings.find(w => w.msg.includes('Unquoted value with spaces'));
      expect(spaceWarning).toBeDefined();
    });

    test('should detect duplicate IDs', () => {
      const duplicateIdLines = [
        '- Task 1',
        '  id: abc123',
        '- Task 2',
        '  id: abc123' // duplicate ID
      ];

      const result = lintLines(duplicateIdLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const duplicateError = result.errors.find(e => e.msg.includes('Duplicate id'));
      expect(duplicateError).toBeDefined();
    });

    test('should warn about non-bullet content outside tasks', () => {
      const orphanContentLines = [
        '# Heading',
        'Some random content',
        'orphan text line', // this should not warn anymore since it's general markdown
        '- Task 1'
      ];

      const result = lintLines(orphanContentLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
      // Should not warn about general markdown content anymore
    });

    test('should handle valid multi-line descriptions', () => {
      const validMultilineLines = [
        '- Task 1',
        '  description: |',
        '    Line one of description',
        '    Line two of description',
        '  notes: |',
        '    Some notes here',
        '- Task 2'
      ];

      const result = lintLines(validMultilineLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
    });

    test('should handle nested tasks correctly', () => {
      const nestedTaskLines = [
        '- Parent task',
        '  - Child task',
        '    - Grandchild task',
        '      key: value'
      ];

      const result = lintLines(nestedTaskLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about large indentation jumps', () => {
      const jumpIndentLines = [
        '- Parent task',
        '      - Way too indented child' // 6 spaces instead of 2
      ];

      const result = lintLines(jumpIndentLines, { indentSize: 2 });
      expect(result.warnings.length).toBeGreaterThan(0);

      const jumpWarning = result.warnings.find(w => w.msg.includes('jumped'));
      expect(jumpWarning).toBeDefined();
    });

    test('should handle empty lines correctly', () => {
      const linesWithEmpties = [
        '- Task 1',
        '',
        '  description: |',
        '',
        '    Content with empty line',
        '',
        '    More content',
        '',
        '- Task 2'
      ];

      const result = lintLines(linesWithEmpties, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
    });

    test('should respect custom indent size', () => {
      const fourSpaceIndentLines = [
        '- Task 1',
        '    - Child task', // 4 spaces
        '        key: value' // 8 spaces
      ];

      const result = lintLines(fourSpaceIndentLines, { indentSize: 4 });
      expect(result.errors).toHaveLength(0);
    });

    test('should detect improper indentation with custom indent size', () => {
      const badCustomIndentLines = [
        '- Task 1',
        '   - Bad child task' // 3 spaces with 4-space indent size
      ];

      const result = lintLines(badCustomIndentLines, { indentSize: 4 });
      expect(result.errors.length).toBeGreaterThan(0);

      const indentError = result.errors.find(e => e.msg.includes('not multiple of 4'));
      expect(indentError).toBeDefined();
    });

    test('should handle quoted values correctly', () => {
      const quotedValueLines = [
        '- Task 1',
        '  title: "Quoted title with spaces"',
        '  description: `Backtick quoted description`',
        '  notes: "Valid quoted value"'
      ];

      const result = lintLines(quotedValueLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
      // Should not warn about quoted values even if they have spaces
      const spaceWarnings = result.warnings.filter(w => w.msg.includes('Unquoted value with spaces'));
      expect(spaceWarnings).toHaveLength(0);
    });

    // New tests for enhanced linter features based on training examples

    test('should detect unmatched closing backtick', () => {
      const unmatchedBacktickLines = [
        '- A @Alice #planning Prepare roadmap` due: 2025-10-05 weight: 10'
      ];

      const result = lintLines(unmatchedBacktickLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const quoteError = result.errors.find(e => e.msg.includes('Unclosed'));
      expect(quoteError).toBeDefined();
    });

    test('should detect unclosed backtick', () => {
      const unclosedBacktickLines = [
        '- A @Alice #planning `Prepare roadmap due: 2025-10-05 weight: 10'
      ];

      const result = lintLines(unclosedBacktickLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const quoteError = result.errors.find(e => e.msg.includes('Unclosed backtick'));
      expect(quoteError).toBeDefined();
    });

    test('should detect values without keys', () => {
      const valuesWithoutKeysLines = [
        '- A @Alice #planning `Prepare roadmap` 2025-10-05 weight: 10'
      ];

      const result = lintLines(valuesWithoutKeysLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const valueError = result.errors.find(e => e.msg.includes('values without keys are not allowed'));
      expect(valueError).toBeDefined();
    });

    test('should detect misplaced @assignee tags', () => {
      const misplacedAssigneeLines = [
        '- A #planning `Prepare roadmap` due: 2025-10-05 weight: 10 @Alice'
      ];

      const result = lintLines(misplacedAssigneeLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const assigneeError = result.errors.find(e => e.msg.includes('@assignee tags are only allowed at beginning'));
      expect(assigneeError).toBeDefined();
    });

    test('should detect misplaced #tags', () => {
      const misplacedTagLines = [
        '- A @Alice `Prepare roadmap` due: 2025-10-05 weight: 10 #planning'
      ];

      const result = lintLines(misplacedTagLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const tagError = result.errors.find(e => e.msg.includes('#tags are only allowed at beginning'));
      expect(tagError).toBeDefined();
    });

    test('should detect misplaced priority shorthand', () => {
      const misplacedPriorityLines = [
        '- @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10 A'
      ];

      const result = lintLines(misplacedPriorityLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const priorityError = result.errors.find(e => e.msg.includes('priority shorthand are only allowed at beginning'));
      expect(priorityError).toBeDefined();
    });

    test('should detect unquoted strings followed by key:value pairs', () => {
      const unquotedStringLines = [
        '- A @Alice #planning Prepare roadmap due: 2025-10-05 weight: 10'
      ];

      const result = lintLines(unquotedStringLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const stringError = result.errors.find(e => e.msg.includes('strings need to be quoted'));
      expect(stringError).toBeDefined();
    });

    test('should detect child bullets without proper parent hierarchy', () => {
      const wrongHierarchyLines = [
        '  - A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10',
        '- B #backend `Refactor auth service` effort: 5h'
      ];

      const result = lintLines(wrongHierarchyLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const hierarchyError = result.errors.find(e => e.msg.includes('child exists without parent'));
      expect(hierarchyError).toBeDefined();
    });

    test('should detect multi-line content without pipe', () => {
      const multilineWithoutPipeLines = [
        '- A @Alice #game',
        '  title: `Plan "game engine" features`',
        '  due: 2025-10-05',
        '  weight: 10',
        '  description:',
        '    Plan the architecture for the game engine:',
        '      - ECS system',
        '      - Rendering backend',
        '      - Asset pipeline'
      ];

      const result = lintLines(multilineWithoutPipeLines, { indentSize: 2 });
      expect(result.errors.length).toBeGreaterThan(0);

      const multilineError = result.errors.find(e => e.msg.includes('multi-line string value indentation without pipe'));
      expect(multilineError).toBeDefined();
    });

    test('should accept properly formatted multi-line with pipe', () => {
      const validMultilineLines = [
        '- A @Alice #game',
        '  title: `Plan "game engine" features`',
        '  due: 2025-10-05',
        '  weight: 10',
        '  description: |',
        '    Plan the architecture for the game engine:',
        '      - ECS system',
        '      - Rendering backend',
        '      - Asset pipeline'
      ];

      const result = lintLines(validMultilineLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
    });

    test('should accept valid unquoted title at end of line', () => {
      const validUnquotedTitleLines = [
        '- A @Alice #planning Prepare roadmap'
      ];

      const result = lintLines(validUnquotedTitleLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
    });

    test('should accept valid prefix order', () => {
      const validPrefixLines = [
        '- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10'
      ];

      const result = lintLines(validPrefixLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
    });

    test('should accept proper bullet hierarchy', () => {
      const validHierarchyLines = [
        '- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10',
        '  - B #backend `Refactor auth service` effort: 5h'
      ];

      const result = lintLines(validHierarchyLines, { indentSize: 2 });
      expect(result.errors).toHaveLength(0);
    });
  });
});