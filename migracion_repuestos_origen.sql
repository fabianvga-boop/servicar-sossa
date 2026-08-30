-- ============================================================================
-- Migración: origen de repuestos en orden_repuestos
-- Permite registrar repuestos que no salen del inventario:
--   * ClienteTrae   — lo trae el cliente (no se cobra, no descuenta stock)
--   * CompraExterna  — se compra fuera del taller (se cobra al costo, no descuenta stock)
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_repuestos_origen.sql
-- ============================================================================

BEGIN;

-- 1. repuesto_id deja de ser obligatorio (solo lo llevan los de inventario)
ALTER TABLE orden_repuestos ALTER COLUMN repuesto_id DROP NOT NULL;

-- 2. nuevas columnas: origen y descripción libre
ALTER TABLE orden_repuestos
    ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'Inventario'
        CHECK (origen IN ('Inventario','ClienteTrae','CompraExterna'));

ALTER TABLE orden_repuestos
    ADD COLUMN IF NOT EXISTS descripcion VARCHAR(150);

-- 3. coherencia: inventario exige repuesto_id; los demás exigen descripción
ALTER TABLE orden_repuestos DROP CONSTRAINT IF EXISTS chk_origen_repuesto;
ALTER TABLE orden_repuestos ADD CONSTRAINT chk_origen_repuesto CHECK (
    (origen = 'Inventario'  AND repuesto_id IS NOT NULL) OR
    (origen <> 'Inventario' AND descripcion IS NOT NULL)
);

COMMIT;
