import Link from "next/link";

import { navItems } from "@/lib/navigation";
import { tenantConfig } from "@/lib/tenant";

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{tenantConfig.appName}</p>
          <h1>Central de chamadas</h1>
        </div>
        <Link className="button primary" href="/login">
          Entrar
        </Link>
      </header>

      <section className="route-grid" aria-label="Areas do sistema">
        {navItems.map((item) => (
          <Link className="route-card" href={item.href} key={item.href}>
            <span>{item.label}</span>
            <strong>{item.isPublic ? "TV de chamadas" : "Area operacional"}</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
