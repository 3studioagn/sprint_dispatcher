import { NavLink } from 'react-router-dom';

import styles from './Sidebar.module.css';

interface NavItem {
  readonly to: string;
  readonly label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/nova', label: 'Nova Sprint' },
  { to: '/acompanhamento', label: 'Acompanhamento' },
  { to: '/historico', label: 'Histórico' },
];

export function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Navegação principal">
      <div className={styles.brand}>
        <span className={styles.brandLogo} aria-hidden="true">
          S
        </span>
        <div className={styles.brandText}>
          <span className={styles.brandName}>Sprint Dispatcher</span>
          <span className={styles.brandTenant}>ARTFLEXÍVEIS</span>
        </div>
      </div>
      <nav className={styles.nav}>
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
      <footer className={styles.footer}>
        <span className={styles.footerText}>v0.0.0 · Wave 1</span>
      </footer>
    </aside>
  );
}
