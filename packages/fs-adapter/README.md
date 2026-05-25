# @sprint/fs-adapter

Adapter de filesystem (port + 2 implementações) do Sprint Dispatcher.

Padrão **port-and-adapter (hexagonal)** — ver
[`DECISIONS.md`](../../DECISIONS.md) ADR-013.

## Uso básico

```ts
import { NodeFilesystemAdapter, FileNotFoundError } from '@sprint/fs-adapter';

const fs = new NodeFilesystemAdapter();

try {
  const content = await fs.readFile('/path/to/file.json');
} catch (err) {
  if (err instanceof FileNotFoundError) {
    // tratar arquivo ausente
  }
}
```

API completa após F8 desta sessão.
