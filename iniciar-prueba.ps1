#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$LimpiarDatos
)

$ErrorActionPreference = "Stop"
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$appUrl = "http://localhost:4040"
$compose = @("compose", "up", "-d", "--build", "--force-recreate")

Set-Location $projectPath
Write-Host "`n=== Punto de Venta: inicio de prueba ===`n" -ForegroundColor Cyan

try {
    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker Desktop no está disponible. Inícialo y vuelve a ejecutar este script." }

    if ($LimpiarDatos) {
        Write-Host "Eliminando volumen MySQL para una prueba limpia..." -ForegroundColor Yellow
        docker compose down -v
    }

    Write-Host "Levantando MySQL y Next.js..." -ForegroundColor Yellow
    & docker @compose
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose no pudo iniciar los servicios." }

    Write-Host "Esperando a que la aplicación responda..." -ForegroundColor Yellow
    $ready = $false
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                $ready = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) {
        docker compose ps
        docker compose logs --tail 40 web
        throw "La aplicación no respondió en el puerto 4040."
    }

    $productBody = @{
        nombre = "Producto demo"
        sku = "SKU-PRUEBA-001"
        codigoBarras = "750000000001"
        precioVenta = 100
        costo = 60
        stockInicial = 10
        stockMinimo = 2
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$appUrl/api/products" -Method Post -ContentType "application/json" -Body $productBody | Out-Null
        Write-Host "Producto demo creado: SKU-PRUEBA-001" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 409) {
            Write-Host "Producto demo ya existente; se conserva para la prueba." -ForegroundColor DarkGray
        } else {
            Write-Warning "La web responde, pero no se pudo crear el producto demo: $($_.Exception.Message)"
        }
    }

    Write-Host "`nAplicación lista para probar:" -ForegroundColor Green
    Write-Host "  $appUrl" -ForegroundColor White
    Write-Host "  SKU de prueba: SKU-PRUEBA-001" -ForegroundColor White
    Write-Host "  Código de barras: 750000000001" -ForegroundColor White
    Write-Host "`nAbriendo el navegador...`n" -ForegroundColor Cyan
    Start-Process $appUrl
} catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Consulta los logs con: docker compose logs --tail 80 web" -ForegroundColor Yellow
    exit 1
}
