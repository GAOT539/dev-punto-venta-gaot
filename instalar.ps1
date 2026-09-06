#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostEntry = "127.0.0.1 punto.caja.local"
$firewallRuleName = "Punto de Venta - Puerto 4040"
$appUrl = "http://punto.caja.local:4040"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
    $arguments = "-ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -WorkingDirectory $projectPath
    exit 0
}

Set-Location $projectPath
Write-Host "`n  SISTEMA PUNTO DE VENTA`n" -ForegroundColor Cyan

Write-Host "[1/4] Configurando el nombre local..." -ForegroundColor Yellow
$hostsContent = Get-Content -Path $hostsPath -ErrorAction Stop
if (-not ($hostsContent | Where-Object { $_ -match '^\s*127\.0\.0\.1\s+punto\.caja\.local\s*(#.*)?$' })) {
    Add-Content -Path $hostsPath -Value $hostEntry -Encoding ascii
}

Write-Host "[2/4] Configurando Firewall para la red local..." -ForegroundColor Yellow
$existingRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Protocol TCP -LocalPort 4040 -Action Allow -Profile Private -Description "Permite acceder al sistema Punto de Venta desde la red local" | Out-Null
} else {
    Set-NetFirewallRule -DisplayName $firewallRuleName -Enabled True -Action Allow -Profile Private | Out-Null
}

Write-Host "[3/4] Construyendo y levantando los servicios..." -ForegroundColor Yellow
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "Docker Compose no pudo levantar el sistema." }

Write-Host "Esperando que la aplicación responda..." -ForegroundColor DarkGray
$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4040" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw "La aplicación no respondió en el puerto 4040." }

Write-Host "[4/4] Creando acceso directo..." -ForegroundColor Yellow
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Sistema Punto de Venta.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $appUrl
$shortcut.WorkingDirectory = $projectPath
$shortcut.Description = "Abrir Sistema Punto de Venta"
$shortcut.Save()
[Runtime.InteropServices.Marshal]::ReleaseComObject($shell) | Out-Null

Write-Host "`n  INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "  Acceso directo creado en el escritorio." -ForegroundColor White
Write-Host "  Acceso local: $appUrl" -ForegroundColor White
Write-Host "  Acceso desde la red: http://IP_DE_ESTA_PC:4040" -ForegroundColor White
Write-Host ""
