"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ApiError,
  createClinicalRecord,
  finishClinicalRecord,
  listClinicalRecords,
  updateClinicalRecord,
} from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { ClinicalRecord, ClinicalRecordPayload } from "@/types/api";

const emptyClinicalRecordPayload: ClinicalRecordPayload = {
  patient_name: "",
  patient_document: null,
  chief_complaint: null,
  history: null,
  physical_exam: null,
  diagnosis: null,
  conduct: null,
  notes: null,
};

function recordToPayload(record: ClinicalRecord): ClinicalRecordPayload {
  return {
    patient_name: record.patient_name,
    patient_document: record.patient_document,
    chief_complaint: record.chief_complaint,
    history: record.history,
    physical_exam: record.physical_exam,
    diagnosis: record.diagnosis,
    conduct: record.conduct,
    notes: record.notes,
  };
}

const statusLabels: Record<ClinicalRecord["status"], string> = {
  draft: "Em atendimento",
  finished: "Finalizado",
};

export default function ClinicalRecordsPage() {
  const { session, isLoading, signOut } = useSessionGuard({
    permission: "clinical_records.read",
  });
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [recordPayload, setRecordPayload] = useState<ClinicalRecordPayload>(
    emptyClinicalRecordPayload,
  );
  const [totalRecords, setTotalRecords] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canWriteRecords = useMemo(
    () => (session ? can(session.user, "clinical_records.write") : false),
    [session],
  );

  const selectedRecord = records.find((record) => record.id === selectedRecordId);
  const canEditSelectedRecord =
    canWriteRecords && (!selectedRecord || selectedRecord.status === "draft");

  const loadRecords = useCallback(async () => {
    if (!session) {
      return;
    }

    const response = await listClinicalRecords(session.token, {
      limit: 20,
      offset: 0,
    });
    setRecords(response.data);
    setTotalRecords(response.pagination.total);
  }, [session]);

  useEffect(() => {
    loadRecords().catch((caught) => {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao carregar consultas";
      setMessage(text);
    });
  }, [loadRecords]);

  function handleNewRecord() {
    setSelectedRecordId(null);
    setRecordPayload(emptyClinicalRecordPayload);
    setMessage(null);
  }

  function handleSelectRecord(record: ClinicalRecord) {
    setSelectedRecordId(record.id);
    setRecordPayload(recordToPayload(record));
    setMessage(null);
  }

  async function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !canEditSelectedRecord) {
      return;
    }

    setIsSaving(true);
    try {
      if (selectedRecordId) {
        await updateClinicalRecord(session.token, selectedRecordId, recordPayload);
        setMessage("Consulta atualizada");
      } else {
        await createClinicalRecord(session.token, recordPayload);
        setMessage("Consulta iniciada");
      }

      handleNewRecord();
      await loadRecords();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao salvar consulta";
      setMessage(text);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinishRecord() {
    if (!session || !selectedRecord || !canWriteRecords) {
      return;
    }

    setIsSaving(true);
    try {
      await finishClinicalRecord(session.token, selectedRecord.id);
      setMessage("Consulta finalizada");
      handleNewRecord();
      await loadRecords();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao finalizar consulta";
      setMessage(text);
    } finally {
      setIsSaving(false);
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
          <h1>Consultas</h1>
          <p className="meta">{session.user.display_name}</p>
        </div>
        <nav className="actions">
          <Link className="button" href="/pacientes">
            Pacientes
          </Link>
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
            <div>
              <h2>Prontuarios</h2>
              <p className="meta">{totalRecords} consulta(s)</p>
            </div>
            <button className="button" onClick={handleNewRecord}>
              Nova
            </button>
          </div>

          <div className="list">
            {records.map((record) => (
              <button
                className="item selectable"
                key={record.id}
                onClick={() => handleSelectRecord(record)}
              >
                <div>
                  <strong>{record.patient_name}</strong>
                  <span>
                    {statusLabels[record.status]} /{" "}
                    {new Date(record.started_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </button>
            ))}
            {records.length === 0 ? (
              <p className="empty">Nenhuma consulta encontrada</p>
            ) : null}
          </div>
        </section>

        <form className="panel form-stack" onSubmit={handleRecordSubmit}>
          <p className="eyebrow">
            {selectedRecord ? statusLabels[selectedRecord.status] : "Nova consulta"}
          </p>
          <h2>{selectedRecord?.patient_name ?? "Prontuario"}</h2>

          <label>
            Paciente
            <input
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  patient_name: event.target.value,
                }))
              }
              required
              value={recordPayload.patient_name ?? ""}
            />
          </label>
          <label>
            CPF
            <input
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  patient_document: event.target.value || null,
                }))
              }
              value={recordPayload.patient_document ?? ""}
            />
          </label>
          <label>
            Queixa principal
            <textarea
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  chief_complaint: event.target.value || null,
                }))
              }
              rows={3}
              value={recordPayload.chief_complaint ?? ""}
            />
          </label>
          <label>
            Historia clinica
            <textarea
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  history: event.target.value || null,
                }))
              }
              rows={5}
              value={recordPayload.history ?? ""}
            />
          </label>
          <label>
            Exame fisico
            <textarea
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  physical_exam: event.target.value || null,
                }))
              }
              rows={4}
              value={recordPayload.physical_exam ?? ""}
            />
          </label>
          <label>
            Diagnostico
            <textarea
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  diagnosis: event.target.value || null,
                }))
              }
              rows={3}
              value={recordPayload.diagnosis ?? ""}
            />
          </label>
          <label>
            Conduta
            <textarea
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  conduct: event.target.value || null,
                }))
              }
              rows={4}
              value={recordPayload.conduct ?? ""}
            />
          </label>
          <label>
            Observacoes internas
            <textarea
              disabled={!canEditSelectedRecord}
              onChange={(event) =>
                setRecordPayload((currentPayload) => ({
                  ...currentPayload,
                  notes: event.target.value || null,
                }))
              }
              rows={3}
              value={recordPayload.notes ?? ""}
            />
          </label>

          {canEditSelectedRecord ? (
            <button className="button primary" disabled={isSaving}>
              {isSaving ? "Salvando" : "Salvar consulta"}
            </button>
          ) : null}
          {selectedRecord?.status === "draft" && canWriteRecords ? (
            <button
              className="button"
              disabled={isSaving}
              onClick={handleFinishRecord}
              type="button"
            >
              Finalizar consulta
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}
