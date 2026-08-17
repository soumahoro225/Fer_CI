import Link from "next/link";
import BrandLogo from "../../brand-logo";

export default function AuthError() {
  return <main className="login-page"><section className="login-card auth-error-card">
    <BrandLogo className="login-logo" priority />
    <h1>Lien de confirmation invalide</h1>
    <p>Le lien a expiré, a déjà été utilisé ou ne correspond pas à cet appareil. Demandez un nouveau lien puis utilisez uniquement le courriel le plus récent.</p>
    <Link className="primary citizen-link-button" href="/citoyen/inscription#resend">Renvoyer le lien de confirmation</Link>
    <Link className="secondary citizen-link-button" href="/login">Revenir à la connexion</Link>
  </section></main>;
}
