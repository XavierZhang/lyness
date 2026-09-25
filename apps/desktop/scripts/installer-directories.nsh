!include "LogicLib.nsh"

Var lynFinalDirectory
Var lynNewDirectory
Var lynOldDirectory
Var lynOldMoved
Var lynNewMoved

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
    ClearErrors
    Rename $lynOldDirectory $lynFinalDirectory
    ${If} ${Errors}
      ; Leave the complete backup in place if another process prevents restoration.
      DetailPrint $lynOldDirectory
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
    Rename $lynFinalDirectory $lynOldDirectory
    ${If} ${Errors}
      Call lynRollbackDirectories
      SetErrors
      Return
    ${EndIf}
    StrCpy $lynOldMoved "1"
  ${Else}
    ; NSIS can create the destination before the install section starts.
    RMDir $lynFinalDirectory
  ${EndIf}
  ClearErrors
  Rename $lynNewDirectory $lynFinalDirectory
  ${If} ${Errors}
    Call lynRollbackDirectories
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
