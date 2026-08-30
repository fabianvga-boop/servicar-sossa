-- ============================================================================
-- Migración: se elimina el módulo Proforma como entidad separada.
-- "Facturas" pasa a ser el único documento de cobro del taller (el sistema no
-- factura vía SIAT, así que no hay distinción fiscal entre "factura" y
-- "proforma"); en la interfaz se muestra como "Proforma".
--
-- ATENCIÓN: esto borra la tabla `proformas` y todo su contenido. Si tenías
-- proformas de prueba vinculadas a facturas (columna facturas.proforma_id),
-- ese vínculo también se pierde — las facturas en sí NO se borran.
--
-- Ejecutar una sola vez sobre la BD existente:
--   psql -U postgres -d servicar_sossa -f migracion_eliminar_proforma.sql
-- ============================================================================

BEGIN;

ALTER TABLE facturas DROP COLUMN IF EXISTS proforma_id;
DROP TABLE IF EXISTS proformas;

COMMIT;
