import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

type AuthCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Solicitud de acceso no válida." }, { status: 403 });
  }

  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ error: "Completá el correo y la contraseña." }, { status: 400 });
  }

  const email = typeof credentials.email === "string" ? credentials.email.trim() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Completá el correo y la contraseña." }, { status: 400 });
  }

  const { url, anonKey } = getSupabasePublicEnv();
  const cookiesToSet = new Map<string, AuthCookie>();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          cookiesToSet.set(cookie.name, cookie);
        });
      },
    },
  });

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    const response = error
      ? NextResponse.json({ error: error.message }, { status: 401 })
      : NextResponse.json({ ok: true });
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el servicio de acceso." }, { status: 503 });
  }
}
