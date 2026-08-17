"use server";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export async function login(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim().toLocaleLowerCase("fr");
  const email = identifier.includes("@") ? identifier : `${identifier}@geosignale.ci`;
  const password = String(formData.get("password") || "");
  if (!identifier || !password) redirect("/login?error=Champs%20requis");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=Identifiants%20invalides");
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user?.id ?? "").maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=Compte%20non%20autorisé");
  }
  if (profile.role === "citoyen") redirect("/citoyen");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
