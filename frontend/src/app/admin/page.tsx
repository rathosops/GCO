"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { ApiError, createRoom, listRooms } from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import type { Room, RoomKind } from "@/types/api";

export default function AdminPage() {
  const { session, isLoading, signOut } = useSessionGuard();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<RoomKind>("office");
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setRooms(await listRooms());
  }, []);

  useEffect(() => {
    loadData().catch((caught) => {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao carregar salas";
      setMessage(text);
    });
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    try {
      await createRoom(session.token, {
        code,
        name,
        display_name: displayName,
        kind,
        is_active: true,
        sort_order: rooms.length + 1,
      });
      setCode("");
      setName("");
      setDisplayName("");
      setKind("office");
      setMessage("Sala criada");
      await loadData();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao criar sala";
      setMessage(text);
    }
  }

  if (isLoading || !session) {
    return <main className="app-shell">Carregando</main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Administracao</p>
          <h1>Salas</h1>
          <p className="meta">{session.user.display_name}</p>
        </div>
        <nav className="actions">
          <Link className="button" href="/operador">
            Operador
          </Link>
          <button className="button" onClick={signOut}>
            Sair
          </button>
        </nav>
      </header>

      {message ? <p className="alert">{message}</p> : null}

      <section className="workspace two-columns">
        <form className="panel form-stack" onSubmit={handleSubmit}>
          <h2>Nova sala</h2>
          <label>
            Codigo
            <input onChange={(event) => setCode(event.target.value)} required value={code} />
          </label>
          <label>
            Nome interno
            <input onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label>
            Nome no painel
            <input
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
          <label>
            Tipo
            <select onChange={(event) => setKind(event.target.value as RoomKind)} value={kind}>
              <option value="office">Consultorio</option>
              <option value="triage">Triagem</option>
              <option value="reception">Recepcao</option>
            </select>
          </label>
          <button className="button primary">Criar sala</button>
        </form>

        <section className="panel">
          <div className="section-head">
            <h2>Salas cadastradas</h2>
            <button className="button" onClick={loadData}>
              Atualizar
            </button>
          </div>
          <div className="list">
            {rooms.map((room) => (
              <article className="item" key={room.id}>
                <div>
                  <strong>{room.display_name}</strong>
                  <span>
                    {room.code} / {room.kind} / {room.is_active ? "ativa" : "inativa"}
                  </span>
                </div>
              </article>
            ))}
            {rooms.length === 0 ? <p className="empty">Sem salas</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
