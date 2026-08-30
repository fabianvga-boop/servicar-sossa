# CLAUDE.md â€” Sistema de InformaciÃ³n Servicar SOSSA

## DescripciÃ³n del proyecto

Sistema de informaciÃ³n para el taller automotriz **Servicar SOSSA** (Tarija, Bolivia).
Proyecto de grado â€” Universidad AutÃ³noma Juan Misael Saracho (UAJMS).
MetodologÃ­a: **Scrum** â€” 8 sprints de ~3 semanas cada uno.

---

## Stack tecnolÃ³gico

| Capa | TecnologÃ­a |
|---|---|
| Frontend | Angular 17+ (standalone components) |
| Backend (API) | C# â€” ASP.NET Core 8 Web API |
| Base de datos | PostgreSQL 16 |
| ORM | Entity Framework Core 8 |
| AutenticaciÃ³n | JWT (JSON Web Tokens) |
| DocumentaciÃ³n API | Swagger / OpenAPI |

---

## Estructura del repositorio

```
servicar-sossa/
â”œâ”€â”€ backend/                   # ASP.NET Core Web API
â”‚   â”œâ”€â”€ ServicarSossa.API/
â”‚   â”‚   â”œâ”€â”€ Controllers/       # Endpoints REST por mÃ³dulo
â”‚   â”‚   â”œâ”€â”€ Program.cs
â”‚   â”‚   â””â”€â”€ appsettings.json
â”‚   â”œâ”€â”€ ServicarSossa.Application/
â”‚   â”‚   â”œâ”€â”€ Services/          # LÃ³gica de negocio
â”‚   â”‚   â”œâ”€â”€ DTOs/              # Data Transfer Objects
â”‚   â”‚   â””â”€â”€ Interfaces/
â”‚   â”œâ”€â”€ ServicarSossa.Domain/
â”‚   â”‚   â”œâ”€â”€ Entities/          # Entidades del dominio (1 por tabla)
â”‚   â”‚   â””â”€â”€ Enums/
â”‚   â””â”€â”€ ServicarSossa.Infrastructure/
â”‚       â”œâ”€â”€ Data/
â”‚       â”‚   â”œâ”€â”€ AppDbContext.cs
â”‚       â”‚   â””â”€â”€ Migrations/
â”‚       â””â”€â”€ Repositories/
â”‚
â”œâ”€â”€ frontend/                  # Angular
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”‚   â”œâ”€â”€ core/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ guards/        # AuthGuard por rol
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ interceptors/  # JWT interceptor
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ services/      # Auth, HTTP base
â”‚   â”‚   â”‚   â”œâ”€â”€ shared/
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ components/    # Tabla, modal, badge, etc.
â”‚   â”‚   â”‚   â””â”€â”€ modules/
â”‚   â”‚   â”‚       â”œâ”€â”€ auth/
â”‚   â”‚   â”‚       â”œâ”€â”€ usuarios/
â”‚   â”‚   â”‚       â”œâ”€â”€ clientes/
â”‚   â”‚   â”‚       â”œâ”€â”€ diagnosticos/
â”‚   â”‚   â”‚       â”œâ”€â”€ ordenes/
â”‚   â”‚   â”‚       â”œâ”€â”€ inventario/
â”‚   â”‚   â”‚       â”œâ”€â”€ comisiones/
â”‚   â”‚   â”‚       â”œâ”€â”€ facturacion/
â”‚   â”‚   â”‚       â””â”€â”€ reportes/
â”‚   â”‚   â””â”€â”€ environments/
â”‚   â””â”€â”€ angular.json
â”‚
â””â”€â”€ CLAUDE.md
```

---

## Base de datos â€” PostgreSQL

### Cadena de conexiÃ³n (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=servicar_sossa;Username=postgres;Password=tu_password"
  }
}
```

### ConvenciÃ³n de llaves primarias

Las llaves primarias son **cÃ³digos alfanumÃ©ricos** de tipo `VARCHAR(20)`, generados en la capa de aplicaciÃ³n (no autoincremento). Formato por entidad:

| Entidad | Formato PK | Ejemplo |
|---|---|---|
| roles | ROL-000 | ROL-001 |
| permisos | PER-000 | PER-001 |
| usuarios | USU-000 | USU-001 |
| clientes | CLI-000 | CLI-001 |
| vehiculos | VEH-000 | VEH-001 |
| diagnosticos | DIA-000 | DIA-001 |
| tipos_servicio | SER-000 | SER-001 |
| ordenes_trabajo | ORD-000 | ORD-001 |
| proveedores | PRO-000 | PRO-001 |
| repuestos | REP-000 | REP-001 |
| compras | CMP-000 | CMP-001 |
| compra_detalle | DET-000 | DET-001 |
| orden_mecanicos | (PK compuesta) | â€” |
| orden_servicios | OSR-000 | OSR-001 |
| orden_repuestos | ORE-000 | ORE-001 |
| comisiones_config | CCF-000 | CCF-001 |
| comisiones | COM-000 | COM-001 |
| proformas | PRF-000 | PRF-001 |
| facturas | FAC-000 | FAC-001 |
| pagos | PAG-000 | PAG-001 |
| reportes_generados | RPT-000 | RPT-001 |

### Enums relevantes

```csharp
// Usar como string en la BD (HasConversion<string>())
public enum EstadoUsuario   { Activo, Inactivo }
public enum EstadoOrden     { Abierta, EnProceso, Finalizada, Cerrada, Cancelada }
public enum EstadoProforma  { Pendiente, Aprobada, Rechazada }
public enum EstadoFactura   { Emitida, Anulada }
public enum EstadoPago      { Pendiente, Pagado }
public enum EstadoDiag      { Registrado, Revisado, Anulado }
public enum MetodoPago      { Efectivo, Transferencia, Tarjeta, QR, Otro }
public enum FormatoReporte  { Pdf, Excel, Csv }

// Estado de cada servicio dentro de una orden (tabla orden_servicios)
public enum EstadoServicioOrden { Pendiente, EnProceso, Completado }
```

> Los `CHECK` del DDL usan exactamente estos valores en PascalCase
> (`'Activo'`, `'EnProceso'`, `'QR'`, â€¦). No usar minÃºsculas ni snake_case
> al insertar: el constraint lo rechaza.

### Tablas con 22 entidades

Ver el script DDL completo en `taller_automotriz_bd.sql`.
Las tablas puente que resuelven relaciones N:M son:
- `rol_permisos` (roles â†” permisos)
- `orden_mecanicos` (ordenes_trabajo â†” usuarios)

---

## Backend â€” ASP.NET Core 8

### Arquitectura en capas

```
Presentation  â†’  Application  â†’  Domain  â†  Infrastructure
(Controllers)    (Services)      (Entities)   (EF Core / Repos)
```

### Convenciones de cÃ³digo C#

- Una entidad por tabla en `Domain/Entities/`
- Un DTO de Request y uno de Response por operaciÃ³n
- Los servicios implementan una interfaz (`IClienteService`, etc.)
- Los repositorios usan el patrÃ³n genÃ©rico `IRepository<T>`
- Usar `async/await` en todos los mÃ©todos de acceso a datos
- Retornar `IActionResult` con cÃ³digos HTTP correctos (200, 201, 400, 404, 409)
- Validar con **Data Annotations** en los DTOs

### Ejemplo de entidad (Domain)

```csharp
public class Cliente
{
    public string ClienteId { get; set; } = string.Empty;   // CLI-001
    public string Nombre { get; set; } = string.Empty;
    public string? Apellido { get; set; }
    public string? RazonSocial { get; set; }
    public string CiNit { get; set; } = string.Empty;       // UNIQUE
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public string? Direccion { get; set; }
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    public string Estado { get; set; } = "Activo";

    // NavegaciÃ³n
    public ICollection<Vehiculo> Vehiculos { get; set; } = [];
    public ICollection<OrdenTrabajo> OrdenesTrabajo { get; set; } = [];
}
```

### Ejemplo de controller (Presentation)

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ClientesController : ControllerBase
{
    private readonly IClienteService _service;
    public ClientesController(IClienteService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? buscar)
        => Ok(await _service.GetAllAsync(buscar));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ClienteRequestDto dto)
    {
        var result = await _service.CreateAsync(dto);
        return result.Success ? CreatedAtAction(nameof(GetAll), result.Data)
                              : Conflict(result.Message);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] ClienteRequestDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return result.Success ? Ok(result.Data) : NotFound(result.Message);
    }
}
```

### AutenticaciÃ³n JWT

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt => {
        opt.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            ValidateIssuer = false,
            ValidateAudience = false
        };
    });
```

```json
// appsettings.json
"Jwt": {
  "Key": "clave-secreta-minimo-256-bits-servicar-sossa-2026"
}
```

### Roles y autorizaciÃ³n

```csharp
// Decorar endpoints segÃºn el rol (solo 2 roles en el sistema)
[Authorize(Roles = "Administrador")]
[Authorize(Roles = "Administrador,Mecanico")]
```

### Reglas de negocio crÃ­ticas (implementar en Application/Services)

1. **Al cerrar una orden** (`EstadoOrden.Cerrada`):
   - Calcular comisiÃ³n por cada mecÃ¡nico: `monto = sumaServiciosMecanico * porcentaje / 100`
   - Descontar `stock_actual` en cada repuesto de `orden_repuestos`
   - Registrar `fecha_cierre` en la orden

2. **Al registrar una compra**:
   - Incrementar `stock_actual` de cada repuesto en `compra_detalle`

3. **Al usar un repuesto en una orden**:
   - Verificar que `stock_actual >= cantidad` antes de permitir el registro

4. **Al aprobar/rechazar una proforma**:
   - Actualizar `estado` y `fecha_respuesta_cliente` en la tabla proformas

---

## Frontend â€” Angular 17+

### Convenciones

- Usar **standalone components** (sin NgModules)
- Servicios con `HttpClient` para consumir la API
- Guards por rol para proteger rutas
- Interceptor HTTP para adjuntar el token JWT en cada request
- Un mÃ³dulo de rutas por feature (`clientes.routes.ts`, etc.)

### Estructura de un mÃ³dulo (ejemplo: clientes)

```
modules/clientes/
â”œâ”€â”€ clientes.routes.ts
â”œâ”€â”€ clientes-list/
â”‚   â”œâ”€â”€ clientes-list.component.ts
â”‚   â””â”€â”€ clientes-list.component.html
â”œâ”€â”€ cliente-form/
â”‚   â”œâ”€â”€ cliente-form.component.ts
â”‚   â””â”€â”€ cliente-form.component.html
â””â”€â”€ clientes.service.ts
```

### JWT Interceptor

```typescript
// core/interceptors/auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
```

### AuthGuard por rol

```typescript
// core/guards/auth.guard.ts
export const authGuard = (roles: string[]): CanActivateFn => () => {
  const userRol = localStorage.getItem('rol');
  return roles.includes(userRol ?? '') ? true : inject(Router).createUrlTree(['/login']);
};
```

### Rutas con guard

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./modules/auth/login.component') },
  { path: 'dashboard', canActivate: [authGuard(['Administrador','Mecanico'])],
    loadComponent: () => import('./modules/dashboard/dashboard.component') },
  { path: 'clientes', canActivate: [authGuard(['Administrador'])],
    loadChildren: () => import('./modules/clientes/clientes.routes') },
  { path: '**', redirectTo: 'login' }
];
```

### Variables de entorno

```typescript
// environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api'
};
```

---

## MÃ³dulos del sistema y endpoints esperados

| MÃ³dulo | Prefijo API | Historias |
|---|---|---|
| AutenticaciÃ³n | `/api/auth` | USU001â€“USU005 |
| Usuarios | `/api/usuarios` | USU001â€“USU005 |
| Clientes | `/api/clientes` | USU006â€“USU008 |
| VehÃ­culos | `/api/vehiculos` | USU009â€“USU011 |
| DiagnÃ³sticos | `/api/diagnosticos` | USU012â€“USU016 |
| Tipos de servicio | `/api/tipos-servicio` | USU013 |
| Ã“rdenes de trabajo | `/api/ordenes` | USU021â€“USU025 |
| Inventario | `/api/repuestos` | USU026â€“USU030 |
| Proveedores | `/api/proveedores` | USU028 |
| Compras | `/api/compras` | USU029 |
| Comisiones | `/api/comisiones` | USU031â€“USU034 |
| Proformas | `/api/proformas` | USU035â€“USU036, USU039â€“USU041 |
| Facturas | `/api/facturas` | USU038 |
| Pagos | `/api/pagos` | USU037 |
| Reportes | `/api/reportes` | USU017â€“USU020 |

---

## Comandos Ãºtiles

### Backend

```bash
# Restaurar paquetes
dotnet restore

# Crear migraciÃ³n
dotnet ef migrations add NombreMigracion --project ServicarSossa.Infrastructure --startup-project ServicarSossa.API

# Aplicar migraciÃ³n
dotnet ef database update --project ServicarSossa.Infrastructure --startup-project ServicarSossa.API

# Ejecutar API (modo desarrollo)
dotnet run --project ServicarSossa.API
# API disponible en: http://localhost:5000
# Swagger en:       http://localhost:5000/swagger
```

### Frontend

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
ng serve
# Disponible en: http://localhost:4200

# Build de producciÃ³n
ng build --configuration production
```

### Base de datos

```bash
# Conectarse a PostgreSQL
psql -U postgres -d servicar_sossa

# Crear la base de datos (primera vez)
psql -U postgres -c "CREATE DATABASE servicar_sossa;"

# Ejecutar el script DDL
psql -U postgres -d servicar_sossa -f taller_automotriz_bd.sql
```

---

## Paquetes NuGet requeridos (backend)

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.*" />
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.*" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.*" />
<PackageReference Include="Swashbuckle.AspNetCore" Version="6.*" />
<PackageReference Include="BCrypt.Net-Next" Version="4.*" />
```

## Paquetes npm requeridos (frontend)

```bash
npm install @angular/common@latest
npm install jwt-decode
npm install chart.js ng2-charts        # para grÃ¡ficos en reportes
```

---

## Notas para Claude Code

- Siempre usar `async/await` en C#; nunca `.Result` ni `.Wait()`
- Hacer commit por historia de usuario completada: `git commit -m "feat(USU006): registrar cliente"`
- El campo `estado` siempre se almacena como string en la BD (no como integer enum)
- Las fechas se almacenan en UTC en PostgreSQL; convertir a hora local en el frontend
- Nunca hardcodear credenciales; usar `appsettings.json` + variables de entorno
- Para reportes en PDF usar la librerÃ­a **QuestPDF** (C#)
- Para exportar Excel usar **ClosedXML** (C#)
- Al generar un ID alfanumÃ©rico, verificar que no exista antes de insertarlo
- El orden de desarrollo sugerido sigue los sprints del backlog:
  Sprint 1 â†’ Auth + Usuarios
  Sprint 2 â†’ Clientes + VehÃ­culos
  Sprint 3 â†’ DiagnÃ³sticos + CatÃ¡logo servicios
  Sprint 4 â†’ Ã“rdenes de trabajo
  Sprint 5 â†’ Inventario + Compras
  Sprint 6 â†’ Comisiones
  Sprint 7 â†’ FacturaciÃ³n + Proformas + Pagos
  Sprint 8 â†’ Reportes + Pruebas + Ajustes finales
