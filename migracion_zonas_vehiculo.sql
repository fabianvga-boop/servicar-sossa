-- ============================================================================
-- Migración: zonas marcadas sobre el diagrama vectorial del vehículo
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_zonas_vehiculo.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS vehiculo_zonas (
    zona_obs_id     VARCHAR(20) PRIMARY KEY
                        CHECK (zona_obs_id ~ '^ZNA-[0-9]{3,}$'),  -- ZNA-001
    vehiculo_id     VARCHAR(20) NOT NULL REFERENCES vehiculos(vehiculo_id) ON DELETE CASCADE,
    orden_id        VARCHAR(20) REFERENCES ordenes_trabajo(orden_id) ON DELETE SET NULL,
    zona            VARCHAR(40) NOT NULL,
    estado          VARCHAR(20) NOT NULL
                        CHECK (estado IN ('Ok', 'Atencion', 'EnReparacion')),
    detalle         VARCHAR(300),
    fecha_registro  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehiculo_zonas_vehiculo ON vehiculo_zonas(vehiculo_id);

COMMIT;
