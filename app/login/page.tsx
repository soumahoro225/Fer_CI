import Link from "next/link";
import BrandLogo from "../brand-logo";
import { login } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return <main className="login-page">
    <form action={login} className="login-card">
      <BrandLogo className="login-logo" priority />
      <div><h1>Connexion</h1><p>Accédez à votre espace de gestion ou à votre espace citoyen.</p></div>
      {error ? <div className="login-error" role="alert">{error}</div> : null}
      {message ? <div className="success-message" role="status">{message}</div> : null}
      <label>Adresse électronique<input name="email" type="email" required autoComplete="email" /></label>
      <label>Mot de passe<input name="password" type="password" required autoComplete="current-password" /></label>
      <button className="primary">Se connecter</button>
      <div className="citizen-auth-link"><span>Vous souhaitez faire un signalement ?</span><Link href="/citoyen/inscription">Créer gratuitement un compte citoyen</Link></div>
    </form>
  </main>;
}
