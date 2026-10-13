"use client";

import { useEffect } from "react";
import { NuevaCoordinacionForm, type NuevaCoordinacionDefaults } from "@/components/coordinaciones/nueva-coordinacion-form";

export function NuevaCoordinacionDialog({ fecha, coordinacionId, valoresIniciales, onClose, onGuardado }: { fecha: string; coordinacionId?: string; valoresIniciales?: NuevaCoordinacionDefaults; onClose: () => void; onGuardado?: (valores: NuevaCoordinacionDefaults) => void }) {
  useEffect(() => {
    function cerrarConEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel modal-card nueva-coordinacion-modal" role="dialog" aria-modal="true" aria-labelledby="nueva-coordinacion-dialog-title">
        <div className="modal-heading">
          <div><p className="eyebrow">Planificación del día</p><h2 id="nueva-coordinacion-dialog-title" className="modal-title">{coordinacionId ? "Editar coordinación" : "Cargar coordinación"}</h2></div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <NuevaCoordinacionForm fecha={fecha} coordinacionId={coordinacionId} valoresIniciales={valoresIniciales} onCancelar={onClose} onGuardado={(valores) => { onGuardado?.(valores); onClose(); }} />
      </section>
    </div>
  );
}
