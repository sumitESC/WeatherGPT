#!/usr/bin/env bash
# exit on error
set -o errexit

echo "=================================================="
echo " 🚀 Building WeatherGPT for Render Deployment "
echo "=================================================="

echo "📦 [1/3] Installing Python Dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "⚡ [2/3] Installing & Building Vite React Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "✅ [3/3] Build Complete! Ready for Uvicorn Web Server."
