# Coordinaciones WN

Aplicación interna en español para gestionar la coordinación diaria del área de instalaciones. Usa Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase Auth y PostgreSQL.

## Desarrollo local

```bash
npm install
npm run dev
```

La aplicación requiere un proyecto Supabase configurado. Copiá `.env.example` como `.env.local`, cargá la URL del proyecto y su clave pública (publishable key; la clave `anon` existente también es compatible) y reiniciá el servidor de desarrollo.

## Preparar Supabase

En un proyecto Supabase nuevo, abrí **SQL Editor** y ejecutá en este orden:

1. `supabase/migrations/202610070001_initial_schema.sql`
2. `supabase/migrations/202610080002_shared_catalogs_notes_holidays.sql`
3. `supabase/migrations/202610090001_orden_coordinaciones.sql`
4. `supabase/migrations/202610090002_ubicacion_coordinaciones.sql`
5. `supabase/migrations/202610120001_rangos_cuadrillas.sql`

Si la base ya estaba instalada antes del mÃ³dulo Rango, ejecutÃ¡ solamente `202610120001_rangos_cuadrillas.sql` una vez desde SQL Editor.

Las migraciones crean el esquema relacional, catálogos iniciales, zonas y cuadrillas conocidas, perfiles, políticas RLS, notas del equipo y feriados con asignaciones de personal. La segunda migración conserva los datos anteriores y añade el horario de retiro de custodias como texto libre.

Después, creá las cuentas internas en **Authentication → Users**. El trigger crea un perfil Coordinador para cada cuenta nueva. Para asignar el primer rol Jefe, ejecutá desde SQL Editor —reemplazando el correo—:

```sql
update public.usuarios as u
set rol_id = r.id
from public.roles as r
where r.codigo = 'JEFE'
  and u.id = (select id from auth.users where email = 'TU_CORREO_INTERNO');
```

Los roles posteriores se administran desde la aplicación. Las operaciones de datos están sujetas a las políticas RLS de Supabase.

## Administración de usuarios

La sección **Usuarios** permite invitar por correo, cambiar el nombre y el rol, y activar o desactivar cuentas. Para estas operaciones del lado servidor, agregá una clave secreta de Supabase a `.env.local`:

```env
SUPABASE_SECRET_KEY=sb_secret_...
```

Obtenela desde las claves API del proyecto. No uses el prefijo `NEXT_PUBLIC_` para esta variable ni la compartas o la subas al repositorio. Reiniciá `npm run dev` después de guardarla. En Vercel, cargá la misma variable como secreto de entorno del servidor.

En **Authentication → URL Configuration**, permití la URL local `http://localhost:3000/cuenta/establecer-contrasena` para que el enlace de invitación permita definir una contraseña. Agregá también la URL equivalente del dominio de producción. Configurá el servicio SMTP de Auth para entregar invitaciones al equipo.

La desactivación conserva las coordinaciones y notas históricas asociadas a la cuenta. Solo un Jefe activo puede cambiar permisos de usuarios; la API valida el rol en cada operación.

### Limpieza automatica de coordinaciones

Para una base ya configurada, ejecuta una sola vez `supabase/migrations/202610150001_limpieza_diaria_coordinaciones.sql` desde **SQL Editor**. Esto activa `pg_cron` y programa la limpieza diaria a las 03:00 de Argentina. Conserva las coordinaciones de hoy y de los 7 dias anteriores; elimina las mas antiguas y sus extras asociados. No elimina rangos, custodias ni otros datos.

Puedes verificar las ejecuciones en **Integrations > Cron > Jobs/History**. La tarea usa la fecha de `America/Argentina/Buenos_Aires` para calcular el corte.

### Uso de base de datos en Dash

Para una base ya configurada, ejecuta una sola vez `supabase/migrations/202610150002_uso_base_datos_jefe.sql` desde **SQL Editor**. En la pestana **Dash**, Jefe vera el tamano actual y una barra de uso antes del tablero de Metabase. El porcentaje usa 500 MB como referencia del plan Free; configura `SUPABASE_DATABASE_SIZE_LIMIT_MB` en local y en Vercel si necesitas otro limite. La consulta se ejecuta al cargar la pagina y la funcion SQL restringe el acceso al rol Jefe.

## Estructura

- `app/`: rutas App Router: calendario, coordinaciones, configuraciones, usuarios y acceso.
- `components/`: shell, navegación, calendario, formularios y vistas reutilizables.
- `lib/supabase/`: clientes de navegador/servidor y renovación de sesión mediante `proxy.ts`.
- `supabase/migrations/`: esquema PostgreSQL, catálogos y políticas RLS.
- `types/database.ts`: tipos del esquema consumidos por el cliente Supabase.
