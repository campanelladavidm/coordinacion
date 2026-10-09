import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeading } from "@/components/ui/page-heading";

export default function HomePage() {
  return (
    <section className="calendar-page">
      <PageHeading eyebrow="Planificación diaria" title="Calendario de coordinaciones" description="Seleccioná una fecha para consultar y organizar el trabajo del día." />
      <CalendarView />
    </section>
  );
}
