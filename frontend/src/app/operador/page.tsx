"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ApiError,
  cancelCall,
  createAppointment,
  createCall,
  finishCall,
  listAppointments,
  listCalls,
  listRooms,
  startCall,
} from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import type { Appointment, Call, CallKind, Room } from "@/types/api";

function displayDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function OperadorPage() {
  const { session, isLoading, signOut } = useSessionGuard();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientDocument, setPatientDocument] = useState("");
  const [requiresTriage, setRequiresTriage] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
  );
  const [roomId, setRoomId] = useState("");
  const [kind, setKind] = useState<CallKind>("doctor");
  const [message, setMessage] = useState<string | null>(null);

  const activeCalls = useMemo(
    () =>
      calls.filter((call) =>
        ["waiting", "called", "in_service"].includes(call.status),
      ),
    [calls],
  );

  const loadData = useCallback(async () => {
    if (!session) {
      return;
    }

    const [nextAppointments, nextCalls, nextRooms] = await Promise.all([
      listAppointments(session.token),
      listCalls(session.token),
      listRooms(),
    ]);
    setAppointments(nextAppointments);
    setCalls(nextCalls);
    setRooms(nextRooms);
  }, [session]);

  useEffect(() => {
    loadData().catch((caught) => {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao carregar dados";
      setMessage(text);
    });
  }, [loadData]);

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    try {
      await createAppointment(session.token, {
        patient_name: patientName,
        patient_document: patientDocument || null,
        scheduled_for: new Date(scheduledFor).toISOString(),
        requires_triage: requiresTriage,
      });
      setPatientName("");
      setPatientDocument("");
      setRequiresTriage(false);
      setMessage("Agendamento criado");
      await loadData();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao criar paciente";
      setMessage(text);
    }
  }

  async function handleCreateCall(appointment: Appointment) {
    if (!session) {
      return;
    }

    try {
      await createCall(session.token, {
        appointment_id: appointment.id,
        room_id: roomId ? Number(roomId) : null,
        kind,
        message: appointment.patient_name,
      });
      setMessage("Chamada enviada");
      await loadData();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao chamar paciente";
      setMessage(text);
    }
  }

  async function handleTransition(
    action: (token: string, callId: number) => Promise<Call>,
    callId: number,
  ) {
    if (!session) {
      return;
    }

    try {
      await action(session.token, callId);
      await loadData();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao atualizar chamada";
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
          <p className="eyebrow">Operacao</p>
          <h1>Operador</h1>
          <p className="meta">{session.user.display_name}</p>
        </div>
        <nav className="actions">
          <Link className="button" href="/painel">
            Painel
          </Link>
          <Link className="button" href="/triagem">
            Triagem
          </Link>
          <button className="button" onClick={signOut}>
            Sair
          </button>
        </nav>
      </header>

      {message ? <p className="alert">{message}</p> : null}

      <section className="workspace two-columns">
        <form className="panel form-stack" onSubmit={handleCreateAppointment}>
          <h2>Novo paciente</h2>
          <label>
            Nome
            <input
              onChange={(event) => setPatientName(event.target.value)}
              required
              value={patientName}
            />
          </label>
          <label>
            Documento
            <input
              onChange={(event) => setPatientDocument(event.target.value)}
              value={patientDocument}
            />
          </label>
          <label>
            Horario
            <input
              onChange={(event) => setScheduledFor(event.target.value)}
              required
              type="datetime-local"
              value={scheduledFor}
            />
          </label>
          <label className="check-row">
            <input
              checked={requiresTriage}
              onChange={(event) => setRequiresTriage(event.target.checked)}
              type="checkbox"
            />
            Exige triagem
          </label>
          <button className="button primary">Criar</button>
        </form>

        <section className="panel">
          <div className="section-head">
            <h2>Chamadas ativas</h2>
            <button className="button" onClick={loadData}>
              Atualizar
            </button>
          </div>
          <div className="list">
            {activeCalls.map((call) => (
              <article className="item" key={call.id}>
                <div>
                  <strong>{call.message ?? `Chamada ${call.sequence_number}`}</strong>
                  <span>
                    {call.kind} / {call.status} / {displayDateTime(call.called_at)}
                  </span>
                </div>
                <div className="actions">
                  <button
                    className="button"
                    onClick={() => handleTransition(startCall, call.id)}
                  >
                    Iniciar
                  </button>
                  <button
                    className="button"
                    onClick={() => handleTransition(finishCall, call.id)}
                  >
                    Finalizar
                  </button>
                  <button
                    className="button danger"
                    onClick={() => handleTransition(cancelCall, call.id)}
                  >
                    Cancelar
                  </button>
                </div>
              </article>
            ))}
            {activeCalls.length === 0 ? <p className="empty">Sem chamadas</p> : null}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Fila</h2>
          <div className="filters">
            <select onChange={(event) => setKind(event.target.value as CallKind)} value={kind}>
              <option value="doctor">Medico</option>
              <option value="triage">Triagem</option>
              <option value="administrative">Administrativo</option>
            </select>
            <select onChange={(event) => setRoomId(event.target.value)} value={roomId}>
              <option value="">Sem sala</option>
              {rooms
                .filter((room) => room.is_active)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.display_name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="list">
          {appointments.map((appointment) => (
            <article className="item" key={appointment.id}>
              <div>
                <strong>{appointment.patient_name}</strong>
                <span>
                  {appointment.status} / {displayDateTime(appointment.scheduled_for)}
                </span>
              </div>
              <button
                className="button primary"
                disabled={appointment.status === "completed"}
                onClick={() => handleCreateCall(appointment)}
              >
                Chamar
              </button>
            </article>
          ))}
          {appointments.length === 0 ? <p className="empty">Fila vazia</p> : null}
        </div>
      </section>
    </main>
  );
}
