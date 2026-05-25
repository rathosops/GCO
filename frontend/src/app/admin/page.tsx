"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  ApiError,
  createRoom,
  getTenantProfile,
  listRooms,
  updateTenantProfile,
} from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import type { Room, RoomKind, TenantProfile } from "@/types/api";

const emptyTenant: Omit<TenantProfile, "id"> = {
  trade_name: "",
  legal_name: null,
  document: null,
  email: null,
  phone: null,
  address_line: null,
  city: null,
  state: null,
  postal_code: null,
  logo_url: null,
  primary_color: null,
  timezone: "America/Sao_Paulo",
  is_active: true,
};

export default function AdminPage() {
  const { session, isLoading, signOut } = useSessionGuard({
    permission: "tenant.manage",
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenant, setTenant] = useState<Omit<TenantProfile, "id">>(emptyTenant);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<RoomKind>("office");
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session) {
      return;
    }

    const [nextRooms, nextTenant] = await Promise.all([
      listRooms(session.token),
      getTenantProfile(),
    ]);
    setRooms(nextRooms);
    setTenant({
      trade_name: nextTenant.trade_name,
      legal_name: nextTenant.legal_name,
      document: nextTenant.document,
      email: nextTenant.email,
      phone: nextTenant.phone,
      address_line: nextTenant.address_line,
      city: nextTenant.city,
      state: nextTenant.state,
      postal_code: nextTenant.postal_code,
      logo_url: nextTenant.logo_url,
      primary_color: nextTenant.primary_color,
      timezone: nextTenant.timezone,
      is_active: nextTenant.is_active,
    });
  }, [session]);

  useEffect(() => {
    loadData().catch((caught) => {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao carregar salas";
      setMessage(text);
    });
  }, [loadData]);

  async function handleTenantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    try {
      const nextTenant = await updateTenantProfile(session.token, tenant);
      setTenant({
        trade_name: nextTenant.trade_name,
        legal_name: nextTenant.legal_name,
        document: nextTenant.document,
        email: nextTenant.email,
        phone: nextTenant.phone,
        address_line: nextTenant.address_line,
        city: nextTenant.city,
        state: nextTenant.state,
        postal_code: nextTenant.postal_code,
        logo_url: nextTenant.logo_url,
        primary_color: nextTenant.primary_color,
        timezone: nextTenant.timezone,
        is_active: nextTenant.is_active,
      });
      setMessage("Perfil da clinica atualizado");
    } catch (caught) {
      const text =
        caught instanceof ApiError
          ? caught.message
          : "Falha ao atualizar perfil da clinica";
      setMessage(text);
    }
  }

  async function handleRoomSubmit(event: FormEvent<HTMLFormElement>) {
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
          <h1>Configuracoes</h1>
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
        <form className="panel form-stack" onSubmit={handleTenantSubmit}>
          <h2>Perfil da clinica</h2>
          <label>
            Nome comercial
            <input
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  trade_name: event.target.value,
                }))
              }
              required
              value={tenant.trade_name}
            />
          </label>
          <label>
            Razao social
            <input
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  legal_name: event.target.value || null,
                }))
              }
              value={tenant.legal_name ?? ""}
            />
          </label>
          <label>
            CNPJ
            <input
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  document: event.target.value || null,
                }))
              }
              value={tenant.document ?? ""}
            />
          </label>
          <label>
            Email
            <input
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  email: event.target.value || null,
                }))
              }
              value={tenant.email ?? ""}
            />
          </label>
          <label>
            Telefone
            <input
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  phone: event.target.value || null,
                }))
              }
              value={tenant.phone ?? ""}
            />
          </label>
          <label>
            Cidade
            <input
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  city: event.target.value || null,
                }))
              }
              value={tenant.city ?? ""}
            />
          </label>
          <label>
            UF
            <input
              maxLength={2}
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  state: event.target.value || null,
                }))
              }
              value={tenant.state ?? ""}
            />
          </label>
          <label>
            Cor principal
            <input
              onChange={(event) =>
                setTenant((current) => ({
                  ...current,
                  primary_color: event.target.value || null,
                }))
              }
              placeholder="#0f766e"
              value={tenant.primary_color ?? ""}
            />
          </label>
          <button className="button primary">Salvar perfil</button>
        </form>

        <form className="panel form-stack" onSubmit={handleRoomSubmit}>
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
      </section>

      <section className="workspace">
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
