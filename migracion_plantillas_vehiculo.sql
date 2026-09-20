-- ============================================================================
-- Migración: biblioteca de diagramas vectoriales por Marca+Modelo
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_plantillas_vehiculo.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS plantillas_vehiculo (
    plantilla_id    VARCHAR(20) PRIMARY KEY
                        CHECK (plantilla_id ~ '^PLV-[0-9]{3,}$'),  -- PLV-001
    marca           VARCHAR(50) NOT NULL,
    modelo          VARCHAR(50) NOT NULL,
    nombre_archivo  VARCHAR(255) NOT NULL,
    fecha_subida    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plantillas_vehiculo_marca_modelo
    ON plantillas_vehiculo(marca, modelo);

COMMIT;
