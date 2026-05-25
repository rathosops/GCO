// src/features/aso/components/QuestionarioDetail.tsx

import { useEffect, useRef, useState } from "react";
import {
  X,
  FileDown,
  CheckCircle,
  Minus,
  AlertCircle,
  Link2,
  Smartphone,
  ClipboardList,
  FileText,
  Printer,
} from "lucide-react";
import { formatCpf } from "@/utils/formatters";
import type {
  AsoQuestionario,
  AnamnesePergunta,
  AnamneseGrupoKey,
} from "../types/aso-questionario.types";
import {
  GRUPO_LABELS,
  GRUPO_ICONS,
  STATUS_CONFIG,
  ORIGEM_LABELS,
} from "../types/aso-questionario.types";
import type { PdfModo } from "../api/aso-questionario.api";

// ============================================
// Helpers
// ============================================

function isRespondida(p: AnamnesePergunta): boolean {
  return p.resposta !== null || (!!p.observacao && p.observacao.trim() !== "");
}

function calcStats(q: AsoQuestionario) {
  const anamnese = q.anamnese ?? {};
  let total = 0;
  let respondidas = 0;
  let alertas = 0;

  for (const [key, perguntas] of Object.entries(anamnese) as [
    AnamneseGrupoKey,
    AnamnesePergunta[],
  ][]) {
    if (!perguntas || perguntas.length === 0) continue;
    const resp = perguntas.filter(isRespondida).length;
    if (key === "perguntas_femininas" && resp === 0) continue;
    total += perguntas.length;
    respondidas += resp;
    alertas += perguntas.filter((p) => p.resposta === "sim").length;
  }

  const pct = total > 0 ? Math.round((respondidas / total) * 100) : 0;
  return { total, respondidas, alertas, pct };
}

// ============================================
// Resposta indicators
// ============================================

function RespostaIcon({
  resposta,
  observacao,
}: {
  resposta: AnamnesePergunta["resposta"];
  observacao?: string;
}) {
  if (resposta === "sim") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100/10">
        <CheckCircle className="h-3.5 w-3.5 text-primary-100" />
      </span>
    );
  }
  if (resposta === "nao") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bg-200">
        <Minus className="h-3.5 w-3.5 text-text-200" />
      </span>
    );
  }
  if (observacao && observacao.trim() !== "") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning-light">
        <AlertCircle className="h-3.5 w-3.5 text-warning" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bg-200">
      <Minus className="h-3.5 w-3.5 text-text-200" />
    </span>
  );
}

function RespostaLabel({
  resposta,
  observacao,
}: {
  resposta: AnamnesePergunta["resposta"];
  observacao?: string;
}) {
  if (resposta === "sim")
    return <span className="text-xs font-semibold text-primary-100">SIM</span>;
  if (resposta === "nao")
    return <span className="text-xs font-semibold text-text-200">NÃO</span>;
  if (observacao && observacao.trim() !== "")
    return (
      <span className="text-xs font-semibold text-warning">TEXTO</span>
    );
  return <span className="text-xs text-text-200">—</span>;
}

// ============================================
// Grupo section
// ============================================

function GrupoSection({
  grupoKey,
  perguntas,
}: {
  grupoKey: AnamneseGrupoKey;
  perguntas: AnamnesePergunta[];
}) {
  const alertas = perguntas.filter((p) => p.resposta === "sim").length;
  const respondidas = perguntas.filter(isRespondida).length;

  return (
    <div className="py-4 first:pt-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-primary-100/10 text-primary-100 flex items-center justify-center text-xs font-bold">
            {GRUPO_ICONS[grupoKey]}
          </span>
          <h4 className="text-sm font-semibold text-text-100">
            {GRUPO_LABELS[grupoKey]}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {alertas > 0 && (
            <span className="text-xs text-primary-100 bg-primary-100/10 px-2 py-0.5 rounded-full font-medium">
              {alertas} sim
            </span>
          )}
          <span className="text-xs text-text-200">
            {respondidas}/{perguntas.length}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {perguntas.map((p, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-3 py-2 rounded-xl transition-colors hover:bg-bg-200/50"
          >
            <RespostaIcon resposta={p.resposta} observacao={p.observacao} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-text-100">{p.texto}</p>
                <RespostaLabel
                  resposta={p.resposta}
                  observacao={p.observacao}
                />
              </div>
              {p.observacao && (
                <p className="text-xs text-text-200 mt-1 pl-1 border-l-2 border-warning/30">
                  {p.observacao}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PDF Dropdown — sempre visível
// ============================================

function PdfDropdown({
  onSelect,
  hasAso,
}: {
  onSelect: (modo: PdfModo) => void;
  hasAso: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button className="btn-primary btn-sm" onClick={() => setOpen(!open)}>
        <FileDown className="h-4 w-4" /> PDF
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-bg-100 border border-bg-300 rounded-xl shadow-lg z-50 py-1">
          <button
            className="w-full text-left px-4 py-2 text-sm text-text-100 hover:bg-bg-200 flex items-center gap-2"
            onClick={() => {
              onSelect("preenchido");
              setOpen(false);
            }}
          >
            <FileDown className="h-4 w-4 text-primary-100" />
            Ficha Preenchida
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-text-100 hover:bg-bg-200 flex items-center gap-2"
            onClick={() => {
              onSelect("parcial");
              setOpen(false);
            }}
          >
            <FileText className="h-4 w-4 text-warning" />
            Só Dados do Paciente
          </button>
          {hasAso && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-text-100 hover:bg-bg-200 flex items-center gap-2"
              onClick={() => {
                onSelect("branco");
                setOpen(false);
              }}
            >
              <Printer className="h-4 w-4 text-text-200" />
              Ficha em Branco
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

interface Props {
  questionario: AsoQuestionario;
  onClose: () => void;
  onDownloadPdf: (modo?: PdfModo) => void;
  onRefresh: () => void;
}

export default function QuestionarioDetail({
  questionario: q,
  onClose,
  onDownloadPdf,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const stats = calcStats(q);
  const statusCfg = STATUS_CONFIG[q.status];
  const anamneseKeys = Object.keys(q.anamnese || {}) as AnamneseGrupoKey[];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full max-w-xl bg-bg-100 z-50 shadow-xl
                   overflow-y-auto border-l border-bg-300
                   animate-[slideIn_0.25s_ease-out]"
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-100/95 backdrop-blur-sm border-b border-bg-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-5 w-5 text-primary-100" />
                <h3 className="text-lg font-bold text-text-100">
                  Questionário #{q.id}
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.class}`}
                >
                  {statusCfg.label}
                </span>
                <span className="text-xs text-text-200 flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  {ORIGEM_LABELS[q.origem]}
                </span>
                {q.aso_id && (
                  <span className="text-xs text-text-200 flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    ASO #{q.aso_id}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PdfDropdown
                onSelect={(modo) => onDownloadPdf(modo)}
                hasAso={!!q.aso_id}
              />
              <button className="btn-ghost btn-icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-bg-200 rounded-xl">
              <p className="text-xl font-bold text-text-100 tabular-nums">
                {stats.pct}%
              </p>
              <p className="text-xs text-text-200">Preenchido</p>
            </div>
            <div className="text-center p-3 bg-bg-200 rounded-xl">
              <p className="text-xl font-bold text-text-100 tabular-nums">
                {stats.respondidas}/{stats.total}
              </p>
              <p className="text-xs text-text-200">Respostas</p>
            </div>
            <div
              className={`text-center p-3 rounded-xl ${stats.alertas > 0 ? "bg-primary-100/10" : "bg-bg-200"}`}
            >
              <p
                className={`text-xl font-bold tabular-nums ${stats.alertas > 0 ? "text-primary-100" : "text-text-100"}`}
              >
                {stats.alertas}
              </p>
              <p className="text-xs text-text-200">Alertas</p>
            </div>
          </div>

          <div className="card !py-3 !px-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-200">Paciente:</span>
              <span className="text-sm font-semibold text-text-100">
                {q.cpf_paciente ? formatCpf(q.cpf_paciente) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-text-200">Recebido em:</span>
              <span className="text-sm text-text-100">
                {new Date(q.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-100">
                Progresso da Anamnese
              </span>
              <span className="text-sm text-text-200 tabular-nums">
                {stats.pct}%
              </span>
            </div>
            <div className="h-3 bg-bg-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-100 transition-all duration-700"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>

          <div className="divide-y divide-bg-200">
            {anamneseKeys.map((key) => {
              const perguntas = q.anamnese?.[key];
              if (!perguntas || perguntas.length === 0) return null;
              if (
                key === "perguntas_femininas" &&
                !perguntas.some(isRespondida)
              )
                return null;
              return (
                <GrupoSection key={key} grupoKey={key} perguntas={perguntas} />
              );
            })}
          </div>

          {q.exame_clinico && Object.values(q.exame_clinico).some(Boolean) && (
            <div className="py-4 border-t border-bg-200">
              <h4 className="text-sm font-semibold text-text-100 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-success-light text-success flex items-center justify-center text-xs font-bold">
                  ✦
                </span>
                Exame Clínico
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {q.exame_clinico.pa && (
                  <div className="px-3 py-2 bg-bg-200 rounded-xl">
                    <p className="text-xs text-text-200">PA</p>
                    <p className="text-sm font-medium text-text-100">
                      {q.exame_clinico.pa} mmHg
                    </p>
                  </div>
                )}
                {q.exame_clinico.fc && (
                  <div className="px-3 py-2 bg-bg-200 rounded-xl">
                    <p className="text-xs text-text-200">FC</p>
                    <p className="text-sm font-medium text-text-100">
                      {q.exame_clinico.fc} bpm
                    </p>
                  </div>
                )}
                {q.exame_clinico.peso && (
                  <div className="px-3 py-2 bg-bg-200 rounded-xl">
                    <p className="text-xs text-text-200">Peso</p>
                    <p className="text-sm font-medium text-text-100">
                      {q.exame_clinico.peso} kg
                    </p>
                  </div>
                )}
                {q.exame_clinico.altura && (
                  <div className="px-3 py-2 bg-bg-200 rounded-xl">
                    <p className="text-xs text-text-200">Altura</p>
                    <p className="text-sm font-medium text-text-100">
                      {q.exame_clinico.altura} m
                    </p>
                  </div>
                )}
              </div>
              {q.exame_clinico.impressao && (
                <div className="mt-3 px-3 py-2 bg-bg-200 rounded-xl">
                  <p className="text-xs text-text-200 mb-1">
                    Impressão Clínica
                  </p>
                  <p className="text-sm text-text-100 whitespace-pre-wrap">
                    {q.exame_clinico.impressao}
                  </p>
                </div>
              )}
            </div>
          )}

          {q.observacoes_medicas && (
            <div className="py-4 border-t border-bg-200">
              <h4 className="text-sm font-semibold text-text-100 mb-2">
                Observações do Médico
              </h4>
              <p className="text-sm text-text-200 bg-bg-200 p-3 rounded-xl whitespace-pre-wrap">
                {q.observacoes_medicas}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}