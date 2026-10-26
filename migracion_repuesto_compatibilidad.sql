-- ============================================================================
-- Migración: compatibilidad de repuestos por vehículo
-- Observación del docente: el repuesto no indicaba para qué marca, modelo y
-- años sirve; solo se podía escribir a mano en la descripción.
--
--   * repuestos.tipo_aplicacion: 'Universal' (aceites, líquidos, fusibles) o
--     'Especifico' (filtros, pastillas, discos, bujías…).
--   * repuesto_compatibilidad: marcas/modelos/años en los que calza un
--     repuesto específico. Modelo vacío = todos los modelos de la marca; años
--     vacíos = sin límite.
--
-- Los repuestos existentes quedan como 'Universal' (valor por defecto): el
-- taller revisa cuáles son específicos y les carga su compatibilidad.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
--   psql -U servicar_app -d servicar_sossa -f migracion_repuesto_compatibilidad.sql
-- ============================================================================

BEGIN;

ALTER TABLE repuestos
    ADD COLUMN IF NOT EXISTS tipo_aplicacion VARCHAR(20) NOT NULL DEFAULT 'Universal';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repuestos_tipo_aplicacion_check') THEN
        ALTER TABLE repuestos
            ADD CONSTRAINT repuestos_tipo_aplicacion_check
            CHECK (tipo_aplicacion IN ('Universal','Especifico'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS repuesto_compatibilidad (
    compatibilidad_id VARCHAR(20) PRIMARY KEY
                          CHECK (compatibilidad_id ~ '^RCP-[0-9]{3,}$'),   -- RCP-001
    repuesto_id       VARCHAR(20) NOT NULL
                          REFERENCES repuestos(repuesto_id) ON DELETE CASCADE,
    marca             VARCHAR(50) NOT NULL,
    modelo            VARCHAR(50),             -- NULL = todos los modelos de la marca
    anio_desde        SMALLINT,                -- NULL = sin límite inferior
    anio_hasta        SMALLINT,                -- NULL = sin límite superior
    CHECK (anio_desde IS NULL OR anio_hasta IS NULL OR anio_desde <= anio_hasta)
);

CREATE INDEX IF NOT EXISTS idx_repuesto_compatibilidad_repuesto
    ON repuesto_compatibilidad(repuesto_id);

-- Misma protección que el resto de las tablas en Supabase: la API de datos
-- pública no devuelve filas. La API del sistema no se ve afectada porque se
-- conecta como dueño de las tablas.
ALTER TABLE repuesto_compatibilidad ENABLE ROW LEVEL SECURITY;

COMMIT;
