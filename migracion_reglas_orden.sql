-- ============================================================================
-- Migración: reglas de trabajo en la orden
--
--   * tipos_servicio.requiere_repuesto: el servicio consume un repuesto
--     (cambio de aceite, de batería, de pastillas…). Una orden no puede dar
--     por completado ese servicio sin registrar el repuesto usado, del
--     inventario, traído por el cliente o comprado afuera.
--   * orden_servicios.requiere_repuesto: copia del valor del catálogo al
--     cargar el servicio (o lo que indique el Administrador si el servicio es
--     fuera de catálogo). Se congela como el precio: si el catálogo cambia
--     después, la orden en curso no cambia sus reglas.
--   * orden_repuestos.orden_servicio_id: para qué servicio se usó el repuesto.
--     Es opcional (un repuesto puede no ser de un servicio en particular) y se
--     pone en NULL si el servicio se quita de la orden.
--   * auditoria.accion admite 'Excepcion': asignar un segundo mecánico a una
--     orden o completar un servicio sin su repuesto quedan registrados con el
--     motivo que escribió el Administrador.
--
-- Clasificación inicial: al crear la columna se marcan como "requiere
-- repuesto" los servicios del catálogo cuyo nombre lo indica (aceite, filtro,
-- batería, bujías, pastillas…). Solo se hace esa primera vez: si después el
-- Administrador cambia la marca de un servicio, volver a ejecutar este script
-- no la pisa. Los servicios ya cargados en órdenes quedan en FALSE: la regla
-- rige para los que se carguen de ahora en adelante.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
--   psql -U servicar_app -d servicar_sossa -f migracion_reglas_orden.sql
-- ============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tipos_servicio' AND column_name = 'requiere_repuesto'
    ) THEN
        ALTER TABLE tipos_servicio
            ADD COLUMN requiere_repuesto BOOLEAN NOT NULL DEFAULT FALSE;

        UPDATE tipos_servicio
           SET requiere_repuesto = TRUE
         WHERE nombre ILIKE ANY (ARRAY[
                   '%aceite%', '%filtro%', '%bater%', '%buj%', '%pastilla%',
                   '%disco%', '%lvula%', '%correa%', '%amortiguador%', '%llanta%',
                   '%neum%', '%embrague%', '%clutch%', '%rodamiento%', '%radiador%']);
    END IF;
END $$;

ALTER TABLE orden_servicios
    ADD COLUMN IF NOT EXISTS requiere_repuesto BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orden_repuestos
    ADD COLUMN IF NOT EXISTS orden_servicio_id VARCHAR(20)
        REFERENCES orden_servicios(orden_servicio_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orden_repuestos_servicio
    ON orden_repuestos(orden_servicio_id);

ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_accion_check;
ALTER TABLE auditoria
    ADD CONSTRAINT auditoria_accion_check
    CHECK (accion IN ('Crear','Editar','Eliminar','Anular','Ajustar','CambiarEstado','Excepcion'));

COMMIT;
