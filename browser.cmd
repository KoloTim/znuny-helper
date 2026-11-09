@echo off
rem Aufrufer fuer die Browser-Werkzeuge des Znuny Helpers.
rem Sucht Node selbst (auch die Laufzeit des DeepSeek Harness) und startet
rem tools\browser\browser.ps1. Aufruf:  browser.cmd smoke
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\browser\browser.ps1" %*
exit /b %ERRORLEVEL%
