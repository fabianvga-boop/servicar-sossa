using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ServicarSossa.Infrastructure;
using ServicarSossa.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

const string PoliticaCorsAngular = "AngularDev";

// ---------------------------------------------------------------- Servicios
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// EF Core, repositorios y servicios de negocio (ver Infrastructure/DependencyInjection.cs)
builder.Services.AddInfrastructure(builder.Configuration);

// --- Autenticación JWT ------------------------------------------------------
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "Falta 'Jwt:Key'. Definirla en appsettings.json o en la variable de entorno Jwt__Key.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            // Sin esto, un token vencido sigue siendo aceptado hasta 5 minutos más.
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// --- CORS para el frontend Angular -----------------------------------------
builder.Services.AddCors(opt => opt.AddPolicy(PoliticaCorsAngular, policy =>
    policy.WithOrigins(
              builder.Configuration.GetSection("Cors:OrigenesPermitidos").Get<string[]>()
              ?? ["http://localhost:4200"])
          .AllowAnyHeader()
          .AllowAnyMethod()));

// --- Swagger con soporte para el token Bearer ------------------------------
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Servicar SOSSA — API",
        Version = "v1",
        Description = "Sistema de información para el taller automotriz Servicar SOSSA (Tarija, Bolivia)."
    });

    opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Pegar solo el token devuelto por /api/auth/login (sin el prefijo 'Bearer')."
    });

    opt.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    var xml = Path.Combine(AppContext.BaseDirectory,
        $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml");
    if (File.Exists(xml)) opt.IncludeXmlComments(xml);
});

// ---------------------------------------------------------------- Pipeline
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(opt =>
    {
        opt.SwaggerEndpoint("/swagger/v1/swagger.json", "Servicar SOSSA API v1");
        opt.DocumentTitle = "Servicar SOSSA — API";
    });
}

// Crea los roles y el administrador inicial si la base está vacía. Corre en
// cualquier entorno (es idempotente): sin esto, un despliegue nuevo no tendría
// ninguna credencial con la que iniciar sesión por primera vez.
await DbSeeder.SeedAsync(app.Services);

// Archivos subidos por el usuario (fotos de vehículos, etc.), separados de
// "Recursos" (que sí se versiona). Sin autenticación: igual que el logo del
// taller, no son datos sensibles y así se sirven directo como <img src>.
var carpetaUploads = Path.Combine(AppContext.BaseDirectory, "Uploads");
Directory.CreateDirectory(carpetaUploads);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(carpetaUploads),
    RequestPath = "/uploads"
});

app.UseCors(PoliticaCorsAngular);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
