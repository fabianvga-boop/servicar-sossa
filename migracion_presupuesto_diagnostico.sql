-- ============================================================================
-- Migración: presupuesto aproximado y aprobación del cliente en diagnosticos
-- El diagnóstico pasa a llevar un monto estimado que se le presenta al cliente;
-- el cliente lo aprueba o lo rechaza, y la orden solo se crea si fue aprobado.
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_presupuesto_diagnostico.sql
-- ============================================================================

BEGIN;

ALTER TABLE diagnosticos
    ADD COLUMN IF NOT EXISTS monto_estimado DECIMAL(12,2);

ALTER TABLE diagnosticos
    ADD COLUMN IF NOT EXISTS respuesta_cliente VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
        CHECK (respuesta_cliente IN ('Pendiente','Aprobado','Rechazado'));

ALTER TABLE diagnosticos
    ADD COLUMN IF NOT EXISTS fecha_respuesta_cliente TIMESTAMPTZ;

ALTER TABLE diagnosticos
    ADD COLUMN IF NOT EXISTS comentario_cliente VARCHAR(255);

-- OPCIONAL — si ya tenías diagnósticos con órdenes creadas antes de esta regla,
-- márcalos como Aprobados para que su historial sea coherente (una orden solo
-- puede existir sobre un diagnóstico aprobado). Descomenta si lo necesitas:
--
-- UPDATE diagnosticos d
--    SET respuesta_cliente = 'Aprobado',
--        fecha_respuesta_cliente = COALESCE(d.fecha_modificacion, d.fecha)
--  WHERE EXISTS (SELECT 1 FROM ordenes_trabajo o WHERE o.diagnostico_id = d.diagnostico_id)
--    AND d.respuesta_cliente = 'Pendiente';

COMMIT;
