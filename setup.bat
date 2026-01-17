@echo off
echo === Financial Audit System Setup ===
echo.

:: 1. Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from nodejs.org.
    pause
    exit /b
)

:: 2. Install Dependencies
echo [1/3] Installing backend dependencies...
call npm install express sqlite3 bcryptjs jsonwebtoken crypto

:: 3. Get Local IP Address
echo.
echo [2/3] Identifying your Server IP...
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4 Address"') do set IP=%%i
set IP=%IP: =%
echo.
echo ===========================================================
echo YOUR SERVER IP IS: %IP%
echo.
echo ACTION REQUIRED:
echo 1. Open app.js and set API_BASE to: http://%IP%:3000/api
echo 2. Open reports.js and set API_BASE to: http://%IP%:3000/api
echo ===========================================================
echo.

:: 4. Start the Server
echo [3/3] Starting the server...
pause
node server.js