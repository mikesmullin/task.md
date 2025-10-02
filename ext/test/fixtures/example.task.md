# Sample Todo Task File

This is a sample todo task file to test the VS Code extension.

## TODO

- x A @Alice #urgent "Fix authentication bug" due: 2025-10-01 weight: 10
  description: |
    The login system is failing for users with special
    characters in their passwords.
  notes: |
    Check with security team before deploying.
  
  - B @Bob "Review security patch" due: 2025-09-30
    - C "Test on staging" effort: 2h
    - C "Update documentation"

- B @Charlie #backend "Optimize database queries"
  priority: B
  effort: 1d
  description: |
    Several queries are taking too long:
    - User lookup queries
    - Report generation
    - Data aggregation

- x A @Alice "Completed task example"
  completed: true
  
- - @Bob "Skipped task example"
  skipped: true

## Notes

This section contains regular Markdown content that should be ignored by the linter.

### Intentional Errors for Testing

The following lines contain intentional syntax errors to test the linter:

## TODO (second section for error testing)

- Unquoted title with spaces followed by key: value  
- A B @Alice "Multiple priorities on same line"
-   "Bad indentation"
- Valid task
  key without value and indented content
    This content should trigger an error
  another_key: |
    # This should be fine