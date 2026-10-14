"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const client = createBrowserClient<Database>(url, anonKey);
  const restClient = (client as unknown as { rest: { headers: Headers } }).rest;
  const contextId = typeof window === "undefined" ? null : window.sessionStorage.getItem("coordi-usuario-contexto");
  if (contextId) restClient.headers.set("x-user-context", contextId);
  else restClient.headers.delete("x-user-context");
  return client;
}


