// cli.test.js
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, '..', 'fixtures');
const todoFixture = path.join(fixturesPath, 'todo.md');
const cliPath = path.join(__dirname, '..', '..', 'src', 'cli.js');

// Helper function to run CLI commands
function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], {
      stdio: 'pipe',
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Create temporary test files
function createTempFile(content) {
  const tempPath = path.join(tmpdir(), `test-todo-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  fs.writeFileSync(tempPath, content, 'utf8');
  return tempPath;
}

describe('CLI Integration', () => {
  let tempFiles = [];

  // Helper test wrapper that automatically cleans up
  function testWithCleanup(name, fn) {
    test(name, async () => {
      try {
        await fn();
      } finally {
        cleanup();
      }
    });
  }

  // Helper cleanup function
  function cleanup() {
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    tempFiles = [];
  }

  describe('lint command', () => {
    test('should pass linting for valid fixture file', async () => {
      const result = await runCli(['lint', todoFixture]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('No lint issues found');
      expect(result.stderr).toBe('');
    });

    test('should detect lint errors in invalid file', async () => {
      const invalidContent = `
# Test File

## TODO

- Task 1
   - Bad indent task
-
`;
      const tempFile = createTempFile(invalidContent);
      tempFiles.push(tempFile);

      const result = await runCli(['lint', tempFile]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('ERROR');

      cleanup();
    });

    test('should show error for non-existent file', async () => {
      const result = await runCli(['lint', 'non-existent-file.md']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('File required and must exist');
    });
  });

  describe('select command', () => {
    test('should output JSON for tasks without orderby', async () => {
      const result = await runCli(['select', todoFixture]);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');

      // Should output valid JSON
      expect(() => JSON.parse(result.stdout)).not.toThrow();

      const tasks = JSON.parse(result.stdout);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);

      // Check that tasks have expected fields
      const firstTask = tasks[0];
      expect(firstTask).toHaveProperty('id');
      expect(firstTask).toHaveProperty('parent');
    });

    test('should sort tasks with orderby clause', async () => {
      const result = await runCli(['select', todoFixture, 'orderby', 'priority desc']);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');

      const tasks = JSON.parse(result.stdout);
      expect(Array.isArray(tasks)).toBe(true);

      // Check that tasks are sorted by priority descending
      const tasksWithPriority = tasks.filter(t => t.priority);
      if (tasksWithPriority.length > 1) {
        for (let i = 0; i < tasksWithPriority.length - 1; i++) {
          const current = tasksWithPriority[i].priority;
          const next = tasksWithPriority[i + 1].priority;
          // D > C > B > A in descending order
          expect(current >= next).toBe(true);
        }
      }
    });

    test('should sort by multiple keys', async () => {
      const result = await runCli(['select', todoFixture, 'orderby', 'priority asc, due desc']);

      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');

      const tasks = JSON.parse(result.stdout);
      expect(Array.isArray(tasks)).toBe(true);
    });

    test('should write sorted tasks to output file', async () => {
      const outputFile = createTempFile('');
      tempFiles.push(outputFile);

      const result = await runCli(['select', todoFixture, 'orderby', 'priority desc', 'into', outputFile]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain(`Saved sorted tasks into ${outputFile}`);

      // Check that output file was created and contains TODO section
      expect(fs.existsSync(outputFile)).toBe(true);
      const outputContent = fs.readFileSync(outputFile, 'utf8');
      expect(outputContent).toContain('## TODO');
      expect(outputContent).toContain('- '); // Should contain bullet points
    });

    test('should preserve hierarchy when writing to file', async () => {
      const outputFile = createTempFile('');
      tempFiles.push(outputFile);

      const result = await runCli(['select', todoFixture, 'into', outputFile]);

      expect(result.code).toBe(0);

      const outputContent = fs.readFileSync(outputFile, 'utf8');
      const lines = outputContent.split('\n');

      // Should have nested tasks with proper indentation
      const indentedLines = lines.filter(l => l.match(/^\s{2,}- /));
      expect(indentedLines.length).toBeGreaterThan(0);
    });

    test('should show error for non-existent input file', async () => {
      const result = await runCli(['select', 'non-existent-file.md']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('input file is required and must exist');
    });

    test('should handle lint errors in input file during select', async () => {
      const invalidContent = `
## TODO

- Task 1
   - Bad indent
`;
      const tempFile = createTempFile(invalidContent);
      tempFiles.push(tempFile);

      const result = await runCli(['select', tempFile]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Lint errors detected');
    });
  });

  describe('error handling', () => {
    test('should show usage when no command provided', async () => {
      const result = await runCli([]);

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('todo select');
      expect(result.stdout).toContain('todo lint');
    });

    test('should show usage for unknown command', async () => {
      const result = await runCli(['unknown-command']);

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('Usage:');
    });
  });

  describe('real-world scenarios', () => {
    test('should handle complex todo file with all features', async () => {
      const complexContent = `
# Complex Project

Some documentation here.

## TODO

- A @Alice #urgent \`Critical bug fix\` due: 2025-10-01 weight: 10
  description: |
    Fix the critical authentication bug that is blocking
    the production deployment.
  notes: |
    Check with security team before deploying.
  
  - B @Bob #urgent \`Test the fix\` due: 2025-10-02
    effort: 3h
    
    - C \`Write test cases\`
      priority: A
      
- x D @Carol #feature \`Completed feature\` due: 2025-09-30
  
- - \`Skipped task\` reason: "Not needed anymore"

## Notes

Some project notes here.
`;

      const tempFile = createTempFile(complexContent);
      tempFiles.push(tempFile);

      // Test lint
      const lintResult = await runCli(['lint', tempFile]);
      expect(lintResult.code).toBe(0);

      // Test select
      const selectResult = await runCli(['select', tempFile]);
      expect(selectResult.code).toBe(0);

      const tasks = JSON.parse(selectResult.stdout);
      expect(tasks.length).toBeGreaterThan(0);

      // Check various task types are present
      const urgentTasks = tasks.filter(t => t.tags && t.tags.includes('urgent'));
      const completedTasks = tasks.filter(t => t.completed === true);
      const skippedTasks = tasks.filter(t => t.skipped === true);

      expect(urgentTasks.length).toBeGreaterThan(0);
      expect(completedTasks.length).toBe(1);
      expect(skippedTasks.length).toBe(1);

      // Test orderby with multiple keys
      const sortedResult = await runCli(['select', tempFile, 'orderby', 'priority asc, due desc']);
      expect(sortedResult.code).toBe(0);

      // Test writing to output file
      const outputFile = createTempFile('');
      tempFiles.push(outputFile);

      const writeResult = await runCli(['select', tempFile, 'orderby', 'priority desc', 'into', outputFile]);
      expect(writeResult.code).toBe(0);

      const outputContent = fs.readFileSync(outputFile, 'utf8');
      expect(outputContent).toContain('## TODO');
      expect(outputContent).toContain('Critical bug fix');
      expect(outputContent).toContain('description: |');
    });
  });
});