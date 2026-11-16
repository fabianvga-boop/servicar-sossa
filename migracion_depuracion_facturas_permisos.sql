-- Depuración del modelo (14/11/2026): se retiran la facturación fiscal (SIAT)
-- y la matriz de permisos, que el sistema no usa. Idempotente.
-- Antes de aplicarla en una base con datos: respaldo completo (pg_dump).
-- La base pasa de 31 a 28 tablas.

BEGIN;

-- facturas_siat (de migracion_siat_preparacion.sql) depende de facturas: va primero.
DROP TABLE IF EXISTS facturas_siat;
DROP TABLE IF EXISTS facturas;
DROP TABLE IF EXISTS rol_permisos;
DROP TABLE IF EXISTS permisos;

ALTER TABLE clientes       DROP COLUMN IF EXISTS tipo_documento_id,
                           DROP COLUMN IF EXISTS numero_documento,
                           DROP COLUMN IF EXISTS complemento;
ALTER TABLE tipos_servicio DROP COLUMN IF EXISTS codigo_sin,
                           DROP COLUMN IF EXISTS unidad_medida_sin;
ALTER TABLE repuestos      DROP COLUMN IF EXISTS codigo_sin,
                           DROP COLUMN IF EXISTS unidad_medida_sin;
ALTER TABLE ventas         DROP COLUMN IF EXISTS metodo_pago_id;
ALTER TABLE pagos          DROP COLUMN IF EXISTS metodo_pago_id;

COMMIT;

-- Métodos de pago: el sistema ofrece Efectivo, QR y Otro. La única venta
-- registrada por transferencia (prueba) pasa a Otro dejando constancia.
BEGIN;
UPDATE ventas SET observaciones = trim(coalesce(observaciones || ' ', '') || '(Transferencia)'), metodo_pago = 'Otro' WHERE metodo_pago IN ('Transferencia','Tarjeta');
UPDATE pagos  SET referencia   = trim(coalesce(referencia   || ' ', '') || '(' || metodo_pago || ')'), metodo_pago = 'Otro' WHERE metodo_pago IN ('Transferencia','Tarjeta');
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_metodo_pago_check CHECK (metodo_pago IN ('Efectivo','QR','Otro'));
ALTER TABLE pagos  DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;
ALTER TABLE pagos  ADD CONSTRAINT pagos_metodo_pago_check CHECK (metodo_pago IN ('Efectivo','QR','Otro'));
COMMIT;
