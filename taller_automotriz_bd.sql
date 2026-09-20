-- ============================================================================
-- BASE DE DATOS: Sistema de Informacion para Taller Automotriz "Servicar SOSSA"
-- Proyecto de Grado - UAJMS (Tarija, Bolivia)
-- Motor: PostgreSQL 16
-- ============================================================================
-- Cobertura: 9 Epicas / 41 Historias de Usuario
--   EPIC001 Gestion de Usuarios            EPIC002 Gestion de Clientes y Vehiculos
--   EPIC003 Servicios y Diagnosticos       EPIC004 Gestion de Reportes
--   EPIC005 Ordenes de Trabajo             EPIC006 Gestion de Inventario
--   EPIC007 Gestion de Comisiones          EPIC008 Facturacion (Proforma) y Pagos
--   EPIC009 Aprobacion de Presupuestos
-- ============================================================================
-- CONVENCIONES
--   * Llaves primarias: VARCHAR(20) alfanumericas con prefijo por entidad
--     (CLI-001, VEH-001, ...). Se generan en la capa de aplicacion, NO son
--     autoincrementales. Cada PK lleva un CHECK que valida el formato.
--   * Los campos 'estado' se almacenan como string en PascalCase para
--     corresponder 1:1 con los enums de C# via HasConversion<string>().
--   * Las marcas de tiempo usan TIMESTAMPTZ y se guardan en UTC. Npgsql mapea
--     DateTime con Kind=Utc directamente a este tipo; NO usar TIMESTAMP simple.
-- ============================================================================
-- USO:
--   psql -U postgres -c "CREATE DATABASE servicar_sossa;"
--   psql -U postgres -d servicar_sossa -f taller_automotriz_bd.sql
-- ============================================================================


-- ============================================================================
-- EPICA 1: GESTION DE USUARIOS (US001-US005)
-- ============================================================================

CREATE TABLE roles (
    rol_id          VARCHAR(20)  PRIMARY KEY
                        CHECK (rol_id ~ '^ROL-[0-9]{3,}$'),         -- ROL-001
    nombre_rol      VARCHAR(50)  NOT NULL UNIQUE,       -- Administrador, Mecanico
    descripcion     VARCHAR(200)
);

CREATE TABLE permisos (
    permiso_id      VARCHAR(20)  PRIMARY KEY
                        CHECK (permiso_id ~ '^PER-[0-9]{3,}$'),     -- PER-001
    nombre          VARCHAR(80)  NOT NULL UNIQUE,
    descripcion     VARCHAR(200)
);

-- Relacion N:M entre roles y permisos (US005 - asignar roles y permisos)
CREATE TABLE rol_permisos (
    rol_id          VARCHAR(20) NOT NULL REFERENCES roles(rol_id)       ON DELETE CASCADE,
    permiso_id      VARCHAR(20) NOT NULL REFERENCES permisos(permiso_id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuarios (
    usuario_id      VARCHAR(20)  PRIMARY KEY
                        CHECK (usuario_id ~ '^USU-[0-9]{3,}$'),     -- USU-001
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol_id          VARCHAR(20)  NOT NULL REFERENCES roles(rol_id),
    telefono        VARCHAR(20),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Activo'
                        CHECK (estado IN ('Activo','Inactivo')),    -- US004 / EstadoUsuario
    fecha_registro  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Foto de perfil (opcional): nombre fisico del archivo en disco.
    nombre_archivo_foto VARCHAR(255)
);

-- ============================================================================
-- EPICA 2: GESTION DE CLIENTES Y VEHICULOS (US006-US011)
-- ============================================================================

CREATE TABLE clientes (
    cliente_id      VARCHAR(20)  PRIMARY KEY
                        CHECK (cliente_id ~ '^CLI-[0-9]{3,}$'),     -- CLI-001
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100),
    razon_social    VARCHAR(150),                 -- para clientes tipo empresa
    ci_nit          VARCHAR(30)  NOT NULL UNIQUE,
    telefono        VARCHAR(20),
    email           VARCHAR(150),
    direccion       VARCHAR(200),
    fecha_registro  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Activo'
                        CHECK (estado IN ('Activo','Inactivo'))
);

CREATE TABLE vehiculos (
    vehiculo_id     VARCHAR(20)  PRIMARY KEY
                        CHECK (vehiculo_id ~ '^VEH-[0-9]{3,}$'),    -- VEH-001
    cliente_id      VARCHAR(20)  NOT NULL REFERENCES clientes(cliente_id) ON DELETE CASCADE,
    placa           VARCHAR(15)  NOT NULL UNIQUE,
    marca           VARCHAR(50)  NOT NULL,
    modelo          VARCHAR(50)  NOT NULL,
    anio            SMALLINT,
    color           VARCHAR(30),
    num_motor       VARCHAR(50),
    num_chasis      VARCHAR(50),
    kilometraje     INT          DEFAULT 0,
    fecha_registro  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Galeria de fotos del vehiculo, opcional (documentar su estado al ingresar).
CREATE TABLE vehiculo_fotos (
    foto_id         VARCHAR(20) PRIMARY KEY
                        CHECK (foto_id ~ '^FOT-[0-9]{3,}$'),    -- FOT-001
    vehiculo_id     VARCHAR(20) NOT NULL REFERENCES vehiculos(vehiculo_id) ON DELETE CASCADE,
    nombre_archivo  VARCHAR(255) NOT NULL,
    fecha_subida    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- EPICA 3: GESTION DE SERVICIOS Y DIAGNOSTICOS (US012-US016)
-- ============================================================================

-- Catalogo de tipos de servicio (usado tambien en Ordenes de Trabajo, Epica 5)
CREATE TABLE tipos_servicio (
    servicio_id     VARCHAR(20)  PRIMARY KEY
                        CHECK (servicio_id ~ '^SER-[0-9]{3,}$'),    -- SER-001
    nombre          VARCHAR(100) NOT NULL,
    descripcion     VARCHAR(255),
    precio_base     DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Activo'
                        CHECK (estado IN ('Activo','Inactivo'))
);

CREATE TABLE diagnosticos (
    diagnostico_id         VARCHAR(20) PRIMARY KEY
                               CHECK (diagnostico_id ~ '^DIA-[0-9]{3,}$'),  -- DIA-001
    vehiculo_id            VARCHAR(20) NOT NULL REFERENCES vehiculos(vehiculo_id) ON DELETE CASCADE,
    mecanico_id            VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    fecha                  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descripcion_falla      TEXT        NOT NULL,
    observaciones_tecnicas TEXT,                  -- US016
    estado                 VARCHAR(20) NOT NULL DEFAULT 'Registrado'
                               CHECK (estado IN ('Registrado','Revisado','Anulado')),  -- EstadoDiag
    fecha_modificacion     TIMESTAMPTZ,             -- US015
    -- Presupuesto aproximado que se presenta al cliente y su decision.
    monto_estimado         DECIMAL(12,2),
    respuesta_cliente      VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                               CHECK (respuesta_cliente IN ('Pendiente','Aprobado','Rechazado')),
    fecha_respuesta_cliente TIMESTAMPTZ,
    comentario_cliente     VARCHAR(255)
);

-- ============================================================================
-- EPICA 5: GESTION DE ORDENES DE TRABAJO (US021-US025)
-- (se define antes de Inventario/Comisiones/Facturacion porque estas dependen de ella)
-- ============================================================================

CREATE TABLE ordenes_trabajo (
    orden_id            VARCHAR(20) PRIMARY KEY
                            CHECK (orden_id ~ '^ORD-[0-9]{3,}$'),   -- ORD-001
    vehiculo_id         VARCHAR(20) NOT NULL REFERENCES vehiculos(vehiculo_id),
    cliente_id          VARCHAR(20) NOT NULL REFERENCES clientes(cliente_id),
    administrador_id    VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    -- Diagnóstico de origen: toda orden nace de un diagnóstico. Nullable solo
    -- para no romper órdenes creadas antes de esta regla; UNIQUE porque un
    -- diagnóstico genera como máximo una orden.
    diagnostico_id      VARCHAR(20) UNIQUE REFERENCES diagnosticos(diagnostico_id),
    fecha_creacion      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_estimada      DATE,
    fecha_cierre        TIMESTAMPTZ,
    estado              VARCHAR(30) NOT NULL DEFAULT 'Abierta'      -- EstadoOrden
                            CHECK (estado IN ('Abierta','EnProceso','Finalizada','Cerrada','Cancelada')),
    observaciones       TEXT
);

-- Relacion N:M: una orden puede tener varios mecanicos asignados (US022)
CREATE TABLE orden_mecanicos (
    orden_id            VARCHAR(20) NOT NULL REFERENCES ordenes_trabajo(orden_id) ON DELETE CASCADE,
    mecanico_id         VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    fecha_asignacion    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (orden_id, mecanico_id)
);

-- Detalle de servicios ejecutados dentro de una orden (US013, US023)
-- Un servicio puede venir del catalogo (servicio_id) o registrarse suelto,
-- fuera de catalogo, con un nombre libre (nombre_libre).
CREATE TABLE orden_servicios (
    orden_servicio_id   VARCHAR(20) PRIMARY KEY
                            CHECK (orden_servicio_id ~ '^OSR-[0-9]{3,}$'),  -- OSR-001
    orden_id            VARCHAR(20) NOT NULL REFERENCES ordenes_trabajo(orden_id) ON DELETE CASCADE,
    servicio_id         VARCHAR(20) REFERENCES tipos_servicio(servicio_id),  -- solo si viene del catalogo
    nombre_libre        VARCHAR(150),
    diagnostico_id      VARCHAR(20) REFERENCES diagnosticos(diagnostico_id),
    mecanico_id         VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    descripcion         VARCHAR(255),
    precio              DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado              VARCHAR(20) NOT NULL DEFAULT 'Pendiente'    -- EstadoServicioOrden
                            CHECK (estado IN ('Pendiente','EnProceso','Completado')),
    -- Del catalogo exige servicio_id; suelto exige nombre_libre.
    CONSTRAINT chk_origen_servicio CHECK (
        (servicio_id IS NOT NULL AND nombre_libre IS NULL) OR
        (servicio_id IS NULL AND nombre_libre IS NOT NULL)
    )
);

-- ============================================================================
-- EPICA 6: GESTION DE INVENTARIO (US026-US030)
-- ============================================================================

CREATE TABLE proveedores (
    proveedor_id    VARCHAR(20)  PRIMARY KEY
                        CHECK (proveedor_id ~ '^PRO-[0-9]{3,}$'),   -- PRO-001
    nombre          VARCHAR(150) NOT NULL,
    contacto        VARCHAR(100),
    telefono        VARCHAR(20),
    email           VARCHAR(150),
    direccion       VARCHAR(200)
);

CREATE TABLE repuestos (
    repuesto_id     VARCHAR(20)  PRIMARY KEY
                        CHECK (repuesto_id ~ '^REP-[0-9]{3,}$'),    -- REP-001
    nombre          VARCHAR(150) NOT NULL,
    descripcion     VARCHAR(255),
    stock_actual    INT          NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo    INT          NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    precio_compra   DECIMAL(10,2) NOT NULL DEFAULT 0,  -- costo (manual o actualizado por la última compra)
    precio_venta    DECIMAL(10,2) NOT NULL DEFAULT 0,  -- precio de venta: se usa en órdenes y punto de venta
    proveedor_id    VARCHAR(20)  REFERENCES proveedores(proveedor_id),
    -- Foto del producto (opcional): nombre del archivo en Uploads/repuestos
    nombre_archivo_foto VARCHAR(255)
);

CREATE TABLE compras (
    compra_id       VARCHAR(20) PRIMARY KEY
                        CHECK (compra_id ~ '^CMP-[0-9]{3,}$'),      -- CMP-001
    proveedor_id    VARCHAR(20) NOT NULL REFERENCES proveedores(proveedor_id),
    usuario_id      VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    fecha           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE compra_detalle (
    detalle_id      VARCHAR(20) PRIMARY KEY
                        CHECK (detalle_id ~ '^DET-[0-9]{3,}$'),     -- DET-001
    compra_id       VARCHAR(20) NOT NULL REFERENCES compras(compra_id) ON DELETE CASCADE,
    repuesto_id     VARCHAR(20) NOT NULL REFERENCES repuestos(repuesto_id),
    cantidad        INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal        DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- Repuestos utilizados en una orden de trabajo.
-- Segun el origen: 'Inventario' sale del stock (repuesto_id obligatorio, se cobra y
-- descuenta stock); 'ClienteTrae' lo trae el cliente (descripcion libre, no se cobra);
-- 'CompraExterna' se compra fuera (descripcion libre, se cobra al costo, sin stock).
CREATE TABLE orden_repuestos (
    orden_repuesto_id  VARCHAR(20) PRIMARY KEY
                           CHECK (orden_repuesto_id ~ '^ORE-[0-9]{3,}$'),  -- ORE-001
    orden_id           VARCHAR(20) NOT NULL REFERENCES ordenes_trabajo(orden_id) ON DELETE CASCADE,
    repuesto_id        VARCHAR(20) REFERENCES repuestos(repuesto_id),  -- solo si origen = Inventario
    origen             VARCHAR(20)   NOT NULL DEFAULT 'Inventario'
                           CHECK (origen IN ('Inventario','ClienteTrae','CompraExterna')),
    descripcion        VARCHAR(150),
    cantidad           INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario    DECIMAL(10,2) NOT NULL,
    subtotal           DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    -- Inventario exige repuesto_id; los otros dos exigen descripcion.
    CONSTRAINT chk_origen_repuesto CHECK (
        (origen = 'Inventario'  AND repuesto_id IS NOT NULL) OR
        (origen <> 'Inventario' AND descripcion IS NOT NULL)
    )
);

-- ============================================================================
-- EPICA 7: GESTION DE COMISIONES (US031-US034)
-- ============================================================================

CREATE TABLE comisiones_config (
    config_id           VARCHAR(20) PRIMARY KEY
                            CHECK (config_id ~ '^CCF-[0-9]{3,}$'),  -- CCF-001
    mecanico_id         VARCHAR(20) NOT NULL UNIQUE REFERENCES usuarios(usuario_id),
    porcentaje          DECIMAL(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
    fecha_actualizacion TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comisiones (
    comision_id     VARCHAR(20) PRIMARY KEY
                        CHECK (comision_id ~ '^COM-[0-9]{3,}$'),    -- COM-001
    orden_id        VARCHAR(20) NOT NULL REFERENCES ordenes_trabajo(orden_id),
    mecanico_id     VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    monto           DECIMAL(10,2) NOT NULL,
    fecha_calculo   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado_pago     VARCHAR(20) NOT NULL DEFAULT 'Pendiente'        -- EstadoPago
                        CHECK (estado_pago IN ('Pendiente','Pagado')),
    fecha_pago      TIMESTAMPTZ,
    -- Una orden genera a lo sumo una comision por mecanico (regla de cierre de orden)
    CONSTRAINT uq_comision_orden_mecanico UNIQUE (orden_id, mecanico_id)
);

-- ============================================================================
-- EPICA 8 y 9: PROFORMAS, FACTURACION SIAT Y PAGOS (US035-US041)
-- La proforma es el documento de cobro operativo del taller, SIN valor fiscal:
-- nace de una orden Finalizada/Cerrada y es contra lo que el cliente paga
-- (tabla propia, no un alias de "factura"). La factura SOLO existe cuando el
-- taller esta habilitado ante el SIN (Facturacion:Modo = SIAT_ONLINE) y puede
-- nacer de una orden o de una venta de mostrador, nunca de las dos; mientras
-- tanto la tabla queda vacia. Los pagos se registran contra la proforma, no
-- contra la factura, porque la proforma es el flujo operativo de todos los
-- dias y la factura no duplica los cobros.
-- ============================================================================

CREATE TABLE proformas (
    proforma_id      VARCHAR(20) PRIMARY KEY
                         CHECK (proforma_id ~ '^PRF-[0-9]{3,}$'),   -- PRF-001
    orden_id         VARCHAR(20) NOT NULL REFERENCES ordenes_trabajo(orden_id),
    fecha_emision    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nit_razon_social VARCHAR(150),
    total            DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado           VARCHAR(20) NOT NULL DEFAULT 'Emitida'         -- EstadoProforma
                         CHECK (estado IN ('Emitida','Anulada'))
);

-- ============================================================================
-- PUNTO DE VENTA: venta de repuestos en mostrador (sin orden de trabajo)
-- Se cobra completa en el acto, asi que el metodo de pago va en la cabecera y
-- no hay saldo pendiente. El stock se descuenta al confirmar la venta.
-- ============================================================================

CREATE TABLE ventas (
    venta_id        VARCHAR(20) PRIMARY KEY
                        CHECK (venta_id ~ '^VTA-[0-9]{3,}$'),       -- VTA-001
    cliente_id      VARCHAR(20) REFERENCES clientes(cliente_id),    -- opcional: mostrador
    usuario_id      VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    fecha_venta     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metodo_pago     VARCHAR(30) NOT NULL                            -- MetodoPago
                        CHECK (metodo_pago IN ('Efectivo','Transferencia','Tarjeta','QR','Otro')),
    total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado          VARCHAR(20) NOT NULL DEFAULT 'Emitida'          -- EstadoVenta
                        CHECK (estado IN ('Emitida','Anulada')),
    observaciones   VARCHAR(255),
    -- Codigo del catalogo del SIN para la forma de cobro, congelado al vender
    -- (la venta tambien necesita el codigo para poder facturarse en linea).
    metodo_pago_id  SMALLINT
);

CREATE TABLE venta_detalle (
    venta_detalle_id VARCHAR(20) PRIMARY KEY
                         CHECK (venta_detalle_id ~ '^VDT-[0-9]{3,}$'),  -- VDT-001
    venta_id         VARCHAR(20) NOT NULL REFERENCES ventas(venta_id) ON DELETE CASCADE,
    repuesto_id      VARCHAR(20) NOT NULL REFERENCES repuestos(repuesto_id),
    cantidad         INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario  DECIMAL(10,2) NOT NULL,
    subtotal         DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- Comprobante fiscal ante el SIN: lleva CUF, CUFD y el XML firmado que se
-- envia a los webservices del SIAT. Cuelga de una orden de trabajo O de una
-- venta de mostrador (chk_facturas_un_origen), nunca de las dos, y no
-- depende de la proforma: se emite directo del documento que origino el cobro.
CREATE TABLE facturas (
    factura_id         VARCHAR(20) PRIMARY KEY
                           CHECK (factura_id ~ '^FAC-[0-9]{3,}$'),  -- FAC-001
    orden_id            VARCHAR(20) REFERENCES ordenes_trabajo(orden_id),
    venta_id            VARCHAR(20) REFERENCES ventas(venta_id),
    fecha_emision       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nit_razon_social    VARCHAR(150),
    total               DECIMAL(12,2) NOT NULL CHECK (total >= 0),
    -- Codigo del catalogo del SIN para la forma de cobro.
    metodo_pago_id      SMALLINT,
    estado              VARCHAR(20) NOT NULL DEFAULT 'Emitida'      -- EstadoFactura
                           CHECK (estado IN ('Emitida','Anulada')),
    -- --- Datos fiscales (SIAT); permanecen NULL mientras el modo no sea SIAT_ONLINE ---
    numero_factura      BIGINT,                    -- correlativo fiscal que exige el SIN
    cuf                 VARCHAR(100),               -- Codigo Unico de Factura
    cufd                VARCHAR(100),               -- Codigo Unico de Descarga (vence cada dia)
    codigo_recepcion    VARCHAR(100),               -- acuse del webservice si la recepcion fue correcta
    estado_siat         VARCHAR(20) NOT NULL DEFAULT 'Pendiente'    -- EstadoSiat
                           CHECK (estado_siat IN ('Pendiente','Enviada','Validada','Rechazada','Contingencia','Anulada')),
    xml_generado        TEXT,                       -- XML armado segun el XSD del SIN, antes de firmar
    xml_firmado         TEXT,                       -- el mismo XML ya firmado digitalmente
    fecha_emision_siat  TIMESTAMPTZ,                -- fecha que consta en el comprobante fiscal
    mensaje_servicio    VARCHAR(500),               -- ultima respuesta del webservice: acuse o motivo de rechazo
    CONSTRAINT chk_facturas_un_origen CHECK (
        (orden_id IS NOT NULL AND venta_id IS NULL) OR
        (orden_id IS NULL AND venta_id IS NOT NULL)
    )
);

-- A lo sumo una factura vigente (no Anulada) por orden y por venta.
CREATE UNIQUE INDEX idx_facturas_orden_vigente ON facturas(orden_id) WHERE orden_id IS NOT NULL AND estado = 'Emitida';
CREATE UNIQUE INDEX idx_facturas_venta_vigente ON facturas(venta_id) WHERE venta_id IS NOT NULL AND estado = 'Emitida';

CREATE TABLE pagos (
    pago_id         VARCHAR(20) PRIMARY KEY
                        CHECK (pago_id ~ '^PAG-[0-9]{3,}$'),        -- PAG-001
    -- El cobro se registra contra la proforma, que es el documento operativo
    -- del taller; la factura fiscal, cuando exista, representa ese mismo
    -- dinero y no duplica los pagos.
    proforma_id     VARCHAR(20) NOT NULL REFERENCES proformas(proforma_id) ON DELETE CASCADE,
    monto           DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    fecha_pago      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metodo_pago     VARCHAR(30) NOT NULL                            -- MetodoPago
                        CHECK (metodo_pago IN ('Efectivo','Transferencia','Tarjeta','QR','Otro')),
    referencia      VARCHAR(100),
    -- Codigo del catalogo del SIN para la forma de cobro, congelado al cobrar.
    metodo_pago_id  SMALLINT
);

-- ============================================================================
-- EPICA 4: GESTION DE REPORTES (US017-US020)
-- ============================================================================

-- Registro/bitacora de reportes generados (no reemplaza a las consultas dinamicas
-- de reportes, que se resuelven con SELECTs sobre las tablas anteriores)
CREATE TABLE reportes_generados (
    reporte_id       VARCHAR(20) PRIMARY KEY
                         CHECK (reporte_id ~ '^RPT-[0-9]{3,}$'),    -- RPT-001
    tipo_reporte     VARCHAR(50) NOT NULL,       -- ventas, comisiones, inventario, ordenes, etc.
    fecha_inicio     DATE        NOT NULL,
    fecha_fin        DATE        NOT NULL,
    usuario_id       VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    fecha_generacion TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    formato          VARCHAR(10) NOT NULL DEFAULT 'Pdf'             -- FormatoReporte
                         CHECK (formato IN ('Pdf','Excel','Csv')),
    CONSTRAINT ck_reporte_rango_fechas CHECK (fecha_fin >= fecha_inicio)
);

-- Bitacora de auditoria: quien hizo que accion, sobre que registro y cuando.
-- No guarda el detalle de los campos que cambiaron, solo el resumen de la accion.
CREATE TABLE auditoria (
    auditoria_id VARCHAR(20) PRIMARY KEY
                     CHECK (auditoria_id ~ '^AUD-[0-9]{3,}$'),    -- AUD-001
    usuario_id   VARCHAR(20) NOT NULL REFERENCES usuarios(usuario_id),
    accion       VARCHAR(20) NOT NULL                             -- AccionAuditoria
                     CHECK (accion IN ('Crear','Editar','Eliminar','Anular','Ajustar','CambiarEstado')),
    entidad      VARCHAR(50) NOT NULL,       -- "Repuesto", "Vehiculo", "Venta", etc.
    entidad_id   VARCHAR(20) NOT NULL,       -- PK del registro afectado
    descripcion  VARCHAR(300) NOT NULL,      -- resumen legible de la accion
    fecha        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX idx_auditoria_fecha   ON auditoria(fecha);

-- ============================================================================
-- INDICES RECOMENDADOS (mejoran consultas frecuentes de reportes y busquedas)
-- ============================================================================

CREATE INDEX idx_usuarios_rol              ON usuarios(rol_id);
CREATE INDEX idx_vehiculos_cliente         ON vehiculos(cliente_id);
CREATE INDEX idx_vehiculo_fotos_vehiculo   ON vehiculo_fotos(vehiculo_id);
CREATE INDEX idx_ventas_fecha              ON ventas(fecha_venta);
CREATE INDEX idx_venta_detalle_venta       ON venta_detalle(venta_id);
CREATE INDEX idx_ordenes_vehiculo          ON ordenes_trabajo(vehiculo_id);
CREATE INDEX idx_ordenes_cliente           ON ordenes_trabajo(cliente_id);
CREATE INDEX idx_ordenes_estado            ON ordenes_trabajo(estado);
CREATE INDEX idx_diagnosticos_vehiculo     ON diagnosticos(vehiculo_id);
CREATE INDEX idx_orden_servicios_orden     ON orden_servicios(orden_id);
CREATE INDEX idx_orden_servicios_mecanico  ON orden_servicios(mecanico_id);
CREATE INDEX idx_orden_repuestos_orden     ON orden_repuestos(orden_id);
CREATE INDEX idx_compra_detalle_compra     ON compra_detalle(compra_id);
CREATE INDEX idx_comisiones_mecanico       ON comisiones(mecanico_id);
CREATE INDEX idx_proformas_orden           ON proformas(orden_id);
CREATE INDEX idx_facturas_cuf              ON facturas(cuf);
CREATE INDEX idx_facturas_fecha            ON facturas(fecha_emision);
CREATE INDEX idx_pagos_proforma            ON pagos(proforma_id);

-- ============================================================================
-- DATOS INICIALES (seed) SUGERIDOS PARA ROLES
-- ============================================================================

INSERT INTO roles (rol_id, nombre_rol, descripcion) VALUES
    ('ROL-001', 'Administrador', 'Control total del sistema'),
    ('ROL-002', 'Mecanico',      'Gestiona diagnosticos y ordenes de trabajo asignadas');
