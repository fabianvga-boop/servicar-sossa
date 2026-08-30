-- ============================================================================
-- Migración: servicios fuera de catálogo en orden_servicios
-- Permite registrar un servicio con nombre libre y precio manual cuando el
-- trabajo no está en el catálogo (tipos_servicio).
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_servicios_fuera_catalogo.sql
-- ============================================================================

BEGIN;

ALTER TABLE orden_servicios ALTER COLUMN servicio_id DROP NOT NULL;

ALTER TABLE orden_servicios
    ADD COLUMN IF NOT EXISTS nombre_libre VARCHAR(150);

ALTER TABLE orden_servicios DROP CONSTRAINT IF EXISTS chk_origen_servicio;
ALTER TABLE orden_servicios ADD CONSTRAINT chk_origen_servicio CHECK (
    (servicio_id IS NOT NULL AND nombre_libre IS NULL) OR
    (servicio_id IS NULL AND nombre_libre IS NOT NULL)
);

COMMIT;
