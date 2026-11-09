-- ============================================================================
-- Migración: la inspección del vehículo se registra al diagnosticar
-- Cada marca de vehiculo_zonas puede quedar ligada al diagnóstico en el que se
-- hizo. En la orden de trabajo la inspección solo se consulta. Las marcas ya
-- registradas quedan sin diagnóstico (NULL). Idempotente.
--   psql -U postgres -d servicar_sossa -f migracion_inspeccion_diagnostico.sql
-- ============================================================================

BEGIN;

ALTER TABLE vehiculo_zonas
    ADD COLUMN IF NOT EXISTS diagnostico_id VARCHAR(20)
        REFERENCES diagnosticos(diagnostico_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehiculo_zonas_diagnostico ON vehiculo_zonas(diagnostico_id);

COMMIT;
