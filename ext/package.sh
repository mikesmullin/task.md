#!/bin/bash

# Package the extension for distribution

echo "Packaging Todo Task Language Support extension..."

# Extension info
EXT_NAME="todo-task-language-support"
EXT_VERSION="0.1.0"
PACKAGE_NAME="${EXT_NAME}-${EXT_VERSION}.vsix"

# Clean up any previous builds
rm -f *.vsix

# Create a temporary directory for packaging
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TEMP_DIR/$EXT_NAME"

echo "Copying files to temporary directory..."
mkdir -p "$PACKAGE_DIR"

# Copy essential files
cp package.json "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/"
cp language-configuration.json "$PACKAGE_DIR/"

# Copy source files
mkdir -p "$PACKAGE_DIR/src"
cp src/extension.js "$PACKAGE_DIR/src/"
cp src/server.js "$PACKAGE_DIR/src/"
# For packaging, copy the actual linter.js file instead of symlink
cp ../src/linter.js "$PACKAGE_DIR/src/"

# Copy syntax files
mkdir -p "$PACKAGE_DIR/syntaxes"
cp syntaxes/todo-task.tmGrammar.json "$PACKAGE_DIR/syntaxes/"

# Copy example file
cp example.task.md "$PACKAGE_DIR/"

echo "Installing production dependencies..."
cd "$PACKAGE_DIR"
npm install --production

echo "Creating package archive..."
cd "$TEMP_DIR"
tar -czf "$PACKAGE_NAME" "$EXT_NAME"

# Move package back to extension directory
mv "$PACKAGE_NAME" "$(dirname "$0")/"

# Clean up
rm -rf "$TEMP_DIR"

echo "Package created: $PACKAGE_NAME"
echo ""
echo "To install manually:"
echo "  1. Extract the package to your VS Code extensions directory"
echo "  2. Restart VS Code"
echo ""
echo "VS Code extensions directory locations:"
echo "  Linux/macOS: ~/.vscode/extensions/"
echo "  Windows: %USERPROFILE%/.vscode/extensions/"