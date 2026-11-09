-- ============================================================================
-- Limpieza de los datos de PRUEBA (prefijo PRUEBA) que quedaron en producción.
-- No se ejecuta solo: lo corre limpiar_pruebas_produccion.ps1, que antes muestra
-- el plan, hace el respaldo y pide confirmación.
--
-- Variables (psql -v): cli, vta, cmp, rep, costo, borrar (true/false), final
--   cli    cliente de prueba; de él cuelgan sus vehículos, diagnósticos, órdenes,
--          proformas, pagos, comisiones y fotos.
--   vta    ventas de mostrador de prueba, separadas por coma.
--   cmp    compras de prueba, separadas por coma.
--   rep    repuesto cuyo costo la compra de prueba dejó en 0.
--   costo  costo con el que se restaura ese repuesto.
--   final  COMMIT para aplicar; ROLLBACK para solo mirar.
--
-- Efecto sobre el inventario: se revierten los movimientos del kárdex de esas
-- órdenes, ventas y compras (el stock vuelve a lo que era) y se recalculan los
-- saldos de los repuestos afectados.
-- ============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
BEGIN;

CREATE TEMP TABLE prm AS
SELECT :'cli'::text AS cli, :'vta'::text AS vta, :'cmp'::text AS cmp,
       :'rep'::text AS rep, :'costo'::numeric AS costo;

CREATE TEMP TABLE c_veh AS SELECT vehiculo_id FROM vehiculos WHERE cliente_id = (SELECT cli FROM prm);
CREATE TEMP TABLE c_ord AS SELECT orden_id FROM ordenes_trabajo WHERE cliente_id = (SELECT cli FROM prm);
CREATE TEMP TABLE c_dia AS SELECT diagnostico_id FROM diagnosticos WHERE vehiculo_id IN (SELECT vehiculo_id FROM c_veh);
CREATE TEMP TABLE c_prf AS SELECT proforma_id FROM proformas WHERE orden_id IN (SELECT orden_id FROM c_ord);
CREATE TEMP TABLE c_pag AS SELECT pago_id FROM pagos WHERE proforma_id IN (SELECT proforma_id FROM c_prf);
CREATE TEMP TABLE c_com AS SELECT comision_id FROM comisiones WHERE orden_id IN (SELECT orden_id FROM c_ord);
CREATE TEMP TABLE c_fot AS SELECT foto_id, nombre_archivo FROM vehiculo_fotos WHERE vehiculo_id IN (SELECT vehiculo_id FROM c_veh);
CREATE TEMP TABLE c_vta AS SELECT venta_id FROM ventas WHERE venta_id = ANY (string_to_array((SELECT vta FROM prm), ','));
CREATE TEMP TABLE c_cmp AS SELECT compra_id FROM compras WHERE compra_id = ANY (string_to_array((SELECT cmp FROM prm), ','));

-- Documentos que mueven stock: de ellos salen los movimientos a revertir.
CREATE TEMP TABLE c_docs AS
SELECT orden_id AS doc FROM c_ord UNION SELECT venta_id FROM c_vta UNION SELECT compra_id FROM c_cmp;

CREATE TEMP TABLE mv AS
SELECT repuesto_id, sum(cantidad)::int AS neto
  FROM movimientos_inventario WHERE referencia IN (SELECT doc FROM c_docs)
 GROUP BY repuesto_id;

\echo
\echo === PLAN: lo que se va a borrar ===
SELECT 'cliente'      AS que, cliente_id AS codigo, trim(concat_ws(' ', nombre, apellido, razon_social)) AS detalle
  FROM clientes WHERE cliente_id = (SELECT cli FROM prm)
UNION ALL SELECT 'vehículo', vehiculo_id, placa FROM vehiculos WHERE vehiculo_id IN (SELECT vehiculo_id FROM c_veh)
UNION ALL SELECT 'foto (borrar también del bucket)', foto_id, nombre_archivo FROM c_fot
UNION ALL SELECT 'diagnóstico', diagnostico_id, left(descripcion_falla, 60) FROM diagnosticos WHERE diagnostico_id IN (SELECT diagnostico_id FROM c_dia)
UNION ALL SELECT 'orden', orden_id, estado FROM ordenes_trabajo WHERE orden_id IN (SELECT orden_id FROM c_ord)
UNION ALL SELECT 'proforma', proforma_id, estado || ' Bs ' || total FROM proformas WHERE proforma_id IN (SELECT proforma_id FROM c_prf)
UNION ALL SELECT 'pago', pago_id, metodo_pago || ' Bs ' || monto FROM pagos WHERE pago_id IN (SELECT pago_id FROM c_pag)
UNION ALL SELECT 'comisión', comision_id, estado_pago || ' Bs ' || monto FROM comisiones WHERE comision_id IN (SELECT comision_id FROM c_com)
UNION ALL SELECT 'venta de mostrador', venta_id, estado || ' Bs ' || total FROM ventas WHERE venta_id IN (SELECT venta_id FROM c_vta)
UNION ALL SELECT 'compra', compra_id, 'Bs ' || total || coalesce(' · ' || referencia, '') FROM compras WHERE compra_id IN (SELECT compra_id FROM c_cmp)
ORDER BY 1, 2;

\echo
\echo === Inventario: el stock vuelve a lo que era ===
SELECT r.repuesto_id, r.nombre, r.stock_actual AS stock_hoy, mv.neto AS movimientos_de_prueba,
       r.stock_actual - mv.neto AS stock_despues
  FROM mv JOIN repuestos r USING (repuesto_id) ORDER BY 1;

\echo
\echo === Costo que se restaura ===
SELECT repuesto_id, nombre, precio_compra AS costo_hoy, (SELECT costo FROM prm) AS costo_despues
  FROM repuestos WHERE repuesto_id = (SELECT rep FROM prm);

\echo
\echo === Otros registros con PRUEBA que NO se tocan (revíselos) ===
SELECT 'cliente' AS que, cliente_id AS codigo, nombre AS detalle FROM clientes
 WHERE (nombre ILIKE '%PRUEBA%' OR coalesce(apellido,'') ILIKE '%PRUEBA%') AND cliente_id <> (SELECT cli FROM prm)
UNION ALL SELECT 'repuesto', repuesto_id, nombre FROM repuestos WHERE nombre ILIKE '%PRUEBA%'
UNION ALL SELECT 'compra', compra_id, referencia FROM compras WHERE coalesce(referencia,'') ILIKE '%PRUEBA%' AND compra_id NOT IN (SELECT compra_id FROM c_cmp)
UNION ALL SELECT 'venta', venta_id, observaciones FROM ventas WHERE coalesce(observaciones,'') ILIKE '%PRUEBA%' AND venta_id NOT IN (SELECT venta_id FROM c_vta)
UNION ALL SELECT 'pago', pago_id, referencia FROM pagos WHERE coalesce(referencia,'') ILIKE '%PRUEBA%' AND pago_id NOT IN (SELECT pago_id FROM c_pag)
UNION ALL SELECT 'diagnóstico', diagnostico_id, left(descripcion_falla, 60) FROM diagnosticos WHERE descripcion_falla ILIKE '%PRUEBA%' AND diagnostico_id NOT IN (SELECT diagnostico_id FROM c_dia)
UNION ALL SELECT 'usuario', usuario_id, username FROM usuarios WHERE username ILIKE '%prueba%' OR nombre ILIKE '%PRUEBA%';

-- ---------------------------------------------------------------- Guardas
-- Si algo no cuadra con lo esperado, se aborta sin tocar nada.
DO $$
DECLARE
  cli text := (SELECT cli FROM prm);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE cliente_id = cli
                  AND (nombre ILIKE '%PRUEBA%' OR coalesce(apellido,'') ILIKE '%PRUEBA%' OR coalesce(razon_social,'') ILIKE '%PRUEBA%')) THEN
    RAISE EXCEPTION 'El cliente % no existe o no dice PRUEBA en el nombre: no se borra nada.', cli;
  END IF;
  IF (SELECT count(*) FROM c_veh) > 5 OR (SELECT count(*) FROM c_ord) > 5 THEN
    RAISE EXCEPTION 'El cliente % tiene demasiados vehículos u órdenes para ser una prueba: revisar a mano.', cli;
  END IF;
  IF EXISTS (SELECT 1 FROM facturas WHERE orden_id IN (SELECT orden_id FROM c_ord) OR venta_id IN (SELECT venta_id FROM c_vta)) THEN
    RAISE EXCEPTION 'Hay facturas fiscales ligadas a los datos de prueba: no se borran desde este script.';
  END IF;
  IF EXISTS (SELECT 1 FROM comisiones WHERE comision_id IN (SELECT comision_id FROM c_com) AND estado_pago = 'Pagado') THEN
    RAISE EXCEPTION 'Una comisión de prueba ya figura como Pagada (salió dinero): revisar a mano.';
  END IF;
  IF (SELECT count(*) FROM c_vta) <> cardinality(string_to_array((SELECT vta FROM prm), ','))
  OR (SELECT count(*) FROM c_cmp) <> cardinality(string_to_array((SELECT cmp FROM prm), ',')) THEN
    RAISE EXCEPTION 'Alguna venta o compra indicada no existe: revise los códigos.';
  END IF;
  IF EXISTS (SELECT 1 FROM c_vta v JOIN ventas w USING (venta_id) WHERE w.cliente_id IS NOT NULL AND w.cliente_id <> cli) THEN
    RAISE EXCEPTION 'Una venta indicada pertenece a otro cliente: revisar a mano.';
  END IF;
END $$;

\if :borrar
-- ------------------------------------------------------------ Borrado real
-- 1. Inventario: devolver el stock y quitar los movimientos de prueba.
UPDATE repuestos r SET stock_actual = r.stock_actual - mv.neto FROM mv WHERE r.repuesto_id = mv.repuesto_id;
DELETE FROM movimientos_inventario WHERE referencia IN (SELECT doc FROM c_docs);
UPDATE movimientos_inventario m SET saldo = s.saldo
  FROM (SELECT movimiento_id,
               sum(cantidad) OVER (PARTITION BY repuesto_id ORDER BY fecha, movimiento_id)::int AS saldo
          FROM movimientos_inventario WHERE repuesto_id IN (SELECT repuesto_id FROM mv)) s
 WHERE m.movimiento_id = s.movimiento_id AND m.saldo <> s.saldo;

-- 2. Documentos, de los que dependen a los que dependen de ellos.
DELETE FROM comisiones WHERE comision_id IN (SELECT comision_id FROM c_com);
DELETE FROM pagos      WHERE pago_id IN (SELECT pago_id FROM c_pag);
DELETE FROM proformas  WHERE proforma_id IN (SELECT proforma_id FROM c_prf);
DELETE FROM ordenes_trabajo WHERE orden_id IN (SELECT orden_id FROM c_ord);   -- arrastra servicios, repuestos y mecánicos
DELETE FROM ventas  WHERE venta_id IN (SELECT venta_id FROM c_vta);           -- arrastra su detalle
DELETE FROM compras WHERE compra_id IN (SELECT compra_id FROM c_cmp);         -- arrastra su detalle
DELETE FROM clientes WHERE cliente_id = (SELECT cli FROM prm);                -- arrastra vehículos, fotos, zonas y diagnósticos

-- 3. Costo que la compra de prueba dejó en 0.
UPDATE repuestos SET precio_compra = (SELECT costo FROM prm)
 WHERE repuesto_id = (SELECT rep FROM prm) AND precio_compra = 0;

-- 4. Rastro en la auditoría de lo borrado.
DELETE FROM auditoria WHERE entidad_id IN (
  SELECT cli FROM prm UNION SELECT vehiculo_id FROM c_veh UNION SELECT diagnostico_id FROM c_dia
  UNION SELECT orden_id FROM c_ord UNION SELECT proforma_id FROM c_prf UNION SELECT pago_id FROM c_pag
  UNION SELECT comision_id FROM c_com UNION SELECT foto_id FROM c_fot
  UNION SELECT venta_id FROM c_vta UNION SELECT compra_id FROM c_cmp);

\echo
\echo === BORRADO APLICADO (pendiente de COMMIT) ===
\echo Fotos a quitar a mano del bucket (Storage > archivoss > vehiculos):
SELECT nombre_archivo FROM c_fot;
\endif

:final;
