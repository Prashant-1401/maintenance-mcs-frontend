@echo off
title Maintenance App - Starting demo
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\demo-launcher.ps1" start
if errorlevel 1 (
  echo.
  echo Something went wrong. Please take a photo of this screen.
  pause
)
