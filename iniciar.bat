@echo off
REM Levanta el backend y el frontend de Servicar SOSSA, cada uno en su propia ventana.

start "Servicar SOSSA - Backend" cmd /k "cd /d "C:\Users\USUARIO\Desktop\Servicar SOSSA\backend" && dotnet run --project ServicarSossa.API"
start "Servicar SOSSA - Frontend" cmd /k "cd /d "C:\Users\USUARIO\Desktop\Servicar SOSSA\frontend" && ng serve"

echo Backend y frontend iniciandose en ventanas separadas...
echo Backend:  http://localhost:5000/swagger
echo Frontend: http://localhost:4200
