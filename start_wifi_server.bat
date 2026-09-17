@echo off
title PRAKASHAN AI - Wireless Wi-Fi Server
echo =========================================================
echo   Starting PRAKASHAN AI Wireless Wi-Fi & Telemetry Server
echo   "Drying solutions for global agriculture"
echo =========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wifi_server.ps1" -Port 8080
pause
