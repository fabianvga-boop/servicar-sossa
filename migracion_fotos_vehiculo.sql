-- ============================================================================
-- Migración: galería de fotos de vehículo (opcional)
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_fotos_vehiculo.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS vehiculo_fotos (
    foto_id         VARCHAR(20) PRIMARY KEY
                        CHECK (foto_id ~ '^FOT-[0-9]{3,}$'),    -- FOT-001
    vehiculo_id     VARCHAR(20) NOT NULL REFERENCES vehiculos(vehiculo_id) ON DELETE CASCADE,
    nombre_archivo  VARCHAR(255) NOT NULL,
    fecha_subida    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehiculo_fotos_vehiculo ON vehiculo_fotos(vehiculo_id);

COMMIT;
