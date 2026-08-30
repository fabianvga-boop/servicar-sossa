using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Infrastructure.Data;

/// <summary>
/// Siembra los datos mínimos para poder usar el sistema: los dos roles y un
/// usuario administrador inicial. Sin esto no existe ninguna credencial con la
/// que iniciar sesión por primera vez.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider sp, CancellationToken ct = default)
    {
        using var scope = sp.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DbSeeder));

        // --- Roles (el sistema solo maneja Administrador y Mecanico) --------
        var rolesRequeridos = new[]
        {
            new Rol { RolId = "ROL-001", NombreRol = "Administrador",
                      Descripcion = "Control total del sistema" },
            new Rol { RolId = "ROL-002", NombreRol = "Mecanico",
                      Descripcion = "Gestiona diagnosticos y ordenes de trabajo asignadas" }
        };

        foreach (var rol in rolesRequeridos)
        {
            if (!await context.Roles.AnyAsync(r => r.RolId == rol.RolId, ct))
            {
                context.Roles.Add(rol);
                logger.LogInformation("Seed: rol {RolId} ({Nombre}) creado.",
                    rol.RolId, rol.NombreRol);
            }
        }
        await context.SaveChangesAsync(ct);

        // --- Administrador inicial ------------------------------------------
        if (await context.Usuarios.AnyAsync(ct))
            return;

        var username = config["SeedAdmin:Username"] ?? "admin";
        var password = config["SeedAdmin:Password"];

        if (string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "No hay usuarios y 'SeedAdmin:Password' no está configurada: " +
                "no se creó el administrador inicial. Defínela en appsettings.Development.json " +
                "o en la variable de entorno SeedAdmin__Password.");
            return;
        }

        context.Usuarios.Add(new Usuario
        {
            UsuarioId = "USU-001",
            Nombre = config["SeedAdmin:Nombre"] ?? "Administrador",
            Apellido = config["SeedAdmin:Apellido"] ?? "del Sistema",
            Email = config["SeedAdmin:Email"] ?? "admin@servicarsossa.bo",
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            RolId = "ROL-001",
            Estado = EstadoUsuario.Activo,
            FechaRegistro = DateTime.UtcNow
        });

        await context.SaveChangesAsync(ct);
        logger.LogInformation(
            "Seed: administrador inicial USU-001 creado con el usuario '{Username}'.", username);
    }
}
