namespace ServicarSossa.Application.Common;

/// <summary>
/// Envoltorio de resultado que usan todos los servicios de Application.
/// Permite que los controllers decidan el código HTTP sin lanzar excepciones
/// para flujos de negocio esperados (duplicados, no encontrado, etc.).
/// </summary>
public class Result<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public ErrorTipo Error { get; init; }

    public static Result<T> Ok(T data, string? mensaje = null)
        => new() { Success = true, Data = data, Message = mensaje };

    public static Result<T> Fail(string mensaje, ErrorTipo error = ErrorTipo.Validacion)
        => new() { Success = false, Message = mensaje, Error = error };

    public static Result<T> NoEncontrado(string mensaje)
        => Fail(mensaje, ErrorTipo.NoEncontrado);

    public static Result<T> Conflicto(string mensaje)
        => Fail(mensaje, ErrorTipo.Conflicto);

    public static Result<T> NoAutorizado(string mensaje)
        => Fail(mensaje, ErrorTipo.NoAutorizado);
}

/// <summary>Mapea 1:1 con el código HTTP que devuelve el controller.</summary>
public enum ErrorTipo
{
    Ninguno = 0,
    Validacion = 400,
    NoAutorizado = 401,
    NoEncontrado = 404,
    Conflicto = 409
}
