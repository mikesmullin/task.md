// utils.test.js
import {
  computeDeterministicId,
  collectTasks,
  resolveIdByPrefix,
  getSortValue,
  multiKeySort
} from '../../src/utils.js';

describe('Utils', () => {
  describe('computeDeterministicId', () => {
    test('should generate consistent IDs for same input', () => {
      const identity1 = {
        title: 'Test Task',
        tags: ['test'],
        priority: 'A',
        stakeholders: ['Alice'],
        due: '2025-10-01'
      };

      const identity2 = {
        title: 'Test Task',
        tags: ['test'],
        priority: 'A',
        stakeholders: ['Alice'],
        due: '2025-10-01'
      };

      const id1 = computeDeterministicId(identity1);
      const id2 = computeDeterministicId(identity2);

      expect(id1).toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBe(8);
    });

    test('should generate different IDs for different inputs', () => {
      const identity1 = {
        title: 'Task One',
        tags: ['test'],
        priority: 'A',
        stakeholders: ['Alice'],
        due: '2025-10-01'
      };

      const identity2 = {
        title: 'Task Two',
        tags: ['test'],
        priority: 'A',
        stakeholders: ['Alice'],
        due: '2025-10-01'
      };

      const id1 = computeDeterministicId(identity1);
      const id2 = computeDeterministicId(identity2);

      expect(id1).not.toBe(id2);
    });

    test('should handle empty/null values', () => {
      const identity = {
        title: '',
        tags: [],
        priority: null,
        stakeholders: [],
        due: null
      };

      const id = computeDeterministicId(identity);
      expect(typeof id).toBe('string');
      expect(id.length).toBe(8);
    });

    test('should respect custom length parameter', () => {
      const identity = { title: 'Test', tags: [], priority: null, stakeholders: [], due: null };
      const id = computeDeterministicId(identity, 12);
      expect(id.length).toBe(12);
    });
  });

  describe('collectTasks', () => {
    test('should flatten tree structure to array', () => {
      const mockTasks = [
        {
          id: 'task1',
          data: { title: 'Parent Task' },
          children: [
            {
              id: 'task2',
              data: { title: 'Child Task' },
              children: [
                {
                  id: 'task3',
                  data: { title: 'Grandchild Task' },
                  children: []
                }
              ]
            }
          ]
        },
        {
          id: 'task4',
          data: { title: 'Another Parent' },
          children: []
        }
      ];

      const flattened = collectTasks(mockTasks);

      expect(flattened).toHaveLength(4);
      expect(flattened[0].id).toBe('task1');
      expect(flattened[0].parent).toBeNull();
      expect(flattened[1].id).toBe('task2');
      expect(flattened[1].parent).toBe('task1');
      expect(flattened[2].id).toBe('task3');
      expect(flattened[2].parent).toBe('task2');
      expect(flattened[3].id).toBe('task4');
      expect(flattened[3].parent).toBeNull();
    });

    test('should handle empty task list', () => {
      const flattened = collectTasks([]);
      expect(flattened).toHaveLength(0);
    });
  });

  describe('resolveIdByPrefix', () => {
    const mockTasks = [
      { id: 'abc12345', data: { title: 'Task 1' }, children: [] },
      { id: 'abc67890', data: { title: 'Task 2' }, children: [] },
      { id: 'def12345', data: { title: 'Task 3' }, children: [] }
    ];

    test('should resolve unique prefix to full ID', () => {
      const fullId = resolveIdByPrefix(mockTasks, 'def');
      expect(fullId).toBe('def12345');
    });

    test('should throw error for ambiguous prefix', () => {
      expect(() => {
        resolveIdByPrefix(mockTasks, 'abc');
      }).toThrow('Ambiguous id prefix');
    });

    test('should throw error for non-existent prefix', () => {
      expect(() => {
        resolveIdByPrefix(mockTasks, 'xyz');
      }).toThrow('No task id matching prefix');
    });

    test('should resolve full ID to itself', () => {
      const fullId = resolveIdByPrefix(mockTasks, 'abc12345');
      expect(fullId).toBe('abc12345');
    });
  });

  describe('getSortValue', () => {
    const mockTask = {
      id: 'test123',
      parent: 'parent123',
      data: {
        title: 'Test Task',
        priority: 'A',
        weight: 10,
        due: '2025-10-01'
      },
      topLevel: 'top-value'
    };

    test('should get parent value', () => {
      expect(getSortValue(mockTask, 'parent')).toBe('parent123');
    });

    test('should get data property values', () => {
      expect(getSortValue(mockTask, 'title')).toBe('Test Task');
      expect(getSortValue(mockTask, 'priority')).toBe('A');
      expect(getSortValue(mockTask, 'weight')).toBe(10);
    });

    test('should get top-level property values as fallback', () => {
      expect(getSortValue(mockTask, 'topLevel')).toBe('top-value');
    });

    test('should return undefined for non-existent properties', () => {
      expect(getSortValue(mockTask, 'nonexistent')).toBeUndefined();
    });

    test('should handle task with no parent', () => {
      const taskNoParent = { ...mockTask, parent: null };
      expect(getSortValue(taskNoParent, 'parent')).toBe('');
    });
  });

  describe('multiKeySort', () => {
    const mockTasks = [
      {
        id: 'task1',
        data: { title: 'Task A', priority: 'B', weight: 5, due: '2025-10-05' }
      },
      {
        id: 'task2',
        data: { title: 'Task B', priority: 'A', weight: 10, due: '2025-10-01' }
      },
      {
        id: 'task3',
        data: { title: 'Task C', priority: 'A', weight: 5, due: '2025-10-03' }
      },
      {
        id: 'task4',
        data: { title: 'Task D', priority: 'B', weight: 10, due: '2025-10-02' }
      }
    ];

    test('should sort by single key ascending', () => {
      const tasks = [...mockTasks];
      multiKeySort(tasks, [{ key: 'priority', dir: 'asc' }]);

      expect(tasks[0].data.priority).toBe('A');
      expect(tasks[1].data.priority).toBe('A');
      expect(tasks[2].data.priority).toBe('B');
      expect(tasks[3].data.priority).toBe('B');
    });

    test('should sort by single key descending', () => {
      const tasks = [...mockTasks];
      multiKeySort(tasks, [{ key: 'weight', dir: 'desc' }]);

      expect(tasks[0].data.weight).toBe(10);
      expect(tasks[1].data.weight).toBe(10);
      expect(tasks[2].data.weight).toBe(5);
      expect(tasks[3].data.weight).toBe(5);
    });

    test('should sort by multiple keys', () => {
      const tasks = [...mockTasks];
      multiKeySort(tasks, [
        { key: 'priority', dir: 'asc' },
        { key: 'weight', dir: 'desc' },
        { key: 'due', dir: 'asc' }
      ]);

      // Priority A first (task2, task3), then priority B (task1, task4)
      // Within priority A: task2 (weight 10) before task3 (weight 5)
      // Within priority B: task4 (weight 10) before task1 (weight 5)
      expect(tasks[0].id).toBe('task2'); // A, 10, 2025-10-01
      expect(tasks[1].id).toBe('task3'); // A, 5, 2025-10-03
      expect(tasks[2].id).toBe('task4'); // B, 10, 2025-10-02
      expect(tasks[3].id).toBe('task1'); // B, 5, 2025-10-05
    });

    test('should handle undefined values', () => {
      const tasksWithUndefined = [
        { id: 'task1', data: { title: 'Task A', priority: 'A' } },
        { id: 'task2', data: { title: 'Task B' } }, // no priority
        { id: 'task3', data: { title: 'Task C', priority: 'B' } }
      ];

      multiKeySort(tasksWithUndefined, [{ key: 'priority', dir: 'asc' }]);

      // Undefined values should sort first
      expect(tasksWithUndefined[0].id).toBe('task2');
      expect(tasksWithUndefined[1].id).toBe('task1');
      expect(tasksWithUndefined[2].id).toBe('task3');
    });

    test('should handle numeric vs string comparison', () => {
      const mixedTasks = [
        { id: 'task1', data: { weight: 5 } },
        { id: 'task2', data: { weight: 10 } },
        { id: 'task3', data: { weight: 2 } }
      ];

      multiKeySort(mixedTasks, [{ key: 'weight', dir: 'asc' }]);

      expect(mixedTasks[0].data.weight).toBe(2);
      expect(mixedTasks[1].data.weight).toBe(5);
      expect(mixedTasks[2].data.weight).toBe(10);
    });
  });
});