import styles from './Historico.module.css';

export function Historico() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Histórico</h1>
        <p className={styles.pageSubtitle}>Sprints concluídas e canceladas.</p>
      </header>
      <section className={styles.empty} aria-label="Estado de desenvolvimento">
        <p className={styles.emptyTitle}>Em desenvolvimento — Wave 3</p>
        <p className={styles.emptyHint}>
          BL-C2-010 entregará a visualização de sprints arquivadas com filtros e busca.
        </p>
      </section>
    </div>
  );
}
