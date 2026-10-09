"use client";

import Link from "next/link";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";
import { PageHeading } from "@/components/ui/page-heading";

const catalogs = [
  { slug: "tercerizadas", name: "Tercerizadas", quantity: "tercerizadas", label: "tercerizadas cargadas" },
  { slug: "cuadrillas", name: "Cuadrillas", quantity: "cuadrillas", label: "cuadrillas cargadas" },
  { slug: "tecnologias", name: "Tecnologías", quantity: "tecnologias", label: "tecnologías cargadas" },
  { slug: "categorias", name: "Categorías", quantity: "categorias", label: "categorías cargadas" },
  { slug: "horarios", name: "Horarios", quantity: "horarios", label: "horarios cargados" },
  { slug: "zonas", name: "Zonas", quantity: "zonas", label: "zonas cargadas" },
  { slug: "estados", name: "Estados", quantity: "estados", label: "estados cargados" },
  { slug: "extras", name: "Extras", quantity: "extras", label: "extras cargados" },
  { slug: "feriados", name: "Feriados y personal interno", label: "Días feriados y equipos internos asignados" },
] as const;

export default function ConfiguracionesPage() {
  const { catalogos } = useCoordinacionesDemo();
  return (
    <section>
      <PageHeading eyebrow="Administración" title="Configuraciones" description="Catálogos que se utilizarán al cargar y organizar coordinaciones." />
      <div className="catalog-grid">
        {catalogs.map((catalog) => {
          const cantidad = "quantity" in catalog ? catalogos[catalog.quantity].length : null;
          const detalle = cantidad === null ? catalog.label : `${cantidad} ${catalog.label}`;
          return (
            <Link key={catalog.slug} className="catalog-link" href={`/configuraciones/${catalog.slug}`}>
              <span>
                <strong>{catalog.name}</strong>
                <span className="block pt-1 text-xs text-slate-400">{detalle}</span>
              </span>
              <span className="catalog-arrow" aria-hidden="true">→</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
