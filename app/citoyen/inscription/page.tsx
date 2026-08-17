import Link from "next/link";
import BrandLogo from "../../brand-logo";
import { registerCitizen, resendCitizenConfirmation } from "./actions";

export default async function CitizenRegistration({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; resendError?: string; resendSuccess?: string }>;
}) {
  const { error, success, resendError, resendSuccess } = await searchParams;
  return <main className="citizen-auth-page">
    <section className="citizen-auth-intro">
      <div className="citizen-mini-brand logo-mode"><BrandLogo className="registration-logo" priority /></div>
      <h1>Ensemble, améliorons notre cadre de vie.</h1>
      <p>Signalez un problème depuis votre téléphone. Votre position sera utilisée uniquement après votre autorisation.</p>
      <div className="citizen-auth-steps"><span>1</span><p><strong>Décrivez</strong><small>le problème observé</small></p><span>2</span><p><strong>Localisez</strong><small>le point avec votre GPS</small></p><span>3</span><p><strong>Suivez</strong><small>le traitement du signalement</small></p></div>
    </section>
    <div className="citizen-auth-column">
      <form action={registerCitizen} className="citizen-auth-card">
        <div><small>ESPACE CITOYEN</small><h2>Créer mon compte</h2><p>Vos coordonnées permettent aux équipes de traitement de vous recontacter si nécessaire.</p></div>
        {error ? <div className="login-error" role="alert">{error}</div> : null}
        {success ? <div className="success-message" role="status">{success}</div> : null}
        <label>Nom et prénoms<input name="fullName" required minLength={2} maxLength={120} autoComplete="name" placeholder="Ex. Aya Kouamé" /></label>
        <label>Numéro de téléphone<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="Ex. 07 00 00 00 00" /></label>
        <label>Adresse électronique<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="vous@exemple.ci" /></label>
        <label>Mot de passe<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>12 caractères minimum</small></label>
        <label>Confirmer le mot de passe<input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
        <button className="citizen-primary">Créer mon compte citoyen</button>
        <p className="citizen-auth-login">Déjà inscrit ? <Link href="/login">Se connecter</Link></p>
      </form>
      <form className="citizen-resend" id="resend" action={resendCitizenConfirmation}>
        <h3>Le lien reçu ne fonctionne pas ?</h3>
        <p>Demandez un nouveau courriel de confirmation. Seul le lien le plus récent doit être utilisé.</p>
        {resendError ? <div className="login-error" role="alert">{resendError}</div> : null}
        {resendSuccess ? <div className="success-message" role="status">{resendSuccess}</div> : null}
        <label>Adresse électronique du compte<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="vous@exemple.ci" /></label>
        <button className="citizen-resend-button">Renvoyer l’e-mail de confirmation</button>
      </form>
    </div>
  </main>;
}
