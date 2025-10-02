// fileSection.test.js
import { replaceTodoSection } from '../../src/fileSection.js';

describe('FileSection', () => {
  describe('replaceTodoSection', () => {
    test('should add TODO section to file without one', () => {
      const originalLines = [
        '# My Project',
        '',
        'This is some content.',
        'More content here.'
      ];

      const taskLines = [
        '- A @Alice "First task"',
        '- B @Bob "Second task"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        'This is some content.',
        'More content here.',
        '',
        '## TODO',
        '- A @Alice "First task"',
        '- B @Bob "Second task"'
      ]);
    });

    test('should replace existing TODO section', () => {
      const originalLines = [
        '# My Project',
        '',
        '## TODO',
        '',
        '- Old task 1',
        '- Old task 2',
        '',
        '## Notes',
        '',
        'Some notes here.'
      ];

      const taskLines = [
        '- A @Alice "New task 1"',
        '- B @Bob "New task 2"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        '## TODO',
        '- A @Alice "New task 1"',
        '- B @Bob "New task 2"',
        '',
        '## Notes',
        '',
        'Some notes here.'
      ]);
    });

    test('should handle TODO section at end of file', () => {
      const originalLines = [
        '# My Project',
        '',
        'Some content.',
        '',
        '## TODO',
        '',
        '- Old task 1',
        '- Old task 2'
      ];

      const taskLines = [
        '- A @Alice "New task 1"',
        '- B @Bob "New task 2"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        'Some content.',
        '',
        '## TODO',
        '- A @Alice "New task 1"',
        '- B @Bob "New task 2"',
        ''
      ]);
    });

    test('should handle empty task list', () => {
      const originalLines = [
        '# My Project',
        '',
        '## TODO',
        '',
        '- Old task 1',
        '- Old task 2'
      ];

      const taskLines = [];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        '## TODO',
        ''
      ]);
    });

    test('should handle case-insensitive TODO heading', () => {
      const originalLines = [
        '# My Project',
        '',
        '## todo',
        '',
        '- Old task 1'
      ];

      const taskLines = [
        '- A @Alice "New task 1"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        '## todo',
        '- A @Alice "New task 1"',
        ''
      ]);
    });

    test('should handle TODO section with multiple subsequent headings', () => {
      const originalLines = [
        '# My Project',
        '',
        '## TODO',
        '',
        '- Old task 1',
        '- Old task 2',
        '',
        '## Notes',
        '',
        'Some notes.',
        '',
        '## References',
        '',
        'Some references.'
      ];

      const taskLines = [
        '- A @Alice "New task 1"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        '## TODO',
        '- A @Alice "New task 1"',
        '',
        '## Notes',
        '',
        'Some notes.',
        '',
        '## References',
        '',
        'Some references.'
      ]);
    });

    test('should handle TODO section followed by top-level heading', () => {
      const originalLines = [
        '# My Project',
        '',
        '## TODO',
        '',
        '- Old task 1',
        '- Old task 2',
        '',
        '# New Section',
        '',
        'New section content.'
      ];

      const taskLines = [
        '- A @Alice "New task 1"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        '## TODO',
        '- A @Alice "New task 1"',
        '',
        '# New Section',
        '',
        'New section content.'
      ]);
    });

    test('should handle file with only TODO section', () => {
      const originalLines = [
        '## TODO',
        '',
        '- Old task 1',
        '- Old task 2'
      ];

      const taskLines = [
        '- A @Alice "New task 1"',
        '- B @Bob "New task 2"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '## TODO',
        '- A @Alice "New task 1"',
        '- B @Bob "New task 2"',
        ''
      ]);
    });

    test('should handle empty file', () => {
      const originalLines = [];

      const taskLines = [
        '- A @Alice "First task"',
        '- B @Bob "Second task"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '## TODO',
        '- A @Alice "First task"',
        '- B @Bob "Second task"'
      ]);
    });

    test('should handle TODO section with mixed content', () => {
      const originalLines = [
        '# My Project',
        '',
        '## TODO',
        '',
        '- Task 1',
        '',
        'Some random text in TODO section',
        '',
        '- Task 2',
        '',
        '## Next Section'
      ];

      const taskLines = [
        '- A @Alice "Clean task 1"',
        '- B @Bob "Clean task 2"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '',
        '## TODO',
        '- A @Alice "Clean task 1"',
        '- B @Bob "Clean task 2"',
        '',
        '## Next Section'
      ]);
    });

    test('should preserve spacing around new TODO section', () => {
      const originalLines = [
        '# My Project',
        '',
        'Content before TODO.',
        'More content.'
      ];

      const taskLines = [
        '- A @Alice "First task"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      // Should add blank line before TODO section
      expect(result).toEqual([
        '# My Project',
        '',
        'Content before TODO.',
        'More content.',
        '',
        '## TODO',
        '- A @Alice "First task"'
      ]);
    });

    test('should handle TODO section with no blank line after heading', () => {
      const originalLines = [
        '# My Project',
        '## TODO',
        '- Old task 1',
        '## Notes'
      ];

      const taskLines = [
        '- A @Alice "New task 1"'
      ];

      const result = replaceTodoSection(originalLines, taskLines);

      expect(result).toEqual([
        '# My Project',
        '## TODO',
        '- A @Alice "New task 1"',
        '',
        '## Notes'
      ]);
    });
  });
});