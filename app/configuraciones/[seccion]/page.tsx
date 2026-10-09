import { Suspense } from "react";
import Link from "next/link";
import { CatalogManager } from "@/components/configuraciones/catalog-manager";
import { PageHeading } from "@/components/ui/page-heading";
import type { CatalogoKey } from "@/components/providers/demo-data-provider";

const catalogos: Record<CatalogoKey, { nombre: string; descripcion: string }> = {
  tercerizadas: { nombre: "Tercerizadas", descripcion: "Administrá las empresas prestadoras y sus cuadrillas." },
  cuadrillas: { nombre: "Cuadrillas", descripcion: "Organizá las cuadrillas por empresa tercerizada." },
  tecnologias: { nombre: "Tecnologías", descripcion: "Opciones de tecnología para cada coordinación." },
  categorias: { nombre: "Categorías", descripcion: "Tipos de trabajo disponibles para las coordinaciones." },
  horarios: { nombre: "Horarios", descripcion: "Franjas horarias que se pueden asignar a un caso." },
  zonas: { nombre: "Zonas", descripcion: "Zonas disponibles para clasificar y organizar las coordinaciones." },
  estados: { nombre: "Estados", descripcion: "Estados posibles de una coordinación." },
  extras: { nombre: "Extras", descripcion: "Atributos complementarios de una coordinación." },
};

type PageParams = { seccion: string };

export default function CatalogoPage({ params }: { params: Promise<PageParams> }) {
  return <Suspense fallback={null}><CatalogoContenido params={params} /></Suspense>;
}

async function CatalogoContenido({ params }: { params: Promise<PageParams> }) {
  const { seccion } = await params;
  const catalogo = catalogos[seccion as CatalogoKey];
  if (!catalogo) return <section><Link href="/configuraciones" className="back-link">← Volver a configuraciones</Link><PageHeading eyebrow="Configuración" title="Catálogo no encontrado" description="Elegí un catálogo disponible en Configuraciones." /></section>;

  return (
    <section>
      <Link href="/configuraciones" className="back-link">← Volver a configuraciones</Link>
      <PageHeading eyebrow="Catálogo" title={catalogo.nombre} description={catalogo.descripcion} />
      <CatalogManager tipo={seccion as CatalogoKey} />
    </section>
  );
}
