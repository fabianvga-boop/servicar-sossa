<#
    Borra de PRODUCCION (Supabase) los datos de prueba del 05/11/2026.

    QUE HACE, EN ESTE ORDEN
      1. Muestra el PLAN (solo lectura, no cambia nada): que se va a borrar,
         como queda el stock, que costo se restaura y que otros registros con
         "PRUEBA" NO se tocan.
      2. Respaldo completo con pg_dump. Si falla, NO sigue.
      3. Pide que escribas BORRAR. Cualquier otra cosa cancela.
      4. Borra todo en UNA transaccion: si algo falla, no queda nada a medias.
      5. Vuelve a mirar para confirmar que no queda nada.

    Si una guarda del script no cuadra (el cliente no dice PRUEBA, hay facturas,
    una comision ya pagada, etc.), aborta sin tocar nada.

    COMO USARLO
      En Supabase: Connect -> Connection string -> URI. Copiala y ejecuta:

        .\limpiar_pruebas_produccion.ps1 -Conexion "postgresql://postgres.xxxx:CLAVE@aws-0-...pooler.supabase.com:5432/postgres"

      Para solo mirar el plan, sin respaldo ni borrado:  agregar -SoloPlan
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Conexion,

    [string]$Cliente = 'CLI-007',      # "PRUEBA Sistema Defensa": de el cuelgan vehiculo, diagnostico, orden, proforma, pagos y comision
    [string]$Ventas  = 'VTA-002',      # venta de mostrador de prueba (varias: separadas por coma)
    [string]$Compras = 'CMP-001',      # compra de prueba
    [string]$Repuesto = 'REP-004',     # repuesto cuyo costo la compra dejo en 0
    [decimal]$Costo = 80,              # costo con el que se restaura (antes de la prueba)

    [switch]$SoloPlan
)

$ErrorActionPreference = 'Continue'
$raiz = $PSScriptRoot
$sql  = Join-Path $raiz 'limpiar_pruebas_produccion.sql'
if (-not (Test-Path $sql)) { throw "Falta $sql" }

# Misma regla que migrar_supabase.ps1: la version MAS NUEVA de las herramientas.
$bin = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
       Where-Object   { $_.Name -match '^\d+$' } |
       Sort-Object    { [int]$_.Name } -Descending |
       ForEach-Object { Join-Path $_.FullName 'bin' } |
       Where-Object   { (Test-Path (Join-Path $_ 'psql.exe')) -and (Test-Path (Join-Path $_ 'pg_dump.exe')) } |
       Select-Object -First 1
if (-not $bin) { throw "No se encontro PostgreSQL en 'C:\Program Files\PostgreSQL'." }
$psql   = Join-Path $bin 'psql.exe'
$pgdump = Join-Path $bin 'pg_dump.exe'

function Correr($borrar, $final) {
    & $psql -d $Conexion -v ON_ERROR_STOP=1 `
        -v "cli=$Cliente" -v "vta=$Ventas" -v "cmp=$Compras" -v "rep=$Repuesto" -v "costo=$Costo" `
        -v "borrar=$borrar" -v "final=$final" -f $sql | Out-Host
    # Out-Host: lo que imprime psql va a la pantalla y NO se mezcla con el valor devuelto.
    return [int]$LASTEXITCODE
}

Write-Host ""
Write-Host "=== 1. Conexion ===" -ForegroundColor Cyan
$ver = & $psql -d $Conexion -tAc "SELECT current_database() || ' @ ' || substring(version() from 'PostgreSQL [0-9.]+');"
if ($LASTEXITCODE -ne 0) { throw "No se pudo conectar: $ver" }
Write-Host "    $ver"

# pg_dump se niega a volcar un servidor de version mayor que la suya: se avisa ya.
$servidorMayor = [int]([int](& $psql -d $Conexion -tAc "SELECT current_setting('server_version_num');") / 10000)
$dumpTexto = (& $pgdump --version) -join ' '
$dumpMayor = if ($dumpTexto -match '(\d+)\.\d+') { [int]$Matches[1] } else { 0 }
if ($dumpMayor -lt $servidorMayor) {
    $aviso = "pg_dump $dumpMayor no puede respaldar un servidor $servidorMayor. Instale: winget install PostgreSQL.PostgreSQL.$servidorMayor"
    if ($SoloPlan) { Write-Host "    AVISO: $aviso" -ForegroundColor Yellow } else { throw $aviso }
} else {
    Write-Host "    pg_dump $dumpMayor contra servidor $servidorMayor : compatible" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== 2. Plan (solo lectura, no se cambia nada) ===" -ForegroundColor Cyan
if ((Correr 'false' 'ROLLBACK') -ne 0) { throw "El plan fallo o una guarda aborto. No se toco nada." }

if ($SoloPlan) { Write-Host "`n    (-SoloPlan: no se hizo respaldo ni se borro nada)"; return }

Write-Host ""
Write-Host "=== 3. Respaldo completo (obligatorio antes de borrar) ===" -ForegroundColor Cyan
$marca    = Get-Date -Format 'yyyyMMdd-HHmmss'
$respaldo = Join-Path $raiz "respaldo_supabase_$marca.sql"
& $pgdump -d $Conexion --no-owner --no-privileges -f $respaldo
if ($LASTEXITCODE -ne 0) { throw "El respaldo FALLO. No se borra nada." }
$kb = [math]::Round((Get-Item $respaldo).Length / 1KB, 1)
if ($kb -lt 5) { throw "El respaldo pesa $kb KB: parece incompleto. Abortado." }
Write-Host "    OK -> $respaldo ($kb KB)" -ForegroundColor Green

Write-Host ""
Write-Host "Revise el PLAN de arriba. Esto es IRREVERSIBLE salvo restaurando el respaldo." -ForegroundColor Yellow
$resp = Read-Host "Escriba BORRAR para continuar (otra cosa cancela)"
if ($resp -cne 'BORRAR') { Write-Host "Cancelado. No se borro nada."; return }

Write-Host ""
Write-Host "=== 4. Borrando (una sola transaccion) ===" -ForegroundColor Cyan
if ((Correr 'true' 'COMMIT') -ne 0) {
    throw "El borrado fallo y se revirtio completo. La base quedo como estaba. Respaldo: $respaldo"
}

Write-Host ""
Write-Host "=== 5. Comprobacion: no debe quedar nada ===" -ForegroundColor Cyan
$q = @"
SELECT 'cliente '||'$Cliente', count(*) FROM clientes WHERE cliente_id='$Cliente'
UNION ALL SELECT 'ventas', count(*) FROM ventas WHERE venta_id = ANY (string_to_array('$Ventas', ','))
UNION ALL SELECT 'compras', count(*) FROM compras WHERE compra_id = ANY (string_to_array('$Compras', ','))
UNION ALL SELECT 'costo $Repuesto', precio_compra::int FROM repuestos WHERE repuesto_id='$Repuesto';
"@
& $psql -d $Conexion -c $q

Write-Host ""
Write-Host "=== LISTO ===" -ForegroundColor Green
Write-Host "    Respaldo previo: $respaldo"
Write-Host "    Falta a mano: borrar del bucket las fotos listadas arriba (Supabase > Storage > archivoss > vehiculos)."
Write-Host ""
