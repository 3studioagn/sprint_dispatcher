---
'sprint-leader': patch
'sprint-operator-agent': patch
---

build(C0): assinatura de código (cert auto-assinado + GPO) no caminho de release
[BL-C0-008]

Os artefatos de release (`SprintLeader.exe`, `SprintAgent.exe`) passam a ser
assinados via **Authenticode** com **timestamping RFC 3161** e **digest
SHA-256**, usando o mecanismo nativo do electron-builder (`CSC_LINK` +
`CSC_KEY_PASSWORD`, lidos do ambiente — nunca hardcoded).

Estratégia de confiança (ADR-024): certificado **auto-assinado da ARTFLEXÍVEIS**
distribuído pelo TI via **GPO** (Trusted Root + Trusted Publishers) — custo
zero, sem CA paga. Migração para CA interna (AD CS) ou cert público = troca de
Secret.

A assinatura ocorre **somente** no caminho de release (`release.yml`, tag
`v*.*.*`, `windows-latest`); PR/branch builds não assinam nem expõem Secrets.
Runbook: `docs/guides/code-signing.md`.

> Nota (ADR-001): apps versionam pelo electron-builder, não por Changesets. Este
> changeset documenta a capacidade entregue; o config atual tem `ignore: []`
> (apps não ignorados). Decisão de manter o bump ou popular `ignore` fica com
> Renan — ver resumo da sessão.
