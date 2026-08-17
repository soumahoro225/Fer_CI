import Link from "next/link";

export default function AuthError() {
  return <main className="login-page"><section className="login-card auth-error-card">
    <div className="brand login-brand"><div className="brand-mark"><span>FER</span><i /></div><div><strong>Signale CI</strong><small>Espace citoyen</small></div></div>
    <h1>Lien de confirmation invalide</h1>
    <p>Le lien a expiré ou a déjà été utilisé. Recommencez l’inscription ou connectez-vous si le compte est confirmé.</p>
    <Link className="primary citizen-link-button" href="/login">Revenir à la connexion</Link>
  </section></main>;
}
