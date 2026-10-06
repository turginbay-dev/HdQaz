export function AppLoadingScreen() {
  return <div className="viewer-container page-skeleton" role="status" aria-label="Контент жүктелуде">
    <span className="sr-only">Жүктелуде…</span><div className="skeleton-heading" /><div className="movie-grid">{Array.from({ length: 6 }, (_, i) => <div key={i}><div className="skeleton-poster" /><div className="skeleton-line" /></div>)}</div>
  </div>;
}
