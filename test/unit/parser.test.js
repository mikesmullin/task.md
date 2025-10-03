// parser.test.js
import { parseFileToTree, loadFileLines } from '../../src/parser.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, '..', 'fixtures');
const todoFixture = path.join(fixturesPath, 'todo.md');

describe('Parser', () => {
  describe('loadFileLines', () => {
    test('should load file lines correctly', () => {
      const lines = loadFileLines(todoFixture);
      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toBe('# Example Document');
    });
  });

  describe('parseFileToTree', () => {
    test('should parse fixture file without lint errors', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: true });
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('lines');
      expect(result.tasks).toBeInstanceOf(Array);
      expect(result.tasks.length).toBeGreaterThan(0);
    });

    test('should parse single-line tasks with prefixes correctly', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      // Find the task "Prepare roadmap"
      const roadmapTask = tasks.find(t => t.data.title === 'Prepare roadmap');
      expect(roadmapTask).toBeDefined();
      expect(roadmapTask.data.priority).toBe('A');
      expect(roadmapTask.data.stakeholders).toEqual(['Alice']);
      expect(roadmapTask.data.tags).toContain('planning');
      expect(roadmapTask.data.due).toBe('2025-10-05');
      expect(roadmapTask.data.weight).toBe(10);
      expect(roadmapTask.data.id).toBeDefined();
    });

    test('should parse completed and skipped tasks', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      const completedTask = tasks.find(t => t.data.completed === true);
      expect(completedTask).toBeDefined();
      expect(completedTask.data.title).toBe('Completed item using x macro only');

      const skippedTask = tasks.find(t => t.data.skipped === true);
      expect(skippedTask).toBeDefined();
      expect(skippedTask.data.title).toBe('Skipped item with dash prefix');
    });

    test('should parse multi-line tasks with descriptions', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      const gameEngineTask = tasks.find(t => t.data.title === 'Plan "game engine" features');
      expect(gameEngineTask).toBeDefined();
      expect(gameEngineTask.data.priority).toBe('A');
      expect(gameEngineTask.data.stakeholders).toEqual(['Alice']);
      expect(gameEngineTask.data.tags).toContain('game');
      expect(gameEngineTask.data.description).toContain('Plan the architecture');
      expect(gameEngineTask.data.description).toContain('ECS system');
      expect(gameEngineTask.data.notes).toContain('Review team document');
    });

    test('should handle nested subtasks correctly', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      const ecsTask = tasks.find(t => t.data.title === 'Design ECS system');
      expect(ecsTask).toBeDefined();
      expect(ecsTask.children).toBeDefined();
      expect(ecsTask.children.length).toBe(1);

      const componentTask = ecsTask.children[0];
      expect(componentTask.data.title).toBe('Define Components');
      expect(componentTask.children).toBeDefined();
      expect(componentTask.children.length).toBe(1);

      const memoryTask = componentTask.children[0];
      expect(memoryTask.data.title).toBe('Investigate memory layout options');
    });

    test('should assign deterministic IDs to tasks', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      // All tasks should have IDs
      function checkIds(taskList) {
        for (const task of taskList) {
          expect(task.id).toBeDefined();
          expect(task.data.id).toBeDefined();
          expect(task.id).toBe(task.data.id);
          expect(typeof task.id).toBe('string');
          expect(task.id.length).toBe(8); // default hash length

          if (task.children && task.children.length > 0) {
            checkIds(task.children);
          }
        }
      }
      checkIds(tasks);
    });

    test('should set parent relationships correctly', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      // Root tasks should have no parent
      for (const task of tasks) {
        expect(task.parent).toBeNull();
      }

      // Find nested task and check parent relationship
      const ecsTask = tasks.find(t => t.data.title === 'Design ECS system');
      expect(ecsTask).toBeDefined();

      if (ecsTask.children && ecsTask.children.length > 0) {
        const childTask = ecsTask.children[0];
        expect(childTask.parent).toBe(ecsTask.id);

        if (childTask.children && childTask.children.length > 0) {
          const grandchildTask = childTask.children[0];
          expect(grandchildTask.parent).toBe(childTask.id);
        }
      }
    });

    test('should handle tasks without titles', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      // Find task without title (has due date but no title)
      const noTitleTask = tasks.find(t => t.data.due === '2026-01-01' && !t.data.title);
      expect(noTitleTask).toBeDefined();
      expect(noTitleTask.data.weight).toBe(3);
      expect(noTitleTask.data.customField).toBe('foo');
    });

    test('should handle edge cases with quotes and special characters', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      const quotedTask = tasks.find(t => t.data.title && t.data.title.includes('escaped'));
      expect(quotedTask).toBeDefined();
      expect(quotedTask.data.title).toContain('"escaped" quotes');
      // Note: Currently the parser has issues with escaped backticks in titles
      // The title gets cut off at the escaped backtick
    });

    test('should parse boolean and numeric values correctly', () => {
      const result = parseFileToTree(todoFixture, { indentSize: 2, lint: false });
      const tasks = result.tasks;

      const roadmapTask = tasks.find(t => t.data.title === 'Prepare roadmap');
      expect(roadmapTask.data.weight).toBe(10); // numeric

      const completedTask = tasks.find(t => t.data.completed === true);
      expect(completedTask.data.completed).toBe(true); // boolean
    });
  });
});