@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\..\lyness.exe" --expose-internals "%~dp0..\..\..\app.asar\lyn\node_modules\@lyness\lyn-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
