using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ServicarSossa.Application.Common;
using ServicarSossa.Application.Interfaces;
using ServicarSossa.Application.Services;
using ServicarSossa.Domain.Enums;
using ServicarSossa.Infrastructure.Archivos;
using ServicarSossa.Infrastructure.Comprobantes;
using ServicarSossa.Infrastructure.Data;
using ServicarSossa.Infrastructure.Facturacion;
using ServicarSossa.Infrastructure.Reportes;
using ServicarSossa.Infrastructure.Repositories;
using ServicarSossa.Infrastructure.Services;

namespace ServicarSossa.Infrastructure;

/// <summary>
/// Punto único de registro de EF Core, repositorios y servicios de negocio.
/// Mantiene Program.cs libre de detalles de infraestructura.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        var conexion = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "Falta la cadena de conexión 'DefaultConnection' en appsettings.json.");

        services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(conexion));

        // QuestPDF exige declarar la licencia antes de generar el primer documento.
        // Community es gratuita para proyectos con ingresos anuales menores a 1M USD.
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

        // --- Repositorios -----------------------------------------------------
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUsuarioRepository, UsuarioRepository>();
        services.AddScoped<IClienteRepository, ClienteRepository>();
        services.AddScoped<IVehiculoRepository, VehiculoRepository>();
        services.AddScoped<ITipoServicioRepository, TipoServicioRepository>();
        services.AddScoped<IDiagnosticoRepository, DiagnosticoRepository>();
        services.AddScoped<IOrdenRepository, OrdenRepository>();
        services.AddScoped<IProveedorRepository, ProveedorRepository>();
        services.AddScoped<IRepuestoRepository, RepuestoRepository>();
        services.AddScoped<ICompraRepository, CompraRepository>();
        services.AddScoped<IComisionRepository, ComisionRepository>();
        services.AddScoped<IComisionConfigRepository, ComisionConfigRepository>();
        services.AddScoped<IProformaRepository, ProformaRepository>();
        services.AddScoped<IFacturaRepository, FacturaRepository>();
        services.AddScoped<IVentaRepository, VentaRepository>();
        services.AddScoped<IPagoRepository, PagoRepository>();
        services.AddScoped<IReporteRepository, ReporteRepository>();
        services.AddScoped<IAuditoriaRepository, AuditoriaRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Identidad del taller para los comprobantes (sección "Taller").
        services.Configure<TallerOptions>(config.GetSection(TallerOptions.Seccion));

        // --- Emisión de comprobantes (Strategy) -------------------------------
        // Una línea de appsettings decide si cada cobro termina en un recibo
        // interno o en una factura electrónica del SIAT. La lógica de ventas no
        // se entera: solo conoce IEmisorComprobante.
        services.Configure<FacturacionOptions>(config.GetSection(FacturacionOptions.Seccion));
        RegistrarEmisorComprobantes(services, config);

        // --- Servicios de infraestructura -------------------------------------
        services.AddScoped<IGeneradorId, GeneradorId>();
        services.AddScoped<IAuditor, Auditor>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IExportadorReportes, ExportadorReportes>();
        services.AddScoped<IGeneradorComprobantes, GeneradorComprobantes>();
        services.AddScoped<IAlmacenArchivos, AlmacenArchivosDisco>();

        // --- Servicios de negocio ---------------------------------------------
        services.AddScoped<IAuthService, AuthService>();                 // Sprint 1
        services.AddScoped<IUsuarioService, UsuarioService>();           // Sprint 1
        services.AddScoped<IClienteService, ClienteService>();           // Sprint 2
        services.AddScoped<IVehiculoService, VehiculoService>();         // Sprint 2
        services.AddScoped<IPlantillaVehiculoService, PlantillaVehiculoService>(); // Diagrama del vehículo
        services.AddScoped<ITipoServicioService, TipoServicioService>(); // Sprint 3
        services.AddScoped<IDiagnosticoService, DiagnosticoService>();   // Sprint 3
        services.AddScoped<IOrdenService, OrdenService>();               // Sprint 4
        services.AddScoped<IProveedorService, ProveedorService>();       // Sprint 5
        services.AddScoped<IRepuestoService, RepuestoService>();         // Sprint 5
        services.AddScoped<ICompraService, CompraService>();             // Sprint 5
        services.AddScoped<IComisionService, ComisionService>();         // Sprint 6
        services.AddScoped<IProformaService, ProformaService>();         // Sprint 7 — cobro del taller
        services.AddScoped<IFacturaService, FacturaService>();           // Facturación electrónica SIAT
        services.AddScoped<IVentaService, VentaService>();               // Punto de venta
        services.AddScoped<IPagoService, PagoService>();                 // Sprint 7
        services.AddScoped<IReporteService, ReporteService>();           // Sprint 8
        services.AddScoped<IAuditoriaService, AuditoriaService>();       // Bitácora de auditoría

        return services;
    }

    /// <summary>
    /// Elige el emisor según <c>Facturacion:Modo</c>.
    ///
    /// En modo SIAT_ONLINE se valida la configuración acá y no en la primera
    /// venta: si falta el NIT o la API key, es mejor que el sistema no arranque
    /// a que arranque y recién falle con un cliente esperando su factura.
    /// </summary>
    private static void RegistrarEmisorComprobantes(
        IServiceCollection services, IConfiguration config)
    {
        var opciones = config.GetSection(FacturacionOptions.Seccion).Get<FacturacionOptions>()
            ?? new FacturacionOptions();

        if (opciones.ModoResuelto == ModoFacturacion.Interno)
        {
            services.AddScoped<IEmisorComprobante, EmisorInterno>();
            return;
        }

        var faltantes = new List<string>();
        if (string.IsNullOrWhiteSpace(opciones.Siat.Nit)) faltantes.Add("Facturacion:Siat:Nit");
        if (string.IsNullOrWhiteSpace(opciones.Siat.ApiKey)) faltantes.Add("Facturacion:Siat:ApiKey");
        if (string.IsNullOrWhiteSpace(opciones.Siat.CodigoSistema)) faltantes.Add("Facturacion:Siat:CodigoSistema");
        if (string.IsNullOrWhiteSpace(opciones.Siat.UrlBase)) faltantes.Add("Facturacion:Siat:UrlBase");

        if (faltantes.Count > 0)
            throw new InvalidOperationException(
                "Facturacion:Modo está en 'SIAT_ONLINE' pero falta configurar: " +
                string.Join(", ", faltantes) + ". " +
                "Complete esos valores o vuelva a 'INTERNAL' para seguir emitiendo recibos internos.");

        // El esqueleto está, pero los pasos que hablan con el SIN todavía no.
        // Arrancar igual significaría vender sin emitir la factura que
        // corresponde: se corta acá, con el detalle de lo que falta.
        throw new InvalidOperationException(
            "Facturacion:Modo está en 'SIAT_ONLINE', pero la integración con el SIAT " +
            "aún no está implementada (ver EmisorSiatFacturacion: CUFD, CUF, XML, firma y envío). " +
            "Implemente esos pasos antes de activar el modo, o vuelva a 'INTERNAL'.");
    }
}
