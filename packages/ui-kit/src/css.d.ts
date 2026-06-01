/**
 * Type declarations para CSS Modules e side-effect imports de .css.
 *
 * - `*.module.css` exporta um objeto com os nomes de classes (strings
 *   geradas pelo bundler).
 * - `*.css` (sem .module) é um side-effect import — declarado vazio
 *   para o TypeScript aceitar.
 *
 * Library mode (Vite) processa esses imports em build-time; em testes
 * (Vitest com jsdom) o stub padrão do vite-plugin-react gera nomes
 * de classes equivalentes.
 */

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module '*.css' {
  const content: string;
  export default content;
}
