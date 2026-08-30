-- Bitácora de auditoría: quién hizo qué acción, sobre qué registro y cuándo.
-- Cubre por ahora: crear/editar/eliminar de repuestos, vehículos, clientes,
-- proveedores y usuarios; ajuste de stock; anular ventas, facturas y pagos;
-- cerrar/cancelar órdenes; crear compras y ventas.
--
-- Segura de ejecutar más de una vez.

CREATE TABLE IF NOT EXISTS auditoria (
    auditoria_id VARCHAR(20) PRIMARY KEY
                     CHECK (auditoria_id ~ '^AUD-[0-9]{3,}$'),    -- AUD-001
    usuario_id   VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    accion       VARCHAR(20) NOT NULL
                     CHECK (accion IN ('Crear','Editar','Eliminar','Anular','Ajustar','CambiarEstado')),
    entidad      VARCHAR(50) NOT NULL,
    entidad_id   VARCHAR(20) NOT NULL,
    descripcion  VARCHAR(300) NOT NULL,
    fecha        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha   ON auditoria(fecha);
