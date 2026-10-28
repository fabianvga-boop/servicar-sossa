-- ============================================================================
-- Migración: compra ocasional
--
-- Hay compras a personas cuyos datos no se tienen o no conviene guardar como
-- proveedor (un vendedor de la feria, alguien de quien no se recuerda el
-- nombre). Igual fueron compras: hubo precio, fecha y cantidad, y el stock
-- tiene que entrar con ese respaldo y no como un ajuste.
--
--   * compras.proveedor_id pasa a ser opcional: NULL = compra ocasional.
--   * compras.referencia: texto libre opcional ("Feria 16 de Julio",
--     "mecánico de otro taller") para recordar de dónde vino.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
--   psql -U servicar_app -d servicar_sossa -f migracion_compra_ocasional.sql
-- ============================================================================

SET client_encoding = 'UTF8';

BEGIN;

ALTER TABLE compras ALTER COLUMN proveedor_id DROP NOT NULL;

ALTER TABLE compras ADD COLUMN IF NOT EXISTS referencia VARCHAR(150);

COMMIT;
