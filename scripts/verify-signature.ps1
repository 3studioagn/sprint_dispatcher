#Requires -Version 5.1
<#
.SYNOPSIS
  Verifica a assinatura Authenticode dos artefatos de release (BL-C0-008).

.DESCRIPTION
  Roda Get-AuthenticodeSignature em cada .exe e distingue dois conceitos:
    - ASSINADO  : SignerCertificate != $null  -> requisito MÍNIMO.
    - CONFIÁVEL : Status -eq 'Valid'           -> só em estação com o .cer já
                  distribuído via GPO (Trusted Root + Trusted Publishers).

  Política de saída:
    - exit 1 se QUALQUER artefato estiver NÃO-ASSINADO (falha o job de CI).
    - "assinado mas não-confiável" (cert ainda não distribuído nesta máquina)
      é apenas um AVISO — esperado fora do domínio. Não falha.
    - exit 2 se nenhum .exe for encontrado.

.PARAMETER Path
  Pasta(s) ou arquivo(s) a verificar. Default: os release/ dos 2 apps.

.EXAMPLE
  pnpm verify:signature

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-signature.ps1 -Path .\apps\leader\release
#>
[CmdletBinding()]
param(
  [string[]]$Path
)

$ErrorActionPreference = 'Stop'

if (-not $Path -or $Path.Count -eq 0) {
  $repoRoot = Join-Path $PSScriptRoot '..'
  $Path = @(
    (Join-Path $repoRoot 'apps\leader\release'),
    (Join-Path $repoRoot 'apps\operator-agent\release')
  )
}

# Coleta os .exe (aceita pastas ou arquivos individuais).
$targets = @()
foreach ($p in $Path) {
  if (Test-Path $p -PathType Container) {
    $targets += Get-ChildItem -Path $p -Filter *.exe -Recurse -ErrorAction SilentlyContinue
  } elseif (Test-Path $p -PathType Leaf) {
    $targets += Get-Item -Path $p
  }
}

if ($targets.Count -eq 0) {
  Write-Host "[verify] Nenhum .exe encontrado em: $($Path -join ', ')." -ForegroundColor Red
  Write-Host "[verify] Rode o build antes (pnpm sign:local, ou make num runner sem ESET)." -ForegroundColor Red
  exit 2
}

$unsigned = 0
$untrusted = 0
foreach ($f in $targets) {
  $sig = Get-AuthenticodeSignature -FilePath $f.FullName
  if ($null -eq $sig.SignerCertificate) {
    Write-Host "[verify] NAO-ASSINADO: $($f.Name)" -ForegroundColor Red
    $unsigned++
    continue
  }
  $subjectName = $sig.SignerCertificate.Subject
  if ($sig.Status -eq 'Valid') {
    Write-Host "[verify] CONFIAVEL:   $($f.Name)  [$subjectName]" -ForegroundColor Green
  } else {
    Write-Host "[verify] ASSINADO (nao-confiavel: $($sig.Status)): $($f.Name)  [$subjectName]" -ForegroundColor Yellow
    Write-Host "         Esperado fora do dominio: o .cer ainda nao esta no trust store desta maquina (GPO)." -ForegroundColor DarkGray
    $untrusted++
  }
}

Write-Host ""
Write-Host "[verify] Resumo: $($targets.Count) artefato(s) | $unsigned nao-assinado(s) | $untrusted assinado(s)-nao-confiavel(eis)."

if ($unsigned -gt 0) {
  Write-Host "[verify] FALHA: $unsigned artefato(s) sem assinatura Authenticode." -ForegroundColor Red
  exit 1
}

Write-Host "[verify] OK: todos os artefatos estao assinados." -ForegroundColor Green
exit 0
