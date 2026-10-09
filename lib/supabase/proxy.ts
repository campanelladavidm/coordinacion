import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const esLogin = request.nextUrl.pathname === "/login";
  const esRutaAuth = request.nextUrl.pathname.startsWith("/auth/");
  const esRutaApi = request.nextUrl.pathname.startsWith("/api/");
  const esEstablecerContrasena = request.nextUrl.pathname === "/cuenta/establecer-contrasena";

  if (!claims && !esLogin && !esRutaAuth && !esRutaApi && !esEstablecerContrasena) return NextResponse.redirect(new URL("/login", request.url));
  if (claims && esLogin) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

