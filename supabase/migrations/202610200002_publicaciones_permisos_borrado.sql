-- The author can delete their own posts; Supervisors and Heads can delete any post.
drop policy if exists notas_equipo_eliminar_propia_o_supervisor on public.notas_equipo;
drop policy if exists notas_equipo_eliminar_supervisor_jefe on public.notas_equipo;
create policy notas_equipo_eliminar_propia_o_supervisor on public.notas_equipo
for delete to authenticated
using (
  creado_por = (select auth.uid())
  or public.rol_efectivo() in ('SUPERVISOR', 'JEFE')
);