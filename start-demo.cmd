@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 藏梦书境 Web Demo

echo.
echo ========================================
echo   藏梦书境 - 现场 Web Demo
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js。请先安装 Node.js 18 或更高版本。
  pause
  exit /b 1
)

echo [1/2] 正在执行现场预检...
call npm run demo:check
if errorlevel 1 (
  echo.
  echo [错误] 预检未通过，请保留此窗口并检查上方信息。
  pause
  exit /b 1
)

echo.
echo [2/2] 正在启动 Web Demo...
echo 浏览器地址：http://127.0.0.1:3000/
echo 关闭此窗口即可停止 Demo。
echo.

if not "%DEMO_NO_BROWSER%"=="1" (
  start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:3000/'"
)

node server.js

if errorlevel 1 (
  echo.
  echo [错误] Demo 服务启动失败。
  pause
  exit /b 1
)
