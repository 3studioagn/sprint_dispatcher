/**
 * Top navigation horizontal — substitui o `Sidebar` vertical da W1.C2
 * parte 1 a partir do redesign do Gate 7. Logo 3Studio na esquerda,
 * 3 links na direita ("Nova rodada", "Acompanhamento", "Histórico").
 *
 * Link ativo: cor accent (amarela) + underline accent embaixo.
 * Link inativo: texto muted, hover sobe para branco.
 *
 * @see DECISIONS.md ADR-015 (composer do Leader — design Gate 7 atualiza visual)
 */

import { NavLink } from 'react-router-dom';

import { Logo } from '../Logo';

import styles from './TopNav.module.css';

interface NavItem {
  readonly to: string;
  readonly label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/nova', label: 'Nova rodada' },
  { to: '/acompanhamento', label: 'Acompanhamento' },
  { to: '/historico', label: 'Histórico' },
];

export function TopNav() {
  return (
    <header className={styles.topNav}>
      <div className={styles.brand}>
        <Logo />
      </div>
      <nav className={styles.nav} aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
