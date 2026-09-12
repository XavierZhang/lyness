@echo off
setlocal DisableDelayedExpansion
set "signTool=%LYNESS_DESKTOP_WINDOWS_SIGNTOOL%"
set "certificateFile=%LYNESS_DESKTOP_WINDOWS_CER_FILE%"
set "tokenPin=%LYNESS_DESKTOP_WINDOWS_TOKEN_PIN%"
set "keyContainer=%LYNESS_DESKTOP_WINDOWS_KEY_CONTAINER%"
set "targetFile=%LYNESS_DESKTOP_WINDOWS_SIGN_TARGET%"
set "appendSignature="
if "%LYNESS_DESKTOP_WINDOWS_SIGN_APPEND%"=="1" set "appendSignature=/as"
set "LYNESS_DESKTOP_WINDOWS_SIGNTOOL="
set "LYNESS_DESKTOP_WINDOWS_CER_FILE="
set "LYNESS_DESKTOP_WINDOWS_TOKEN_PIN="
set "LYNESS_DESKTOP_WINDOWS_KEY_CONTAINER="
set "LYNESS_DESKTOP_WINDOWS_SIGN_TARGET="
set "LYNESS_DESKTOP_WINDOWS_SIGN_APPEND="
set "signTool=" & set "certificateFile=" & set "tokenPin=" & set "keyContainer=" & set "targetFile=" & set "appendSignature=" & "%signTool%" sign /v /fd sha256 /f "%certificateFile%" /kc "[{{%tokenPin%}}]=%keyContainer%" /csp "eToken Base Cryptographic Provider" %appendSignature% /tr http://timestamp.digicert.com /td sha256 "%targetFile%"
exit /b %errorlevel%
