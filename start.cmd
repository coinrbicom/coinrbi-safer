@echo off
setlocal

REM .bin 폴더 및 node.exe 경로 설정
set BIN_DIR=%~dp0.bin
set NODE_EXE=%BIN_DIR%\node.exe

REM node.exe가 이미 있으면 종료
if exist "%NODE_EXE%" (
  echo Node.js already installed at %NODE_EXE%
  goto :RUN_DEV
)

REM .bin 폴더 없으면 생성
if not exist "%BIN_DIR%" (
  mkdir "%BIN_DIR%"
)

REM Node.js 다운로드
set NODE_VERSION=v22.18.0
set NODE_ZIP=node-%NODE_VERSION%-win-x64.zip
set NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_ZIP%

echo Downloading Node.js...
powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"

REM 압축 풀기
echo Extracting Node.js...
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%BIN_DIR%'"

REM node.exe 이동
move "%BIN_DIR%\node-%NODE_VERSION%-win-x64\node.exe" "%NODE_EXE%"

REM 정리
rd /s /q "%BIN_DIR%\node-%NODE_VERSION%-win-x64"
del "%NODE_ZIP%"

echo Node.js installed at %NODE_EXE%

:RUN_DEV
REM .bin 폴더의 node로 실행
echo Running "nodemon --watch src --exec node --experimental-specifier-resolution=node ." with portable node...
"%NODE_EXE%"  --experimental-specifier-resolution=nodemon --watch src --exec node --experimental-specifier-resolution=node .

:END
endlocal
exit /b