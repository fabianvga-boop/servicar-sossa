using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Application.Interfaces;

/// <summary>Emite el JWT. La clave y la vigencia vienen de appsettings (nunca hardcodeadas).</summary>
public interface IJwtTokenGenerator
{
    /// <param name="usuario">Debe traer <see cref="Usuario.Rol"/> cargado.</param>
    (string Token, DateTime ExpiraEn) Generar(Usuario usuario);
}
