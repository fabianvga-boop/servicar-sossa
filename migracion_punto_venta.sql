-- ============================================================================
-- Migración: punto de venta de repuestos + foto de producto
--   * repuestos.nombre_archivo_foto — foto del producto (opcional)
--   * ventas / venta_detalle        — venta de mostrador, sin orden de trabajo
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_punto_venta.sql
-- ============================================================================

BEGIN;

-- 1. Foto del producto
ALTER TABLE repuestos
    ADD COLUMN IF NOT EXISTS nombre_archivo_foto VARCHAR(255);

-- 2. Punto de venta
CREATE TABLE IF NOT EXISTS ventas (
    venta_id        VARCHAR(20) PRIMARY KEY
                        CHECK (venta_id ~ '^VTA-[0-9]{3,}$'),       -- VTA-001
    cliente_id      VARCHAR(20) REFERENCES clientes(cliente_id),    -- opcional: mostrador
    usuario_id      VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    fecha_venta     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metodo_pago     VARCHAR(30) NOT NULL
                        CHECK (metodo_pago IN ('Efectivo','Transferencia','Tarjeta','QR','Otro')),
    total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado          VARCHAR(20) NOT NULL DEFAULT 'Emitida'
                        CHECK (estado IN ('Emitida','Anulada')),
    observaciones   VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS venta_detalle (
    venta_detalle_id VARCHAR(20) PRIMARY KEY
                         CHECK (venta_detalle_id ~ '^VDT-[0-9]{3,}$'),  -- VDT-001
    venta_id         VARCHAR(20) NOT NULL REFERENCES ventas(venta_id) ON DELETE CASCADE,
    repuesto_id      VARCHAR(20) NOT NULL REFERENCES repuestos(repuesto_id),
    cantidad         INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario  DECIMAL(10,2) NOT NULL,
    subtotal         DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha        ON ventas(fecha_venta);
CREATE INDEX IF NOT EXISTS idx_venta_detalle_venta ON venta_detalle(venta_id);

COMMIT;
