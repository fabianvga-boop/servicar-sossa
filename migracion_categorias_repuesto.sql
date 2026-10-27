-- ============================================================================
-- Migración: categorías de repuesto
--
-- Un servicio del catálogo no se enlaza a un repuesto concreto (habría que
-- crear un "Cambio de aceite" por cada marca de aceite), sino a TIPOS de
-- repuesto: "Cambio de aceite y filtro" lleva Aceite de motor y Filtro de
-- aceite, y con eso quedan cubiertos todos los aceites y filtros del
-- inventario, los de hoy y los que se compren después.
--
--   * categorias_repuesto: lista editable por el Administrador (CAT-000).
--   * repuestos.categoria_id: categoría del repuesto (opcional). Si se borra la
--     categoría, el repuesto queda sin categoría.
--   * servicio_categorias: qué categorías lleva cada servicio del catálogo.
--
-- Regla en la orden: a un servicio con categorías no se le puede registrar un
-- repuesto del inventario de otra categoría (aceite para "Cambio de bujías").
-- Solo el Administrador puede hacerlo igual, escribiendo el motivo, que queda
-- en auditoría. Un servicio sin categorías, o un repuesto sin categoría, no se
-- controla.
--
-- Clasificación inicial: solo cuando se crea cada tabla o columna se cargan
-- las categorías típicas de un taller y se clasifican los repuestos y los
-- servicios existentes por su nombre. Volver a ejecutar el archivo no pisa lo
-- que el Administrador haya cambiado después.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
--   psql -U servicar_app -d servicar_sossa -f migracion_categorias_repuesto.sql
-- ============================================================================

-- Los nombres llevan tildes: sin esto, psql en Windows los lee con la página
-- de códigos de la consola y quedan mal guardados.
SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'categorias_repuesto') THEN

        CREATE TABLE categorias_repuesto (
            categoria_id   VARCHAR(20)  PRIMARY KEY
                               CHECK (categoria_id ~ '^CAT-[0-9]{3,}$'),   -- CAT-001
            nombre         VARCHAR(60)  NOT NULL UNIQUE,
            fecha_registro TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO categorias_repuesto (categoria_id, nombre) VALUES
            ('CAT-001', 'Aceite de motor'),
            ('CAT-002', 'Filtro de aceite'),
            ('CAT-003', 'Filtro de aire'),
            ('CAT-004', 'Filtro de combustible'),
            ('CAT-005', 'Pastillas de freno'),
            ('CAT-006', 'Discos de freno'),
            ('CAT-007', 'Líquido de frenos'),
            ('CAT-008', 'Batería'),
            ('CAT-009', 'Bujías'),
            ('CAT-010', 'Refrigerante'),
            ('CAT-011', 'Amortiguadores'),
            ('CAT-012', 'Correas'),
            ('CAT-013', 'Embrague'),
            ('CAT-014', 'Aceite de transmisión'),
            ('CAT-015', 'Llantas'),
            ('CAT-016', 'Iluminación'),
            ('CAT-017', 'Fusibles y eléctricos'),
            ('CAT-018', 'Limpiaparabrisas');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'repuestos' AND column_name = 'categoria_id') THEN

        ALTER TABLE repuestos
            ADD COLUMN categoria_id VARCHAR(20)
                REFERENCES categorias_repuesto(categoria_id) ON DELETE SET NULL;

        -- El orden importa: "Filtro de aceite" es filtro antes que aceite.
        UPDATE repuestos SET categoria_id = CASE
            WHEN nombre ILIKE '%filtro%aceite%'                          THEN 'CAT-002'
            WHEN nombre ILIKE '%filtro%aire%' OR nombre ILIKE '%filtro%cabina%' THEN 'CAT-003'
            WHEN nombre ILIKE '%filtro%combust%' OR nombre ILIKE '%filtro%gasol%'
              OR nombre ILIKE '%filtro%di_sel%'                          THEN 'CAT-004'
            WHEN nombre ILIKE '%aceite%' AND (nombre ILIKE '%transmisi%' OR nombre ILIKE '%caja%'
              OR nombre ILIKE '%atf%' OR nombre ILIKE '%diferencial%')   THEN 'CAT-014'
            WHEN nombre ILIKE '%aceite%'                                 THEN 'CAT-001'
            WHEN nombre ILIKE '%pastilla%'                               THEN 'CAT-005'
            WHEN nombre ILIKE '%disco%' AND nombre NOT ILIKE '%embrague%' THEN 'CAT-006'
            WHEN nombre ILIKE '%l_quido%freno%' OR nombre ILIKE '%dot%3%'
              OR nombre ILIKE '%dot%4%'                                  THEN 'CAT-007'
            WHEN nombre ILIKE '%bater%'                                  THEN 'CAT-008'
            WHEN nombre ILIKE '%buj%'                                    THEN 'CAT-009'
            WHEN nombre ILIKE '%refrigerante%' OR nombre ILIKE '%anticongelante%' THEN 'CAT-010'
            WHEN nombre ILIKE '%amortiguador%'                           THEN 'CAT-011'
            WHEN nombre ILIKE '%correa%' OR nombre ILIKE '%banda%'       THEN 'CAT-012'
            WHEN nombre ILIKE '%embrague%' OR nombre ILIKE '%clutch%'    THEN 'CAT-013'
            WHEN nombre ILIKE '%llanta%' OR nombre ILIKE '%neum%'        THEN 'CAT-015'
            WHEN nombre ILIKE '%foco%' OR nombre ILIKE '%faro%' OR nombre ILIKE '%bombilla%' THEN 'CAT-016'
            WHEN nombre ILIKE '%fusible%'                                THEN 'CAT-017'
            WHEN nombre ILIKE '%plumilla%' OR nombre ILIKE '%limpiaparabrisas%' THEN 'CAT-018'
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repuestos_categoria ON repuestos(categoria_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'servicio_categorias') THEN

        CREATE TABLE servicio_categorias (
            servicio_id  VARCHAR(20) NOT NULL
                             REFERENCES tipos_servicio(servicio_id) ON DELETE CASCADE,
            categoria_id VARCHAR(20) NOT NULL
                             REFERENCES categorias_repuesto(categoria_id) ON DELETE CASCADE,
            PRIMARY KEY (servicio_id, categoria_id)
        );

        -- Solo los servicios que ya estaban marcados como "lleva repuestos".
        INSERT INTO servicio_categorias (servicio_id, categoria_id)
        SELECT s.servicio_id, c.categoria_id
          FROM tipos_servicio s
          JOIN (VALUES
                ('CAT-001', '%aceite%',            '%transmisi%'),
                ('CAT-002', '%aceite%filtro%',     NULL),
                ('CAT-002', '%filtro%aceite%',     NULL),
                ('CAT-003', '%filtro%aire%',       NULL),
                ('CAT-004', '%filtro%combust%',    NULL),
                ('CAT-005', '%pastilla%',          NULL),
                ('CAT-006', '%disco%freno%',       NULL),
                ('CAT-007', '%l_quido%freno%',     NULL),
                ('CAT-008', '%bater%',             NULL),
                ('CAT-009', '%buj%',               NULL),
                ('CAT-010', '%refrigerante%',      NULL),
                ('CAT-011', '%amortiguador%',      NULL),
                ('CAT-012', '%correa%',            NULL),
                ('CAT-012', '%banda%',             NULL),
                ('CAT-013', '%embrague%',          NULL),
                ('CAT-014', '%aceite%transmisi%',  NULL),
                ('CAT-015', '%llanta%',            NULL)
               ) AS c(categoria_id, patron, excluir)
            ON s.nombre ILIKE c.patron
           AND (c.excluir IS NULL OR s.nombre NOT ILIKE c.excluir)
           -- "Cambio de filtro de aceite" no lleva aceite: solo filtro.
           AND NOT (c.categoria_id = 'CAT-001' AND s.nombre ILIKE '%filtro de aceite%'
                    AND s.nombre NOT ILIKE '%aceite y%')
         WHERE s.requiere_repuesto
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_servicio_categorias_categoria ON servicio_categorias(categoria_id);

COMMIT;
