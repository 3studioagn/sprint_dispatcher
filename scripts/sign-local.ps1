#Requires -Version 5.1
<#
.SYNOPSIS
  Validação local da cadeia de assinatura (BL-C0-008), sem Secrets do CI.

.DESCRIPTION
  Executa, em um único processo (para CSC_* propagarem):
    1) gera um cert DEV em ./.certs (sempre fresh, -Force);
    2) seta CSC_LINK / CSC_KEY_PASSWORD / CSC_IDENTITY_AUTO_DISCOVERY=false;
    3) builda assinado os 2 apps (electron-builder lê CSC_* do ambiente);
    4) verifica as assinaturas (verify-signature.ps1).

  No release REAL (CI), o .pfx vem do Secret via release.yml — não do disco.
  ATENÇÃO: o ESET local pode travar o electron-builder ao escrever o app.asar
  (G-009). Se o passo 3 falhar por isso, valide a assinatura no CI (release.yml).

.PARAMETER Password
  Senha do .pfx DEV local. Default: $env:WINDOWS_CERT_PASSWORD ou um valor de dev.
#>
[CmdletBinding()]
param(
  [string]$Password = $(if ($env:WINDOWS_CERT_PASSWORD) { $env:WINDOWS_CERT_PASSWORD } else { 'sprint-dev-cert' })
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$pfx = Join-Path $repoRoot '.certs\artflexiveis-codesign.pfx'

Write-Host "[sign:local] (1/4) gerando cert DEV local..."
& (Join-Path $PSScriptRoot 'generate-signing-cert.ps1') -Password $Password -Dev -Force

Write-Host "[sign:local] (2/4) exportando CSC_* no processo atual..."
$env:CSC_LINK = $pfx
$env:CSC_KEY_PASSWORD = $Password
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

Write-Host "[sign:local] (3/4) build assinado dos 2 apps (electron-builder)..."
& pnpm --filter sprint-leader run make
if ($LASTEXITCODE -ne 0) {
  Write-Host "[sign:local] build do Leader falhou (ESET/G-009?). Abortando." -ForegroundColor Red
  exit $LASTEXITCODE
}
& pnpm --filter sprint-operator-agent run make
if ($LASTEXITCODE -ne 0) {
  Write-Host "[sign:local] build do Agent falhou (ESET/G-009?). Abortando." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "[sign:local] (4/4) verificando assinaturas..."
& (Join-Path $PSScriptRoot 'verify-signature.ps1')
exit $LASTEXITCODE
