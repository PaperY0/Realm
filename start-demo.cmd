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
  echo [错误] 未找到 Node.js。
  echo 本项目现场 Demo 已锁定 Node.js 24.x，请安装 Node.js 24 后重试。
  pause
  exit /b 1
)

set "NODE_VERSION="
set "NODE_MAJOR="
for /f "delims=" %%V in ('node -p "process.versions.node" 2^>nul') do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=." %%M in ("%NODE_VERSION%") do set "NODE_MAJOR=%%M"

if not "%NODE_MAJOR%"=="24" (
  echo [错误] 当前 Node.js 版本为 %NODE_VERSION%。
  echo 本项目依赖 node:sqlite，现场 Demo 仅支持并锁定 Node.js 24.x。
  echo 请切换到 Node.js 24 后重新启动。
  pause
  exit /b 1
)

node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:'); db.close();" >nul 2>nul
if errorlevel 1 (
  echo [错误] 当前 Node.js 24 环境无法使用 node:sqlite。
  echo 请重新安装官方 Node.js 24，并确认安装完整。
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm。请重新安装官方 Node.js 24，并确保 npm 已加入 PATH。
  pause
  exit /b 1
)

echo [环境] Node.js %NODE_VERSION% 与 node:sqlite 检查通过。
echo.
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
