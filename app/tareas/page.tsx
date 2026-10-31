import { Suspense } from "react";
import { TareasView } from "@/components/tareas/tareas-view";

export default function TareasPage() {
  return <Suspense fallback={<div className="panel tasks-loading-panel">Cargando tareas…</div>}><TareasView /></Suspense>;
}
