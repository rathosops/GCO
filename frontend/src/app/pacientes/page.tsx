"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ApiError, createPatient, listPatients, updatePatient } from "@/lib/api";
import { useSessionGuard } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Patient, PatientPayload, PatientSex } from "@/types/api";

const emptyPatientPayload: PatientPayload = {
  full_name: "",
  cpf: null,
  birth_date: null,
  sex: "not_informed",
  email: null,
  phone: null,
  address_line: null,
  city: null,
  state: null,
  postal_code: null,
  notes: null,
  is_active: true,
};

const sexLabels: Record<PatientSex, string> = {
  female: "Feminino",
  male: "Masculino",
  other: "Outro",
  not_informed: "Nao informado",
};

function patientToPayload(patient: Patient): PatientPayload {
  return {
    full_name: patient.full_name,
    cpf: patient.cpf,
    birth_date: patient.birth_date,
    sex: patient.sex,
    email: patient.email,
    phone: patient.phone,
    address_line: patient.address_line,
    city: patient.city,
    state: patient.state,
    postal_code: patient.postal_code,
    notes: patient.notes,
    is_active: patient.is_active,
  };
}

export default function PatientsPage() {
  const { session, isLoading, signOut } = useSessionGuard({
    permission: "patients.read",
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientPayload, setPatientPayload] =
    useState<PatientPayload>(emptyPatientPayload);
  const [search, setSearch] = useState("");
  const [totalPatients, setTotalPatients] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canWritePatients = useMemo(
    () => (session ? can(session.user, "patients.write") : false),
    [session],
  );

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);

  const loadPatients = useCallback(async () => {
    if (!session) {
      return;
    }

    const response = await listPatients(session.token, {
      search,
      limit: 20,
      offset: 0,
    });
    setPatients(response.data);
    setTotalPatients(response.pagination.total);
  }, [search, session]);

  useEffect(() => {
    loadPatients().catch((caught) => {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao carregar pacientes";
      setMessage(text);
    });
  }, [loadPatients]);

  function handleNewPatient() {
    setSelectedPatientId(null);
    setPatientPayload(emptyPatientPayload);
    setMessage(null);
  }

  function handleSelectPatient(patient: Patient) {
    setSelectedPatientId(patient.id);
    setPatientPayload(patientToPayload(patient));
    setMessage(null);
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadPatients();
  }

  async function handlePatientSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !canWritePatients) {
      return;
    }

    setIsSaving(true);
    try {
      if (selectedPatientId) {
        await updatePatient(session.token, selectedPatientId, patientPayload);
        setMessage("Paciente atualizado");
      } else {
        await createPatient(session.token, patientPayload);
        setMessage("Paciente cadastrado");
      }

      handleNewPatient();
      await loadPatients();
    } catch (caught) {
      const text =
        caught instanceof ApiError ? caught.message : "Falha ao salvar paciente";
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
          <p className="eyebrow">Cadastros</p>
          <h1>Pacientes</h1>
          <p className="meta">{session.user.display_name}</p>
        </div>
        <nav className="actions">
          <Link className="button" href="/operador">
            Operador
          </Link>
          <Link className="button" href="/admin">
            Admin
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
              <h2>Lista</h2>
              <p className="meta">{totalPatients} paciente(s)</p>
            </div>
            <button className="button" onClick={handleNewPatient}>
              Novo
            </button>
          </div>

          <form className="filters" onSubmit={handleSearchSubmit}>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou CPF"
              value={search}
            />
            <button className="button">Buscar</button>
          </form>

          <div className="list">
            {patients.map((patient) => (
              <button
                className="item selectable"
                key={patient.id}
                onClick={() => handleSelectPatient(patient)}
              >
                <div>
                  <strong>{patient.full_name}</strong>
                  <span>
                    {patient.cpf ?? "Sem CPF"} / {sexLabels[patient.sex]} /{" "}
                    {patient.is_active ? "ativo" : "inativo"}
                  </span>
                </div>
              </button>
            ))}
            {patients.length === 0 ? (
              <p className="empty">Nenhum paciente encontrado</p>
            ) : null}
          </div>
        </section>

        <form className="panel form-stack" onSubmit={handlePatientSubmit}>
          <p className="eyebrow">{selectedPatient ? "Edicao" : "Cadastro"}</p>
          <h2>{selectedPatient?.full_name ?? "Novo paciente"}</h2>

          <label>
            Nome completo
            <input
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  full_name: event.target.value,
                }))
              }
              required
              value={patientPayload.full_name}
            />
          </label>
          <label>
            CPF
            <input
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  cpf: event.target.value || null,
                }))
              }
              value={patientPayload.cpf ?? ""}
            />
          </label>
          <label>
            Nascimento
            <input
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  birth_date: event.target.value || null,
                }))
              }
              type="date"
              value={patientPayload.birth_date ?? ""}
            />
          </label>
          <label>
            Sexo
            <select
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  sex: event.target.value as PatientSex,
                }))
              }
              value={patientPayload.sex}
            >
              {Object.entries(sexLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Telefone
            <input
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  phone: event.target.value || null,
                }))
              }
              value={patientPayload.phone ?? ""}
            />
          </label>
          <label>
            Email
            <input
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  email: event.target.value || null,
                }))
              }
              value={patientPayload.email ?? ""}
            />
          </label>
          <label>
            Cidade
            <input
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  city: event.target.value || null,
                }))
              }
              value={patientPayload.city ?? ""}
            />
          </label>
          <label>
            UF
            <input
              disabled={!canWritePatients}
              maxLength={2}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  state: event.target.value || null,
                }))
              }
              value={patientPayload.state ?? ""}
            />
          </label>
          <label>
            Observacoes
            <textarea
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  notes: event.target.value || null,
                }))
              }
              rows={4}
              value={patientPayload.notes ?? ""}
            />
          </label>
          <label className="check-row">
            <input
              checked={patientPayload.is_active}
              disabled={!canWritePatients}
              onChange={(event) =>
                setPatientPayload((currentPayload) => ({
                  ...currentPayload,
                  is_active: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Ativo
          </label>
          {canWritePatients ? (
            <button className="button primary" disabled={isSaving}>
              {isSaving ? "Salvando" : "Salvar paciente"}
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}
