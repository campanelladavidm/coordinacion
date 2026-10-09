import { NuevaCoordinacionForm } from "@/components/coordinaciones/nueva-coordinacion-form";

export default async function EditarCoordinacionPage({ params }: { params: Promise<{ fecha: string; id: string }> }) {
  const { fecha, id } = await params;
  return <NuevaCoordinacionForm fecha={fecha} coordinacionId={id} />;
}
