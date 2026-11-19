@echo off
title Maintenance App - Stopping demo
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\demo-launcher.ps1" stop
timeout /t 4 >nul
