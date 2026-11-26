; 크리스마스 트리 위젯 설치 파일 (NSIS)
; build/make-installer.sh 가 VERSION, SRC(win-unpacked 폴더), OUT 을 넘겨줘요.
Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma

!define APP_NAME "크리스마스 트리 위젯"
!define APP_EXE "TreeWidget.exe"
!define APP_ID "bongo.tree.widget"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\TreeWidget"
!define RUN_KEY "Software\Microsoft\Windows\CurrentVersion\Run"

Name "${APP_NAME}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\TreeWidget"
RequestExecutionLevel user
BrandingText "TreeWidget ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1042 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1042 "FileDescription" "${APP_NAME} 설치"
VIAddVersionKey /LANG=1042 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1042 "CompanyName" "bugsbunni22"
VIAddVersionKey /LANG=1042 "LegalCopyright" "bugsbunni22"

!include "MUI2.nsh"
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "지금 트리 띄우기"
!define MUI_FINISHPAGE_TITLE "설치가 끝났어요"
!define MUI_FINISHPAGE_TEXT "모니터 구석에 트리가 떠요.$\r$\n$\r$\n• 처음 실행하면 내 트리 주소를 물어봐요.$\r$\n• 트리를 꾹 눌러 끌면 옮겨지고, Ctrl + 마우스 휠로 크기를 바꿔요.$\r$\n• 작업 표시줄 오른쪽 트리 아이콘을 오른쪽 클릭하면 메뉴가 나와요."
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

!macro CloseApp
  ; 실행 중이면 닫고 덮어써요 (업데이트 설치)
  nsExec::Exec 'taskkill /IM "${APP_EXE}" /F'
  Pop $0
  Sleep 600
!macroend

Section "Install"
  !insertmacro CloseApp
  SetOutPath "$INSTDIR"
  ; 예전 버전 파일이 섞이지 않게 앱 폴더를 비우고 새로 넣어요 (설정은 AppData 에 있어서 그대로)
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall TreeWidget.exe"

  ; 시작 메뉴·바탕화면 바로가기 (알림이 뜨려면 시작 메뉴 바로가기에 앱 ID가 있어야 해요)
  CreateShortcut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  WinShell::SetLnkAUMI "$SMPROGRAMS\${APP_NAME}.lnk" "${APP_ID}"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  WinShell::SetLnkAUMI "$DESKTOP\${APP_NAME}.lnk" "${APP_ID}"

  ; 설정 > 앱 목록에 보이게
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "bugsbunni22"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall TreeWidget.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall TreeWidget.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" ${SIZE_KB}
SectionEnd

Section "Uninstall"
  !insertmacro CloseApp
  ; "윈도우 시작할 때 자동 실행" 등록 지우기 (main.js 의 LOGIN_NAME)
  DeleteRegValue HKCU "${RUN_KEY}" "TreeWidget"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "TreeWidget"
  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  ; 트리 주소·위치 설정(%APPDATA%\TreeWidget)은 남겨둬요. 다시 설치하면 그대로 이어져요.
SectionEnd
