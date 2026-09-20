--
-- PostgreSQL database dump
--

\restrict PSYf6wsrTaUC1AhYAPcNa6KWLDuVhM1oExXe4SjHTOWL8dlJwG108D0eIjOoZeb

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria (
    auditoria_id character varying(20) NOT NULL,
    usuario_id character varying(20) NOT NULL,
    accion character varying(20) NOT NULL,
    entidad character varying(50) NOT NULL,
    entidad_id character varying(20) NOT NULL,
    descripcion character varying(300) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT auditoria_accion_check CHECK (((accion)::text = ANY ((ARRAY['Crear'::character varying, 'Editar'::character varying, 'Eliminar'::character varying, 'Anular'::character varying, 'Ajustar'::character varying, 'CambiarEstado'::character varying])::text[]))),
    CONSTRAINT auditoria_auditoria_id_check CHECK (((auditoria_id)::text ~ '^AUD-[0-9]{3,}$'::text))
);


ALTER TABLE public.auditoria OWNER TO postgres;

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    cliente_id character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100),
    razon_social character varying(150),
    ci_nit character varying(30) NOT NULL,
    telefono character varying(20),
    email character varying(150),
    direccion character varying(200),
    fecha_registro timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado character varying(20) DEFAULT 'Activo'::character varying NOT NULL,
    tipo_documento_id smallint,
    numero_documento character varying(30),
    complemento character varying(5),
    CONSTRAINT clientes_cliente_id_check CHECK (((cliente_id)::text ~ '^CLI-[0-9]{3,}$'::text)),
    CONSTRAINT clientes_estado_check CHECK (((estado)::text = ANY ((ARRAY['Activo'::character varying, 'Inactivo'::character varying])::text[])))
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- Name: COLUMN clientes.tipo_documento_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clientes.tipo_documento_id IS 'CÃ³digo del catÃ¡logo del SIN: 1=CI, 2=CEX, 3=PAS, 4=OD, 5=NIT. Verificar contra el catÃ¡logo vigente.';


--
-- Name: COLUMN clientes.numero_documento; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clientes.numero_documento IS 'NÃºmero de documento normalizado para el SIAT. Uso interno sigue siendo ci_nit.';


--
-- Name: comisiones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comisiones (
    comision_id character varying(20) NOT NULL,
    orden_id character varying(20) NOT NULL,
    mecanico_id character varying(20) NOT NULL,
    monto numeric(10,2) NOT NULL,
    fecha_calculo timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado_pago character varying(20) DEFAULT 'Pendiente'::character varying NOT NULL,
    fecha_pago timestamp with time zone,
    CONSTRAINT comisiones_comision_id_check CHECK (((comision_id)::text ~ '^COM-[0-9]{3,}$'::text)),
    CONSTRAINT comisiones_estado_pago_check CHECK (((estado_pago)::text = ANY ((ARRAY['Pendiente'::character varying, 'Pagado'::character varying])::text[])))
);


ALTER TABLE public.comisiones OWNER TO postgres;

--
-- Name: comisiones_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comisiones_config (
    config_id character varying(20) NOT NULL,
    mecanico_id character varying(20) NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT comisiones_config_config_id_check CHECK (((config_id)::text ~ '^CCF-[0-9]{3,}$'::text)),
    CONSTRAINT comisiones_config_porcentaje_check CHECK (((porcentaje >= (0)::numeric) AND (porcentaje <= (100)::numeric)))
);


ALTER TABLE public.comisiones_config OWNER TO postgres;

--
-- Name: compra_detalle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compra_detalle (
    detalle_id character varying(20) NOT NULL,
    compra_id character varying(20) NOT NULL,
    repuesto_id character varying(20) NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    subtotal numeric(12,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio_unitario)) STORED,
    CONSTRAINT compra_detalle_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT compra_detalle_detalle_id_check CHECK (((detalle_id)::text ~ '^DET-[0-9]{3,}$'::text))
);


ALTER TABLE public.compra_detalle OWNER TO postgres;

--
-- Name: compras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compras (
    compra_id character varying(20) NOT NULL,
    proveedor_id character varying(20) NOT NULL,
    usuario_id character varying(20) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT compras_compra_id_check CHECK (((compra_id)::text ~ '^CMP-[0-9]{3,}$'::text))
);


ALTER TABLE public.compras OWNER TO postgres;

--
-- Name: diagnosticos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diagnosticos (
    diagnostico_id character varying(20) NOT NULL,
    vehiculo_id character varying(20) NOT NULL,
    mecanico_id character varying(20) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    descripcion_falla text NOT NULL,
    observaciones_tecnicas text,
    estado character varying(20) DEFAULT 'Registrado'::character varying NOT NULL,
    fecha_modificacion timestamp with time zone,
    monto_estimado numeric(12,2),
    respuesta_cliente character varying(20) DEFAULT 'Pendiente'::character varying NOT NULL,
    fecha_respuesta_cliente timestamp with time zone,
    comentario_cliente character varying(255),
    CONSTRAINT diagnosticos_diagnostico_id_check CHECK (((diagnostico_id)::text ~ '^DIA-[0-9]{3,}$'::text)),
    CONSTRAINT diagnosticos_estado_check CHECK (((estado)::text = ANY ((ARRAY['Registrado'::character varying, 'Revisado'::character varying, 'Anulado'::character varying])::text[]))),
    CONSTRAINT diagnosticos_respuesta_cliente_check CHECK (((respuesta_cliente)::text = ANY ((ARRAY['Pendiente'::character varying, 'Aprobado'::character varying, 'Rechazado'::character varying])::text[])))
);


ALTER TABLE public.diagnosticos OWNER TO postgres;

--
-- Name: facturas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.facturas (
    factura_id character varying(20) NOT NULL,
    orden_id character varying(20) NOT NULL,
    fecha_emision timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    nit_razon_social character varying(150),
    total numeric(12,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'Emitida'::character varying NOT NULL,
    CONSTRAINT facturas_estado_check CHECK (((estado)::text = ANY ((ARRAY['Emitida'::character varying, 'Anulada'::character varying])::text[]))),
    CONSTRAINT facturas_factura_id_check CHECK (((factura_id)::text ~ '^FAC-[0-9]{3,}$'::text))
);


ALTER TABLE public.facturas OWNER TO postgres;

--
-- Name: facturas_siat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.facturas_siat (
    factura_siat_id character varying(20) NOT NULL,
    factura_id character varying(20),
    venta_id character varying(20),
    cuf character varying(100),
    cufd character varying(100),
    codigo_recepcion character varying(100),
    estado_siat character varying(20) DEFAULT 'Pendiente'::character varying NOT NULL,
    xml_generado text,
    xml_firmado text,
    fecha_emision_siat timestamp with time zone,
    mensaje_servicio character varying(500),
    fecha_registro timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_facturas_siat_un_origen CHECK ((((factura_id IS NOT NULL) AND (venta_id IS NULL)) OR ((factura_id IS NULL) AND (venta_id IS NOT NULL)))),
    CONSTRAINT facturas_siat_estado_siat_check CHECK (((estado_siat)::text = ANY ((ARRAY['Pendiente'::character varying, 'Enviada'::character varying, 'Validada'::character varying, 'Rechazada'::character varying, 'Contingencia'::character varying, 'Anulada'::character varying])::text[]))),
    CONSTRAINT facturas_siat_factura_siat_id_check CHECK (((factura_siat_id)::text ~ '^FSI-[0-9]{3,}$'::text))
);


ALTER TABLE public.facturas_siat OWNER TO postgres;

--
-- Name: orden_mecanicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orden_mecanicos (
    orden_id character varying(20) NOT NULL,
    mecanico_id character varying(20) NOT NULL,
    fecha_asignacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.orden_mecanicos OWNER TO postgres;

--
-- Name: orden_repuestos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orden_repuestos (
    orden_repuesto_id character varying(20) NOT NULL,
    orden_id character varying(20) NOT NULL,
    repuesto_id character varying(20),
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    subtotal numeric(12,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio_unitario)) STORED,
    origen character varying(20) DEFAULT 'Inventario'::character varying NOT NULL,
    descripcion character varying(150),
    CONSTRAINT chk_origen_repuesto CHECK (((((origen)::text = 'Inventario'::text) AND (repuesto_id IS NOT NULL)) OR (((origen)::text <> 'Inventario'::text) AND (descripcion IS NOT NULL)))),
    CONSTRAINT orden_repuestos_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT orden_repuestos_orden_repuesto_id_check CHECK (((orden_repuesto_id)::text ~ '^ORE-[0-9]{3,}$'::text)),
    CONSTRAINT orden_repuestos_origen_check CHECK (((origen)::text = ANY ((ARRAY['Inventario'::character varying, 'ClienteTrae'::character varying, 'CompraExterna'::character varying])::text[])))
);


ALTER TABLE public.orden_repuestos OWNER TO postgres;

--
-- Name: orden_servicios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orden_servicios (
    orden_servicio_id character varying(20) NOT NULL,
    orden_id character varying(20) NOT NULL,
    servicio_id character varying(20),
    diagnostico_id character varying(20),
    mecanico_id character varying(20) NOT NULL,
    descripcion character varying(255),
    precio numeric(10,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'Pendiente'::character varying NOT NULL,
    nombre_libre character varying(150),
    CONSTRAINT chk_origen_servicio CHECK ((((servicio_id IS NOT NULL) AND (nombre_libre IS NULL)) OR ((servicio_id IS NULL) AND (nombre_libre IS NOT NULL)))),
    CONSTRAINT orden_servicios_estado_check CHECK (((estado)::text = ANY ((ARRAY['Pendiente'::character varying, 'EnProceso'::character varying, 'Completado'::character varying])::text[]))),
    CONSTRAINT orden_servicios_orden_servicio_id_check CHECK (((orden_servicio_id)::text ~ '^OSR-[0-9]{3,}$'::text))
);


ALTER TABLE public.orden_servicios OWNER TO postgres;

--
-- Name: ordenes_trabajo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ordenes_trabajo (
    orden_id character varying(20) NOT NULL,
    vehiculo_id character varying(20) NOT NULL,
    cliente_id character varying(20) NOT NULL,
    administrador_id character varying(20) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_estimada date,
    fecha_cierre timestamp with time zone,
    estado character varying(30) DEFAULT 'Abierta'::character varying NOT NULL,
    observaciones text,
    diagnostico_id character varying(20),
    CONSTRAINT ordenes_trabajo_estado_check CHECK (((estado)::text = ANY ((ARRAY['Abierta'::character varying, 'EnProceso'::character varying, 'Finalizada'::character varying, 'Cerrada'::character varying, 'Cancelada'::character varying])::text[]))),
    CONSTRAINT ordenes_trabajo_orden_id_check CHECK (((orden_id)::text ~ '^ORD-[0-9]{3,}$'::text))
);


ALTER TABLE public.ordenes_trabajo OWNER TO postgres;

--
-- Name: pagos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagos (
    pago_id character varying(20) NOT NULL,
    factura_id character varying(20) NOT NULL,
    monto numeric(12,2) NOT NULL,
    fecha_pago timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metodo_pago character varying(30) NOT NULL,
    referencia character varying(100),
    metodo_pago_id smallint,
    CONSTRAINT pagos_metodo_pago_check CHECK (((metodo_pago)::text = ANY ((ARRAY['Efectivo'::character varying, 'Transferencia'::character varying, 'Tarjeta'::character varying, 'QR'::character varying, 'Otro'::character varying])::text[]))),
    CONSTRAINT pagos_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT pagos_pago_id_check CHECK (((pago_id)::text ~ '^PAG-[0-9]{3,}$'::text))
);


ALTER TABLE public.pagos OWNER TO postgres;

--
-- Name: permisos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos (
    permiso_id character varying(20) NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion character varying(200),
    CONSTRAINT permisos_permiso_id_check CHECK (((permiso_id)::text ~ '^PER-[0-9]{3,}$'::text))
);


ALTER TABLE public.permisos OWNER TO postgres;

--
-- Name: plantillas_vehiculo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plantillas_vehiculo (
    plantilla_id character varying(20) NOT NULL,
    marca character varying(50) NOT NULL,
    modelo character varying(50) NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    fecha_subida timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT plantillas_vehiculo_plantilla_id_check CHECK (((plantilla_id)::text ~ '^PLV-[0-9]{3,}$'::text))
);


ALTER TABLE public.plantillas_vehiculo OWNER TO postgres;

--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proveedores (
    proveedor_id character varying(20) NOT NULL,
    nombre character varying(150) NOT NULL,
    contacto character varying(100),
    telefono character varying(20),
    email character varying(150),
    direccion character varying(200),
    CONSTRAINT proveedores_proveedor_id_check CHECK (((proveedor_id)::text ~ '^PRO-[0-9]{3,}$'::text))
);


ALTER TABLE public.proveedores OWNER TO postgres;

--
-- Name: reportes_generados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reportes_generados (
    reporte_id character varying(20) NOT NULL,
    tipo_reporte character varying(50) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    usuario_id character varying(20) NOT NULL,
    fecha_generacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    formato character varying(10) DEFAULT 'Pdf'::character varying NOT NULL,
    CONSTRAINT ck_reporte_rango_fechas CHECK ((fecha_fin >= fecha_inicio)),
    CONSTRAINT reportes_generados_formato_check CHECK (((formato)::text = ANY ((ARRAY['Pdf'::character varying, 'Excel'::character varying, 'Csv'::character varying])::text[]))),
    CONSTRAINT reportes_generados_reporte_id_check CHECK (((reporte_id)::text ~ '^RPT-[0-9]{3,}$'::text))
);


ALTER TABLE public.reportes_generados OWNER TO postgres;

--
-- Name: repuestos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repuestos (
    repuesto_id character varying(20) NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion character varying(255),
    stock_actual integer DEFAULT 0 NOT NULL,
    stock_minimo integer DEFAULT 0 NOT NULL,
    precio_venta numeric(10,2) DEFAULT 0 NOT NULL,
    proveedor_id character varying(20),
    nombre_archivo_foto character varying(255),
    precio_compra numeric(10,2) DEFAULT 0 NOT NULL,
    codigo_sin character varying(20),
    unidad_medida_sin smallint,
    CONSTRAINT repuestos_repuesto_id_check CHECK (((repuesto_id)::text ~ '^REP-[0-9]{3,}$'::text)),
    CONSTRAINT repuestos_stock_actual_check CHECK ((stock_actual >= 0)),
    CONSTRAINT repuestos_stock_minimo_check CHECK ((stock_minimo >= 0))
);


ALTER TABLE public.repuestos OWNER TO postgres;

--
-- Name: COLUMN repuestos.codigo_sin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.repuestos.codigo_sin IS 'HomologaciÃ³n del Ã­tem contra el catÃ¡logo de productos del SIN.';


--
-- Name: rol_permisos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rol_permisos (
    rol_id character varying(20) NOT NULL,
    permiso_id character varying(20) NOT NULL
);


ALTER TABLE public.rol_permisos OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    rol_id character varying(20) NOT NULL,
    nombre_rol character varying(50) NOT NULL,
    descripcion character varying(200),
    CONSTRAINT roles_rol_id_check CHECK (((rol_id)::text ~ '^ROL-[0-9]{3,}$'::text))
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: tipos_servicio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipos_servicio (
    servicio_id character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(255),
    precio_base numeric(10,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'Activo'::character varying NOT NULL,
    codigo_sin character varying(20),
    unidad_medida_sin smallint,
    CONSTRAINT tipos_servicio_estado_check CHECK (((estado)::text = ANY ((ARRAY['Activo'::character varying, 'Inactivo'::character varying])::text[]))),
    CONSTRAINT tipos_servicio_servicio_id_check CHECK (((servicio_id)::text ~ '^SER-[0-9]{3,}$'::text))
);


ALTER TABLE public.tipos_servicio OWNER TO postgres;

--
-- Name: COLUMN tipos_servicio.codigo_sin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tipos_servicio.codigo_sin IS 'HomologaciÃ³n del servicio contra el catÃ¡logo de actividades/productos del SIN.';


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    usuario_id character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol_id character varying(20) NOT NULL,
    telefono character varying(20),
    estado character varying(20) DEFAULT 'Activo'::character varying NOT NULL,
    fecha_registro timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    nombre_archivo_foto character varying(255),
    CONSTRAINT usuarios_estado_check CHECK (((estado)::text = ANY ((ARRAY['Activo'::character varying, 'Inactivo'::character varying])::text[]))),
    CONSTRAINT usuarios_usuario_id_check CHECK (((usuario_id)::text ~ '^USU-[0-9]{3,}$'::text))
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: vehiculo_fotos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehiculo_fotos (
    foto_id character varying(20) NOT NULL,
    vehiculo_id character varying(20) NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    fecha_subida timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT vehiculo_fotos_foto_id_check CHECK (((foto_id)::text ~ '^FOT-[0-9]{3,}$'::text))
);


ALTER TABLE public.vehiculo_fotos OWNER TO postgres;

--
-- Name: vehiculo_zonas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehiculo_zonas (
    zona_obs_id character varying(20) NOT NULL,
    vehiculo_id character varying(20) NOT NULL,
    orden_id character varying(20),
    zona character varying(40) NOT NULL,
    estado character varying(20) NOT NULL,
    detalle character varying(300),
    fecha_registro timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT vehiculo_zonas_estado_check CHECK (((estado)::text = ANY ((ARRAY['Ok'::character varying, 'Atencion'::character varying, 'EnReparacion'::character varying])::text[]))),
    CONSTRAINT vehiculo_zonas_zona_obs_id_check CHECK (((zona_obs_id)::text ~ '^ZNA-[0-9]{3,}$'::text))
);


ALTER TABLE public.vehiculo_zonas OWNER TO postgres;

--
-- Name: vehiculos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehiculos (
    vehiculo_id character varying(20) NOT NULL,
    cliente_id character varying(20) NOT NULL,
    placa character varying(15) NOT NULL,
    marca character varying(50) NOT NULL,
    modelo character varying(50) NOT NULL,
    anio smallint,
    color character varying(30),
    num_motor character varying(50),
    num_chasis character varying(50),
    kilometraje integer DEFAULT 0,
    fecha_registro timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT vehiculos_vehiculo_id_check CHECK (((vehiculo_id)::text ~ '^VEH-[0-9]{3,}$'::text))
);


ALTER TABLE public.vehiculos OWNER TO postgres;

--
-- Name: venta_detalle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venta_detalle (
    venta_detalle_id character varying(20) NOT NULL,
    venta_id character varying(20) NOT NULL,
    repuesto_id character varying(20) NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    subtotal numeric(12,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio_unitario)) STORED,
    CONSTRAINT venta_detalle_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT venta_detalle_venta_detalle_id_check CHECK (((venta_detalle_id)::text ~ '^VDT-[0-9]{3,}$'::text))
);


ALTER TABLE public.venta_detalle OWNER TO postgres;

--
-- Name: ventas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ventas (
    venta_id character varying(20) NOT NULL,
    cliente_id character varying(20),
    usuario_id character varying(20) NOT NULL,
    fecha_venta timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metodo_pago character varying(30) NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'Emitida'::character varying NOT NULL,
    observaciones character varying(255),
    metodo_pago_id smallint,
    CONSTRAINT ventas_estado_check CHECK (((estado)::text = ANY ((ARRAY['Emitida'::character varying, 'Anulada'::character varying])::text[]))),
    CONSTRAINT ventas_metodo_pago_check CHECK (((metodo_pago)::text = ANY ((ARRAY['Efectivo'::character varying, 'Transferencia'::character varying, 'Tarjeta'::character varying, 'QR'::character varying, 'Otro'::character varying])::text[]))),
    CONSTRAINT ventas_venta_id_check CHECK (((venta_id)::text ~ '^VTA-[0-9]{3,}$'::text))
);


ALTER TABLE public.ventas OWNER TO postgres;

--
-- Name: COLUMN ventas.metodo_pago_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ventas.metodo_pago_id IS 'CÃ³digo SIN de tipo de mÃ©todo de pago, congelado al vender. NULL mientras se emitan recibos internos.';


--
-- Data for Name: auditoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria (auditoria_id, usuario_id, accion, entidad, entidad_id, descripcion, fecha) FROM stdin;
AUD-001	USU-001	Editar	Repuesto	REP-001	Editó el repuesto 'Aceite 10w40'.	2026-08-24 12:45:28.362119-04
AUD-002	USU-001	Editar	Usuario	USU-002	Editó el usuario 'Hector Vega'.	2026-08-30 22:27:49.974458-04
AUD-003	USU-001	Anular	Orden	ORD-010	Marcó la orden ORD-010 como Cancelada.	2026-08-30 23:15:26.280222-04
AUD-004	USU-001	Editar	Vehiculo	VEH-001	Editó el vehículo '4203KTM'.	2026-09-03 01:04:39.305059-04
AUD-005	USU-001	Crear	Repuesto	REP-003	Registró el repuesto 'Prueba Lote A'.	2026-09-08 18:48:46.488397-04
AUD-006	USU-001	Crear	Cliente	CLI-006	Registró el cliente 'Cliente Lote A'.	2026-09-08 18:49:19.328324-04
AUD-007	USU-001	Crear	Proveedor	PRO-002	Registró el proveedor 'Proveedor Lote A'.	2026-09-08 18:49:41.286954-04
AUD-008	USU-001	Crear	Repuesto	REP-004	Registró el repuesto 'Frenos'.	2026-09-08 19:36:59.136255-04
AUD-009	USU-001	Crear	Compra	CMP-003	Registró la compra CMP-003 por Bs 50,00.	2026-09-08 19:37:15.96222-04
AUD-010	USU-001	Ajustar	Repuesto	REP-004	Ajustó el stock de 'Frenos' de 101 a 103 unidades.	2026-09-08 19:56:46.081575-04
AUD-011	USU-001	Crear	Vehiculo	VEH-005	Registró el vehículo '4243UTN'.	2026-09-08 19:59:40.612906-04
AUD-012	USU-001	Crear	Repuesto	REP-005	Registró el repuesto 'Filtro de prueba 1788912051171'.	2026-09-08 20:00:51.246988-04
AUD-013	USU-001	Crear	Compra	CMP-004	Registró la compra CMP-004 por Bs 96,00.	2026-09-08 20:00:51.497349-04
AUD-014	USU-001	Ajustar	Repuesto	REP-005	Ajustó el stock de 'Filtro de prueba 1788912051171' de 13 a 10 (-3) — Merma o rotura: Se rompieron 3 en el estante	2026-09-08 20:12:29.678579-04
AUD-015	USU-001	Ajustar	Repuesto	REP-005	Ajustó el stock de 'Filtro de prueba 1788912051171' de 10 a 12 (+2) — Conteo físico: Aparecieron 2 en otro estante	2026-09-08 20:12:58.018959-04
AUD-016	USU-001	Editar	Vehiculo	VEH-003	Marcó la zona 'capo' como Atencion en el diagrama del vehículo.	2026-09-11 19:01:53.307179-04
AUD-017	USU-001	CambiarEstado	Orden	ORD-011	Marcó la orden ORD-011 como EnProceso.	2026-09-11 23:44:48.716189-04
AUD-018	USU-001	Crear	Venta	VTA-002	Registró la venta VTA-002 por Bs 200,00.	2026-09-12 00:39:15.233217-04
AUD-019	USU-001	Anular	Venta	VTA-002	Anuló la venta VTA-002 por Bs 200,00.	2026-09-12 00:41:28.730834-04
AUD-020	USU-001	Anular	Factura	FAC-004	Anuló la factura FAC-004.	2026-09-12 00:41:29.293544-04
AUD-021	USU-001	Crear	Venta	VTA-003	Registró la venta VTA-003 por Bs 15,00.	2026-09-12 00:43:50.349961-04
AUD-022	USU-001	CambiarEstado	Orden	ORD-011	Marcó la orden ORD-011 como Finalizada.	2026-09-12 00:44:59.762537-04
AUD-023	USU-001	CambiarEstado	Orden	ORD-011	Cerró la orden ORD-011: stock descontado y comisiones calculadas.	2026-09-12 00:45:06.094461-04
\.


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clientes (cliente_id, nombre, apellido, razon_social, ci_nit, telefono, email, direccion, fecha_registro, estado, tipo_documento_id, numero_documento, complemento) FROM stdin;
CLI-001	Juan Carlos	Mendoza Rojas	\N	7654321	71234567	\N	\N	2026-08-17 13:40:29.53323-04	Activo	\N	\N	\N
CLI-002	Ronal	Vega	\N	10702148	73496744	fabiangamery@gmail.com	Ameller entre Belgrano y Aniceto Arce	2026-08-17 18:15:40.7562-04	Activo	\N	\N	\N
CLI-003	Jesus	Vega	Honda SRL	10293012	73182912	hondasrl@gmail.com	Calle Ballivian	2026-08-17 19:33:08.327841-04	Activo	\N	\N	\N
CLI-004	Jhon	Lara	\N	10582192	75902133	lirilarila@gmail.com	Avenida Bolivar	2026-08-23 21:30:47.238908-04	Activo	\N	\N	\N
CLI-005	Prueba Combinada	\N	\N	TEST-9999	\N	\N	\N	2026-08-24 01:20:48.499074-04	Inactivo	\N	\N	\N
CLI-006	Cliente Lote A	\N	\N	LOTE-0001	\N	\N	\N	2026-09-08 18:49:19.291532-04	Activo	\N	\N	\N
\.


--
-- Data for Name: comisiones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comisiones (comision_id, orden_id, mecanico_id, monto, fecha_calculo, estado_pago, fecha_pago) FROM stdin;
COM-001	ORD-001	USU-002	13.00	2026-08-17 19:27:20.755889-04	Pendiente	\N
COM-002	ORD-004	USU-002	55.00	2026-08-17 19:41:52.152584-04	Pendiente	\N
COM-003	ORD-006	USU-002	55.00	2026-08-18 00:31:44.995263-04	Pendiente	\N
COM-004	ORD-007	USU-002	55.00	2026-08-18 18:40:03.2435-04	Pendiente	\N
COM-005	ORD-008	USU-002	474.00	2026-08-19 19:18:05.770789-04	Pagado	2026-08-23 22:14:11.938634-04
COM-006	ORD-009	USU-003	15.00	2026-08-23 22:04:14.034913-04	Pagado	2026-08-23 22:14:20.354127-04
\.


--
-- Data for Name: comisiones_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comisiones_config (config_id, mecanico_id, porcentaje, fecha_actualizacion) FROM stdin;
CCF-001	USU-002	50.00	2026-08-23 22:04:51.560295-04
CCF-002	USU-003	50.00	2026-08-23 22:04:56.97445-04
\.


--
-- Data for Name: compra_detalle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compra_detalle (detalle_id, compra_id, repuesto_id, cantidad, precio_unitario) FROM stdin;
DET-001	CMP-001	REP-001	10	100.00
DET-002	CMP-002	REP-002	10	50.00
DET-003	CMP-003	REP-004	1	50.00
DET-004	CMP-004	REP-005	8	12.00
\.


--
-- Data for Name: compras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compras (compra_id, proveedor_id, usuario_id, fecha, total) FROM stdin;
CMP-001	PRO-001	USU-001	2026-08-24 12:05:59.872444-04	1000.00
CMP-002	PRO-001	USU-001	2026-08-24 12:06:59.993399-04	500.00
CMP-003	PRO-002	USU-001	2026-09-08 19:37:15.769326-04	50.00
CMP-004	PRO-001	USU-001	2026-09-08 20:00:51.320675-04	96.00
\.


--
-- Data for Name: diagnosticos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.diagnosticos (diagnostico_id, vehiculo_id, mecanico_id, fecha, descripcion_falla, observaciones_tecnicas, estado, fecha_modificacion, monto_estimado, respuesta_cliente, fecha_respuesta_cliente, comentario_cliente) FROM stdin;
DIA-002	VEH-002	USU-001	2026-08-17 19:38:29.922178-04	se verifico que tiene problemas con las valvulas del motor	sin detalles	Revisado	2026-08-18 17:35:45.261573-04	\N	Pendiente	\N	\N
DIA-003	VEH-002	USU-001	2026-08-18 18:03:20.941852-04	Sonido raro en el motor\nNecesita un cambio de biela	el auto necesita un mantenimiento general	Revisado	2026-08-18 18:05:50.948685-04	\N	Pendiente	\N	\N
DIA-004	VEH-001	USU-001	2026-08-18 18:08:07.839725-04	Rueda pinchada	sin detalles	Revisado	2026-08-18 18:09:17.567173-04	\N	Pendiente	\N	\N
DIA-005	VEH-002	USU-001	2026-08-19 19:12:17.713141-04	Problemas con la gasolina	sin detalles	Revisado	2026-08-19 19:13:03.33026-04	\N	Pendiente	\N	\N
DIA-006	VEH-003	USU-001	2026-08-23 21:33:10.338279-04	el motor rompio junta	se recomienda bajar el motor	Revisado	2026-08-23 21:52:50.328091-04	2000.00	Aprobado	2026-08-23 21:48:56.130924-04	continuen con la reparacion
DIA-007	VEH-003	USU-001	2026-08-25 23:56:06.826623-04	cigueñal roto	\N	Revisado	2026-08-25 23:56:13.193057-04	\N	Pendiente	\N	\N
DIA-008	VEH-004	USU-001	2026-08-25 23:57:50.907043-04	Cigueñal y biela para cambiar	ya le toca un cambio de aceite	Revisado	2026-08-25 23:58:23.183441-04	2000.00	Aprobado	2026-08-25 23:58:22.967758-04	continuar con el trabajo
DIA-001	VEH-001	USU-001	2026-08-17 18:40:51.02304-04	Rompio junta	el vehiculo llego en muy mal estado	Anulado	2026-08-26 00:01:15.111968-04	\N	Pendiente	\N	\N
DIA-009	VEH-002	USU-001	2026-08-26 00:02:27.060686-04	auto chino	sin detalles	Registrado	2026-08-26 00:02:46.308392-04	3000.00	Rechazado	2026-08-26 00:02:46.308391-04	\N
DIA-010	VEH-001	USU-001	2026-09-11 23:38:10.189246-04	cigenal roto	\N	Revisado	2026-09-11 23:43:01.792793-04	1500.00	Aprobado	2026-09-11 23:43:01.792594-04	\N
\.


--
-- Data for Name: facturas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.facturas (factura_id, orden_id, fecha_emision, nit_razon_social, total, estado) FROM stdin;
FAC-001	ORD-007	2026-08-18 18:41:21.752355-04	reparacion del vehiculo	850.00	Emitida
FAC-002	ORD-008	2026-08-19 19:20:10.018088-04	empresa	1780.00	Emitida
FAC-003	ORD-009	2026-08-23 22:08:32.636917-04	no refiere	50.00	Emitida
FAC-004	ORD-001	2026-09-12 00:40:15.56974-04	Prueba emision SIAT preparado	230.00	Anulada
FAC-005	ORD-001	2026-09-12 00:43:28.026391-04	reparacion del vehiculo	230.00	Emitida
FAC-006	ORD-011	2026-09-12 00:45:18.600743-04	\N	250.00	Emitida
\.


--
-- Data for Name: facturas_siat; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.facturas_siat (factura_siat_id, factura_id, venta_id, cuf, cufd, codigo_recepcion, estado_siat, xml_generado, xml_firmado, fecha_emision_siat, mensaje_servicio, fecha_registro) FROM stdin;
\.


--
-- Data for Name: orden_mecanicos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orden_mecanicos (orden_id, mecanico_id, fecha_asignacion) FROM stdin;
ORD-001	USU-002	2026-08-17 18:40:15.168335-04
ORD-002	USU-002	2026-08-17 19:27:38.842224-04
ORD-003	USU-002	2026-08-17 19:27:58.933916-04
ORD-004	USU-002	2026-08-17 19:35:20.117075-04
ORD-005	USU-002	2026-08-17 19:47:23.394797-04
ORD-006	USU-002	2026-08-18 00:25:46.070297-04
ORD-007	USU-002	2026-08-18 18:09:30.000297-04
ORD-008	USU-002	2026-08-19 19:15:08.585359-04
ORD-009	USU-003	2026-08-23 21:53:05.97009-04
ORD-011	USU-001	2026-09-11 23:44:25.547373-04
\.


--
-- Data for Name: orden_repuestos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orden_repuestos (orden_repuesto_id, orden_id, repuesto_id, cantidad, precio_unitario, origen, descripcion) FROM stdin;
ORE-001	ORD-001	REP-001	1	100.00	Inventario	\N
ORE-002	ORD-004	REP-002	2	50.00	Inventario	\N
ORE-003	ORD-006	REP-002	4	50.00	Inventario	\N
ORE-004	ORD-007	REP-002	4	50.00	Inventario	\N
ORE-005	ORD-007	REP-001	1	100.00	Inventario	\N
ORE-006	ORD-008	REP-001	1	100.00	Inventario	\N
ORE-007	ORD-008	REP-002	2	50.00	Inventario	\N
ORE-008	ORD-009	\N	1	0.00	ClienteTrae	cigueñal
\.


--
-- Data for Name: orden_servicios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orden_servicios (orden_servicio_id, orden_id, servicio_id, diagnostico_id, mecanico_id, descripcion, precio, estado, nombre_libre) FROM stdin;
OSR-001	ORD-001	SER-001	\N	USU-002	sin ningun detalle	130.00	Completado	\N
OSR-002	ORD-003	SER-001	\N	USU-002	\N	130.00	Pendiente	\N
OSR-003	ORD-004	SER-002	\N	USU-002	sin detalles	550.00	Completado	\N
OSR-004	ORD-006	SER-002	\N	USU-002	\N	550.00	Completado	\N
OSR-005	ORD-007	SER-002	\N	USU-002	se tomo mas del tiempo pensado	550.00	Completado	\N
OSR-006	ORD-008	SER-008	\N	USU-002	\N	30.00	Completado	\N
OSR-007	ORD-008	SER-003	\N	USU-002	\N	50.00	Completado	\N
OSR-008	ORD-008	SER-006	\N	USU-002	\N	1500.00	Completado	\N
OSR-009	ORD-009	SER-003	\N	USU-003	sin problemas	50.00	Completado	\N
OSR-012	ORD-011	SER-003	\N	USU-001	\N	50.00	Completado	\N
OSR-011	ORD-011	SER-004	\N	USU-001	\N	200.00	Completado	\N
\.


--
-- Data for Name: ordenes_trabajo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ordenes_trabajo (orden_id, vehiculo_id, cliente_id, administrador_id, fecha_creacion, fecha_estimada, fecha_cierre, estado, observaciones, diagnostico_id) FROM stdin;
ORD-001	VEH-001	CLI-002	USU-001	2026-08-17 18:17:49.731522-04	2026-08-24	2026-08-17 19:27:20.981321-04	Cerrada	Mantenimiento general	\N
ORD-002	VEH-001	CLI-002	USU-001	2026-08-17 19:27:38.418948-04	\N	\N	Cancelada	\N	\N
ORD-003	VEH-001	CLI-002	USU-001	2026-08-17 19:27:58.537952-04	\N	\N	Cancelada	\N	\N
ORD-004	VEH-002	CLI-003	USU-001	2026-08-17 19:35:08.766945-04	2026-08-31	2026-08-17 19:41:52.215996-04	Cerrada	Problemas con el motor del automovil	\N
ORD-005	VEH-001	CLI-002	USU-001	2026-08-17 19:47:05.362823-04	2026-08-20	\N	Cancelada	\N	\N
ORD-006	VEH-002	CLI-003	USU-001	2026-08-18 00:23:24.776411-04	\N	2026-08-18 00:31:45.081855-04	Cerrada	\N	\N
ORD-007	VEH-001	CLI-002	USU-001	2026-08-18 18:09:17.424789-04	2026-08-24	2026-08-18 18:40:03.339129-04	Cerrada	no tiene problemas con el presupuesto	DIA-004
ORD-008	VEH-002	CLI-003	USU-001	2026-08-19 19:13:03.206289-04	2026-08-26	2026-08-19 19:18:05.852576-04	Cerrada	sin observaciones	DIA-005
ORD-009	VEH-003	CLI-004	USU-001	2026-08-23 21:52:50.217448-04	2026-08-24	2026-08-23 22:04:14.114883-04	Cerrada	sin novedad	DIA-006
ORD-010	VEH-004	CLI-005	USU-001	2026-08-25 23:58:23.093793-04	\N	\N	Cancelada	\N	DIA-008
ORD-011	VEH-001	CLI-002	USU-001	2026-09-11 23:43:01.878915-04	\N	2026-09-12 00:45:06.094276-04	Cerrada	\N	DIA-010
\.


--
-- Data for Name: pagos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pagos (pago_id, factura_id, monto, fecha_pago, metodo_pago, referencia, metodo_pago_id) FROM stdin;
PAG-001	FAC-002	1780.00	2026-09-12 00:46:48.34698-04	Efectivo	\N	\N
\.


--
-- Data for Name: permisos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permisos (permiso_id, nombre, descripcion) FROM stdin;
\.


--
-- Data for Name: plantillas_vehiculo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plantillas_vehiculo (plantilla_id, marca, modelo, nombre_archivo, fecha_subida) FROM stdin;
PLV-001	Toyota	Rav4	PLV-001.svg	2026-09-11 19:25:40.081149-04
\.


--
-- Data for Name: proveedores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proveedores (proveedor_id, nombre, contacto, telefono, email, direccion) FROM stdin;
PRO-001	Juana Bravo	Rider	68680932	juanabravo30@gmail.com	calle ameller entre belgrano
PRO-002	Proveedor Lote A	\N	\N	\N	\N
\.


--
-- Data for Name: reportes_generados; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reportes_generados (reporte_id, tipo_reporte, fecha_inicio, fecha_fin, usuario_id, fecha_generacion, formato) FROM stdin;
RPT-001	Ordenes	2026-01-01	2026-12-31	USU-001	2026-08-17 12:14:04.449619-04	Pdf
RPT-002	Ordenes	2026-01-01	2026-12-31	USU-001	2026-08-17 12:14:12.582095-04	Excel
RPT-003	Ordenes	2026-01-01	2026-12-31	USU-001	2026-08-17 12:14:13.501681-04	Csv
RPT-004	Ventas	2026-08-01	2026-08-19	USU-001	2026-08-19 19:22:29.105282-04	Pdf
\.


--
-- Data for Name: repuestos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repuestos (repuesto_id, nombre, descripcion, stock_actual, stock_minimo, precio_venta, proveedor_id, nombre_archivo_foto, precio_compra, codigo_sin, unidad_medida_sin) FROM stdin;
REP-002	Valvulas	Valvulas para motor	97	10	50.00	PRO-001	\N	50.00	\N	\N
REP-003	Prueba Lote A	\N	0	0	15.00	\N	\N	10.00	\N	\N
REP-004	Frenos	Frenos para automovil	103	10	80.00	\N	\N	50.00	\N	\N
REP-001	Aceite 10w40	Aceite para motor de automovil	106	5	200.00	\N	REP-001.png	100.00	\N	\N
REP-005	Filtro de prueba 1788912051171	\N	11	1	15.00	PRO-001	\N	12.00	\N	\N
\.


--
-- Data for Name: rol_permisos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rol_permisos (rol_id, permiso_id) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (rol_id, nombre_rol, descripcion) FROM stdin;
ROL-001	Administrador	Control total del sistema
ROL-002	Mecanico	Gestiona diagnosticos y ordenes de trabajo asignadas
\.


--
-- Data for Name: tipos_servicio; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tipos_servicio (servicio_id, nombre, descripcion, precio_base, estado, codigo_sin, unidad_medida_sin) FROM stdin;
SER-001	Balanceo digital	se realiza el balanceo digital computarizado al vehiculo	130.00	Inactivo	\N	\N
SER-002	Cambio de valvulas	se realiza el cambio de válvulas del motor del motorizado	550.00	Activo	\N	\N
SER-004	Alineacion y Balanceo	Ajuste de los ángulos de las ruedas y balanceo de llantas para evitar vibraciones.	200.00	Activo	\N	\N
SER-006	Reparacion mayor de motor	Desarmado profundo y rectificación por daños severos.	1500.00	Activo	\N	\N
SER-003	Cambio de aceite y filtros	Drenaje del aceite usado, reemplazo del filtro y llenado con lubricante nuevo.	50.00	Activo	\N	\N
SER-005	Cambio de pastillas de freno	Sustitución de pastillas desgastadas, limpieza del sistema y mano de obra por eje.	50.00	Activo	\N	\N
SER-007	Cambio de bujias	Reemplazo de las bujías para mejorar la chispa del motor y la eficiencia del combustible.	40.00	Activo	\N	\N
SER-008	Cambio de bateria	Instalación de una batería nueva.	30.00	Activo	\N	\N
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (usuario_id, nombre, apellido, email, username, password_hash, rol_id, telefono, estado, fecha_registro, nombre_archivo_foto) FROM stdin;
USU-002	Hector	Vega	hectorvega6060@gmail.com	mecanicoH	$2a$11$jR4smJGJkVw/gassvZ/3Xuy9xCK1LBwHLUQBCzNmorve7pnfe3A/a	ROL-002	68680524	Activo	2026-08-17 18:40:01.161132-04	\N
USU-003	Fabian	Vega	fabianvega422@gmail.com	fabian	$2a$11$V3g.rEyvj.dezCV1c.y61.y2eriANAHIwE2Ro9gb2NG.pb5E4XAsy	ROL-002	73496744	Activo	2026-08-19 19:52:10.758753-04	\N
USU-001	Edgar	Sossa	admin@servicarsossa.bo	admin	$2a$11$.HyOcv43Ws18LRBRRcSR1.FAhIVSKw.56Ad/w8w5Cy8GcPh4FCZay	ROL-001	\N	Activo	2026-08-16 22:00:39.968127-04	USU-001.png
\.


--
-- Data for Name: vehiculo_fotos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehiculo_fotos (foto_id, vehiculo_id, nombre_archivo, fecha_subida) FROM stdin;
\.


--
-- Data for Name: vehiculo_zonas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehiculo_zonas (zona_obs_id, vehiculo_id, orden_id, zona, estado, detalle, fecha_registro) FROM stdin;
ZNA-001	VEH-003	\N	capo	Atencion	\N	2026-09-11 19:01:53.124523-04
\.


--
-- Data for Name: vehiculos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehiculos (vehiculo_id, cliente_id, placa, marca, modelo, anio, color, num_motor, num_chasis, kilometraje, fecha_registro) FROM stdin;
VEH-002	CLI-003	6921UHD	Hyunday	Changan	2025	Rojo	CMKS-231	92821323	5000	2026-08-17 19:34:12.421197-04
VEH-003	CLI-004	6792UHD	Toyota	Rav4	2024	Blanco	291921922	921939129	4000	2026-08-23 21:31:41.680518-04
VEH-004	CLI-005	TST-999	Toyota	Hilux	\N	\N	\N	\N	0	2026-08-24 01:20:49.236226-04
VEH-001	CLI-002	4203KTM	KIA	2020	2016	Negro	21	2133ECFAS	21000	2026-08-17 18:16:47.053245-04
VEH-005	CLI-002	4243UTN	JAC	Full	2022	Gris	CMKS-231	2133ECFAS	2000	2026-09-08 19:59:40.566975-04
\.


--
-- Data for Name: venta_detalle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.venta_detalle (venta_detalle_id, venta_id, repuesto_id, cantidad, precio_unitario) FROM stdin;
VDT-001	VTA-001	REP-002	1	50.00
VDT-002	VTA-001	REP-001	1	100.00
VDT-003	VTA-002	REP-001	1	200.00
VDT-004	VTA-003	REP-005	1	15.00
\.


--
-- Data for Name: ventas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ventas (venta_id, cliente_id, usuario_id, fecha_venta, metodo_pago, total, estado, observaciones, metodo_pago_id) FROM stdin;
VTA-001	\N	USU-001	2026-08-24 12:05:17.517608-04	Efectivo	150.00	Emitida	\N	\N
VTA-002	\N	USU-001	2026-09-12 00:39:14.064178-04	Efectivo	200.00	Anulada	\N	\N
VTA-003	\N	USU-001	2026-09-12 00:43:50.326613-04	Transferencia	15.00	Emitida	\N	\N
\.


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (auditoria_id);


--
-- Name: clientes clientes_ci_nit_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_ci_nit_key UNIQUE (ci_nit);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (cliente_id);


--
-- Name: comisiones_config comisiones_config_mecanico_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones_config
    ADD CONSTRAINT comisiones_config_mecanico_id_key UNIQUE (mecanico_id);


--
-- Name: comisiones_config comisiones_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones_config
    ADD CONSTRAINT comisiones_config_pkey PRIMARY KEY (config_id);


--
-- Name: comisiones comisiones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT comisiones_pkey PRIMARY KEY (comision_id);


--
-- Name: compra_detalle compra_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compra_detalle
    ADD CONSTRAINT compra_detalle_pkey PRIMARY KEY (detalle_id);


--
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (compra_id);


--
-- Name: diagnosticos diagnosticos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_pkey PRIMARY KEY (diagnostico_id);


--
-- Name: facturas facturas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_pkey PRIMARY KEY (factura_id);


--
-- Name: facturas_siat facturas_siat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas_siat
    ADD CONSTRAINT facturas_siat_pkey PRIMARY KEY (factura_siat_id);


--
-- Name: orden_mecanicos orden_mecanicos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_mecanicos
    ADD CONSTRAINT orden_mecanicos_pkey PRIMARY KEY (orden_id, mecanico_id);


--
-- Name: orden_repuestos orden_repuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_repuestos
    ADD CONSTRAINT orden_repuestos_pkey PRIMARY KEY (orden_repuesto_id);


--
-- Name: orden_servicios orden_servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_servicios
    ADD CONSTRAINT orden_servicios_pkey PRIMARY KEY (orden_servicio_id);


--
-- Name: ordenes_trabajo ordenes_trabajo_diagnostico_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_diagnostico_id_key UNIQUE (diagnostico_id);


--
-- Name: ordenes_trabajo ordenes_trabajo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_pkey PRIMARY KEY (orden_id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (pago_id);


--
-- Name: permisos permisos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_nombre_key UNIQUE (nombre);


--
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (permiso_id);


--
-- Name: plantillas_vehiculo plantillas_vehiculo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plantillas_vehiculo
    ADD CONSTRAINT plantillas_vehiculo_pkey PRIMARY KEY (plantilla_id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (proveedor_id);


--
-- Name: reportes_generados reportes_generados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reportes_generados
    ADD CONSTRAINT reportes_generados_pkey PRIMARY KEY (reporte_id);


--
-- Name: repuestos repuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repuestos
    ADD CONSTRAINT repuestos_pkey PRIMARY KEY (repuesto_id);


--
-- Name: rol_permisos rol_permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_pkey PRIMARY KEY (rol_id, permiso_id);


--
-- Name: roles roles_nombre_rol_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_rol_key UNIQUE (nombre_rol);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (rol_id);


--
-- Name: tipos_servicio tipos_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipos_servicio
    ADD CONSTRAINT tipos_servicio_pkey PRIMARY KEY (servicio_id);


--
-- Name: comisiones uq_comision_orden_mecanico; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT uq_comision_orden_mecanico UNIQUE (orden_id, mecanico_id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (usuario_id);


--
-- Name: usuarios usuarios_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_username_key UNIQUE (username);


--
-- Name: vehiculo_fotos vehiculo_fotos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculo_fotos
    ADD CONSTRAINT vehiculo_fotos_pkey PRIMARY KEY (foto_id);


--
-- Name: vehiculo_zonas vehiculo_zonas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculo_zonas
    ADD CONSTRAINT vehiculo_zonas_pkey PRIMARY KEY (zona_obs_id);


--
-- Name: vehiculos vehiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_pkey PRIMARY KEY (vehiculo_id);


--
-- Name: vehiculos vehiculos_placa_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_placa_key UNIQUE (placa);


--
-- Name: venta_detalle venta_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_detalle
    ADD CONSTRAINT venta_detalle_pkey PRIMARY KEY (venta_detalle_id);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (venta_id);


--
-- Name: idx_auditoria_entidad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_entidad ON public.auditoria USING btree (entidad, entidad_id);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auditoria_fecha ON public.auditoria USING btree (fecha);


--
-- Name: idx_comisiones_mecanico; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comisiones_mecanico ON public.comisiones USING btree (mecanico_id);


--
-- Name: idx_compra_detalle_compra; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compra_detalle_compra ON public.compra_detalle USING btree (compra_id);


--
-- Name: idx_diagnosticos_vehiculo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diagnosticos_vehiculo ON public.diagnosticos USING btree (vehiculo_id);


--
-- Name: idx_facturas_orden; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_facturas_orden ON public.facturas USING btree (orden_id);


--
-- Name: idx_facturas_siat_cuf; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_facturas_siat_cuf ON public.facturas_siat USING btree (cuf);


--
-- Name: idx_facturas_siat_factura; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_facturas_siat_factura ON public.facturas_siat USING btree (factura_id) WHERE (factura_id IS NOT NULL);


--
-- Name: idx_facturas_siat_venta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_facturas_siat_venta ON public.facturas_siat USING btree (venta_id) WHERE (venta_id IS NOT NULL);


--
-- Name: idx_orden_repuestos_orden; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orden_repuestos_orden ON public.orden_repuestos USING btree (orden_id);


--
-- Name: idx_orden_servicios_mecanico; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orden_servicios_mecanico ON public.orden_servicios USING btree (mecanico_id);


--
-- Name: idx_orden_servicios_orden; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orden_servicios_orden ON public.orden_servicios USING btree (orden_id);


--
-- Name: idx_ordenes_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ordenes_cliente ON public.ordenes_trabajo USING btree (cliente_id);


--
-- Name: idx_ordenes_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ordenes_estado ON public.ordenes_trabajo USING btree (estado);


--
-- Name: idx_ordenes_vehiculo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ordenes_vehiculo ON public.ordenes_trabajo USING btree (vehiculo_id);


--
-- Name: idx_pagos_factura; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_factura ON public.pagos USING btree (factura_id);


--
-- Name: idx_plantillas_vehiculo_marca_modelo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_plantillas_vehiculo_marca_modelo ON public.plantillas_vehiculo USING btree (marca, modelo);


--
-- Name: idx_usuarios_rol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_rol ON public.usuarios USING btree (rol_id);


--
-- Name: idx_vehiculo_fotos_vehiculo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vehiculo_fotos_vehiculo ON public.vehiculo_fotos USING btree (vehiculo_id);


--
-- Name: idx_vehiculo_zonas_vehiculo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vehiculo_zonas_vehiculo ON public.vehiculo_zonas USING btree (vehiculo_id);


--
-- Name: idx_vehiculos_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vehiculos_cliente ON public.vehiculos USING btree (cliente_id);


--
-- Name: idx_venta_detalle_venta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_venta_detalle_venta ON public.venta_detalle USING btree (venta_id);


--
-- Name: idx_ventas_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ventas_fecha ON public.ventas USING btree (fecha_venta);


--
-- Name: auditoria auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: comisiones_config comisiones_config_mecanico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones_config
    ADD CONSTRAINT comisiones_config_mecanico_id_fkey FOREIGN KEY (mecanico_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: comisiones comisiones_mecanico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT comisiones_mecanico_id_fkey FOREIGN KEY (mecanico_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: comisiones comisiones_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT comisiones_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_trabajo(orden_id);


--
-- Name: compra_detalle compra_detalle_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compra_detalle
    ADD CONSTRAINT compra_detalle_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(compra_id) ON DELETE CASCADE;


--
-- Name: compra_detalle compra_detalle_repuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compra_detalle
    ADD CONSTRAINT compra_detalle_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES public.repuestos(repuesto_id);


--
-- Name: compras compras_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(proveedor_id);


--
-- Name: compras compras_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: diagnosticos diagnosticos_mecanico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_mecanico_id_fkey FOREIGN KEY (mecanico_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: diagnosticos diagnosticos_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(vehiculo_id) ON DELETE CASCADE;


--
-- Name: facturas facturas_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_trabajo(orden_id);


--
-- Name: facturas_siat facturas_siat_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas_siat
    ADD CONSTRAINT facturas_siat_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas(factura_id);


--
-- Name: facturas_siat facturas_siat_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturas_siat
    ADD CONSTRAINT facturas_siat_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(venta_id);


--
-- Name: orden_mecanicos orden_mecanicos_mecanico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_mecanicos
    ADD CONSTRAINT orden_mecanicos_mecanico_id_fkey FOREIGN KEY (mecanico_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: orden_mecanicos orden_mecanicos_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_mecanicos
    ADD CONSTRAINT orden_mecanicos_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_trabajo(orden_id) ON DELETE CASCADE;


--
-- Name: orden_repuestos orden_repuestos_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_repuestos
    ADD CONSTRAINT orden_repuestos_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_trabajo(orden_id) ON DELETE CASCADE;


--
-- Name: orden_repuestos orden_repuestos_repuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_repuestos
    ADD CONSTRAINT orden_repuestos_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES public.repuestos(repuesto_id);


--
-- Name: orden_servicios orden_servicios_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_servicios
    ADD CONSTRAINT orden_servicios_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(diagnostico_id);


--
-- Name: orden_servicios orden_servicios_mecanico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_servicios
    ADD CONSTRAINT orden_servicios_mecanico_id_fkey FOREIGN KEY (mecanico_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: orden_servicios orden_servicios_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_servicios
    ADD CONSTRAINT orden_servicios_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_trabajo(orden_id) ON DELETE CASCADE;


--
-- Name: orden_servicios orden_servicios_servicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orden_servicios
    ADD CONSTRAINT orden_servicios_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.tipos_servicio(servicio_id);


--
-- Name: ordenes_trabajo ordenes_trabajo_administrador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_administrador_id_fkey FOREIGN KEY (administrador_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: ordenes_trabajo ordenes_trabajo_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(cliente_id);


--
-- Name: ordenes_trabajo ordenes_trabajo_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(diagnostico_id);


--
-- Name: ordenes_trabajo ordenes_trabajo_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(vehiculo_id);


--
-- Name: pagos pagos_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas(factura_id) ON DELETE CASCADE;


--
-- Name: reportes_generados reportes_generados_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reportes_generados
    ADD CONSTRAINT reportes_generados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: repuestos repuestos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repuestos
    ADD CONSTRAINT repuestos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(proveedor_id);


--
-- Name: rol_permisos rol_permisos_permiso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES public.permisos(permiso_id) ON DELETE CASCADE;


--
-- Name: rol_permisos rol_permisos_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(rol_id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(rol_id);


--
-- Name: vehiculo_fotos vehiculo_fotos_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculo_fotos
    ADD CONSTRAINT vehiculo_fotos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(vehiculo_id) ON DELETE CASCADE;


--
-- Name: vehiculo_zonas vehiculo_zonas_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculo_zonas
    ADD CONSTRAINT vehiculo_zonas_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_trabajo(orden_id) ON DELETE SET NULL;


--
-- Name: vehiculo_zonas vehiculo_zonas_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculo_zonas
    ADD CONSTRAINT vehiculo_zonas_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(vehiculo_id) ON DELETE CASCADE;


--
-- Name: vehiculos vehiculos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(cliente_id) ON DELETE CASCADE;


--
-- Name: venta_detalle venta_detalle_repuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_detalle
    ADD CONSTRAINT venta_detalle_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES public.repuestos(repuesto_id);


--
-- Name: venta_detalle venta_detalle_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_detalle
    ADD CONSTRAINT venta_detalle_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(venta_id) ON DELETE CASCADE;


--
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(cliente_id);


--
-- Name: ventas ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO servicar_app;


--
-- Name: TABLE auditoria; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.auditoria TO servicar_app;


--
-- Name: TABLE clientes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clientes TO servicar_app;


--
-- Name: TABLE comisiones; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.comisiones TO servicar_app;


--
-- Name: TABLE comisiones_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.comisiones_config TO servicar_app;


--
-- Name: TABLE compra_detalle; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.compra_detalle TO servicar_app;


--
-- Name: TABLE compras; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.compras TO servicar_app;


--
-- Name: TABLE diagnosticos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.diagnosticos TO servicar_app;


--
-- Name: TABLE facturas; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.facturas TO servicar_app;


--
-- Name: TABLE facturas_siat; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.facturas_siat TO servicar_app;


--
-- Name: TABLE orden_mecanicos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orden_mecanicos TO servicar_app;


--
-- Name: TABLE orden_repuestos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orden_repuestos TO servicar_app;


--
-- Name: TABLE orden_servicios; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orden_servicios TO servicar_app;


--
-- Name: TABLE ordenes_trabajo; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ordenes_trabajo TO servicar_app;


--
-- Name: TABLE pagos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pagos TO servicar_app;


--
-- Name: TABLE permisos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.permisos TO servicar_app;


--
-- Name: TABLE plantillas_vehiculo; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.plantillas_vehiculo TO servicar_app;


--
-- Name: TABLE proveedores; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.proveedores TO servicar_app;


--
-- Name: TABLE reportes_generados; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reportes_generados TO servicar_app;


--
-- Name: TABLE repuestos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.repuestos TO servicar_app;


--
-- Name: TABLE rol_permisos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.rol_permisos TO servicar_app;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.roles TO servicar_app;


--
-- Name: TABLE tipos_servicio; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tipos_servicio TO servicar_app;


--
-- Name: TABLE usuarios; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.usuarios TO servicar_app;


--
-- Name: TABLE vehiculo_fotos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vehiculo_fotos TO servicar_app;


--
-- Name: TABLE vehiculo_zonas; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vehiculo_zonas TO servicar_app;


--
-- Name: TABLE vehiculos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vehiculos TO servicar_app;


--
-- Name: TABLE venta_detalle; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.venta_detalle TO servicar_app;


--
-- Name: TABLE ventas; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ventas TO servicar_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO servicar_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO servicar_app;


--
-- PostgreSQL database dump complete
--

\unrestrict PSYf6wsrTaUC1AhYAPcNa6KWLDuVhM1oExXe4SjHTOWL8dlJwG108D0eIjOoZeb

