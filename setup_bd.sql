-- ============================================================================
-- SETUP RESTANTE DE LA BASE servicar_sossa
-- ============================================================================
-- Ejecutar UNA SOLA VEZ en pgAdmin4:
--   Servers > PostgreSQL 16 > Databases > servicar_sossa > (clic derecho) Query Tool
--   Abrir este archivo y ejecutar todo con F5.
--
-- Contiene 3 pasos:
--   1. Migracion TIMESTAMP -> TIMESTAMPTZ (obligatorio para EF Core / Npgsql)
--   2. Eliminacion del rol Cliente (el sistema solo usa Administrador y Mecanico)
--   3. Creacion del rol de base de datos que usara la API
-- ============================================================================


-- ============================================================================
-- PASO 1: TIMESTAMP -> TIMESTAMPTZ
-- ============================================================================
-- Motivo: el CLAUDE.md establece que las fechas se almacenan en UTC. En
-- PostgreSQL eso corresponde a TIMESTAMPTZ, no a TIMESTAMP.
--
-- Npgsql 6+ (el driver de EF Core) LANZA UNA EXCEPCION al intentar escribir un
-- DateTime con Kind=Utc en una columna 'timestamp without time zone':
--     "Cannot write DateTime with Kind=UTC to PostgreSQL type
--      'timestamp without time zone'"
-- Como las entidades usan DateTime.UtcNow por defecto, el primer INSERT fallaria.
--
-- La base esta vacia, asi que no hay riesgo de perder datos.
-- ============================================================================

ALTER TABLE usuarios
    ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ USING fecha_registro AT TIME ZONE 'UTC';

ALTER TABLE clientes
    ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ USING fecha_registro AT TIME ZONE 'UTC';

ALTER TABLE vehiculos
    ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ USING fecha_registro AT TIME ZONE 'UTC';

ALTER TABLE diagnosticos
    ALTER COLUMN fecha              TYPE TIMESTAMPTZ USING fecha              AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_modificacion TYPE TIMESTAMPTZ USING fecha_modificacion AT TIME ZONE 'UTC';

ALTER TABLE ordenes_trabajo
    ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ USING fecha_creacion AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_cierre   TYPE TIMESTAMPTZ USING fecha_cierre   AT TIME ZONE 'UTC';

ALTER TABLE orden_mecanicos
    ALTER COLUMN fecha_asignacion TYPE TIMESTAMPTZ USING fecha_asignacion AT TIME ZONE 'UTC';

ALTER TABLE compras
    ALTER COLUMN fecha TYPE TIMESTAMPTZ USING fecha AT TIME ZONE 'UTC';

ALTER TABLE comisiones_config
    ALTER COLUMN fecha_actualizacion TYPE TIMESTAMPTZ USING fecha_actualizacion AT TIME ZONE 'UTC';

ALTER TABLE comisiones
    ALTER COLUMN fecha_calculo TYPE TIMESTAMPTZ USING fecha_calculo AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_pago    TYPE TIMESTAMPTZ USING fecha_pago    AT TIME ZONE 'UTC';

ALTER TABLE proformas
    ALTER COLUMN fecha_emision           TYPE TIMESTAMPTZ USING fecha_emision           AT TIME ZONE 'UTC',
    ALTER COLUMN fecha_respuesta_cliente TYPE TIMESTAMPTZ USING fecha_respuesta_cliente AT TIME ZONE 'UTC';

ALTER TABLE facturas
    ALTER COLUMN fecha_emision TYPE TIMESTAMPTZ USING fecha_emision AT TIME ZONE 'UTC';

ALTER TABLE pagos
    ALTER COLUMN fecha_pago TYPE TIMESTAMPTZ USING fecha_pago AT TIME ZONE 'UTC';

ALTER TABLE reportes_generados
    ALTER COLUMN fecha_generacion TYPE TIMESTAMPTZ USING fecha_generacion AT TIME ZONE 'UTC';


-- ============================================================================
-- PASO 2: eliminar el rol Cliente
-- ============================================================================
-- El sistema quedo con 2 roles: Administrador (ROL-001) y Mecanico (ROL-002).

DELETE FROM roles WHERE rol_id = 'ROL-003';


-- ============================================================================
-- PASO 3: rol de base de datos para la API
-- ============================================================================
-- La API no debe conectarse como superusuario 'postgres'. Este rol tiene
-- permisos solo sobre el esquema public de servicar_sossa.
--
-- IMPORTANTE: cambia 'ServicarApp2026' por una contrasena propia y usa la misma
-- en backend/ServicarSossa.API/appsettings.Development.json.

CREATE ROLE servicar_app WITH LOGIN PASSWORD 'ServicarApp2026';

GRANT CONNECT ON DATABASE servicar_sossa TO servicar_app;
GRANT USAGE  ON SCHEMA public            TO servicar_app;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public TO servicar_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO servicar_app;

-- Que los permisos apliquen tambien a objetos creados a futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO servicar_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO servicar_app;


-- ============================================================================
-- VERIFICACION
-- ============================================================================

-- (a) No debe quedar ninguna columna 'timestamp without time zone'
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone'
ORDER BY table_name, column_name;

-- (b) Deben quedar exactamente 2 roles
SELECT rol_id, nombre_rol FROM roles ORDER BY rol_id;

-- (c) El rol de aplicacion debe existir y poder iniciar sesion
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'servicar_app';
