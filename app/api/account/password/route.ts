import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });

  let body: { currentPassword?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!currentPassword || !auth.user.email) {
    return NextResponse.json({ error: "Le mot de passe actuel est requis" }, { status: 400 });
  }
  if (password.length < 12 || password.length > 128) {
    return NextResponse.json({ error: "Le mot de passe doit contenir entre 12 et 128 caractères" }, { status: 400 });
  }
  const { error: verificationError } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: currentPassword,
  });
  if (verificationError) {
    return NextResponse.json({ error: "Le mot de passe actuel est incorrect" }, { status: 403 });
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("account.password", error.message);
    return NextResponse.json({ error: "Modification du mot de passe impossible" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
