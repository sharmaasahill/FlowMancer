@echo off
REM FlowMancer Quick Start Script for Windows

echo 🔮 Starting FlowMancer...
echo.

REM Check if .env exists
if not exist "backend\.env" (
    echo ⚠️  No .env file found. Creating from example...
    copy backend\env.example backend\.env
    echo ✅ Created backend\.env
    echo.
    echo ⚠️  IMPORTANT: Edit backend\.env and add your OPENAI_API_KEY!
    echo.
    pause
)

echo 🐳 Starting Docker containers...
docker-compose up -d

echo.
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak > nul

echo.
echo ✅ FlowMancer is running!
echo.
echo 📍 Access the application:
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/api/docs
echo.
echo 📊 View logs:
echo    docker-compose logs -f
echo.
echo 🛑 Stop FlowMancer:
echo    docker-compose down
echo.
echo Happy automating! 🚀
pause

