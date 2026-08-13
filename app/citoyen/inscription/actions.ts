"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { siteUrl } from "../../../lib/site-url";

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
    redirect("/citoyen/inscription?error=Le%20nom%20complet%20est%20invalide");
  }
  if (!email || email.length > 254 || !email.includes("@")) {
    redirect("/citoyen/inscription?error=L’adresse%20électronique%20est%20invalide");
  }
  if (!phone) {
    redirect("/citoyen/inscription?error=Utilisez%20un%20numéro%20ivoirien%20à%2010%20chiffres");
  }
  if (password.length < 12 || password.length > 128) {
    redirect("/citoyen/inscription?error=Le%20mot%20de%20passe%20doit%20contenir%20au%20moins%2012%20caractères");
  }
  if (password !== confirmation) {
    redirect("/citoyen/inscription?error=Les%20deux%20mots%20de%20passe%20ne%20correspondent%20pas");
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
    console.error("citizen.signup", error.message);
    redirect("/citoyen/inscription?error=Création%20du%20compte%20impossible");
  }
  if (data.session) redirect("/citoyen");
  redirect("/citoyen/inscription?success=Consultez%20votre%20courriel%20pour%20confirmer%20le%20compte");
}
