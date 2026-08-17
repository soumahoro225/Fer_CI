"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="state-page">
      <div className="state-card">
        <span className="state-code">Signale CI</span>
        <h1>Les données ne peuvent pas être chargées</h1>
        <p>La connexion au service est momentanément indisponible. Vos données n’ont pas été modifiées.</p>
        <button className="primary" onClick={reset}>Réessayer</button>
      </div>
    </main>
  );
}
