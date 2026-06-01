#Requires -Version 5.1
<#
.SYNOPSIS
  Gera o certificado de code signing auto-assinado da ARTFLEXÍVEIS (BL-C0-008).

.DESCRIPTION
  Cria um certificado self-signed do tipo CodeSigningCert (RSA-2048, SHA-256) e
  exporta dois arquivos para a pasta de saída:
    - <Name>.pfx  chave PRIVADA, protegida por senha — vira o Secret de release
                  e/ou o cert de uso local. NUNCA entra no Git.
    - <Name>.cer  chave PÚBLICA (DER) — é o arquivo que o TI distribui via GPO
                  (Trusted Root + Trusted Publishers).
  O certificado é removido do store do usuário após a exportação (o .pfx é o
  artefato de assinatura). Idempotente: não sobrescreve arquivos existentes,
  exceto com -Force.

  Estratégia de confiança e passo-a-passo do TI: docs/guides/code-signing.md.
  Decisão: ADR-024 em DECISIONS.md.

.PARAMETER Password
  Senha que protege o .pfx. Precedência: -Password > $env:WINDOWS_CERT_PASSWORD
  > prompt interativo. Para o cert REAL de publicação, informe explicitamente.

.PARAMETER Years
  Validade em anos (default 3).

.PARAMETER OutDir
  Pasta de saída (default ./.certs na raiz do repo — gitignored).

.PARAMETER Name
  Nome-base dos arquivos (default artflexiveis-codesign).

.PARAMETER Dev
  Acrescenta " DEV" ao CN — cert efêmero para validação local (sign:local).

.PARAMETER Force
  Recria os arquivos mesmo que já existam.

.EXAMPLE
  pnpm cert:gen

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-signing-cert.ps1 -Years 3 -Force
#>
[CmdletBinding()]
param(
  [string]$Password,
  [int]$Years = 3,
  [string]$OutDir = (Join-Path $PSScriptRoot '..\.certs'),
  [string]$Name = 'artflexiveis-codesign',
  [switch]$Dev,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

# "ARTFLEXIVEIS" com o Í (U+00CD) montado via codepoint — independe do encoding
# com que o PowerShell 5.1 lê este arquivo. O CN precisa casar com o
# `publisherName` dos electron-builder.yml para o publisher exibir certo.
$company = 'ARTFLEX' + [char]0x00CD + 'VEIS'
$cn = if ($Dev) { "$company DEV" } else { $company }
$subject = "CN=$cn, O=$company"

# Resolve a senha: -Password > env > prompt (uso humano interativo).
if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = $env:WINDOWS_CERT_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($Password)) {
  $secure = Read-Host -Prompt 'Senha para proteger o .pfx' -AsSecureString
} else {
  $secure = ConvertTo-SecureString -String $Password -AsPlainText -Force
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
$pfxPath = Join-Path $OutDir "$Name.pfx"
$cerPath = Join-Path $OutDir "$Name.cer"

if ((Test-Path $pfxPath) -and (-not $Force)) {
  Write-Host "[cert:gen] $pfxPath ja existe - use -Force para recriar. Nada a fazer."
  Write-Host "[cert:gen] CSC_LINK=$pfxPath"
  exit 0
}

Write-Host "[cert:gen] Gerando cert de code signing: $subject (validade ${Years}a, RSA-2048/SHA-256)"
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $subject `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears($Years)

try {
  Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secure -Force | Out-Null
  Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null
} finally {
  # O .pfx exportado é o artefato; não deixamos o cert no store do usuário.
  Remove-Item -Path ("Cert:\CurrentUser\My\" + $cert.Thumbprint) -Force -ErrorAction SilentlyContinue
}

Write-Host "[cert:gen] OK"
Write-Host "[cert:gen]   PFX (privado, NUNCA no Git): $pfxPath"
Write-Host "[cert:gen]   CER (publico, GPO):          $cerPath"
Write-Host "[cert:gen]   Thumbprint:                  $($cert.Thumbprint)"
Write-Host "[cert:gen] Build local: defina CSC_LINK=$pfxPath e CSC_KEY_PASSWORD=<senha>"
Write-Host "[cert:gen] CI: base64 do .pfx -> Secret WINDOWS_CERT_PFX_BASE64 ; senha -> WINDOWS_CERT_PASSWORD"
