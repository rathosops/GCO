"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  ApiError,
  cancelPrescription,
  createPrescription,
  listPrescriptions,
} from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import type { Prescription, PrescriptionKind } from "@/types/api";

const kindLabels: Record<PrescriptionKind, string> = {
  simple: "Simples",
  special_control: "Controle especial",
  antimicrobial: "Antimicrobiano",
};

export default function PrescriptionsPage() {
  const { session, isLoading, signOut } = useSessionGuard({
    permission: "prescriptions.read",
  });
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientDocument, setPatientDocument] = useState("");
  const [kind, setKind] = useState<PrescriptionKind>("simple");
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    if (!session) {
      return;
    }
    setPrescriptions(await listPrescriptions(session.token));
  }, [session]);

  useEffect(() => {
    loadPrescriptions().catch((caught) => {
      setMessage(
        caught instanceof ApiError
          ? caught.message
          : "Falha ao carregar receituarios",
      );
    });
  }, [loadPrescriptions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    try {
      await createPrescription(session.token, {
        patient_name: patientName,
        patient_document: patientDocument || null,
        kind,
        items: [
          {
            medication_name: medicationName,
            dosage: dosage || null,
            frequency: frequency || null,
          },
        ],
      });
      setPatientName("");
      setPatientDocument("");
      setMedicationName("");
      setDosage("");
      setFrequency("");
      setMessage("Receituario emitido");
      await loadPrescriptions();
    } catch (caught) {
      setMessage(
        caught instanceof ApiError ? caught.message : "Falha ao emitir receituario",
      );
    }
  }

  async function handleCancel(prescription: Prescription) {
    if (!session) {
      return;
    }
    try {
      await cancelPrescription(session.token, prescription.id, "Cancelado pela tela");
      setMessage("Receituario cancelado");
      await loadPrescriptions();
    } catch (caught) {
      setMessage(
        caught instanceof ApiError ? caught.message : "Falha ao cancelar receituario",
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
          <h1>Receituarios</h1>
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
          <h2>Novo receituario</h2>
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
            Tipo
            <select
              onChange={(event) => setKind(event.target.value as PrescriptionKind)}
              value={kind}
            >
              {Object.entries(kindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Medicamento
            <input
              onChange={(event) => setMedicationName(event.target.value)}
              required
              value={medicationName}
            />
          </label>
          <label>
            Dose
            <input onChange={(event) => setDosage(event.target.value)} value={dosage} />
          </label>
          <label>
            Frequencia
            <input
              onChange={(event) => setFrequency(event.target.value)}
              value={frequency}
            />
          </label>
          <button className="button primary">Emitir</button>
        </form>

        <section className="panel">
          <div className="section-head">
            <h2>Recentes</h2>
            <button className="button" onClick={loadPrescriptions}>
              Atualizar
            </button>
          </div>
          <div className="list">
            {prescriptions.map((prescription) => (
              <article className="item" key={prescription.id}>
                <div>
                  <strong>{prescription.patient_name}</strong>
                  <span>
                    {kindLabels[prescription.kind]} / {prescription.status} / validade{" "}
                    {new Date(prescription.valid_until).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {prescription.status === "active" ? (
                  <button
                    className="button danger"
                    onClick={() => handleCancel(prescription)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </article>
            ))}
            {prescriptions.length === 0 ? (
              <p className="empty">Nenhum receituario encontrado</p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
