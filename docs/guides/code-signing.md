# Code Signing — Runbook (BL-C0-008)

> **Decisão:** [ADR-024](../../DECISIONS.md) — assinar com **certificado
> auto-assinado da ARTFLEXÍVEIS**, distribuído pelo TI como raiz confiável via
> **GPO**. Custo zero, sem CA paga. A infraestrutura de assinatura é idêntica
> caso no futuro se troque a origem do certificado (CA interna AD CS ou CA
> pública) — muda só um Secret.

O Sprint Dispatcher é distribuído **apenas internamente**, em estações da
ARTFLEXÍVEIS gerenciadas via Active Directory / GPO. Por isso a confiança na
assinatura **não** vem de reputação de CA pública (SmartScreen), e sim da
distribuição da chave pública (`.cer`) pela própria TI, via Group Policy.

Por que assinar, então? **RI-01**: antivírus e o SmartScreen bloqueiam/avisam
sobre EXEs não-assinados ("editor desconhecido"). Com o `.cer` distribuído via
GPO (Trusted Root + Trusted Publishers), o app aparece como **publisher
ARTFLEXÍVEIS verificado**, sem prompt, e executa em silêncio nas estações do
domínio.

A assinatura usa o mecanismo **nativo do electron-builder** (`CSC_LINK` +
`CSC_KEY_PASSWORD`), com **timestamping RFC 3161** (a assinatura continua válida
após o certificado expirar) e **digest SHA-256**. Acontece **somente no caminho
de release** (`.github/workflows/release.yml`, em tag `v*.*.*`); PR/branch
builds nunca assinam nem veem os Secrets.

---

## Mecânica (visão geral)

```
generate-signing-cert.ps1
        │  produz
        ├──► artflexiveis-codesign.pfx  (privado)  ──► Secret CI / uso local
        └──► artflexiveis-codesign.cer  (público)  ──► TI distribui via GPO
                                                         (Trusted Root + Publishers)

release.yml (tag v*):
   Secret WINDOWS_CERT_PFX_BASE64 ─► prepare-signing-cert.mjs ─► $RUNNER_TEMP\codesign.pfx
                                                                  └► CSC_LINK
   Secret WINDOWS_CERT_PASSWORD   ─► CSC_KEY_PASSWORD
   electron-builder (win) ─► assina .exe  +  rfc3161TimeStampServer  +  sha256
   verify-signature.ps1   ─► falha o job se algum .exe não estiver assinado
   cleanup (if: always()) ─► remove o .pfx do runner
```

Configuração de assinatura (em ambos `apps/*/electron-builder.yml`, bloco
`win:`), válida para **electron-builder 24.x** (chaves top-level, não
`signtoolOptions`, que é da linha 25.x):

```yaml
win:
  publisherName: ARTFLEXÍVEIS
  rfc3161TimeStampServer: http://timestamp.digicert.com
  signingHashAlgorithms:
    - sha256
```

> O caminho do `.pfx` e a senha **nunca** ficam no YAML — vêm do ambiente
> (`CSC_LINK` / `CSC_KEY_PASSWORD`).

---

## A) Caminho recomendado — cert auto-assinado + GPO (custo zero) — para o TI

### A.1. Gerar o certificado da ARTFLEXÍVEIS

Numa estação Windows do TI (com o repo, ou só com o script
`scripts/generate-signing-cert.ps1`):

```powershell
# Na raiz do monorepo:
pnpm cert:gen
# ou diretamente, escolhendo validade:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-signing-cert.ps1 -Years 3
```

Produz em `./.certs/`:

- `artflexiveis-codesign.pfx` — **chave privada**, protegida por senha. Guardar
  em local seguro (cofre da TI). **Nunca** vai para o Git (`.gitignore` cobre
  `.certs/` e `*.pfx`).
- `artflexiveis-codesign.cer` — **chave pública** (DER). É o arquivo distribuído
  via GPO. Pode ser versionado/compartilhado à vontade.

Equivalente manual (sem o script):

```powershell
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=ARTFLEXÍVEIS, O=ARTFLEXÍVEIS" -KeyAlgorithm RSA -KeyLength 2048 `
  -HashAlgorithm SHA256 -KeyExportPolicy Exportable `
  -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(3)
$pw = Read-Host "Senha do PFX" -AsSecureString
Export-PfxCertificate -Cert $cert -FilePath .\artflexiveis-codesign.pfx -Password $pw
Export-Certificate    -Cert $cert -FilePath .\artflexiveis-codesign.cer
```

### A.2. Distribuir a confiança via Group Policy (GPMC)

Aplicar a uma **OU** que cubra as estações de **operadores e líderes**.

No Group Policy Management, editar (ou criar) um GPO ligado a essa OU:

1. **Trusted Root Certification Authorities** (para a cadeia ser confiável):
   `Computer Configuration → Policies → Windows Settings → Security Settings → Public Key Policies → Trusted Root Certification Authorities`
   → botão direito → **Import** → selecionar `artflexiveis-codesign.cer`.
2. **Trusted Publishers** (remove o prompt de "editor desconhecido" e permite
   execução silenciosa): mesma árvore → **Trusted Publishers** → **Import** → o
   mesmo `.cer`.
3. Forçar atualização numa estação modelo:

   ```cmd
   gpupdate /force
   ```

> Como é auto-assinado, o `.cer` precisa entrar **tanto** em Trusted Root
> **quanto** em Trusted Publishers (a CA é o próprio cert).

### A.3. Cadastrar os Secrets do CI (release assinado)

Em
`GitHub → repo → Settings → Secrets and variables → Actions → New repository secret`:

| Secret                    | Valor                                             |
| ------------------------- | ------------------------------------------------- |
| `WINDOWS_CERT_PFX_BASE64` | o `.pfx` (chave privada) codificado em **base64** |
| `WINDOWS_CERT_PASSWORD`   | a senha do `.pfx`                                 |

Converter o `.pfx` para base64:

```powershell
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes('artflexiveis-codesign.pfx')) | Set-Clipboard
```

```bash
# Linux/macOS
base64 -w0 artflexiveis-codesign.pfx
```

Disparar o release: criar uma tag `vX.Y.Z` (ou rodar o workflow **Release
(signed)** manualmente via `workflow_dispatch`). O `release.yml` decodifica o
Secret, assina, **verifica** e faz upload dos instaladores; o `.pfx` temporário
é removido do runner ao final (inclusive em falha).

### A.4. Validar numa estação do domínio

Após o `.cer` distribuído via GPO e o app assinado instalado:

1. Instalar o `.exe` assinado — **não** deve aparecer "editor desconhecido"; o
   publisher exibido é **ARTFLEXÍVEIS**.
2. Conferir a assinatura:

   ```powershell
   Get-AuthenticodeSignature 'C:\Caminho\SprintLeader.exe' | Format-List Status, SignerCertificate
   # Esperado numa estação do domínio: Status = Valid
   ```

### A.5. Validar localmente (dev) — sem Secrets

```powershell
pnpm sign:local        # gera cert DEV em ./.certs, builda assinado, verifica
pnpm verify:signature  # re-verifica os release/*.exe
```

> **Fora do domínio** (máquina sem o `.cer` na trust store), o
> `verify:signature` reporta o artefato como **assinado mas não-confiável**
> (`Status` ≠ `Valid`) — **isto é esperado**. "Assinado" é o requisito mínimo (e
> falha o job se ausente); "confiável" só ocorre onde a GPO já distribuiu o
> `.cer`. Em estações sem Windows, gerar o cert com
> `scripts/generate-signing-cert.sh` (openssl); a assinatura em si é
> Windows-only.
>
> Na máquina do Renan, o ESET pode travar o `electron-builder` ao escrever o
> `app.asar` (G-009) — nesse caso, valide a assinatura pelo `release.yml` (CI).

---

## B) Opção equivalente — CA interna (AD CS)

Se a ARTFLEXÍVEIS já operar uma **Enterprise CA** (Active Directory Certificate
Services), emitir um certificado de **code signing** por ela em vez do
auto-assinado:

- **Vantagem:** a raiz da CA interna já é distribuída automaticamente a todas as
  máquinas do domínio (via auto-enrollment / GPO padrão do AD) — **não** é
  preciso empurrar o `.cer` manualmente para Trusted Root. Ainda pode ser
  desejável adicionar o cert a **Trusted Publishers** para execução silenciosa.
- **Custo:** zero (infra já existente).
- **Migração:** trocar a origem do certificado **não muda a infraestrutura de
  assinatura** — gere/obtenha o `.pfx` da CA interna e atualize **apenas** o
  Secret `WINDOWS_CERT_PFX_BASE64` (e a senha). `release.yml`,
  `electron-builder.yml`, scripts e verificação permanecem idênticos.

Recomendada **se** a empresa já tem uma Enterprise CA. Caso contrário, o caminho
(A) auto-assinado + GPO entrega o mesmo resultado sem montar uma CA.

---

## C) Nota de evolução — CA pública paga (fora de escopo)

Só faria sentido se um dia o EXE fosse distribuído **fora do domínio** da
ARTFLEXÍVEIS (não é o caso — o sistema é LAN-only). Registro para referência
futura:

- **Certificado público OV/EV** (Sectigo, DigiCert, …) — custo recorrente.
- Desde **jun/2023**, a chave privada de certificados de code signing exige
  **HSM/token** (FIPS 140-2 L2+) — não dá mais para exportar um `.pfx` simples.
  Um cert **EV/HSM** pode demandar um **hook de assinatura customizado** no
  electron-builder (assinatura via token, não via `CSC_LINK` de arquivo).
- **OV** acumula reputação no **SmartScreen** ao longo do tempo (avisos diminuem
  conforme downloads); **EV** passa no SmartScreen imediatamente.
- Mitigação **independente de assinatura** (Anexo G.8 dos requisitos):
  **whitelist por hash** do EXE no antivírus corporativo. Útil como camada
  complementar, mas exige re-whitelist a cada versão e não remove o "editor
  desconhecido" — por isso não é a estratégia principal.

---

## Referências

- [ADR-024](../../DECISIONS.md) — estratégia de assinatura e confiança de
  código.
- `apps/leader/electron-builder.yml`, `apps/operator-agent/electron-builder.yml`
  — bloco `win:` (timestamping + SHA-256).
- `.github/workflows/release.yml` — caminho de release assinado.
- `scripts/` — `generate-signing-cert.ps1` / `.sh`, `verify-signature.ps1`,
  `sign-local.ps1`, `prepare-signing-cert.mjs` (+ `pfx-secret.mjs`).
- Contrato de Secrets: `WINDOWS_CERT_PFX_BASE64`, `WINDOWS_CERT_PASSWORD`.
- **Próximo (BL-C0-009):** publish/version/notify no `release.yml` — bloqueado
  por BL-C5-005 (nomeação de artefatos).
