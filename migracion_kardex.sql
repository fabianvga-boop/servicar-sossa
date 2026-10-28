-- ============================================================================
-- Migración: kárdex de inventario
--
-- Cada cambio de stock de un repuesto queda como un movimiento, con su saldo:
-- de dónde salió cada unidad y a dónde fue. "Procedencia" del repuesto pasa a
-- mostrar este kárdex, y su último saldo cuadra con el stock actual.
--
--   * movimientos_inventario (MOV-000): repuesto, fecha, tipo, cantidad
--     (+ entra, - sale), saldo después del movimiento, referencia (CMP-, ORD-,
--     VTA-), detalle, precio unitario y quién lo hizo.
--
-- Reconstrucción del historial (solo al crear la tabla): compras, órdenes
-- cerradas, ventas vigentes y ajustes (leídos de la auditoría). Lo que no se
-- explica con eso (stock cargado al crear el repuesto, movimientos anteriores
-- a la auditoría) entra como "Saldo anterior al kárdex", primero en la lista,
-- para que el último saldo coincida con el stock actual.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
--   psql -U servicar_app -d servicar_sossa -f migracion_kardex.sql
-- ============================================================================

SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_name = 'movimientos_inventario') THEN
        RETURN;
    END IF;

    CREATE TABLE movimientos_inventario (
        movimiento_id   VARCHAR(20)  PRIMARY KEY
                            CHECK (movimiento_id ~ '^MOV-[0-9]{3,}$'),   -- MOV-001
        repuesto_id     VARCHAR(20)  NOT NULL
                            REFERENCES repuestos(repuesto_id) ON DELETE CASCADE,
        fecha           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        tipo            VARCHAR(20)  NOT NULL
                            CHECK (tipo IN ('SaldoInicial','StockInicial','Compra','SalidaOrden',
                                            'DevolucionOrden','Venta','AnulacionVenta','Ajuste')),
        cantidad        INT          NOT NULL CHECK (cantidad <> 0),   -- + entra, - sale
        saldo           INT          NOT NULL,                         -- stock después del movimiento
        referencia      VARCHAR(20),                                   -- CMP-, ORD-, VTA-
        detalle         VARCHAR(200),
        precio_unitario DECIMAL(10,2),
        usuario_id      VARCHAR(20)  REFERENCES usuarios(usuario_id)
    );

    CREATE INDEX idx_movimientos_repuesto ON movimientos_inventario(repuesto_id, fecha);

    -- Historial reconstruido a partir de lo que ya está registrado.
    CREATE TEMP TABLE mov_tmp ON COMMIT DROP AS
    SELECT d.repuesto_id, c.fecha, 'Compra'::varchar AS tipo, d.cantidad, c.compra_id AS referencia,
           left(coalesce(p.nombre,
                CASE WHEN c.referencia IS NULL THEN 'Compra ocasional'
                     ELSE 'Compra ocasional (' || c.referencia || ')' END), 200) AS detalle,
           d.precio_unitario, c.usuario_id, 1 AS orden
      FROM compra_detalle d
      JOIN compras c USING (compra_id)
      LEFT JOIN proveedores p ON p.proveedor_id = c.proveedor_id
    UNION ALL
    SELECT o.repuesto_id, coalesce(t.fecha_cierre, t.fecha_creacion), 'SalidaOrden', -o.cantidad, t.orden_id,
           'Usado en la orden ' || t.orden_id, o.precio_unitario, NULL, 1
      FROM orden_repuestos o
      JOIN ordenes_trabajo t USING (orden_id)
     WHERE t.estado = 'Cerrada' AND o.origen = 'Inventario' AND o.repuesto_id IS NOT NULL
    UNION ALL
    SELECT v.repuesto_id, w.fecha_venta, 'Venta', -v.cantidad, w.venta_id,
           'Venta en mostrador', v.precio_unitario, w.usuario_id, 1
      FROM venta_detalle v
      JOIN ventas w USING (venta_id)
     WHERE w.estado = 'Emitida'
    UNION ALL
    -- "Ajustó el stock de 'X' de 10 a 12 (+2) — Conteo físico: motivo"
    SELECT a.entidad_id, a.fecha, 'Ajuste',
           substring(a.descripcion from ' a ([0-9]+) \(')::int
             - substring(a.descripcion from ' de ([0-9]+) a [0-9]+ \(')::int,
           NULL, left(coalesce(substring(a.descripcion from '— (.*)$'), 'Ajuste de stock'), 200),
           NULL, a.usuario_id, 1
      FROM auditoria a
     WHERE a.entidad = 'Repuesto' AND a.accion = 'Ajustar'
       AND a.descripcion ~ ' de [0-9]+ a [0-9]+ \('
       AND EXISTS (SELECT 1 FROM repuestos r WHERE r.repuesto_id = a.entidad_id);

    DELETE FROM mov_tmp WHERE cantidad = 0;

    -- Lo que falta para llegar al stock actual: saldo anterior al kárdex.
    INSERT INTO mov_tmp
    SELECT r.repuesto_id,
           least(coalesce((SELECT min(m.fecha) FROM mov_tmp m WHERE m.repuesto_id = r.repuesto_id), now()),
                 coalesce((SELECT min(a.fecha) FROM auditoria a
                            WHERE a.entidad = 'Repuesto' AND a.entidad_id = r.repuesto_id), now()))
             - interval '1 second',
           'SaldoInicial',
           r.stock_actual - coalesce((SELECT sum(m.cantidad) FROM mov_tmp m WHERE m.repuesto_id = r.repuesto_id), 0),
           NULL, 'Saldo anterior al kárdex (stock inicial o movimientos sin registro)', NULL, NULL, 0
      FROM repuestos r
     WHERE r.stock_actual - coalesce((SELECT sum(m.cantidad) FROM mov_tmp m WHERE m.repuesto_id = r.repuesto_id), 0) <> 0;

    INSERT INTO movimientos_inventario
        (movimiento_id, repuesto_id, fecha, tipo, cantidad, saldo, referencia, detalle, precio_unitario, usuario_id)
    SELECT 'MOV-' || lpad(row_number() OVER (ORDER BY fecha, orden, repuesto_id)::text, 3, '0'),
           repuesto_id, fecha, tipo, cantidad,
           sum(cantidad) OVER (PARTITION BY repuesto_id ORDER BY fecha, orden
                               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
           referencia, detalle, precio_unitario, usuario_id
      FROM mov_tmp;
END $$;

COMMIT;
