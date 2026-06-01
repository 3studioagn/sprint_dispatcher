# `@sprint/release-tools` — scripts de build/release

Workspace privado (nunca publicado) com a infraestrutura de **code signing**
(BL-C0-008) e helpers de CI do Sprint Dispatcher.

Runbook completo (gerar certificado, distribuir via GPO, cadastrar Secrets,
validar): [`docs/guides/code-signing.md`](../docs/guides/code-signing.md).
Decisão de confiança: ADR-024 em [`DECISIONS.md`](../DECISIONS.md).

## Conteúdo

| Arquivo                            | Tipo            | Papel                                                                                 |
| ---------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `generate-signing-cert.ps1`        | PowerShell      | Gera o cert auto-assinado da ARTFLEXÍVEIS (`.pfx` privado + `.cer` público). Primário |
| `generate-signing-cert.sh`         | Bash + openssl  | Fallback multiplataforma para gerar `.pfx` + `.cer`                                   |
| `verify-signature.ps1`             | PowerShell      | `Get-AuthenticodeSignature` nos artefatos — distingue _assinado_ vs _confiável_       |
| `pfx-secret.mjs`                   | Node (lib)      | Decode base64 → arquivo + cleanup. **Unit-testado**, é a parte determinística         |
| `prepare-signing-cert.mjs`         | Node (CLI glue) | Usado pelo `release.yml`: `prepare` (decode + `CSC_LINK`) / `cleanup`                 |
| `pfx-secret.test.mjs`              | Vitest          | Testes do helper (happy / erros / cleanup idempotente)                                |
| `electron-builder-config.test.mjs` | Vitest          | Asserções: ambos os YAML têm timestamping + SHA-256 e zero segredo hardcoded          |

## Contrato de Secrets (CI de release)

| Secret                    | Conteúdo                                   |
| ------------------------- | ------------------------------------------ |
| `WINDOWS_CERT_PFX_BASE64` | O `.pfx` (chave privada) codificado base64 |
| `WINDOWS_CERT_PASSWORD`   | A senha do `.pfx`                          |

O `.pfx` e a senha **nunca** entram no Git. `.certs/` e `*.pfx` estão no
`.gitignore`. Só o `.cer` (chave pública) pode ser versionado, se conveniente.

## Scripts npm (rodados da raiz do monorepo)

| Comando                 | O que faz                                                            |
| ----------------------- | -------------------------------------------------------------------- |
| `pnpm cert:gen`         | Gera `./.certs/artflexiveis-codesign.{pfx,cer}` (PowerShell)         |
| `pnpm build:signed`     | Build assinado dos 2 apps (usa `CSC_LINK`/`CSC_KEY_PASSWORD` do env) |
| `pnpm sign:local`       | `cert:gen` + `build:signed` com o `.pfx` local (validação sem CI)    |
| `pnpm verify:signature` | `Get-AuthenticodeSignature` nos `release/*.exe` dos 2 apps           |

> Fora do domínio (cert ainda não distribuído via GPO), `verify:signature`
> reporta o artefato como **assinado mas não-confiável** — esperado. Em estação
> do domínio com o `.cer` na trust store, o status é `Valid`.
