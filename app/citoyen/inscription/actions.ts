"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { siteUrl } from "../../../lib/site-url";

type AuthFailure = {
  code?: string;
  message: string;
  status?: number;
};

type RegistrationMessage = "error" | "success" | "resendError" | "resendSuccess";

function redirectToRegistration(type: RegistrationMessage, message: string, anchor = ""): never {
  const search = new URLSearchParams({ [type]: message });
  redirect(`/citoyen/inscription?${search.toString()}${anchor}`);
}

function isEmailRateLimit(error: AuthFailure) {
  return error.status === 429
    || error.code === "over_email_send_rate_limit"
    || error.message.toLowerCase().includes("email rate limit");
}

function logAuthFailure(event: string, error: AuthFailure) {
  console.error(event, { code: error.code ?? "unknown", status: error.status ?? 500 });
}

function normalizeIvorianPhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^\+225\d{10}$/.test(compact)) return compact;
  if (/^225\d{10}$/.test(compact)) return `+${compact}`;
  if (/^0\d{9}$/.test(compact)) return `+225${compact}`;
  return null;
}

export async function registerCitizen(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = normalizeIvorianPhone(String(formData.get("phone") || ""));
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");

  if (fullName.length < 2 || fullName.length > 120) {
    redirectToRegistration("error", "Le nom complet est invalide");
  }
  if (!email || email.length > 254 || !email.includes("@")) {
    redirectToRegistration("error", "L’adresse électronique est invalide");
  }
  if (!phone) {
    redirectToRegistration("error", "Utilisez un numéro ivoirien à 10 chiffres");
  }
  if (password.length < 12 || password.length > 128) {
    redirectToRegistration("error", "Le mot de passe doit contenir au moins 12 caractères");
  }
  if (password !== confirmation) {
    redirectToRegistration("error", "Les deux mots de passe ne correspondent pas");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, contact_phone: phone },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/citoyen`,
    },
  });

  if (error) {
    logAuthFailure("citizen.signup", error);
    if (isEmailRateLimit(error)) {
      redirectToRegistration(
        "error",
        "Trop de courriels de confirmation ont été demandés. Patientez environ une heure, puis réessayez ou demandez un nouveau lien si le compte existe déjà.",
        "#resend",
      );
    }
    redirectToRegistration("error", "Création du compte impossible");
  }
  if (data.session) redirect("/citoyen");
  redirectToRegistration("success", "Consultez votre courriel pour confirmer le compte");
}

export async function resendCitizenConfirmation(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes("@")) {
    redirectToRegistration("resendError", "L’adresse électronique est invalide", "#resend");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/citoyen` },
  });
  if (error) {
    logAuthFailure("citizen.confirmation.resend", error);
    if (isEmailRateLimit(error)) {
      redirectToRegistration(
        "resendError",
        "Limite temporaire d’envoi atteinte. Patientez environ une heure avant de demander un nouveau lien.",
        "#resend",
      );
    }
    redirectToRegistration("resendError", "Le nouveau lien n’a pas pu être envoyé", "#resend");
  }
  redirectToRegistration("resendSuccess", "Un nouveau lien de confirmation vient d’être envoyé", "#resend");
}
