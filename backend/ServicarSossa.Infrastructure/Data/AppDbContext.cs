using Microsoft.EntityFrameworkCore;
using ServicarSossa.Domain.Entities;

namespace ServicarSossa.Infrastructure.Data;

/// <summary>
/// Contexto EF Core mapeado al esquema existente de <c>servicar_sossa</c>
/// (creado por taller_automotriz_bd.sql). Convenciones aplicadas:
///   * Tablas y columnas en snake_case.
///   * PKs y FKs VARCHAR(20) generadas en la capa de aplicación (nunca por la BD).
///   * Enums persistidos como string en PascalCase (HasConversion&lt;string&gt;()),
///     coincidiendo con los CHECK constraints del DDL.
///   * Los subtotales de compra_detalle y orden_repuestos son columnas calculadas
///     en PostgreSQL: EF las lee pero nunca las escribe.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Rol> Roles => Set<Rol>();
    public DbSet<Permiso> Permisos => Set<Permiso>();
    public DbSet<RolPermiso> RolPermisos => Set<RolPermiso>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Vehiculo> Vehiculos => Set<Vehiculo>();
    public DbSet<VehiculoFoto> VehiculoFotos => Set<VehiculoFoto>();
    public DbSet<TipoServicio> TiposServicio => Set<TipoServicio>();
    public DbSet<Diagnostico> Diagnosticos => Set<Diagnostico>();
    public DbSet<OrdenTrabajo> OrdenesTrabajo => Set<OrdenTrabajo>();
    public DbSet<OrdenMecanico> OrdenMecanicos => Set<OrdenMecanico>();
    public DbSet<OrdenServicio> OrdenServicios => Set<OrdenServicio>();
    public DbSet<Proveedor> Proveedores => Set<Proveedor>();
    public DbSet<Repuesto> Repuestos => Set<Repuesto>();
    public DbSet<Compra> Compras => Set<Compra>();
    public DbSet<CompraDetalle> CompraDetalles => Set<CompraDetalle>();
    public DbSet<OrdenRepuesto> OrdenRepuestos => Set<OrdenRepuesto>();
    public DbSet<ComisionConfig> ComisionesConfig => Set<ComisionConfig>();
    public DbSet<Comision> Comisiones => Set<Comision>();
    public DbSet<Factura> Facturas => Set<Factura>();
    public DbSet<Venta> Ventas => Set<Venta>();
    public DbSet<VentaDetalle> VentaDetalles => Set<VentaDetalle>();
    public DbSet<Pago> Pagos => Set<Pago>();
    public DbSet<ReporteGenerado> ReportesGenerados => Set<ReporteGenerado>();
    public DbSet<Auditoria> Auditorias => Set<Auditoria>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        ConfigurarUsuarios(b);
        ConfigurarClientesVehiculos(b);
        ConfigurarServiciosDiagnosticos(b);
        ConfigurarOrdenes(b);
        ConfigurarInventario(b);
        ConfigurarComisiones(b);
        ConfigurarFacturacion(b);
        ConfigurarReportes(b);

        // Ninguna PK string se genera en la BD: siempre las asigna GeneradorIdService.
        foreach (var entidad in b.Model.GetEntityTypes())
            foreach (var prop in entidad.GetProperties())
                if (prop.IsPrimaryKey() && prop.ClrType == typeof(string))
                    prop.ValueGenerated = Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never;
    }

    // ------------------------------------------------------------------ ÉPICA 1
    private static void ConfigurarUsuarios(ModelBuilder b)
    {
        b.Entity<Rol>(e =>
        {
            e.ToTable("roles");
            e.HasKey(x => x.RolId);
            e.Property(x => x.RolId).HasColumnName("rol_id").HasMaxLength(20);
            e.Property(x => x.NombreRol).HasColumnName("nombre_rol").HasMaxLength(50).IsRequired();
            e.Property(x => x.Descripcion).HasColumnName("descripcion").HasMaxLength(200);
            e.HasIndex(x => x.NombreRol).IsUnique();
        });

        b.Entity<Permiso>(e =>
        {
            e.ToTable("permisos");
            e.HasKey(x => x.PermisoId);
            e.Property(x => x.PermisoId).HasColumnName("permiso_id").HasMaxLength(20);
            e.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(80).IsRequired();
            e.Property(x => x.Descripcion).HasColumnName("descripcion").HasMaxLength(200);
            e.HasIndex(x => x.Nombre).IsUnique();
        });

        b.Entity<RolPermiso>(e =>
        {
            e.ToTable("rol_permisos");
            e.HasKey(x => new { x.RolId, x.PermisoId });
            e.Property(x => x.RolId).HasColumnName("rol_id").HasMaxLength(20);
            e.Property(x => x.PermisoId).HasColumnName("permiso_id").HasMaxLength(20);
            e.HasOne(x => x.Rol).WithMany(r => r.RolPermisos)
                .HasForeignKey(x => x.RolId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Permiso).WithMany(p => p.RolPermisos)
                .HasForeignKey(x => x.PermisoId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Usuario>(e =>
        {
            e.ToTable("usuarios");
            e.HasKey(x => x.UsuarioId);
            e.Property(x => x.UsuarioId).HasColumnName("usuario_id").HasMaxLength(20);
            e.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            e.Property(x => x.Apellido).HasColumnName("apellido").HasMaxLength(100).IsRequired();
            e.Property(x => x.Email).HasColumnName("email").HasMaxLength(150).IsRequired();
            e.Property(x => x.Username).HasColumnName("username").HasMaxLength(50).IsRequired();
            e.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(255).IsRequired();
            e.Property(x => x.RolId).HasColumnName("rol_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Telefono).HasColumnName("telefono").HasMaxLength(20);
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.FechaRegistro).HasColumnName("fecha_registro").IsRequired();
            e.Property(x => x.NombreArchivoFoto)
                .HasColumnName("nombre_archivo_foto").HasMaxLength(255);
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.Username).IsUnique();
            e.HasOne(x => x.Rol).WithMany(r => r.Usuarios)
                .HasForeignKey(x => x.RolId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // ------------------------------------------------------------------ ÉPICA 2
    private static void ConfigurarClientesVehiculos(ModelBuilder b)
    {
        b.Entity<Cliente>(e =>
        {
            e.ToTable("clientes");
            e.HasKey(x => x.ClienteId);
            e.Property(x => x.ClienteId).HasColumnName("cliente_id").HasMaxLength(20);
            e.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            e.Property(x => x.Apellido).HasColumnName("apellido").HasMaxLength(100);
            e.Property(x => x.RazonSocial).HasColumnName("razon_social").HasMaxLength(150);
            e.Property(x => x.CiNit).HasColumnName("ci_nit").HasMaxLength(30).IsRequired();
            e.Property(x => x.Telefono).HasColumnName("telefono").HasMaxLength(20);
            e.Property(x => x.Email).HasColumnName("email").HasMaxLength(150);
            e.Property(x => x.Direccion).HasColumnName("direccion").HasMaxLength(200);
            e.Property(x => x.FechaRegistro).HasColumnName("fecha_registro").IsRequired();
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.HasIndex(x => x.CiNit).IsUnique();
        });

        b.Entity<Vehiculo>(e =>
        {
            e.ToTable("vehiculos");
            e.HasKey(x => x.VehiculoId);
            e.Property(x => x.VehiculoId).HasColumnName("vehiculo_id").HasMaxLength(20);
            e.Property(x => x.ClienteId).HasColumnName("cliente_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Placa).HasColumnName("placa").HasMaxLength(15).IsRequired();
            e.Property(x => x.Marca).HasColumnName("marca").HasMaxLength(50).IsRequired();
            e.Property(x => x.Modelo).HasColumnName("modelo").HasMaxLength(50).IsRequired();
            e.Property(x => x.Anio).HasColumnName("anio");
            e.Property(x => x.Color).HasColumnName("color").HasMaxLength(30);
            e.Property(x => x.NumMotor).HasColumnName("num_motor").HasMaxLength(50);
            e.Property(x => x.NumChasis).HasColumnName("num_chasis").HasMaxLength(50);
            e.Property(x => x.Kilometraje).HasColumnName("kilometraje");
            e.Property(x => x.FechaRegistro).HasColumnName("fecha_registro").IsRequired();
            e.HasIndex(x => x.Placa).IsUnique();
            e.HasIndex(x => x.ClienteId).HasDatabaseName("idx_vehiculos_cliente");
            e.HasOne(x => x.Cliente).WithMany(c => c.Vehiculos)
                .HasForeignKey(x => x.ClienteId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<VehiculoFoto>(e =>
        {
            e.ToTable("vehiculo_fotos");
            e.HasKey(x => x.FotoId);
            e.Property(x => x.FotoId).HasColumnName("foto_id").HasMaxLength(20);
            e.Property(x => x.VehiculoId).HasColumnName("vehiculo_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.NombreArchivo).HasColumnName("nombre_archivo").HasMaxLength(255).IsRequired();
            e.Property(x => x.FechaSubida).HasColumnName("fecha_subida").IsRequired();
            e.HasIndex(x => x.VehiculoId).HasDatabaseName("idx_vehiculo_fotos_vehiculo");
            e.HasOne(x => x.Vehiculo).WithMany(v => v.Fotos)
                .HasForeignKey(x => x.VehiculoId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    // ------------------------------------------------------------------ ÉPICA 3
    private static void ConfigurarServiciosDiagnosticos(ModelBuilder b)
    {
        b.Entity<TipoServicio>(e =>
        {
            e.ToTable("tipos_servicio");
            e.HasKey(x => x.ServicioId);
            e.Property(x => x.ServicioId).HasColumnName("servicio_id").HasMaxLength(20);
            e.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            e.Property(x => x.Descripcion).HasColumnName("descripcion").HasMaxLength(255);
            e.Property(x => x.PrecioBase).HasColumnName("precio_base").HasPrecision(10, 2);
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
        });

        b.Entity<Diagnostico>(e =>
        {
            e.ToTable("diagnosticos");
            e.HasKey(x => x.DiagnosticoId);
            e.Property(x => x.DiagnosticoId).HasColumnName("diagnostico_id").HasMaxLength(20);
            e.Property(x => x.VehiculoId).HasColumnName("vehiculo_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.MecanicoId).HasColumnName("mecanico_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Fecha).HasColumnName("fecha").IsRequired();
            e.Property(x => x.DescripcionFalla).HasColumnName("descripcion_falla").IsRequired();
            e.Property(x => x.ObservacionesTecnicas).HasColumnName("observaciones_tecnicas");
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.FechaModificacion).HasColumnName("fecha_modificacion");
            e.Property(x => x.MontoEstimado).HasColumnName("monto_estimado").HasPrecision(12, 2);
            e.Property(x => x.RespuestaCliente).HasColumnName("respuesta_cliente").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.FechaRespuestaCliente).HasColumnName("fecha_respuesta_cliente");
            e.Property(x => x.ComentarioCliente).HasColumnName("comentario_cliente").HasMaxLength(255);
            e.HasIndex(x => x.VehiculoId).HasDatabaseName("idx_diagnosticos_vehiculo");
            e.HasOne(x => x.Vehiculo).WithMany(v => v.Diagnosticos)
                .HasForeignKey(x => x.VehiculoId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Mecanico).WithMany(u => u.Diagnosticos)
                .HasForeignKey(x => x.MecanicoId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // ------------------------------------------------------------------ ÉPICA 5
    private static void ConfigurarOrdenes(ModelBuilder b)
    {
        b.Entity<OrdenTrabajo>(e =>
        {
            e.ToTable("ordenes_trabajo");
            e.HasKey(x => x.OrdenId);
            e.Property(x => x.OrdenId).HasColumnName("orden_id").HasMaxLength(20);
            e.Property(x => x.VehiculoId).HasColumnName("vehiculo_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.ClienteId).HasColumnName("cliente_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.AdministradorId).HasColumnName("administrador_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.DiagnosticoId).HasColumnName("diagnostico_id").HasMaxLength(20);
            e.Property(x => x.FechaCreacion).HasColumnName("fecha_creacion").IsRequired();
            e.Property(x => x.FechaEstimada).HasColumnName("fecha_estimada");
            e.Property(x => x.FechaCierre).HasColumnName("fecha_cierre");
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(30)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.Observaciones).HasColumnName("observaciones");
            e.HasIndex(x => x.VehiculoId).HasDatabaseName("idx_ordenes_vehiculo");
            e.HasIndex(x => x.ClienteId).HasDatabaseName("idx_ordenes_cliente");
            e.HasIndex(x => x.Estado).HasDatabaseName("idx_ordenes_estado");
            // Único: un diagnóstico genera como máximo una orden.
            e.HasIndex(x => x.DiagnosticoId).IsUnique().HasDatabaseName("idx_ordenes_diagnostico");
            e.HasOne(x => x.Vehiculo).WithMany(v => v.OrdenesTrabajo)
                .HasForeignKey(x => x.VehiculoId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Cliente).WithMany(c => c.OrdenesTrabajo)
                .HasForeignKey(x => x.ClienteId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Administrador).WithMany(u => u.OrdenesAdministradas)
                .HasForeignKey(x => x.AdministradorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Diagnostico).WithOne(d => d.Orden)
                .HasForeignKey<OrdenTrabajo>(x => x.DiagnosticoId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<OrdenMecanico>(e =>
        {
            e.ToTable("orden_mecanicos");
            e.HasKey(x => new { x.OrdenId, x.MecanicoId });
            e.Property(x => x.OrdenId).HasColumnName("orden_id").HasMaxLength(20);
            e.Property(x => x.MecanicoId).HasColumnName("mecanico_id").HasMaxLength(20);
            e.Property(x => x.FechaAsignacion).HasColumnName("fecha_asignacion").IsRequired();
            e.HasOne(x => x.Orden).WithMany(o => o.Mecanicos)
                .HasForeignKey(x => x.OrdenId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Mecanico).WithMany(u => u.OrdenesAsignadas)
                .HasForeignKey(x => x.MecanicoId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<OrdenServicio>(e =>
        {
            e.ToTable("orden_servicios");
            e.HasKey(x => x.OrdenServicioId);
            e.Property(x => x.OrdenServicioId).HasColumnName("orden_servicio_id").HasMaxLength(20);
            e.Property(x => x.OrdenId).HasColumnName("orden_id").HasMaxLength(20).IsRequired();
            // servicio_id es opcional: solo lo llevan los servicios del catálogo.
            e.Property(x => x.ServicioId).HasColumnName("servicio_id").HasMaxLength(20);
            e.Property(x => x.NombreLibre).HasColumnName("nombre_libre").HasMaxLength(150);
            e.Property(x => x.DiagnosticoId).HasColumnName("diagnostico_id").HasMaxLength(20);
            e.Property(x => x.MecanicoId).HasColumnName("mecanico_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Descripcion).HasColumnName("descripcion").HasMaxLength(255);
            e.Property(x => x.Precio).HasColumnName("precio").HasPrecision(10, 2);
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.HasIndex(x => x.OrdenId).HasDatabaseName("idx_orden_servicios_orden");
            e.HasIndex(x => x.MecanicoId).HasDatabaseName("idx_orden_servicios_mecanico");
            e.HasOne(x => x.Orden).WithMany(o => o.Servicios)
                .HasForeignKey(x => x.OrdenId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Servicio).WithMany(s => s.OrdenServicios)
                .HasForeignKey(x => x.ServicioId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Diagnostico).WithMany(d => d.OrdenServicios)
                .HasForeignKey(x => x.DiagnosticoId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Mecanico).WithMany(u => u.ServiciosEjecutados)
                .HasForeignKey(x => x.MecanicoId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // ------------------------------------------------------------------ ÉPICA 6
    private static void ConfigurarInventario(ModelBuilder b)
    {
        b.Entity<Proveedor>(e =>
        {
            e.ToTable("proveedores");
            e.HasKey(x => x.ProveedorId);
            e.Property(x => x.ProveedorId).HasColumnName("proveedor_id").HasMaxLength(20);
            e.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(150).IsRequired();
            e.Property(x => x.Contacto).HasColumnName("contacto").HasMaxLength(100);
            e.Property(x => x.Telefono).HasColumnName("telefono").HasMaxLength(20);
            e.Property(x => x.Email).HasColumnName("email").HasMaxLength(150);
            e.Property(x => x.Direccion).HasColumnName("direccion").HasMaxLength(200);
        });

        b.Entity<Repuesto>(e =>
        {
            e.ToTable("repuestos");
            e.HasKey(x => x.RepuestoId);
            e.Property(x => x.RepuestoId).HasColumnName("repuesto_id").HasMaxLength(20);
            e.Property(x => x.Nombre).HasColumnName("nombre").HasMaxLength(150).IsRequired();
            e.Property(x => x.Descripcion).HasColumnName("descripcion").HasMaxLength(255);
            e.Property(x => x.StockActual).HasColumnName("stock_actual").IsRequired();
            e.Property(x => x.StockMinimo).HasColumnName("stock_minimo").IsRequired();
            e.Property(x => x.PrecioCompra).HasColumnName("precio_compra").HasPrecision(10, 2);
            e.Property(x => x.PrecioVenta).HasColumnName("precio_venta").HasPrecision(10, 2);
            e.Property(x => x.ProveedorId).HasColumnName("proveedor_id").HasMaxLength(20);
            e.Property(x => x.NombreArchivoFoto).HasColumnName("nombre_archivo_foto").HasMaxLength(255);
            e.HasOne(x => x.Proveedor).WithMany(p => p.Repuestos)
                .HasForeignKey(x => x.ProveedorId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Compra>(e =>
        {
            e.ToTable("compras");
            e.HasKey(x => x.CompraId);
            e.Property(x => x.CompraId).HasColumnName("compra_id").HasMaxLength(20);
            e.Property(x => x.ProveedorId).HasColumnName("proveedor_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.UsuarioId).HasColumnName("usuario_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Fecha).HasColumnName("fecha").IsRequired();
            e.Property(x => x.Total).HasColumnName("total").HasPrecision(12, 2);
            e.HasOne(x => x.Proveedor).WithMany(p => p.Compras)
                .HasForeignKey(x => x.ProveedorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Usuario).WithMany(u => u.Compras)
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<CompraDetalle>(e =>
        {
            e.ToTable("compra_detalle");
            e.HasKey(x => x.DetalleId);
            e.Property(x => x.DetalleId).HasColumnName("detalle_id").HasMaxLength(20);
            e.Property(x => x.CompraId).HasColumnName("compra_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.RepuestoId).HasColumnName("repuesto_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Cantidad).HasColumnName("cantidad").IsRequired();
            e.Property(x => x.PrecioUnitario).HasColumnName("precio_unitario").HasPrecision(10, 2);
            e.Property(x => x.Subtotal).HasColumnName("subtotal").HasPrecision(12, 2)
                .HasComputedColumnSql("cantidad * precio_unitario", stored: true);
            e.HasIndex(x => x.CompraId).HasDatabaseName("idx_compra_detalle_compra");
            e.HasOne(x => x.Compra).WithMany(c => c.Detalles)
                .HasForeignKey(x => x.CompraId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Repuesto).WithMany(r => r.CompraDetalles)
                .HasForeignKey(x => x.RepuestoId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<OrdenRepuesto>(e =>
        {
            e.ToTable("orden_repuestos");
            e.HasKey(x => x.OrdenRepuestoId);
            e.Property(x => x.OrdenRepuestoId).HasColumnName("orden_repuesto_id").HasMaxLength(20);
            e.Property(x => x.OrdenId).HasColumnName("orden_id").HasMaxLength(20).IsRequired();
            // repuesto_id es opcional: solo lo llevan los repuestos de inventario.
            e.Property(x => x.RepuestoId).HasColumnName("repuesto_id").HasMaxLength(20);
            e.Property(x => x.Origen).HasColumnName("origen").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.Descripcion).HasColumnName("descripcion").HasMaxLength(150);
            e.Property(x => x.Cantidad).HasColumnName("cantidad").IsRequired();
            e.Property(x => x.PrecioUnitario).HasColumnName("precio_unitario").HasPrecision(10, 2);
            e.Property(x => x.Subtotal).HasColumnName("subtotal").HasPrecision(12, 2)
                .HasComputedColumnSql("cantidad * precio_unitario", stored: true);
            e.HasIndex(x => x.OrdenId).HasDatabaseName("idx_orden_repuestos_orden");
            e.HasOne(x => x.Orden).WithMany(o => o.Repuestos)
                .HasForeignKey(x => x.OrdenId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Repuesto).WithMany(r => r.OrdenRepuestos)
                .HasForeignKey(x => x.RepuestoId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // ------------------------------------------------------------------ ÉPICA 7
    private static void ConfigurarComisiones(ModelBuilder b)
    {
        b.Entity<ComisionConfig>(e =>
        {
            e.ToTable("comisiones_config");
            e.HasKey(x => x.ConfigId);
            e.Property(x => x.ConfigId).HasColumnName("config_id").HasMaxLength(20);
            e.Property(x => x.MecanicoId).HasColumnName("mecanico_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Porcentaje).HasColumnName("porcentaje").HasPrecision(5, 2);
            e.Property(x => x.FechaActualizacion).HasColumnName("fecha_actualizacion").IsRequired();
            e.HasIndex(x => x.MecanicoId).IsUnique();
            e.HasOne(x => x.Mecanico).WithOne(u => u.ComisionConfig)
                .HasForeignKey<ComisionConfig>(x => x.MecanicoId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Comision>(e =>
        {
            e.ToTable("comisiones");
            e.HasKey(x => x.ComisionId);
            e.Property(x => x.ComisionId).HasColumnName("comision_id").HasMaxLength(20);
            e.Property(x => x.OrdenId).HasColumnName("orden_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.MecanicoId).HasColumnName("mecanico_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Monto).HasColumnName("monto").HasPrecision(10, 2);
            e.Property(x => x.FechaCalculo).HasColumnName("fecha_calculo").IsRequired();
            e.Property(x => x.EstadoPago).HasColumnName("estado_pago").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.FechaPago).HasColumnName("fecha_pago");
            e.HasIndex(x => x.MecanicoId).HasDatabaseName("idx_comisiones_mecanico");
            e.HasIndex(x => new { x.OrdenId, x.MecanicoId })
                .IsUnique().HasDatabaseName("uq_comision_orden_mecanico");
            e.HasOne(x => x.Orden).WithMany(o => o.Comisiones)
                .HasForeignKey(x => x.OrdenId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Mecanico).WithMany(u => u.Comisiones)
                .HasForeignKey(x => x.MecanicoId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    // --------------------------------------------------------------- ÉPICAS 8/9
    private static void ConfigurarFacturacion(ModelBuilder b)
    {
        b.Entity<Factura>(e =>
        {
            e.ToTable("facturas");
            e.HasKey(x => x.FacturaId);
            e.Property(x => x.FacturaId).HasColumnName("factura_id").HasMaxLength(20);
            e.Property(x => x.OrdenId).HasColumnName("orden_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.FechaEmision).HasColumnName("fecha_emision").IsRequired();
            e.Property(x => x.NitRazonSocial).HasColumnName("nit_razon_social").HasMaxLength(150);
            e.Property(x => x.Total).HasColumnName("total").HasPrecision(12, 2);
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.HasIndex(x => x.OrdenId).HasDatabaseName("idx_facturas_orden");
            e.HasOne(x => x.Orden).WithMany(o => o.Facturas)
                .HasForeignKey(x => x.OrdenId).OnDelete(DeleteBehavior.Restrict);
        });

        // Punto de venta: venta de repuestos en mostrador, sin orden de trabajo.
        b.Entity<Venta>(e =>
        {
            e.ToTable("ventas");
            e.HasKey(x => x.VentaId);
            e.Property(x => x.VentaId).HasColumnName("venta_id").HasMaxLength(20);
            e.Property(x => x.ClienteId).HasColumnName("cliente_id").HasMaxLength(20);
            e.Property(x => x.UsuarioId).HasColumnName("usuario_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.FechaVenta).HasColumnName("fecha_venta").IsRequired();
            e.Property(x => x.MetodoPago).HasColumnName("metodo_pago").HasMaxLength(30)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.Total).HasColumnName("total").HasPrecision(12, 2);
            e.Property(x => x.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.Observaciones).HasColumnName("observaciones").HasMaxLength(255);
            e.HasIndex(x => x.FechaVenta).HasDatabaseName("idx_ventas_fecha");
            e.HasOne(x => x.Cliente).WithMany(c => c.Ventas)
                .HasForeignKey(x => x.ClienteId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
            // Sin colección inversa en Usuario: nadie consulta "las ventas de este usuario".
            e.HasOne(x => x.Usuario).WithMany()
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<VentaDetalle>(e =>
        {
            e.ToTable("venta_detalle");
            e.HasKey(x => x.VentaDetalleId);
            e.Property(x => x.VentaDetalleId).HasColumnName("venta_detalle_id").HasMaxLength(20);
            e.Property(x => x.VentaId).HasColumnName("venta_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.RepuestoId).HasColumnName("repuesto_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Cantidad).HasColumnName("cantidad").IsRequired();
            e.Property(x => x.PrecioUnitario).HasColumnName("precio_unitario").HasPrecision(10, 2);
            e.Property(x => x.Subtotal).HasColumnName("subtotal").HasPrecision(12, 2)
                .HasComputedColumnSql("cantidad * precio_unitario", stored: true);
            e.HasIndex(x => x.VentaId).HasDatabaseName("idx_venta_detalle_venta");
            e.HasOne(x => x.Venta).WithMany(v => v.Detalles)
                .HasForeignKey(x => x.VentaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Repuesto).WithMany(r => r.VentaDetalles)
                .HasForeignKey(x => x.RepuestoId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Pago>(e =>
        {
            e.ToTable("pagos");
            e.HasKey(x => x.PagoId);
            e.Property(x => x.PagoId).HasColumnName("pago_id").HasMaxLength(20);
            e.Property(x => x.FacturaId).HasColumnName("factura_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Monto).HasColumnName("monto").HasPrecision(12, 2);
            e.Property(x => x.FechaPago).HasColumnName("fecha_pago").IsRequired();
            e.Property(x => x.MetodoPago).HasColumnName("metodo_pago").HasMaxLength(30)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.Referencia).HasColumnName("referencia").HasMaxLength(100);
            e.HasIndex(x => x.FacturaId).HasDatabaseName("idx_pagos_factura");
            e.HasOne(x => x.Factura).WithMany(f => f.Pagos)
                .HasForeignKey(x => x.FacturaId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    // ------------------------------------------------------------------ ÉPICA 4
    private static void ConfigurarReportes(ModelBuilder b)
    {
        b.Entity<ReporteGenerado>(e =>
        {
            e.ToTable("reportes_generados");
            e.HasKey(x => x.ReporteId);
            e.Property(x => x.ReporteId).HasColumnName("reporte_id").HasMaxLength(20);
            e.Property(x => x.TipoReporte).HasColumnName("tipo_reporte").HasMaxLength(50).IsRequired();
            e.Property(x => x.FechaInicio).HasColumnName("fecha_inicio").IsRequired();
            e.Property(x => x.FechaFin).HasColumnName("fecha_fin").IsRequired();
            e.Property(x => x.UsuarioId).HasColumnName("usuario_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.FechaGeneracion).HasColumnName("fecha_generacion").IsRequired();
            e.Property(x => x.Formato).HasColumnName("formato").HasMaxLength(10)
                .HasConversion<string>().IsRequired();
            e.HasOne(x => x.Usuario).WithMany(u => u.ReportesGenerados)
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Auditoria>(e =>
        {
            e.ToTable("auditoria");
            e.HasKey(x => x.AuditoriaId);
            e.Property(x => x.AuditoriaId).HasColumnName("auditoria_id").HasMaxLength(20);
            e.Property(x => x.UsuarioId).HasColumnName("usuario_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Accion).HasColumnName("accion").HasMaxLength(20)
                .HasConversion<string>().IsRequired();
            e.Property(x => x.Entidad).HasColumnName("entidad").HasMaxLength(50).IsRequired();
            e.Property(x => x.EntidadId).HasColumnName("entidad_id").HasMaxLength(20).IsRequired();
            e.Property(x => x.Descripcion).HasColumnName("descripcion").HasMaxLength(300).IsRequired();
            e.Property(x => x.Fecha).HasColumnName("fecha").IsRequired();
            e.HasOne(x => x.Usuario).WithMany()
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.Entidad, x.EntidadId });
            e.HasIndex(x => x.Fecha);
        });
    }
}
