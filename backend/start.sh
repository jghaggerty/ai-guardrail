#!/bin/bash

# AI Bias & Heuristics Diagnostic Tool - Backend Startup Script

echo "🚀 Starting AI Bias & Heuristics Diagnostic Tool API..."
echo ""

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "✓ Activating virtual environment..."
    source venv/bin/activate
fi

# Check if dependencies are installed
python -c "import fastapi" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Dependencies not installed. Installing..."
    pip install -q -r requirements.txt
    echo "✓ Dependencies installed"
fi

# Start the server
echo "✓ Starting FastAPI server on http://localhost:8000"
echo ""
echo "📚 API Documentation: http://localhost:8000/docs"
echo "📖 ReDoc: http://localhost:8000/redoc"
echo "❤️  Health Check: http://localhost:8000/health"
echo ""
echo "Press CTRL+C to stop the server"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
