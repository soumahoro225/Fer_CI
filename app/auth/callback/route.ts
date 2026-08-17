import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safePath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedPath = safePath(request.nextUrl.searchParams.get("next"));
  if (!code) {
    console.warn("auth.callback.missing_code", { path: request.nextUrl.pathname });
    return NextResponse.redirect(new URL("/auth/error", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth.callback.exchange_failed", { code: error.code, status: error.status });
    return NextResponse.redirect(new URL("/auth/error", request.url));
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user?.id ?? "").maybeSingle();
  const destination = profile?.role === "citoyen" ? "/citoyen" : requestedPath || "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
