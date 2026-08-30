-- Separa el precio único de repuestos en dos: costo de compra y precio de venta.
-- Antes, "precio_unitario" cumplía las dos funciones a la vez (y cada compra
-- pisaba el precio de venta con el último costo pagado, sin darse cuenta).
--
-- Esta migración es segura de ejecutar más de una vez.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'repuestos' AND column_name = 'precio_unitario'
    ) THEN
        ALTER TABLE repuestos RENAME COLUMN precio_unitario TO precio_venta;
    END IF;
END $$;

ALTER TABLE repuestos
    ADD COLUMN IF NOT EXISTS precio_compra DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Arranque razonable: el costo parte igual al precio de venta que ya tenían
-- cargado (ajustable luego desde el formulario de cada repuesto).
UPDATE repuestos SET precio_compra = precio_venta WHERE precio_compra = 0;

ALTER TABLE repuestos
    ALTER COLUMN precio_venta SET NOT NULL,
    ALTER COLUMN precio_venta SET DEFAULT 0;
