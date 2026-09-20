@echo off
REM ============================================================================
REM  Servicar SOSSA - levanta backend y frontend, cada uno en su propia ventana.
REM
REM  Las rutas se calculan desde la ubicacion de este archivo (%~dp0), asi que
REM  el script sigue funcionando si moves el proyecto a otra carpeta u otra PC.
REM  Para detener todo: cerra las dos ventanas que se abren, o Ctrl+C en cada una.
REM ============================================================================

setlocal
set "RAIZ=%~dp0"

echo.
echo  === Servicar SOSSA ===
echo.

REM --- Herramientas necesarias en el PATH -------------------------------------
REM  Si instalaste algo recien, cerra y volve a abrir la ventana: el PATH nuevo
REM  no llega a las ventanas que ya estaban abiertas.
where dotnet >nul 2>&1
if errorlevel 1 (
    echo  [X] No se encuentra 'dotnet' en el PATH.
    echo      Instala el .NET 8 SDK, o abri una ventana nueva si lo acabas de instalar.
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo  [X] No se encuentra 'npm' en el PATH.
    echo      Instala Node.js, o abri una ventana nueva si lo acabas de instalar.
    pause
    exit /b 1
)

REM --- PostgreSQL debe estar corriendo o el backend no arranca -----------------
sc query postgresql-x64-16 2>nul | find "RUNNING" >nul
if errorlevel 1 (
    echo  [!] El servicio postgresql-x64-16 NO esta corriendo.
    echo      El backend va a fallar al conectarse a la base servicar_sossa.
    echo      Arrancalo con:  net start postgresql-x64-16
    echo.
    pause
)

REM --- Puertos ya ocupados: evita levantar dos veces lo mismo ------------------
netstat -an | find ":5000" | find "LISTENING" >nul
if not errorlevel 1 echo  [i] El puerto 5000 ya esta ocupado: el backend quiza ya este corriendo.
netstat -an | find ":4200" | find "LISTENING" >nul
if not errorlevel 1 echo  [i] El puerto 4200 ya esta ocupado: el frontend quiza ya este corriendo.

REM --- Arranque ---------------------------------------------------------------
start "Servicar SOSSA - Backend"  cmd /k "cd /d "%RAIZ%backend" && dotnet run --project ServicarSossa.API"
start "Servicar SOSSA - Frontend" cmd /k "cd /d "%RAIZ%frontend" && npm start"

echo  Backend .... http://localhost:5000/swagger
echo  Frontend ... http://localhost:4200
echo.
echo  Esperando a que compile el frontend (puede tardar ~30s la primera vez)...

REM --- Espera hasta que el 4200 responda, con limite de ~90 segundos -----------
set /a INTENTOS=0
:esperar
REM ping en vez de timeout: timeout falla si la entrada esta redirigida
ping -n 4 127.0.0.1 >nul
set /a INTENTOS+=1
netstat -an | find ":4200" | find "LISTENING" >nul
if not errorlevel 1 goto listo
if %INTENTOS% GEQ 30 (
    echo  [!] El frontend no respondio en 90 segundos. Revisa su ventana.
    goto fin
)
goto esperar

:listo
echo  Listo. Abriendo el navegador para iniciar sesion...
start "" http://localhost:4200

:fin
echo.
echo  Podes cerrar esta ventana; las otras dos deben quedar abiertas.
ping -n 9 127.0.0.1 >nul
endlocal
