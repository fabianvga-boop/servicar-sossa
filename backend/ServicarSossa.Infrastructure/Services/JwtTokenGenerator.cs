using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Infrastructure.Services;

/// <summary>
/// Emite el JWT firmado con HMAC-SHA256. El claim <see cref="ClaimTypes.Role"/>
/// contiene el nombre del rol ("Administrador" / "Mecanico"), que es lo que
/// evalúa <c>[Authorize(Roles = "...")]</c> en los controllers.
/// </summary>
public class JwtTokenGenerator(IConfiguration config) : IJwtTokenGenerator
{
    public (string Token, DateTime ExpiraEn) Generar(Usuario usuario)
    {
        var clave = config["Jwt:Key"]
            ?? throw new InvalidOperationException(
                "Falta la configuración 'Jwt:Key'. Definirla en appsettings.json " +
                "o en la variable de entorno Jwt__Key.");

        if (Encoding.UTF8.GetByteCount(clave) < 32)
            throw new InvalidOperationException(
                "'Jwt:Key' debe tener al menos 256 bits (32 caracteres) para HMAC-SHA256.");

        var minutos = config.GetValue<int?>("Jwt:MinutosVigencia") ?? 480;
        var expiraEn = DateTime.UtcNow.AddMinutes(minutos);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.UsuarioId),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, usuario.UsuarioId),
            new(ClaimTypes.Name, usuario.Username),
            new(ClaimTypes.Email, usuario.Email),
            new(ClaimTypes.Role, usuario.Rol.NombreRol)
        };

        var credenciales = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(clave)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiraEn,
            signingCredentials: credenciales);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiraEn);
    }
}
