"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  ApiError,
  cancelExamRequest,
  createExamRequest,
  listExamRequests,
} from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import type { ExamRequest } from "@/types/api";

export default function ExamRequestsPage() {
  const { session, isLoading, signOut } = useSessionGuard({
    permission: "exam_requests.read",
  });
  const [examRequests, setExamRequests] = useState<ExamRequest[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientDocument, setPatientDocument] = useState("");
  const [examName, setExamName] = useState("");
  const [unitPrice, setUnitPrice] = useState("0.00");
  const [discountAmount, setDiscountAmount] = useState("0.00");
  const [message, setMessage] = useState<string | null>(null);

  const loadExamRequests = useCallback(async () => {
    if (!session) {
      return;
    }
    setExamRequests(await listExamRequests(session.token));
  }, [session]);

  useEffect(() => {
    loadExamRequests().catch((caught) => {
      setMessage(
        caught instanceof ApiError
          ? caught.message
          : "Falha ao carregar solicitacoes",
      );
    });
  }, [loadExamRequests]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    try {
      await createExamRequest(session.token, {
        patient_name: patientName,
        patient_document: patientDocument || null,
        status: "pending",
        discount_amount: discountAmount,
        items: [{ exam_name: examName, unit_price: unitPrice }],
      });
      setPatientName("");
      setPatientDocument("");
      setExamName("");
      setUnitPrice("0.00");
      setDiscountAmount("0.00");
      setMessage("Solicitacao criada");
      await loadExamRequests();
    } catch (caught) {
      setMessage(
        caught instanceof ApiError ? caught.message : "Falha ao criar solicitacao",
      );
    }
  }

  async function handleCancel(examRequest: ExamRequest) {
    if (!session) {
      return;
    }
    try {
      await cancelExamRequest(session.token, examRequest.id, "Cancelado pela tela");
      setMessage("Solicitacao cancelada");
      await loadExamRequests();
    } catch (caught) {
      setMessage(
        caught instanceof ApiError ? caught.message : "Falha ao cancelar solicitacao",
      );
    }
  }

  if (isLoading || !session) {
    return <main className="app-shell">Carregando</main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Operacao clinica</p>
          <h1>Solicitacoes de exames</h1>
          <p className="meta">{session.user.display_name}</p>
        </div>
        <nav className="actions">
          <Link className="button" href="/consultas">
            Consultas
          </Link>
          <button className="button" onClick={signOut}>
            Sair
          </button>
        </nav>
      </header>

      {message ? <p className="alert">{message}</p> : null}

      <section className="workspace two-columns">
        <form className="panel form-stack" onSubmit={handleSubmit}>
          <h2>Nova solicitacao</h2>
          <label>
            Paciente
            <input
              onChange={(event) => setPatientName(event.target.value)}
              required
              value={patientName}
            />
          </label>
          <label>
            CPF
            <input
              onChange={(event) => setPatientDocument(event.target.value)}
              value={patientDocument}
            />
          </label>
          <label>
            Exame
            <input
              onChange={(event) => setExamName(event.target.value)}
              required
              value={examName}
            />
          </label>
          <label>
            Valor
            <input
              onChange={(event) => setUnitPrice(event.target.value)}
              type="number"
              value={unitPrice}
            />
          </label>
          <label>
            Desconto
            <input
              onChange={(event) => setDiscountAmount(event.target.value)}
              type="number"
              value={discountAmount}
            />
          </label>
          <button className="button primary">Criar solicitacao</button>
        </form>

        <section className="panel">
          <div className="section-head">
            <h2>Recentes</h2>
            <button className="button" onClick={loadExamRequests}>
              Atualizar
            </button>
          </div>
          <div className="list">
            {examRequests.map((examRequest) => (
              <article className="item" key={examRequest.id}>
                <div>
                  <strong>{examRequest.patient_name}</strong>
                  <span>
                    {examRequest.status} / total R$ {examRequest.total_amount}
                  </span>
                </div>
                {examRequest.status !== "cancelled" ? (
                  <button
                    className="button danger"
                    onClick={() => handleCancel(examRequest)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </article>
            ))}
            {examRequests.length === 0 ? (
              <p className="empty">Nenhuma solicitacao encontrada</p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
