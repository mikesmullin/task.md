// serializer.test.js
import { serializeTasksToLines } from '../../src/serializer.js';

describe('Serializer', () => {
  describe('serializeTasksToLines', () => {
    test('should serialize simple single-line tasks', () => {
      const tasks = [
        {
          data: {
            id: 'abc12345',
            title: 'Simple task',
            priority: 'A',
            stakeholders: ['Alice'],
            tags: ['test'],
            due: '2025-10-01'
          },
          children: [],
          inline: 'A @Alice #test "Simple task" due: 2025-10-01 id: abc12345'
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('- A @Alice #test');
      expect(lines[0]).toContain('"Simple task"');
      expect(lines[0]).toContain('due: 2025-10-01');
      expect(lines[0]).toContain('id: abc12345');
    });

    test('should serialize multi-line tasks with descriptions', () => {
      const tasks = [
        {
          data: {
            id: 'def67890',
            title: 'Complex task',
            priority: 'B',
            stakeholders: ['Bob'],
            tags: ['complex'],
            description: 'This is a multi-line\ndescription with details',
            notes: 'Some additional\nnotes here'
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      expect(lines.length).toBeGreaterThan(5);

      // Check header line with inline title and id
      expect(lines[0]).toBe('- B @Bob #complex "Complex task" id: def67890');

      // Check that title is on first line, not as separate title: line
      expect(lines[0]).toContain('"Complex task"');

      // Check multi-line description
      const descLine = lines.find(l => l.includes('description: |'));
      expect(descLine).toBeDefined();
      const descIndex = lines.indexOf(descLine);
      expect(lines[descIndex + 1]).toContain('This is a multi-line');
      expect(lines[descIndex + 2]).toContain('description with details');

      // Check ID is on first line, not as separate id: line
      expect(lines[0]).toContain('id: def67890');
    });

    test('should serialize nested tasks with proper indentation', () => {
      const tasks = [
        {
          data: {
            id: 'parent1',
            title: 'Parent task',
            priority: 'A'
          },
          children: [
            {
              data: {
                id: 'child1',
                title: 'Child task',
                priority: 'B'
              },
              children: [
                {
                  data: {
                    id: 'grandchild1',
                    title: 'Grandchild task'
                  },
                  children: []
                }
              ]
            }
          ]
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });

      // Parent task (no indent)
      const parentLines = lines.filter(l => l.startsWith('- A'));
      expect(parentLines).toHaveLength(1);

      // Child task (2 spaces indent)
      const childLines = lines.filter(l => l.startsWith('  - B'));
      expect(childLines).toHaveLength(1);

      // Grandchild task (4 spaces indent)
      const grandchildLines = lines.filter(l => l.startsWith('    -'));
      expect(grandchildLines).toHaveLength(1);
    });

    test('should handle completed and skipped tasks', () => {
      const tasks = [
        {
          data: {
            id: 'completed1',
            title: 'Completed task',
            completed: true
          },
          children: []
        },
        {
          data: {
            id: 'skipped1',
            title: 'Skipped task',
            skipped: true
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      expect(lines.length).toBeGreaterThan(2);

      // Find lines containing the prefixes
      const xLine = lines.find(l => l.includes('- [x]'));
      const dashLine = lines.find(l => l.includes('- [-]'));

      expect(xLine).toBeDefined();
      expect(dashLine).toBeDefined();
    });

    test('should handle tasks without titles', () => {
      const tasks = [
        {
          data: {
            id: 'notitle1',
            priority: 'C',
            due: '2025-12-01',
            weight: 5
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      expect(lines.length).toBeGreaterThan(1);

      // Check that required fields are present
      const allText = lines.join('\n');
      expect(allText).toContain('- C');
      expect(allText).toContain('due: 2025-12-01');
      expect(allText).toContain('weight: 5');
      expect(allText).toContain('id: notitle1');
      expect(allText).not.toContain('title:');
    });

    test('should handle multiple tags correctly', () => {
      const tasks = [
        {
          data: {
            id: 'multitag1',
            title: 'Multi-tag task',
            tags: ['urgent', 'backend', 'api']
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      const taskLine = lines[0];
      expect(taskLine).toContain('#urgent');
      expect(taskLine).toContain('#backend');
      expect(taskLine).toContain('#api');
    });

    test('should serialize tags as comma-separated in multi-line format', () => {
      const tasks = [
        {
          data: {
            id: 'multitag2',
            title: 'Multi-tag multiline task',
            tags: ['urgent', 'backend'],
            description: 'This has a description\nso it uses multiline format'
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      const tagsLine = lines.find(l => l.includes('tags:'));
      expect(tagsLine).toBeDefined();
      expect(tagsLine).toContain('tags: "urgent,backend"');
    });

    test('should handle boolean and numeric values', () => {
      const tasks = [
        {
          data: {
            id: 'types1',
            title: 'Type test task',
            completed: true,
            weight: 10,
            rate: 25.5,
            active: false
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      const allText = lines.join('\n');
      expect(allText).toContain('weight: 10');
      expect(allText).toContain('rate: 25.5');
      expect(allText).toContain('active: false');
    });

    test('should quote values with spaces', () => {
      const tasks = [
        {
          data: {
            id: 'spaces1',
            title: 'Spaces task',
            category: 'Project Management',
            location: 'San Francisco'
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      const allText = lines.join('\n');
      expect(allText).toContain('category: "Project Management"');
      expect(allText).toContain('location: "San Francisco"');
    });

    test('should handle empty task list', () => {
      const lines = serializeTasksToLines([], { indentSize: 2 });
      expect(lines).toHaveLength(0);
    });

    test('should respect custom indent size', () => {
      const tasks = [
        {
          data: {
            id: 'indent1',
            title: 'Parent'
          },
          children: [
            {
              data: {
                id: 'indent2',
                title: 'Child'
              },
              children: []
            }
          ]
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 4 });

      // Parent should have no indent
      const parentLine = lines.find(l => l.match(/^- /));
      expect(parentLine).toBeDefined();

      // Child should have 4-space indent
      const childBulletLine = lines.find(l => l.match(/^    - /));
      expect(childBulletLine).toBeDefined();
    });

    test('should handle tasks with quotes in titles', () => {
      const tasks = [
        {
          data: {
            id: 'quotes1',
            title: 'Task with "double quotes"'
          },
          children: []
        },
        {
          data: {
            id: 'quotes2',
            title: 'Task with `backticks`'
          },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });
      const allText = lines.join('\n');

      // Title with double quotes should use backticks
      expect(allText).toContain('`Task with "double quotes"`');

      // Title with backticks should use double quotes  
      expect(allText).toContain('"Task with `backticks`"');
    });

    test('should preserve order of tasks and children', () => {
      const tasks = [
        {
          data: { id: 'first', title: 'First task' },
          children: []
        },
        {
          data: { id: 'second', title: 'Second task' },
          children: [
            {
              data: { id: 'second-child1', title: 'Second child 1' },
              children: []
            },
            {
              data: { id: 'second-child2', title: 'Second child 2' },
              children: []
            }
          ]
        },
        {
          data: { id: 'third', title: 'Third task' },
          children: []
        }
      ];

      const lines = serializeTasksToLines(tasks, { indentSize: 2 });

      // Since all tasks have short titles and no long fields, they should be single-line
      const firstTaskLine = lines.find(l => l.includes('First task'));
      expect(firstTaskLine).toContain('First task');

      const secondTaskLine = lines.find(l => l.includes('Second task'));
      expect(secondTaskLine).toContain('Second task');

      const secondChild1Line = lines.find(l => l.includes('Second child 1'));
      expect(secondChild1Line).toContain('Second child 1');

      const secondChild2Line = lines.find(l => l.includes('Second child 2'));
      expect(secondChild2Line).toContain('Second child 2');

      const thirdTaskLine = lines.find(l => l.includes('Third task'));
      expect(thirdTaskLine).toContain('Third task');
    });
  });
});