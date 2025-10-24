#!/bin/bash

echo "Installing Invoice AI Backend Dependencies..."
echo "=============================================="
echo ""

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "⚠️  Warning: No virtual environment detected!"
    echo "   It's recommended to use a virtual environment."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing Python packages..."
pip install -r requirements.txt

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "You can now start the backend with:"
    echo "  python main.py"
    echo ""
    echo "Or run with uvicorn:"
    echo "  uvicorn main:app --reload --port 10000"
else
    echo ""
    echo "❌ Installation failed! Please check the error messages above."
    exit 1
fi
