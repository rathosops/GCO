"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ApiError, completeTriage, listAppointments } from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import type { Appointment } from "@/types/api";

export default function TriagemPage() {
  const { session, isLoading, signOut } = useSessionGuard();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const triageQueue = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.requires_triage &&
          ["waiting", "called", "in_service"].includes(appointment.status),
      ),
    [appointments],
  );

  const selectedAppointment = triageQueue.find(
    (appointment) => appointment.id === selectedId,
  );

  const loadData = useCallback(async () => {
    if (!session) {
      return;
    }

    setAppointments(await listAppointments(session.token));
  }, [session]);

  useEffect(() => {
    loadData().catch((caught) => {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao carregar triagem";
      setMessage(text);
    });
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !selectedAppointment) {
      return;
    }

    try {
      await completeTriage(session.token, selectedAppointment.id, notes);
      setNotes("");
      setSelectedId(null);
      setMessage("Triagem concluida");
      await loadData();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao concluir triagem";
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
          <p className="eyebrow">Triagem</p>
          <h1>Fila de triagem</h1>
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
        <section className="panel">
          <div className="section-head">
            <h2>Pacientes</h2>
            <button className="button" onClick={loadData}>
              Atualizar
            </button>
          </div>
          <div className="list">
            {triageQueue.map((appointment) => (
              <button
                className="item selectable"
                key={appointment.id}
                onClick={() => setSelectedId(appointment.id)}
              >
                <strong>{appointment.patient_name}</strong>
                <span>{appointment.status}</span>
              </button>
            ))}
            {triageQueue.length === 0 ? <p className="empty">Fila vazia</p> : null}
          </div>
        </section>

        <form className="panel form-stack" onSubmit={handleSubmit}>
          <p className="eyebrow">Conclusao</p>
          <h2>{selectedAppointment?.patient_name ?? "Selecione um paciente"}</h2>
          <label>
            Observacoes
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              rows={8}
              value={notes}
            />
          </label>
          <button className="button primary" disabled={!selectedAppointment}>
            Concluir triagem
          </button>
        </form>
      </section>
    </main>
  );
}
