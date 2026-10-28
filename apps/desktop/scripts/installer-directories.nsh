!include "LogicLib.nsh"

Var lynFinalDirectory
Var lynNewDirectory
Var lynOldDirectory
Var lynOldMoved
Var lynNewMoved
Var lynDirectoryError
Var lynDirectorySource
Var lynDirectoryDestination
Var lynRestoreError
Var lynDirectoryLogDirectory
Var lynRecoveryStopped

; MoveFileEx preserves the destination and exposes the Windows error before rollback changes it.
; Open files inside a directory can make its rename return access denied (5).
!macro lynDirectoryOperation SOURCE DESTINATION RESULT PHASE
  Push $0
  Push $1
  Push $2
  StrCpy $0 0
  ${Do}
    ${If} "${DESTINATION}" == ""
      System::Call 'kernel32::RemoveDirectoryW(w "${SOURCE}") i.r1 ?e'
    ${Else}
      System::Call 'kernel32::MoveFileExW(w "${SOURCE}", w "${DESTINATION}", i 0) i.r1 ?e'
    ${EndIf}
    Pop ${RESULT}
    ${If} "${DESTINATION}" == ""
      ${If} ${RESULT} == 2
      ${OrIf} ${RESULT} == 3
        StrCpy $1 1
      ${EndIf}
    ${EndIf}
    ${If} $1 != 0
      StrCpy ${RESULT} 0
      ${ExitDo}
    ${EndIf}
    ClearErrors
    FileOpen $2 "$PLUGINSDIR\directory-operations.log" a
    ${IfNot} ${Errors}
      FileSeek $2 0 END
      FileWrite $2 "${PHASE}: Windows error: ${RESULT}$\r$\n"
      FileClose $2
    ${EndIf}
    ${If} ${RESULT} != 5
    ${AndIf} ${RESULT} != 32
    ${AndIf} ${RESULT} != 33
      ${ExitDo}
    ${EndIf}
    IntOp $0 $0 + 1
    ${If} $0 >= 10
      ${ExitDo}
    ${EndIf}
    IntOp $1 $0 * 250
    Sleep $1
  ${Loop}
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro lynReportDirectoryFailure
  ${If} $lynRestoreError != 0
    StrCpy $lynRecoveryStopped "1"
  ${EndIf}
  !ifmacrodef customInstallerDirectoryFailed
    !insertmacro customInstallerDirectoryFailed
  !else
    DetailPrint "Directory operation failed ($lynDirectoryError): $lynDirectorySource -> $lynDirectoryDestination; restore error: $lynRestoreError"
  !endif
!macroend

!macro lynExtractPayload FILE
  !ifmacrodef customInstallerExtract
    !insertmacro customInstallerExtract "${FILE}"
  !else
    nsExec::ExecToStack '"$PLUGINSDIR\lyn-7za.exe" x -y -bd -bb0 "-o$INSTDIR" "${FILE}"'
    Pop $R0
    Pop $R1
  !endif
  ${If} $R0 != 0
    DetailPrint $R1
    Call lynRollbackDirectories
    !ifmacrodef customInstallerExtractFailed
      !insertmacro customInstallerExtractFailed "${FILE}"
    !else
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(decompressionFailed)" /SD IDOK
    !endif
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro lynStageApplication
  !ifdef LYNESS_INSTALLER_LOG_DIR
    ; electron-builder defines the cache name after including our function bodies, before this section expands.
    StrCpy $lynDirectoryLogDirectory "${LYNESS_INSTALLER_LOG_DIR}"
  !endif
  StrCpy $lynFinalDirectory $INSTDIR
  System::Call 'ole32::CoCreateGuid(g .r0) i .r1'
  ${If} $1 != 0
    SetErrorLevel 2
    Quit
  ${EndIf}
  StrCpy $lynNewDirectory "$INSTDIR.new-$0"
  StrCpy $lynOldDirectory "$INSTDIR.old-$0"
  StrCpy $lynOldMoved ""
  StrCpy $lynNewMoved ""
  StrCpy $lynDirectoryError 0
  StrCpy $lynRestoreError 0
  StrCpy $lynRecoveryStopped ""
  ClearErrors
  CreateDirectory $lynNewDirectory
  ${If} ${Errors}
    SetErrorLevel 2
    Quit
  ${EndIf}
  File /oname=$PLUGINSDIR\lyn-7za.exe "${LYNESS_SEVENZIP_PATH}"
  StrCpy $INSTDIR $lynNewDirectory
  SetOutPath $INSTDIR
  !insertmacro installApplicationFiles
  !ifdef LYNESS_SEVENZIP_LICENSE_DIR
    File /oname=7zip-installer-LICENSE.txt "${LYNESS_SEVENZIP_LICENSE_DIR}\LICENSE.txt"
    File /oname=7zip-installer-COPYING.txt "${LYNESS_SEVENZIP_LICENSE_DIR}\COPYING"
  !endif
  !ifdef UNINSTALLER_ICON
    File /oname=uninstallerIcon.ico "${UNINSTALLER_ICON}"
  !endif
  StrCpy $INSTDIR $lynFinalDirectory
  SetOutPath $PLUGINSDIR
!macroend

Function .onGUIEnd
  Call lynCleanupDirectories
FunctionEnd

Function lynCleanupDirectories
  ${If} $lynRecoveryStopped == "1"
    Return
  ${EndIf}
  ${If} $lynFinalDirectory != ""
    Call lynRollbackDirectories
  ${EndIf}
FunctionEnd

; Only directories created or renamed by this installer are removed during rollback.
Function lynRollbackDirectories
  SetOutPath $PLUGINSDIR
  ${If} $lynNewMoved == "1"
    RMDir /r "\\?\$lynFinalDirectory"
    StrCpy $lynNewMoved ""
  ${EndIf}
  ${If} $lynOldMoved == "1"
    !insertmacro lynDirectoryOperation "$lynOldDirectory" "$lynFinalDirectory" $lynRestoreError "restore"
    ${If} $lynRestoreError != 0
      ; Leave the complete backup in place if another process prevents restoration.
      DetailPrint $lynOldDirectory
      RMDir /r "\\?\$lynNewDirectory"
      Return
    ${EndIf}
    StrCpy $lynOldMoved ""
  ${EndIf}
  ${If} $lynNewDirectory != ""
    RMDir /r "\\?\$lynNewDirectory"
  ${EndIf}
  StrCpy $INSTDIR $lynFinalDirectory
FunctionEnd

Function lynPromoteDirectories
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 2
  !endif
  ; SetOutPath opens a directory handle; release it before either rename.
  SetOutPath $PLUGINSDIR
  ClearErrors
  ${If} ${FileExists} "$lynFinalDirectory\*.*"
    StrCpy $lynDirectorySource $lynFinalDirectory
    StrCpy $lynDirectoryDestination $lynOldDirectory
    !insertmacro lynDirectoryOperation "$lynDirectorySource" "$lynDirectoryDestination" $lynDirectoryError "backup"
    ${If} $lynDirectoryError != 0
      Call lynRollbackDirectories
      !insertmacro lynReportDirectoryFailure
      SetErrors
      Return
    ${EndIf}
    StrCpy $lynOldMoved "1"
  ${Else}
    ; NSIS can create the destination before the install section starts.
    StrCpy $lynDirectorySource $lynFinalDirectory
    StrCpy $lynDirectoryDestination ""
    !insertmacro lynDirectoryOperation "$lynDirectorySource" "" $lynDirectoryError "remove-empty"
    ${If} $lynDirectoryError != 0
      Call lynRollbackDirectories
      !insertmacro lynReportDirectoryFailure
      SetErrors
      Return
    ${EndIf}
  ${EndIf}
  ClearErrors
  StrCpy $lynDirectorySource $lynNewDirectory
  StrCpy $lynDirectoryDestination $lynFinalDirectory
  !insertmacro lynDirectoryOperation "$lynDirectorySource" "$lynDirectoryDestination" $lynDirectoryError "promote"
  ${If} $lynDirectoryError != 0
    Call lynRollbackDirectories
    !insertmacro lynReportDirectoryFailure
    SetErrors
    Return
  ${EndIf}
  StrCpy $lynNewMoved "1"
  SetOutPath $lynFinalDirectory
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 3
  !endif
  ClearErrors
FunctionEnd

!macro lynFinishDirectories
  StrCpy $lynNewMoved ""
  ${If} $lynOldMoved == "1"
    RMDir /r "\\?\$lynOldDirectory"
    StrCpy $lynOldMoved ""
  ${EndIf}
!macroend
