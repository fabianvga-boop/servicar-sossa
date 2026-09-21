<#
    Pone al dia el esquema de PRODUCCION (Supabase) aplicando las migraciones
    del proyecto en orden cronologico.

    QUE HACE, EN ESTE ORDEN
      1. Respaldo completo con pg_dump. Si falla, NO sigue.
      2. Inventario del esquema actual, para saber de donde partimos.
      3. Aplica las migraciones pendientes, una por una, deteniendose al primer error.
      4. Verifica que queden las 28 tablas y que pagos apunte a proformas.

    NO aplica migracion_eliminar_proforma.sql A PROPOSITO: es un paso historico
    del 23/08 que hace DROP TABLE proformas. Correrlo hoy borraria la tabla de
    proformas y, en cascada, el historial de pagos.

    COMO USARLO
      En Supabase: Connect -> Connection string -> URI. Copiala y ejecuta:

        .\migrar_supabase.ps1 -Conexion "postgresql://postgres.xxxx:CLAVE@aws-0-...pooler.supabase.com:5432/postgres"

      La cadena queda solo en tu terminal.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Conexion,

    # Muestra lo que haria sin aplicar ningun cambio.
    [switch]$SoloSimular
)

# 'Continue': en PowerShell 5.1 cada linea de stderr de un ejecutable nativo
# (un simple NOTICE de psql) se convierte en error si se usa 2>&1 con 'Stop'.
# El control de errores se hace mirando $LASTEXITCODE, no la preferencia.
$ErrorActionPreference = 'Continue'
$raiz = $PSScriptRoot

# Se usa la version MAS NUEVA de las herramientas instaladas: pg_dump se niega a
# volcar un servidor de version mayor que la suya, y Supabase corre PostgreSQL 17.
$bin = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
       Where-Object   { $_.Name -match '^\d+$' } |
       Sort-Object    { [int]$_.Name } -Descending |
       ForEach-Object { Join-Path $_.FullName 'bin' } |
       Where-Object   { (Test-Path (Join-Path $_ 'psql.exe')) -and (Test-Path (Join-Path $_ 'pg_dump.exe')) } |
       Select-Object -First 1

if (-not $bin) {
    throw "No se encontro PostgreSQL en 'C:\Program Files\PostgreSQL'. Instala al menos las herramientas cliente."
}

$psql   = Join-Path $bin 'psql.exe'
$pgdump = Join-Path $bin 'pg_dump.exe'

# Orden cronologico. migracion_eliminar_proforma.sql esta excluida a proposito.
$migraciones = @(
    'migracion_repuestos_origen.sql',
    'migracion_presupuesto_diagnostico.sql',
    'migracion_servicios_fuera_catalogo.sql',
    'migracion_fotos_vehiculo.sql',
    'migracion_punto_venta.sql',
    'migracion_precio_compra_venta.sql',
    'migracion_auditoria.sql',
    'migracion_zonas_vehiculo.sql',
    'migracion_plantillas_vehiculo.sql',
    'migracion_siat_preparacion.sql',
    'migracion_proformas_y_facturas.sql'
)

function Consultar($sql) {
    $r = & $psql -d $Conexion -tAc $sql
    if ($LASTEXITCODE -ne 0) { throw "Fallo la consulta: $r" }
    return ($r | Where-Object { $_ -and "$_".Trim() })
}

Write-Host ""
Write-Host "=== 1. Comprobando la conexion ===" -ForegroundColor Cyan
$ver = Consultar "SELECT current_database() || ' @ ' || substring(version() from 'PostgreSQL [0-9.]+');"
Write-Host "    $ver"
Write-Host "    herramientas locales: $bin"

# pg_dump aborta si el servidor es de una version mayor que la suya. Se verifica
# ANTES de tocar nada, para no descubrirlo recien al intentar el respaldo.
$servidorMayor = [int]([int](Consultar "SELECT current_setting('server_version_num');") / 10000)
$dumpTexto     = (& $pgdump --version) -join ' '
$dumpMayor     = if ($dumpTexto -match '(\d+)\.\d+') { [int]$Matches[1] } else { 0 }

if ($dumpMayor -lt $servidorMayor) {
    throw @"
Incompatibilidad de versiones: el servidor es PostgreSQL $servidorMayor y tu pg_dump es $dumpMayor.
pg_dump se niega a volcar un servidor mas nuevo que el, asi que NO se puede hacer el respaldo
previo y no se aplica ninguna migracion.

Solucion: instala las herramientas de PostgreSQL $servidorMayor y volve a correr esto.
    winget install PostgreSQL.PostgreSQL.$servidorMayor
(Convive con la $dumpMayor que ya tenes; el script toma sola la mas nueva.)
"@
}
Write-Host "    pg_dump $dumpMayor contra servidor $servidorMayor : compatible" -ForegroundColor DarkGray

Write-Host ""
Write-Host "=== 2. Estado actual del esquema ===" -ForegroundColor Cyan
$tablas = Consultar "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;"
Write-Host "    tablas: $($tablas.Count)"
Write-Host "    $($tablas -join ', ')"

$tieneProformas = $tablas -contains 'proformas'
Write-Host ""
if ($tieneProformas) {
    Write-Host "    proformas YA EXISTE -> se saltea migracion_proformas_y_facturas.sql" -ForegroundColor Yellow
    $migraciones = $migraciones | Where-Object { $_ -ne 'migracion_proformas_y_facturas.sql' }
} else {
    Write-Host "    proformas NO existe -> se aplicara la migracion (paso irreversible)" -ForegroundColor Yellow
    $filas = Consultar "SELECT count(*) FROM facturas;"
    Write-Host "    filas en facturas que se recodificaran a PRF-: $filas"
}

if ($SoloSimular) {
    Write-Host ""
    Write-Host "=== SIMULACION: se aplicarian estas migraciones ===" -ForegroundColor Cyan
    $migraciones | ForEach-Object { Write-Host "    $_" }
    Write-Host ""
    Write-Host "    (no se hizo respaldo ni se modifico nada)"
    return
}

Write-Host ""
Write-Host "=== 3. Respaldo completo (obligatorio antes de migrar) ===" -ForegroundColor Cyan
$marca    = Get-Date -Format 'yyyyMMdd-HHmmss'
$respaldo = Join-Path $raiz "respaldo_supabase_$marca.sql"
& $pgdump -d $Conexion --no-owner --no-privileges -f $respaldo
if ($LASTEXITCODE -ne 0) { throw "El respaldo FALLO. No se aplica ninguna migracion." }
if (-not (Test-Path $respaldo)) { throw "El respaldo no genero archivo. Abortado." }
$kb = [math]::Round((Get-Item $respaldo).Length / 1KB, 1)
if ($kb -lt 5) { throw "El respaldo pesa $kb KB: demasiado chico, parece incompleto. Abortado." }
Write-Host "    OK -> $respaldo ($kb KB)" -ForegroundColor Green

Write-Host ""
Write-Host "=== 4. Aplicando migraciones ===" -ForegroundColor Cyan
foreach ($m in $migraciones) {
    $ruta = Join-Path $raiz $m
    if (-not (Test-Path $ruta)) { throw "Falta el archivo $m" }
    Write-Host "    -> $m" -NoNewline
    & $psql -d $Conexion -v ON_ERROR_STOP=1 -f $ruta | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FALLO" -ForegroundColor Red
        Write-Host "    (el detalle del error de psql quedo impreso arriba)"
        throw "Se detuvo en $m. La base quedo como estaba antes de este archivo (cada migracion es una transaccion). Respaldo en: $respaldo"
    }
    Write-Host "  ok" -ForegroundColor Green
}

# migracion_siat_preparacion.sql crea facturas_siat, pero el modelo nuevo la
# absorbe dentro de facturas. En la primera corrida la elimina la migracion de
# proformas; si esa se salteo (porque ya estaba aplicada), la tabla queda
# huerfana. Se elimina solo si esta vacia, para no perder nada nunca.
if ((Consultar "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='facturas_siat';") -eq '1') {
    $filasSiat = Consultar "SELECT count(*) FROM facturas_siat;"
    if ($filasSiat -eq '0') {
        & $psql -d $Conexion -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS facturas_siat;" | Out-Null
        Write-Host "    -> facturas_siat (vacia, absorbida por facturas) eliminada" -ForegroundColor DarkGray
    } else {
        Write-Host "    -> facturas_siat tiene $filasSiat filas: se conserva, revisala a mano" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== 5. Verificacion final ===" -ForegroundColor Cyan
$esperadas = @('auditoria','clientes','comisiones','comisiones_config','compra_detalle','compras',
               'diagnosticos','facturas','orden_mecanicos','orden_repuestos','orden_servicios',
               'ordenes_trabajo','pagos','permisos','plantillas_vehiculo','proformas','proveedores',
               'reportes_generados','repuestos','rol_permisos','roles','tipos_servicio','usuarios',
               'vehiculo_fotos','vehiculo_zonas','vehiculos','venta_detalle','ventas')

$final    = Consultar "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;"
$faltan   = $esperadas | Where-Object { $final -notcontains $_ }
$columna  = Consultar "SELECT count(*) FROM information_schema.columns WHERE table_name='pagos' AND column_name='proforma_id';"
$nProf    = Consultar "SELECT count(*) FROM proformas;"
$malCodif = Consultar "SELECT count(*) FROM proformas WHERE proforma_id NOT LIKE 'PRF-%';"

$sobran = $final | Where-Object { $esperadas -notcontains $_ }
Write-Host "    tablas presentes    : $($final.Count) de 28"
if ($sobran) { Write-Host "    tablas inesperadas  : $($sobran -join ', ')" -ForegroundColor Yellow }
Write-Host "    pagos.proforma_id   : $(if ($columna -eq '1') {'si'} else {'NO'})"
Write-Host "    proformas           : $nProf filas, $malCodif sin prefijo PRF-"

if ($faltan) { throw "Faltan tablas: $($faltan -join ', ')" }
if ($columna -ne '1') { throw "pagos no tiene la columna proforma_id." }
if ($malCodif -ne '0') { throw "Quedaron $malCodif proformas sin recodificar a PRF-." }

Write-Host ""
Write-Host "=== LISTO: produccion quedo con el esquema al dia ===" -ForegroundColor Green
Write-Host "    Respaldo previo: $respaldo"
Write-Host "    Siguiente paso : redesplegar Railway para que tome el esquema nuevo."
Write-Host ""
