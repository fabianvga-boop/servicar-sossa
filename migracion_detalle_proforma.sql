-- ============================================================================
-- Migración: copia del detalle de la proforma
--
-- Con "Corregir orden" una orden cerrada puede volver a cambiar. El PDF de la
-- proforma se armaba leyendo la orden en el momento, así que el PDF de una
-- proforma ANULADA terminaba mostrando el detalle corregido y no lo que se le
-- entregó al cliente.
--
--   * proformas.detalle: copia (JSON) del detalle tal como se emitió: cliente,
--     vehículo, servicios, repuestos y subtotales. El PDF sale de esta copia.
--
-- Las proformas ya emitidas quedan con detalle NULL y se siguen armando desde
-- la orden (que no cambió). El sistema toma su copia justo antes de anularlas
-- o de corregir su orden, así que nunca llegan a mostrar datos posteriores.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
--   psql -U servicar_app -d servicar_sossa -f migracion_detalle_proforma.sql
-- ============================================================================

BEGIN;

ALTER TABLE proformas
    ADD COLUMN IF NOT EXISTS detalle JSONB;

COMMIT;
