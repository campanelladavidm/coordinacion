"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCoordinacionesDemo } from "@/components/providers/demo-data-provider";

const links = [
  { href: "/", label: "Calendario", icon: "▦" },
  { href: "/configuraciones", label: "Configuraciones", icon: "⚙" },
  { href: "/usuarios", label: "Usuarios", icon: "♙" },
];

export function NavLinks() {
  const pathname = usePathname();
  const { rolDemo } = useCoordinacionesDemo();
  const visibles = links.filter((link) => {
    if (link.href === "/configuraciones") return rolDemo === "SUPERVISOR" || rolDemo === "JEFE";
    if (link.href === "/usuarios") return rolDemo === "JEFE";
    return true;
  });

  return (
    <nav className="nav-list" aria-label="Navegación principal">
      {visibles.map((link) => {
        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return <Link key={link.href} className={`nav-link${isActive ? " active" : ""}`} href={link.href}><span className="nav-icon" aria-hidden="true">{link.icon}</span><span className="nav-text">{link.label}</span></Link>;
      })}
    </nav>
  );
}
