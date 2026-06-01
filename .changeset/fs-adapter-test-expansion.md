---
'@sprint/fs-adapter': patch
---

test(C8): expand fs-adapter test suite to 100% lines with adversarial scenarios,
parity matrix, and cross-package roundtrip [BL-C8-003]

Ampliação da suíte de testes do `@sprint/fs-adapter` (W1.C8 — Gate 4-6) com
cenários adversariais de concorrência, paridade Node↔Memory para domain layer, e
roundtrip cross-package via property-based testing.

Adicionados:

- **`fast-check@^3.20.0`** como devDependency.
- **`src/__helpers__/arbitraries.ts`** — `posixPathArbitrary`, `ulidArbitrary`,
  `userIdArbitrary` (cópia local — `@sprint/contracts` não expõe subpath
  `__helpers__/*` por design).
- **`src/__helpers__/tmpFixtures.ts`** — `setupTmpShared(label)` cria
  `<tmp>/pending,acks/` para integration tests.
- **`src/node-adapter.adversarial.test.ts`** (NOVO, 10 testes — 3 skipped no
  Windows):
  - Concorrência 10 escritas mesmo path (Linux/macOS only), 10 paths distintos,
    estado final `.tmp`-livre após 20+5 writes.
  - Payloads grandes: 10MB texto puro (<5s), 100KB de emojis ZWJ family
    preservados byte-a-byte.
  - **Cobertura defensiva — lines 50-51 e 63-64** via `vi.mock` de
    `node:fs/promises.open` (mock injeta `FileHandle` com `close()` que
    rejeita). Subiu node-adapter.ts de 97.74% → 100% lines.
  - Permission revoked (chmod 0o000) — Linux/macOS only via `it.runIf`.
- **`src/domain/pending-store.adversarial.test.ts`** (NOVO, 12 testes):
  - 10 writePendingSprint concorrentes (users distintos + sprint_ids distintos)
    → listPending retorna 10, zero `.tmp`.
  - mtime ordering com `fs.utimes` real (não spy reverso no Memory).
  - Race de pasta `pending/` removida durante listPending.
  - Race de arquivo deletado entre listDir e stat (setImmediate).
  - **Cenário "mistura 8 arquivos"** — 3 sprint válidos + 2 cancel + 1 invalid +
    1 `.tmp` + 1 junk + 1 ack errado → listPending filtra para 6 entries com
    kinds corretos; filtros userId/sprintId.
- **`src/domain/ack-store.adversarial.test.ts`** (NOVO, 7 testes):
  - Overwrite progressivo 3× (displayed_at → +acknowledged_at → re-displayed_at)
    — UC de re-exibição W2.
  - 10 acks concorrentes (sprint compartilhada).
  - Cenário "mistura 6 arquivos" — 3 ack + 1 invalid + 1 pending no acks/ + 1
    junk → listAcks filtra para 4 entries.
- **`src/integration/parity.test.ts`** (NOVO, 18 testes — 9 × 2 adapters):
  Matriz cross-adapter via `describeParity(label, factory)` rodando PendingStore
  (write/list/delete), AckStore (write/list/overwrite) e Stubs
  (CancelStore/ArchiveStore — `NotImplementedError`) contra Node (tmp dir real)
  **e** Memory (mock). Garante que consumers (Leader, Agent) podem trocar
  adapter sem mudar comportamento.
- **`src/integration/roundtrip.test.ts`** (NOVO, 12 testes — cross-package):
  - 3 properties roundtrip (50 runs cada): PendingStore writePendingSprint →
    listPending preserva campos críticos; filtro userId universal; AckStore
    writeAck → listAcks preserva campos.
  - 3 testes sanitização end-to-end: `<script>` injetado vira sanitizado
    pós-write; `onerror` neutralizado; body limpo é preservado.
  - 3 testes unicode (acentos+emoji, ZWJ family, 1900 chars).
  - 3 testes end-to-end Node real FS: `.json` válido em disk, `.ack.json`
    válido, XSS sanitizado no disco.
- **Thresholds elevados** em `vitest.config.ts`: 95/95/95/95 (era 95/90/95/95).

Cobertura final: **100% lines / 99.53% branches / 100% functions / 100%
statements** em todos os arquivos. 235 → 294 testes (+59; 291 passing + 3
skipped no Windows).

Bug-discovery (não-crítico, política §2.4 da sessão):

- Windows EPERM em renames concorrentes ao mesmo path (limite do SO, não bug) →
  `it.runIf` Linux/macOS only.
- `.tmp` files visíveis em `listDir` raw durante write (atomicidade no rename,
  não na invisibilidade) → asserções corrigidas para estado final.

Zero modificação em código de produção. Stubs `CancelStore.writeCancel`
(W2/BL-C4-004) e `ArchiveStore.moveToArchive` (W3/BL-C4-005) permanecem
intactos.
