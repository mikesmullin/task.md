#!/bin/bash

# Install script for Todo Task Language Support VS Code Extension

echo "Installing Todo Task Language Support extension..."

# Get VS Code extensions directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
else
    # Linux and others
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
fi

# Create extensions directory if it doesn't exist
mkdir -p "$VSCODE_EXT_DIR"

# Extension directory name
EXT_NAME="todo-task-language-support-0.1.0"
EXT_TARGET="$VSCODE_EXT_DIR/$EXT_NAME"

# Remove existing installation
if [ -d "$EXT_TARGET" ]; then
    echo "Removing existing installation..."
    rm -rf "$EXT_TARGET"
fi

# Copy extension files
echo "Copying extension files to $EXT_TARGET..."
cp -r "$(dirname "$0")" "$EXT_TARGET"

# Install npm dependencies
echo "Installing dependencies..."
cd "$EXT_TARGET"
npm install --production

echo "Extension installed successfully!"
echo "Please restart VS Code to activate the extension."
echo ""
echo "Test the extension by opening the example.task.md file:"
echo "  code $EXT_TARGET/example.task.md"