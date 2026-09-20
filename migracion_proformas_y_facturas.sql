-- ============================================================================
-- Migración: separar Proformas (cobro interno) de Facturas (fiscal SIAT)
--
-- QUÉ HACE
--   1. La tabla `facturas` actual pasa a llamarse `proformas`: siempre fue el
--      documento de cobro del taller, sin valor fiscal, y la interfaz ya lo
--      mostraba como "Proforma". Sus 6 filas se recodifican FAC-00X -> PRF-00X.
--   2. `pagos.factura_id` pasa a `proformas_id`: el cliente paga contra la proforma.
--   3. Se elimina `facturas_siat` (creada hoy, vacía): sus campos se mudan
--      adentro de la nueva `facturas`, que ahora sí es el comprobante fiscal.
--   4. Se crea la nueva `facturas`, que cuelga de una orden O de una venta.
--
-- ATENCIÓN — ESTA MIGRACIÓN NO ES REVERSIBLE CON UN CLIC.
-- Renombra tablas y recodifica llaves primarias que ya tienen datos.
-- HAGA UN RESPALDO ANTES DE EJECUTARLA:
--   pg_dump -U postgres -d servicar_sossa -f respaldo_antes_proformas.sql
--
-- Ejecutar una sola vez:
--   psql -U postgres -d servicar_sossa -f migracion_proformas_y_facturas.sql
-- ============================================================================

BEGIN;

-- ======================================================== 1. FACTURAS -> PROFORMAS

ALTER TABLE facturas RENAME TO proformas;
ALTER TABLE proformas RENAME COLUMN factura_id TO proforma_id;

-- Los nombres de constraints e índices no se renombran solos.
ALTER TABLE proformas RENAME CONSTRAINT facturas_factura_id_check TO proformas_proforma_id_check;
ALTER TABLE proformas RENAME CONSTRAINT facturas_estado_check     TO proformas_estado_check;
ALTER TABLE proformas RENAME CONSTRAINT facturas_orden_id_fkey    TO proformas_orden_id_fkey;
ALTER INDEX facturas_pkey      RENAME TO proformas_pkey;
ALTER INDEX idx_facturas_orden RENAME TO idx_proformas_orden;

-- ================================================== 2. PAGOS APUNTAN A PROFORMA

ALTER TABLE pagos RENAME COLUMN factura_id TO proforma_id;
ALTER TABLE pagos RENAME CONSTRAINT pagos_factura_id_fkey TO pagos_proforma_id_fkey;
ALTER INDEX idx_pagos_factura RENAME TO idx_pagos_proforma;

-- ================================================ 3. RECODIFICAR FAC-00X -> PRF-00X

-- El CHECK del formato y la FK estorban mientras se recodifica: se sueltan y
-- se vuelven a poner ya con la regla nueva.
ALTER TABLE proformas DROP CONSTRAINT proformas_proforma_id_check;
ALTER TABLE pagos     DROP CONSTRAINT pagos_proforma_id_fkey;

UPDATE proformas SET proforma_id = 'PRF-' || substring(proforma_id from 5)
WHERE proforma_id LIKE 'FAC-%';

UPDATE pagos SET proforma_id = 'PRF-' || substring(proforma_id from 5)
WHERE proforma_id LIKE 'FAC-%';

ALTER TABLE proformas ADD CONSTRAINT proformas_proforma_id_check
    CHECK (proforma_id ~ '^PRF-[0-9]{3,}$');

ALTER TABLE pagos ADD CONSTRAINT pagos_proforma_id_fkey
    FOREIGN KEY (proforma_id) REFERENCES proformas(proforma_id) ON DELETE CASCADE;

-- ===================================================== 4. FUERA facturas_siat

-- Se creó hoy y está vacía: sus columnas se mudan adentro de la nueva
-- `facturas`. Ya no hace falta una tabla satélite, porque ahora la factura
-- ES el documento fiscal y no existe si no se emitió ante el SIN.
DROP TABLE IF EXISTS facturas_siat;

-- ================================================== 5. NUEVA TABLA `facturas`

-- Comprobante fiscal. Cuelga de una orden de trabajo O de una venta de
-- mostrador, nunca de las dos. Mientras el modo sea INTERNAL queda vacía.
CREATE TABLE facturas (
    factura_id         VARCHAR(20) PRIMARY KEY
                           CHECK (factura_id ~ '^FAC-[0-9]{3,}$'),        -- FAC-001

    orden_id           VARCHAR(20) REFERENCES ordenes_trabajo(orden_id),
    venta_id           VARCHAR(20) REFERENCES ventas(venta_id),

    -- --- Datos comerciales, congelados al emitir --------------------------
    fecha_emision      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nit_razon_social   VARCHAR(150),
    total              NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    metodo_pago_id     SMALLINT,
    estado             VARCHAR(20)  NOT NULL DEFAULT 'Emitida'
                           CHECK (estado IN ('Emitida', 'Anulada')),

    -- --- Datos fiscales (SIAT) --------------------------------------------
    numero_factura     BIGINT,       -- correlativo fiscal que exige el SIN
    cuf                VARCHAR(100),
    cufd               VARCHAR(100),
    codigo_recepcion   VARCHAR(100),
    estado_siat        VARCHAR(20)  NOT NULL DEFAULT 'Pendiente'
                           CHECK (estado_siat IN ('Pendiente', 'Enviada', 'Validada',
                                                  'Rechazada', 'Contingencia', 'Anulada')),
    xml_generado       TEXT,
    xml_firmado        TEXT,
    fecha_emision_siat TIMESTAMPTZ,
    mensaje_servicio   VARCHAR(500),

    -- Exactamente un origen: o una orden de taller, o una venta de mostrador.
    CONSTRAINT chk_facturas_un_origen CHECK (
        (orden_id IS NOT NULL AND venta_id IS NULL) OR
        (orden_id IS NULL AND venta_id IS NOT NULL)
    )
);

-- Un documento no puede facturarse dos veces con la factura vigente.
CREATE UNIQUE INDEX idx_facturas_orden_vigente
    ON facturas(orden_id) WHERE orden_id IS NOT NULL AND estado = 'Emitida';

CREATE UNIQUE INDEX idx_facturas_venta_vigente
    ON facturas(venta_id) WHERE venta_id IS NOT NULL AND estado = 'Emitida';

CREATE INDEX idx_facturas_cuf          ON facturas(cuf);
CREATE INDEX idx_facturas_fecha        ON facturas(fecha_emision);

COMMENT ON TABLE  facturas IS
    'Comprobante fiscal SIAT. Vacía mientras Facturacion:Modo = INTERNAL.';
COMMENT ON TABLE  proformas IS
    'Documento de cobro del taller, sin valor fiscal. Es el flujo operativo actual.';

COMMIT;
