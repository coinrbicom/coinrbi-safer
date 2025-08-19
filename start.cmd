@echo off
setlocal

REM =====================================
REM Portable Node.js + npm 실행 스크립트
REM =====================================

REM .bin 폴더 및 node.exe 경로 설정
set BIN_DIR=%~dp0.bin
set NODE_DIR=%BIN_DIR%\node-v22
set NODE_EXE=%NODE_DIR%\node.exe

REM Node.js 버전 지정
set NODE_VERSION=v22.18.0
set NODE_ZIP=node-%NODE_VERSION%-win-x64.zip
set NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_ZIP%

REM Node.js가 이미 설치되어 있으면 넘어감
if exist "%NODE_EXE%" (
  echo Node.js already installed at %NODE_EXE%
  goto :RUN_DEV
)

REM .bin 폴더 없으면 생성
if not exist "%BIN_DIR%" (
  mkdir "%BIN_DIR%"
)

REM Node.js 다운로드
echo Downloading Node.js...
powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"

REM 압축 풀기
echo Extracting Node.js...
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%BIN_DIR%'"

REM Node.js 폴더 이동 (npm 포함)
move "%BIN_DIR%\node-%NODE_VERSION%-win-x64" "%NODE_DIR%"

REM 정리
del "%NODE_ZIP%"

echo Node.js installed at %NODE_EXE%

:RUN_DEV
REM =====================================
REM 프로젝트 실행
REM =====================================

REM 의존성 설치 (npm install)
if not exist "%~dp0\node_modules" (
  echo Running "npm install" ...
  "%NODE_EXE%" "%NODE_DIR%\node_modules\npm\bin\npm-cli.js" install
)

REM nodemon 실행
echo Running "nodemon --watch src --exec node --experimental-specifier-resolution=node ." with portable node...
"%NODE_EXE%" "%~dp0\node_modules\nodemon\bin\nodemon.js" --watch src --exec node --experimental-specifier-resolution=node .

:END
endlocal
exit /b
