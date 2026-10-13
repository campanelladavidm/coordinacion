import { PageHeading } from "@/components/ui/page-heading";

const DASHBOARD_URL = "http://172.16.210.32/public/dashboard/542d5440-9ef3-433f-bc04-0cb99bc99d80?tab=540-general-instalaciones";

export default function PanelesPage() {
  return (
    <section className="metabase-page">
      <PageHeading
        eyebrow="Indicadores"
        title="Paneles"
        description="Dashboards de instalaciones en tiempo real."
      />
      <div className="metabase-frame-wrap" style={{ width: "100%", minHeight: "70vh", overflow: "hidden", border: "1px solid #263f59", borderRadius: 12, background: "#fff" }}>
        <iframe
          className="metabase-frame"
          src={DASHBOARD_URL}
          title="Dashboard general de instalaciones"
          loading="eager"
          referrerPolicy="no-referrer"
          allowFullScreen
          style={{ display: "block", width: "100%", height: "78vh", minHeight: 620, maxHeight: 1100, border: 0, background: "#fff" }}
        />
      </div>
      <p className="metabase-network-note">Para ver este panel, tu dispositivo tiene que estar conectado al Wi-Fi de la empresa o a su VPN.</p>
    </section>
  );
}
