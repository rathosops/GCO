import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GCO V2</p>
          <h1>Central de chamadas</h1>
        </div>
        <Link className="button primary" href="/login">
          Entrar
        </Link>
      </header>

      <section className="route-grid" aria-label="Areas do sistema">
        <Link className="route-card" href="/painel">
          <span>Painel</span>
          <strong>TV de chamadas</strong>
        </Link>
        <Link className="route-card" href="/operador">
          <span>Operador</span>
          <strong>Atendimento e chamadas</strong>
        </Link>
        <Link className="route-card" href="/triagem">
          <span>Triagem</span>
          <strong>Conclusao de triagem</strong>
        </Link>
        <Link className="route-card" href="/admin">
          <span>Admin</span>
          <strong>Salas operacionais</strong>
        </Link>
      </section>
    </main>
  );
}
