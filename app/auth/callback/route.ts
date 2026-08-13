import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safePath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedPath = safePath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/auth/error", request.url));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/auth/error", request.url));

  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user?.id ?? "").maybeSingle();
  const destination = profile?.role === "citoyen" ? "/citoyen" : requestedPath || "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
