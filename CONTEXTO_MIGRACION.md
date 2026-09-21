# Contexto del proyecto — para retomar tras la migración de PC

Este archivo existe porque la carpeta de sesión `.claude` copiada por USB no
cargó la memoria/historial en la PC nueva. Contiene lo esencial de lo hablado
y hecho en la PC anterior. Pedile a Claude que lo lea completo antes de seguir
trabajando.

## Qué es el proyecto

Sistema de información para el taller automotriz **Servicar SOSSA** (Tarija/
Bermejo, Bolivia). Es el **proyecto de grado** de Ronal Fabian Vega Bravo,
UAJMS, metodología Scrum, 8 sprints de ~3 semanas, 9 épicas, 41 historias de
usuario, 132 puntos, 499 horas.

**Stack**: Angular 21 (standalone components, signals) + ASP.NET Core 8 Web
API (arquitectura en capas Domain/Application/Infrastructure/API) +
PostgreSQL 16 (PKs alfanuméricas tipo `USU-001`, generadas en la app). Ver
`CLAUDE.md` en la raíz del repo para las convenciones completas.

## Despliegue — Vercel + Railway + Supabase

El sistema está desplegado en producción, no solo en local:

- **Frontend** → **Vercel**. Config en `frontend/vercel.json`. Build con
  `npm run build`, sirve `dist/frontend/browser`.
- **Backend** → **Railway**, vía Docker (`backend/Dockerfile`). URL de la API
  en producción: `https://servicar-sossa-production.up.railway.app/api`
  (ver `frontend/src/environments/environment.production.ts`).
- **Base de datos** → **Supabase** (Postgres administrado). Proyecto
  vinculado: `servicar-sossa`, ref `eapacqrjqjusbunibcjv`, organización
  `gboqverofghhgysmmqxd` (ver `supabase/.temp/linked-project.json`; ese CLI
  está instalado y logueado en la PC anterior, en la nueva probablemente haya
  que volver a hacer `supabase link`).
- Historial de commits relacionados: "Preparar despliegue: Docker para el
  backend, config de Vercel, fix del seeder", "Disparar redeploy tras
  desactivar la protección SSO de Vercel", "Tolerar la ventana de despliegue
  en los listados de clientes y órdenes".

**Importante**: la corrección del script `taller_automotriz_bd.sql` (tabla
`proformas`, columnas SIAT de `facturas`, etc.) se verificó contra el
PostgreSQL **local** (`localhost`, usuario `servicar_app`), no contra la base
de Supabase de producción. Si la app en producción ya viene funcionando con
proformas, es porque Supabase ya tiene el esquema correcto aplicado a mano —
pero conviene confirmarlo (`\d proformas` contra la conexión de Supabase)
antes de asumir que coincide con el script corregido.

## Trabajo de documentación de tesis ya entregado

Se documentaron y entregaron los 8 sprints en formato APA 7, en
`C:\Users\USUARIO\Desktop\Presentacion Final Taller 3\` (en la PC anterior):
ocho archivos `.docx`, numeración continua Tablas 67–130 y Figuras 42–113
(continuando la Tabla 66/Figura 41 de la tesis ya escrita). Cada sprint:
9 figuras (diagramas/capturas reproducidas fielmente del sistema real) y 8
tablas (2 de contenido + 6 casos de prueba ejecutados en vivo, nunca
inventados).

Hallazgos documentados en esos sprints (relevantes si se sigue trabajando el
código):

- **Brecha de auditoría corregida en tres módulos**: Diagnósticos/Catálogo de
  servicios (Sprint 3), Comisiones (Sprint 6), Proformas/Pagos al crearlos
  (Sprint 7) — antes no dejaban rastro en la tabla `auditoria`.
- **USU032 ("Como Mecánico, deseo consultar mis comisiones") no se cumple**:
  un Mecánico real recibe HTTP 403 en `/api/comisiones` y
  `/api/comisiones/resumen` (confirmado con sesión real, control con HTTP 200
  en `/api/ordenes`). Documentado como "No aprobado", NO corregido
  unilateralmente porque es una decisión de producto (dos opciones de
  remediación propuestas en la Review del Sprint 6).
- **Divergencia DDL vs. esquema real, ya corregida** (ver más arriba): faltaba
  la tabla `proformas` y `pagos` apuntaba a `facturas` en vez de a
  `proformas`.
- Se respetó una reconciliación previa de EPIC009 en el documento de tesis
  (actor pasó de "Cliente" a "Administrador" para USU039/040/041).
- Quedan registros de prueba etiquetados en la base: USU-004, CLI-007/VEH-006,
  DIA-012/013/014, ORD-013/014, SER-009/010, REP-006, PRO-003, CMP-005,
  CCF-003, COM-007, PRF-007/008, PAG-002/003/004, RPT-005.

## Memoria del proyecto (resumen de lo que Claude tenía guardado)

- No rehacer las tablas como tarjetas móviles apiladas: el sistema se usa
  sobre todo en escritorio.
- El tema visual sigue la geometría de Spike (vía tokens CSS) conservando el
  rojo de marca; se descartó Angular Material.
- Responder siempre en castellano.
- Hay una feature de diagrama de vehículo (zonas + plantillas por modelo,
  tablas `vehiculo_zonas`/`plantillas_vehiculo` en la base) que el usuario
  todavía no confirmó si quiere conservar — no tocarla sin preguntar.
- Redundancia de campos descripción/detalle entre formularios: pendiente de
  revisar, no tocar todavía.
- Pendiente diseñar el balanceo/alineación restringido a que solo el
  Administrador se asigne ese servicio.
- Hay inconsistencias tesis↔sistema (stack desktop-vs-web en el documento
  escrito, PKs Integer-vs-VARCHAR, roles, horas de la épica 9, mapeo de
  sprints) que se reconciliarán al finalizar, no antes.
- Manual de usuario ya aprobado; el de instalación pendiente de afinar.

## Qué pedirle a Claude en la sesión nueva

Una vez que lea este archivo, puede seguir directamente con cualquier tarea
pendiente del proyecto sin tener que volver a explicar el contexto del taller,
la tesis, ni el despliegue.
