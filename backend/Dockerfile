# Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ServicarSossa.Domain/*.csproj ServicarSossa.Domain/
COPY ServicarSossa.Application/*.csproj ServicarSossa.Application/
COPY ServicarSossa.Infrastructure/*.csproj ServicarSossa.Infrastructure/
COPY ServicarSossa.API/*.csproj ServicarSossa.API/
RUN dotnet restore ServicarSossa.API/ServicarSossa.API.csproj

COPY . .
RUN dotnet publish ServicarSossa.API/ServicarSossa.API.csproj -c Release -o /app --no-restore

# Run
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_ENVIRONMENT=Production
ENTRYPOINT ["dotnet", "ServicarSossa.API.dll"]
