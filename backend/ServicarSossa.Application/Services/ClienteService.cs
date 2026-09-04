using ServicarSossa.Application.Common;
using ServicarSossa.Application.DTOs.Clientes;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Domain.Entities;
using ServicarSossa.Domain.Enums;

namespace ServicarSossa.Application.Services;

/// <summary>USU006, USU007, USU008 — gestión de clientes.</summary>
public class ClienteService(
    IClienteRepository clientes,
    IGeneradorId generadorId,
    IAuditor auditor) : IClienteService
{
    public async Task<Result<IEnumerable<ClienteResponseDto>>> GetAllAsync(
        string? buscar, CancellationToken ct = default)
    {
        var lista = (await clientes.BuscarAsync(buscar, ct)).ToList();
        var placas = await clientes.ObtenerPlacasPorClienteAsync(
            lista.Select(c => c.ClienteId), ct);

        return Result<IEnumerable<ClienteResponseDto>>.Ok(
            lista.Select(c => Mapear(c, placas.GetValueOrDefault(c.ClienteId, []))));
    }

    public async Task<Result<ClienteResponseDto>> GetByIdAsync(
        string id, CancellationToken ct = default)
    {
        var cliente = await clientes.GetByIdAsync(id, ct);

        if (cliente is null)
            return Result<ClienteResponseDto>.NoEncontrado($"No existe el cliente {id}.");

        var placas = await clientes.ObtenerPlacasPorClienteAsync([id], ct);
        return Result<ClienteResponseDto>.Ok(Mapear(cliente, placas.GetValueOrDefault(id, [])));
    }

    public async Task<Result<ClienteResponseDto>> CreateAsync(
        ClienteRequestDto dto, string usuarioId, CancellationToken ct = default)
    {
        var ciNit = dto.CiNit.Trim();

        if (await clientes.ExistsAsync(c => c.CiNit == ciNit, ct))
            return Result<ClienteResponseDto>.Conflicto(
                $"Ya existe un cliente registrado con el CI/NIT '{ciNit}'.");

        var cliente = new Cliente
        {
            ClienteId = await generadorId.SiguienteAsync<Cliente>("CLI", ct),
            Nombre = dto.Nombre.Trim(),
            Apellido = string.IsNullOrWhiteSpace(dto.Apellido) ? null : dto.Apellido.Trim(),
            RazonSocial = string.IsNullOrWhiteSpace(dto.RazonSocial) ? null : dto.RazonSocial.Trim(),
            CiNit = ciNit,
            Telefono = string.IsNullOrWhiteSpace(dto.Telefono) ? null : dto.Telefono.Trim(),
            Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant(),
            Direccion = string.IsNullOrWhiteSpace(dto.Direccion) ? null : dto.Direccion.Trim(),
            Estado = EstadoCliente.Activo,
            FechaRegistro = DateTime.UtcNow
        };

        await clientes.AddAsync(cliente, ct);

        var nombreCompleto = $"{cliente.Nombre} {cliente.Apellido}".Trim();
        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Crear, "Cliente", cliente.ClienteId,
            $"Registró el cliente '{nombreCompleto}'.", ct);

        await clientes.SaveChangesAsync(ct);

        // Recién creado: todavía no tiene vehículos.
        return Result<ClienteResponseDto>.Ok(Mapear(cliente, []), "Cliente registrado correctamente.");
    }

    public async Task<Result<ClienteResponseDto>> UpdateAsync(
        string id, ClienteUpdateDto dto, string usuarioId, CancellationToken ct = default)
    {
        var cliente = await clientes.FirstOrDefaultAsync(c => c.ClienteId == id, ct);

        if (cliente is null)
            return Result<ClienteResponseDto>.NoEncontrado($"No existe el cliente {id}.");

        var ciNit = dto.CiNit.Trim();

        if (await clientes.ExistsAsync(c => c.CiNit == ciNit && c.ClienteId != id, ct))
            return Result<ClienteResponseDto>.Conflicto(
                $"Ya existe otro cliente registrado con el CI/NIT '{ciNit}'.");

        cliente.Nombre = dto.Nombre.Trim();
        cliente.Apellido = string.IsNullOrWhiteSpace(dto.Apellido) ? null : dto.Apellido.Trim();
        cliente.RazonSocial = string.IsNullOrWhiteSpace(dto.RazonSocial) ? null : dto.RazonSocial.Trim();
        cliente.CiNit = ciNit;
        cliente.Telefono = string.IsNullOrWhiteSpace(dto.Telefono) ? null : dto.Telefono.Trim();
        cliente.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant();
        cliente.Direccion = string.IsNullOrWhiteSpace(dto.Direccion) ? null : dto.Direccion.Trim();

        var nombreCompleto = $"{cliente.Nombre} {cliente.Apellido}".Trim();
        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.Editar, "Cliente", id,
            $"Editó el cliente '{nombreCompleto}'.", ct);

        await clientes.SaveChangesAsync(ct);

        var placas = await clientes.ObtenerPlacasPorClienteAsync([id], ct);
        return Result<ClienteResponseDto>.Ok(
            Mapear(cliente, placas.GetValueOrDefault(id, [])), "Cliente actualizado correctamente.");
    }

    public async Task<Result<ClienteResponseDto>> CambiarEstadoAsync(
        string id, CambiarEstadoClienteDto dto, string usuarioId, CancellationToken ct = default)
    {
        var cliente = await clientes.FirstOrDefaultAsync(c => c.ClienteId == id, ct);

        if (cliente is null)
            return Result<ClienteResponseDto>.NoEncontrado($"No existe el cliente {id}.");

        if (cliente.Estado == dto.Estado)
            return Result<ClienteResponseDto>.Fail($"El cliente ya está {dto.Estado}.");

        cliente.Estado = dto.Estado;

        var nombreCompleto = $"{cliente.Nombre} {cliente.Apellido}".Trim();
        await auditor.RegistrarAsync(
            usuarioId, AccionAuditoria.CambiarEstado, "Cliente", id,
            $"Marcó al cliente '{nombreCompleto}' como {dto.Estado}.", ct);

        await clientes.SaveChangesAsync(ct);

        var placas = await clientes.ObtenerPlacasPorClienteAsync([id], ct);
        return Result<ClienteResponseDto>.Ok(
            Mapear(cliente, placas.GetValueOrDefault(id, [])), $"Cliente marcado como {dto.Estado}.");
    }

    private static ClienteResponseDto Mapear(Cliente c, List<string> placas) => new()
    {
        ClienteId = c.ClienteId,
        Nombre = c.Nombre,
        Apellido = c.Apellido,
        RazonSocial = c.RazonSocial,
        CiNit = c.CiNit,
        Telefono = c.Telefono,
        Email = c.Email,
        Direccion = c.Direccion,
        FechaRegistro = c.FechaRegistro,
        Estado = c.Estado,
        CantidadVehiculos = placas.Count,
        Placas = placas
    };
}
