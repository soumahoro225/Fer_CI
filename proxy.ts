import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./lib/supabase/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(items, headers) {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
    },
  }});
  const { data } = await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  const isApi = path.startsWith("/api/");
  const isPublic = isLogin
    || path.startsWith("/citoyen/inscription")
    || path.startsWith("/auth/callback")
    || path.startsWith("/auth/confirm")
    || path.startsWith("/auth/error");
  if (isApi) return response;
  if (!data?.claims && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (path.startsWith("/citoyen")) loginUrl.searchParams.set("next", "/citoyen");
    return redirectWithSession(loginUrl, response);
  }
  if (data?.claims && (isLogin || path.startsWith("/citoyen/inscription"))) {
    return redirectWithSession(new URL("/", request.url), response);
  }
  return response;
}

function redirectWithSession(url: URL, sessionResponse: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const name of ["set-cookie", "cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
