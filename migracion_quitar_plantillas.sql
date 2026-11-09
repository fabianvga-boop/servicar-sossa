-- ============================================================================
-- Migración: se retira la biblioteca de plantillas de vehículo
-- El diagrama con zonas sobre el dibujo se reemplazó por la inspección del
-- vehículo (lista de partes con su estado). Las marcas ya registradas siguen en
-- vehiculo_zonas; solo desaparece la tabla de plantillas (SVG por marca/modelo).
-- Idempotente. Los archivos .svg ya subidos al almacenamiento no se tocan: se
-- pueden borrar a mano (carpeta plantillas-vehiculo).
--   psql -U postgres -d servicar_sossa -f migracion_quitar_plantillas.sql
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS plantillas_vehiculo;

COMMIT;
