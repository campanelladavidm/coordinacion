"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";

type MenuIcon = "calendar" | "list" | "settings" | "users" | "chart" | "notes";

const links: { href: string; label: string; icon: MenuIcon }[] = [
  { href: "/", label: "Calendario", icon: "calendar" },
  { href: "/coordinaciones", label: "Hoy", icon: "list" },
  { href: "/paneles", label: "Dash", icon: "chart" },
  { href: "/novedades", label: "Novedades", icon: "notes" },
  { href: "/configuraciones", label: "Configuraciones", icon: "settings" },
  { href: "/usuarios", label: "Usuarios", icon: "users" },
];

function Icon({ name }: { name: MenuIcon }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  if (name === "calendar") return <svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M16 3v4M8 3v4M3.5 10h17" /></svg>;
  if (name === "list") return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M8 8h8M8 12h8M8 16h5M8 2v3M16 2v3" /></svg>;
  if (name === "notes") return <svg {...common}><path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14.5 3.5V8H19M8 12h8M8 16h8" /></svg>;
  if (name === "chart") return <svg {...common}><path d="M4 19.5h16" /><rect x="5" y="11" width="3.5" height="6.5" rx=".8" /><rect x="10.25" y="7.5" width="3.5" height="10" rx=".8" /><rect x="15.5" y="4" width="3.5" height="13.5" rx=".8" /></svg>;
  if (name === "settings") return <svg {...common}><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" /><path d="m19.3 13.5 1.1.9-1.5 2.6-1.4-.5a7.7 7.7 0 0 1-1.7 1l-.2 1.5h-3l-.3-1.5a7.7 7.7 0 0 1-1.7-1l-1.4.5-1.5-2.6 1.1-.9a6.8 6.8 0 0 1 0-2l-1.1-.9 1.5-2.6 1.4.5a7.7 7.7 0 0 1 1.7-1l.3-1.5h3l.2 1.5a7.7 7.7 0 0 1 1.7 1l1.4-.5 1.5 2.6-1.1.9a6.8 6.8 0 0 1 0 2Z" /></svg>;
  return <svg {...common}><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-1.5a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6" /></svg>;
}

function todayInArgentina() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function NavLinks() {
  const pathname = usePathname();
  const [openAtPath, setOpenAtPath] = useState<string | null>(null);
  const mobileOpen = openAtPath === pathname;
  const { rolDemo } = useCoordinacionesDemo();
  const dateFromRoute = pathname.match(/^\/coordinaciones\/(\d{4}-\d{2}-\d{2})/)?.[1];
  const coordinationHref = `/coordinaciones/${dateFromRoute ?? todayInArgentina()}`;
  const visibles = links.filter((link) => {
    if (link.href === "/configuraciones") return rolDemo === "SUPERVISOR" || rolDemo === "JEFE";
    if (link.href === "/usuarios") return rolDemo === "JEFE";
    return true;
  });

  return (
    <>
    <button type="button" className="mobile-menu-toggle" aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setOpenAtPath(mobileOpen ? null : pathname)}>
      <span className="mobile-menu-toggle-icon" aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
      <span>Menú</span>
    </button>
    <nav id="primary-navigation" className={`nav-list${mobileOpen ? " is-open" : ""}`} aria-label="Navegación principal">
      {visibles.map((link) => {
        const href = link.href === "/coordinaciones" ? coordinationHref : link.href;
        const isActive = link.href === "/"
          ? pathname === "/"
          : link.href === "/coordinaciones"
            ? pathname.startsWith("/coordinaciones/")
            : pathname.startsWith(link.href);
        return (
          <Link key={link.href} className={`nav-link${isActive ? " active" : ""}`} href={href} aria-current={isActive ? "page" : undefined} onClick={() => setOpenAtPath(null)}>
            <span className="nav-icon"><Icon name={link.icon} /></span>
            <span className="nav-text">{link.label}</span>
          </Link>
        );
      })}
    </nav>
    </>
  );
}
