import Link from "next/link";
import BrandLogo from "../../brand-logo";

export default function AuthError() {
  return <main className="login-page"><section className="login-card auth-error-card">
    <BrandLogo className="login-logo" priority />
    <h1>Lien de confirmation invalide</h1>
    <p>Le lien a expiré ou a déjà été utilisé. Recommencez l’inscription ou connectez-vous si le compte est confirmé.</p>
    <Link className="primary citizen-link-button" href="/login">Revenir à la connexion</Link>
  </section></main>;
}
