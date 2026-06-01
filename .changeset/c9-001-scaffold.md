---
'@sprint/ui-kit': minor
---

feat(C9): scaffold inicial do package @sprint/ui-kit [BL-C9-001]

Cria o quarto package compartilhado do monorepo Sprint Dispatcher, em modo
library do Vite 5.x:

- Estrutura `src/{components,theme,tokens}` com barrels reservados
- `package.json` ESM com exports tree-shakeable e subpath `./tokens.css`
- `react` e `react-dom` como peerDependencies (^18.3.0)
- Build via Vite library mode + vite-plugin-dts (rollupTypes)
- Cópia estática de tokens.css via vite-plugin-static-copy
- Vitest com jsdom para testes de componentes
- `src/test-setup.ts` dentro do `src` + `tsconfig.node.json` para vite/vitest
  configs (padrão leader, G-010)
- Smoke test de barrel exportando `UI_KIT_PACKAGE_VERSION`
- `commitlint.config.cjs` ampliado para aceitar scope `C9`

**Não edita `tsconfig.base.json`** — alias TS de `@sprint/ui-kit` será
adicionado em `apps/operator-agent/tsconfig.json` durante BL-C3-015 (padrão
atual do monorepo: paths no consumidor).
