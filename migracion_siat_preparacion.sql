-- ============================================================================
-- Migración: preparación para facturación SIAT (sin activarla)
--
-- El taller sigue operando con notas de venta / recibos internos: esta
-- migración NO cambia ninguna columna existente ni el comportamiento actual.
-- Solo agrega columnas opcionales y una tabla nueva que queda vacía hasta que
-- se habilite `Facturacion:Modo = SIAT_ONLINE` en appsettings.
--
-- Es reentrante (IF NOT EXISTS): volver a ejecutarla no rompe nada.
--
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_siat_preparacion.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- CLIENTES
-- El SIAT pide el documento desglosado; `ci_nit` se queda como está porque es
-- lo que el taller usa todos los días y lo que tiene índice único.
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS tipo_documento_id SMALLINT,
    ADD COLUMN IF NOT EXISTS numero_documento  VARCHAR(30),
    ADD COLUMN IF NOT EXISTS complemento       VARCHAR(5);

COMMENT ON COLUMN clientes.tipo_documento_id IS
    'Código del catálogo del SIN: 1=CI, 2=CEX, 3=PAS, 4=OD, 5=NIT. Verificar contra el catálogo vigente.';
COMMENT ON COLUMN clientes.numero_documento IS
    'Número de documento normalizado para el SIAT. Uso interno sigue siendo ci_nit.';

-- ------------------------------------------------------- ÍTEMS FACTURABLES
-- Repuestos y servicios se facturan igual, así que ambos necesitan su
-- homologación contra el catálogo de productos/servicios del SIN.
ALTER TABLE repuestos
    ADD COLUMN IF NOT EXISTS codigo_sin        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS unidad_medida_sin SMALLINT;

ALTER TABLE tipos_servicio
    ADD COLUMN IF NOT EXISTS codigo_sin        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS unidad_medida_sin SMALLINT;

COMMENT ON COLUMN repuestos.codigo_sin IS
    'Homologación del ítem contra el catálogo de productos del SIN.';
COMMENT ON COLUMN tipos_servicio.codigo_sin IS
    'Homologación del servicio contra el catálogo de actividades/productos del SIN.';

-- ------------------------------------------------------------ MÉTODO DE PAGO
-- El código numérico se congela en cada cobro: el catálogo del SIN cambia con
-- el tiempo y lo ya emitido debe conservar el código con el que se emitió.
ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS metodo_pago_id SMALLINT;

ALTER TABLE pagos
    ADD COLUMN IF NOT EXISTS metodo_pago_id SMALLINT;

COMMENT ON COLUMN ventas.metodo_pago_id IS
    'Código SIN de tipo de método de pago, congelado al vender. NULL mientras se emitan recibos internos.';

-- ------------------------------------------------------------- FACTURAS SIAT
-- Todo lo exclusivamente fiscal, separado de lo transaccional. Cuelga de una
-- factura de taller O de una venta de mostrador: nunca de las dos, nunca de
-- ninguna. Mientras el modo sea INTERNAL esta tabla permanece vacía.
CREATE TABLE IF NOT EXISTS facturas_siat (
    factura_siat_id    VARCHAR(20) PRIMARY KEY
                           CHECK (factura_siat_id ~ '^FSI-[0-9]{3,}$'),   -- FSI-001

    factura_id         VARCHAR(20) REFERENCES facturas(factura_id),
    venta_id           VARCHAR(20) REFERENCES ventas(venta_id),

    cuf                VARCHAR(100),
    cufd               VARCHAR(100),
    codigo_recepcion   VARCHAR(100),

    estado_siat        VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                           CHECK (estado_siat IN ('Pendiente', 'Enviada', 'Validada',
                                                  'Rechazada', 'Contingencia', 'Anulada')),

    xml_generado       TEXT,
    xml_firmado        TEXT,
    fecha_emision_siat TIMESTAMPTZ,
    mensaje_servicio   VARCHAR(500),
    fecha_registro     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Exactamente un documento de origen: o factura de taller, o venta de mostrador.
    CONSTRAINT chk_facturas_siat_un_origen CHECK (
        (factura_id IS NOT NULL AND venta_id IS NULL) OR
        (factura_id IS NULL AND venta_id IS NOT NULL)
    )
);

-- 1 a 0..1: un cobro no puede tener dos comprobantes fiscales.
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_siat_factura
    ON facturas_siat(factura_id) WHERE factura_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_siat_venta
    ON facturas_siat(venta_id) WHERE venta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_siat_cuf
    ON facturas_siat(cuf);

COMMIT;
