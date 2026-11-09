-- ============================================================================
-- Migración: foto ligada al trabajo de la orden (trazabilidad)
-- Ejecutar una sola vez sobre una BD existente (local o Supabase):
--   psql -U postgres -d servicar_sossa -f migracion_foto_trabajo.sql
-- Una foto con orden_servicio_id es evidencia de ese trabajo; sin él sigue
-- siendo una foto general del vehículo. Las fotos anteriores quedan generales.
-- NO ejecutar sobre una base creada con taller_automotriz_bd.sql actual.
-- ============================================================================

BEGIN;

ALTER TABLE vehiculo_fotos
    ADD COLUMN IF NOT EXISTS orden_servicio_id VARCHAR(20)
        REFERENCES orden_servicios(orden_servicio_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehiculo_fotos_servicio ON vehiculo_fotos(orden_servicio_id);

COMMIT;
