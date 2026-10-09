import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Actor = { id: string };

async function autorizarJefe(): Promise<{ actor: Actor } | { response: NextResponse }> {
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }) };
  const { data: rol, error: rolError } = await sessionClient.rpc("mi_rol");
  if (rolError) return { response: NextResponse.json({ error: "No se pudo validar tu rol." }, { status: 503 }) };
  if (rol !== "JEFE") return { response: NextResponse.json({ error: "Solo un Jefe puede administrar usuarios." }, { status: 403 }) };
  return { actor: { id: user.id } };
}

function origenPermitido(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === request.nextUrl.origin;
}

function errorServidor(error: unknown) {
  const mensaje = error instanceof Error ? error.message : "Ocurrió un error al administrar usuarios.";
  const status = mensaje.includes("Falta SUPABASE_SECRET_KEY") ? 503 : 500;
  return NextResponse.json({ error: mensaje }, { status });
}

export async function GET() {
  const auth = await autorizarJefe();
  if ("response" in auth) return auth.response;

  try {
    const admin = createAdminClient();
    const [perfiles, roles] = await Promise.all([
      admin.from("usuarios").select("id,nombre_completo,rol_id,activo,created_at").order("created_at"),
      admin.from("roles").select("id,codigo,nombre").order("nombre"),
    ]);
    if (perfiles.error) throw perfiles.error;
    if (roles.error) throw roles.error;

    const authUsuarios = [];
    for (let page = 1; ; page += 1) {
      const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (result.error) throw result.error;
      authUsuarios.push(...result.data.users);
      if (result.data.users.length < 1000) break;
    }

    const perfilPorId = new Map((perfiles.data ?? []).map((perfil) => [perfil.id, perfil]));
    const rolPorId = new Map((roles.data ?? []).map((rol) => [rol.id, rol]));
    const usuarios = authUsuarios.map((usuario) => {
      const perfil = perfilPorId.get(usuario.id);
      const rol = perfil ? rolPorId.get(perfil.rol_id) : undefined;
      return {
        id: usuario.id,
        email: usuario.email ?? "Sin correo",
        nombre: perfil?.nombre_completo ?? String(usuario.user_metadata?.nombre_completo ?? ""),
        rolId: perfil?.rol_id ?? "",
        rol: rol?.nombre ?? "Sin perfil",
        activo: perfil?.activo ?? false,
        confirmado: Boolean(usuario.email_confirmed_at),
        createdAt: usuario.created_at,
        lastSignInAt: usuario.last_sign_in_at,
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.email.localeCompare(b.email, "es"));

    return NextResponse.json({ usuarios, roles: roles.data ?? [] });
  } catch (error) {
    return errorServidor(error);
  }
}

export async function POST(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await autorizarJefe();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json() as { email?: unknown; nombre?: unknown; rolId?: unknown; modo?: unknown; contrasena?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const rolId = typeof body.rolId === "string" ? body.rolId : "";
    const modo = body.modo === "DIRECTO" ? "DIRECTO" : "INVITAR";
    const contrasena = typeof body.contrasena === "string" ? body.contrasena : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Ingresá un correo electrónico válido." }, { status: 400 });
    if (!nombre || nombre.length > 100) return NextResponse.json({ error: "Ingresá un nombre de hasta 100 caracteres." }, { status: 400 });
    if (modo === "DIRECTO" && (contrasena.length < 12 || new TextEncoder().encode(contrasena).length > 72)) {
      return NextResponse.json({ error: "La contraseña inicial debe tener entre 12 y 72 bytes." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: rol, error: rolError } = await admin.from("roles").select("id,codigo").eq("id", rolId).single();
    if (rolError || !rol) return NextResponse.json({ error: "Seleccioná un rol válido." }, { status: 400 });

    let usuarioId: string;
    if (modo === "DIRECTO") {
      const { data: creado, error: createError } = await admin.auth.admin.createUser({
        email,
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombre_completo: nombre },
      });
      if (createError) throw createError;
      if (!creado.user) throw new Error("Supabase no devolvió el usuario creado.");
      usuarioId = creado.user.id;
    } else {
      const redirectTo = new URL("/cuenta/establecer-contrasena", request.url).toString();
      const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nombre_completo: nombre },
        redirectTo,
      });
      if (inviteError) throw inviteError;
      if (!invitation.user) throw new Error("Supabase no devolvió el usuario invitado.");
      usuarioId = invitation.user.id;
    }

    const { error: perfilError } = await admin.from("usuarios").upsert({
      id: usuarioId,
      nombre_completo: nombre,
      rol_id: rol.id,
      activo: true,
    }, { onConflict: "id" });
    if (perfilError) {
      if (modo === "DIRECTO") await admin.auth.admin.deleteUser(usuarioId);
      throw perfilError;
    }

    return NextResponse.json({ ok: true, mensaje: modo === "DIRECTO" ? `Cuenta creada para ${email}.` : `Invitación enviada a ${email}.` }, { status: 201 });
  } catch (error) {
    return errorServidor(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await autorizarJefe();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json() as { id?: unknown; nombre?: unknown; rolId?: unknown; activo?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "El usuario seleccionado no es válido." }, { status: 400 });
    }
    if (id === auth.actor.id && (body.activo === false || typeof body.rolId === "string")) {
      return NextResponse.json({ error: "No podés desactivar ni cambiar tu propio rol." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: actual, error: actualError } = await admin.from("usuarios").select("id,nombre_completo,rol_id,activo").eq("id", id).single();
    if (actualError || !actual) return NextResponse.json({ error: "No encontramos el perfil de ese usuario." }, { status: 404 });
    const cambios: { nombre_completo?: string; rol_id?: string; activo?: boolean } = {};
    if (typeof body.nombre === "string") {
      const nombre = body.nombre.trim();
      if (!nombre || nombre.length > 100) return NextResponse.json({ error: "El nombre debe tener entre 1 y 100 caracteres." }, { status: 400 });
      cambios.nombre_completo = nombre;
    }
    if (typeof body.rolId === "string") {
      const { data: rol, error: rolError } = await admin.from("roles").select("id").eq("id", body.rolId).maybeSingle();
      if (rolError || !rol) return NextResponse.json({ error: "Seleccioná un rol válido." }, { status: 400 });
      cambios.rol_id = rol.id;
    }
    if (typeof body.activo === "boolean") cambios.activo = body.activo;
    if (Object.keys(cambios).length === 0) return NextResponse.json({ error: "No hay cambios para guardar." }, { status: 400 });

    const roles = await admin.from("roles").select("id,codigo");
    if (roles.error) throw roles.error;
    const codigoRolActual = roles.data.find((rol) => rol.id === actual.rol_id)?.codigo;
    const codigoRolNuevo = cambios.rol_id ? roles.data.find((rol) => rol.id === cambios.rol_id)?.codigo : codigoRolActual;
    const quitaJefeActivo = actual.activo && codigoRolActual === "JEFE" && (cambios.activo === false || codigoRolNuevo !== "JEFE");
    if (quitaJefeActivo) {
      const jefeId = roles.data.find((rol) => rol.codigo === "JEFE")?.id;
      const jefes = jefeId ? await admin.from("usuarios").select("id").eq("rol_id", jefeId).eq("activo", true) : null;
      if (jefes?.error) throw jefes.error;
      if ((jefes?.data.length ?? 0) <= 1) return NextResponse.json({ error: "No se puede dejar el sistema sin un usuario Jefe activo." }, { status: 400 });
    }

    const { error: updateError } = await admin.from("usuarios").update(cambios).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorServidor(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!origenPermitido(request)) return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  const auth = await autorizarJefe();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "El usuario seleccionado no es válido." }, { status: 400 });
    }
    if (id === auth.actor.id) return NextResponse.json({ error: "No podés eliminar tu propia cuenta." }, { status: 400 });

    const admin = createAdminClient();
    const [{ data: perfil, error: perfilError }, { data: roles, error: rolesError }] = await Promise.all([
      admin.from("usuarios").select("id,rol_id,activo").eq("id", id).single(),
      admin.from("roles").select("id,codigo"),
    ]);
    if (perfilError || !perfil) return NextResponse.json({ error: "No encontramos el perfil de ese usuario." }, { status: 404 });
    if (rolesError) throw rolesError;
    const rolJefeId = roles.find((rol) => rol.codigo === "JEFE")?.id;
    if (perfil.activo && perfil.rol_id === rolJefeId) {
      const jefes = rolJefeId ? await admin.from("usuarios").select("id").eq("rol_id", rolJefeId).eq("activo", true) : null;
      if (jefes?.error) throw jefes.error;
      if ((jefes?.data.length ?? 0) <= 1) return NextResponse.json({ error: "No se puede eliminar al último usuario Jefe activo." }, { status: 400 });
    }
    const notas = await admin.from("notas_equipo").select("id", { count: "exact", head: true }).eq("creado_por", id);
    if (notas.error) throw notas.error;
    if ((notas.count ?? 0) > 0) return NextResponse.json({ error: "Este usuario tiene notas del equipo asociadas. Desactivá la cuenta para conservar el historial." }, { status: 409 });

    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorServidor(error);
  }
}
