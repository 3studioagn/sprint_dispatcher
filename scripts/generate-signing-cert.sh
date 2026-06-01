#!/usr/bin/env bash
#
# Fallback multiplataforma (openssl) para gerar o cert de code signing
# auto-assinado da ARTFLEXÍVEIS. O caminho primário é generate-signing-cert.ps1
# (Windows). Útil para gerar o material do certificado em CI Linux/macOS ou numa
# máquina de dev sem Windows; a assinatura em si continua sendo feita no Windows
# (signtool, via electron-builder).
#
# Saída em ${OUTDIR:-<repo>/.certs}:
#   <name>.pfx  chave PRIVADA protegida por senha (NUNCA no Git)
#   <name>.cer  chave PÚBLICA em DER (distribuída pelo TI via GPO)
#
# Variáveis de ambiente (todas opcionais):
#   NAME, OUTDIR, YEARS, SUBJECT, FORCE=1, WINDOWS_CERT_PASSWORD
#
# Runbook: docs/guides/code-signing.md ; decisão: ADR-024.
set -euo pipefail

NAME="${NAME:-artflexiveis-codesign}"
OUTDIR="${OUTDIR:-$(cd "$(dirname "$0")/.." && pwd)/.certs}"
YEARS="${YEARS:-3}"
DAYS=$(( YEARS * 365 ))
SUBJECT="${SUBJECT:-/CN=ARTFLEXÍVEIS/O=ARTFLEXÍVEIS}"
PASSWORD="${WINDOWS_CERT_PASSWORD:-}"

mkdir -p "$OUTDIR"
KEY="$OUTDIR/$NAME.key"
CRT="$OUTDIR/$NAME.crt"
PFX="$OUTDIR/$NAME.pfx"
CER="$OUTDIR/$NAME.cer"

if [[ -f "$PFX" && "${FORCE:-}" != "1" ]]; then
  echo "[cert:gen] $PFX ja existe - FORCE=1 para recriar. Nada a fazer."
  echo "[cert:gen] CSC_LINK=$PFX"
  exit 0
fi

if [[ -z "$PASSWORD" ]]; then
  read -r -s -p "Senha para proteger o .pfx: " PASSWORD
  echo
fi

echo "[cert:gen] Gerando cert de code signing (RSA-2048/SHA-256, ${YEARS}a): $SUBJECT"
# Cert auto-assinado com EKU codeSigning.
openssl req -x509 -newkey rsa:2048 -keyout "$KEY" -out "$CRT" \
  -days "$DAYS" -nodes -sha256 -utf8 -subj "$SUBJECT" \
  -addext "keyUsage=digitalSignature" \
  -addext "extendedKeyUsage=codeSigning"

# PFX (privado) protegido por senha. A senha vai por ENV (não argv) para não
# aparecer em `ps`/`/proc` de outros usuários da máquina (remediação da
# auditoria do BL-C0-008 — exposição local do script de fallback).
PFX_PASS="$PASSWORD" openssl pkcs12 -export -inkey "$KEY" -in "$CRT" -out "$PFX" -passout env:PFX_PASS
# CER público em DER (formato que o GPO importa).
openssl x509 -in "$CRT" -outform DER -out "$CER"
rm -f "$KEY" "$CRT"

echo "[cert:gen] OK"
echo "[cert:gen]   PFX (privado, NUNCA no Git): $PFX"
echo "[cert:gen]   CER (publico, GPO):          $CER"
echo "[cert:gen] Build: defina CSC_LINK=$PFX e CSC_KEY_PASSWORD=<senha>"
echo "[cert:gen] CI: base64 -w0 do .pfx -> Secret WINDOWS_CERT_PFX_BASE64 ; senha -> WINDOWS_CERT_PASSWORD"
