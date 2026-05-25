import styles from './Acompanhamento.module.css';

export function Acompanhamento() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Acompanhamento</h1>
        <p className={styles.pageSubtitle}>Status das sprints ativas em tempo quase-real.</p>
      </header>
      <section className={styles.empty} aria-label="Estado de desenvolvimento">
        <p className={styles.emptyTitle}>Em desenvolvimento — Wave 2</p>
        <p className={styles.emptyHint}>
          BL-C2-008 entregará a visualização de acks em tempo quase-real assim que o dispatch real
          (BL-C2-007) estiver disponível.
        </p>
      </section>
    </div>
  );
}
