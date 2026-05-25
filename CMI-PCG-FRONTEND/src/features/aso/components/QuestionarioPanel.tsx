// src/features/aso/components/QuestionarioPanel.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Clock,
  Link2,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  FileDown,
  ExternalLink,
  Copy,
  Inbox,
  Smartphone,
  FileText,
  Search,
  Printer,
  User,
  X,
  Building2,
} from "lucide-react";
import { questionarioAPI } from "../api/aso-questionario.api";
import type { PdfModo } from "../api/aso-questionario.api";
import { downloadBlob } from "../api/aso.api";
import { useToast } from "@/components/feedback/toast";
import { formatCpf, formatCnpj } from "@/utils/formatters";
import { debounce } from "@/utils/debounce";
import {
  autocompleteAPI,
  type AutocompleteEmpresa,
} from "@/services/autocomplete.api";
import { pacientesAPI, type PacienteRecord } from "@/services/pacientes.api";
import EntityPicker from "@/components/common/EntityPicker";
import type {
  AsoQuestionario,
  AnamnesePergunta,
  AnamneseGrupoKey,
} from "../types/aso-questionario.types";
import { STATUS_CONFIG, ORIGEM_LABELS } from "../types/aso-questionario.types";
import QuestionarioDetail from "./QuestionarioDetail";

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
// Status Badge
// ============================================

function StatusBadge({ status }: { status: AsoQuestionario["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.class}`}
    >
      {cfg.label}
    </span>
  );
}

// ============================================
// KPI Row
// ============================================

function StatsRow({ pendentes }: { pendentes: AsoQuestionario[] }) {
  const total = pendentes.length;
  const fromForms = pendentes.filter((q) => q.origem === "google_forms").length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="card flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-warning-light">
          <Clock className="h-6 w-6 text-warning" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-100 tabular-nums">
            {total}
          </p>
          <p className="text-sm text-text-200">Pendentes</p>
        </div>
      </div>

      <div className="card flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary-100/10">
          <Smartphone className="h-6 w-6 text-primary-100" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-100 tabular-nums">
            {fromForms}
          </p>
          <p className="text-sm text-text-200">Via Google Forms</p>
        </div>
      </div>

      <div className="card flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-success-light">
          <CheckCircle className="h-6 w-6 text-success" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-100 tabular-nums">
            {total - fromForms}
          </p>
          <p className="text-sm text-text-200">Preenchimento Manual</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Info banner
// ============================================

function InfoBanner() {
  const [copied, setCopied] = useState(false);
  const formUrl = import.meta.env.VITE_GOOGLE_FORM_URL || "";

  const handleCopy = async () => {
    if (!formUrl) return;
    await navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card border border-primary-200 bg-primary-100/5">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="p-3 rounded-2xl bg-primary-100/10 shrink-0">
          <ClipboardList className="h-6 w-6 text-primary-100" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-100 mb-1">
            Questionário de Anamnese Ocupacional
          </h3>
          <p className="text-sm text-text-200 mb-3">
            Os pacientes preenchem o questionário via Google Forms antes da
            consulta. As respostas chegam automaticamente e são vinculadas ao
            ASO quando o médico inicia o atendimento. Envie o link por WhatsApp
            ou email.
          </p>

          {formUrl ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 bg-bg-200 rounded-xl text-sm text-text-200 min-w-0 max-w-full overflow-hidden">
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">{formUrl}</span>
              </div>
              <button
                onClick={handleCopy}
                className="btn-secondary btn-sm shrink-0"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </>
                )}
              </button>
              <a
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir Form
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-text-200">
              <AlertCircle className="h-4 w-4 text-warning shrink-0" />
              Configure{" "}
              <code className="px-1.5 py-0.5 bg-bg-200 rounded text-xs">
                VITE_GOOGLE_FORM_URL
              </code>{" "}
              no frontend para exibir o link do formulário.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Quick Actions
// ============================================

function QuickActions({
  onDownloadBranca,
  loadingBranca,
}: {
  onDownloadBranca: () => void;
  loadingBranca: boolean;
}) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-2 mb-3">
        <Printer className="h-5 w-5 text-primary-100" />
        <h3 className="font-semibold text-text-100">Fichas para Impressão</h3>
      </div>
      <p className="text-sm text-text-200 mb-4">
        Quando o paciente não preencheu o Google Forms, imprima uma ficha em
        branco para preenchimento à mão na recepção.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-secondary btn-sm"
          onClick={onDownloadBranca}
          disabled={loadingBranca}
        >
          {loadingBranca ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Ficha em Branco (sem dados)
        </button>
      </div>
    </div>
  );
}

// ============================================
// Busca unificada por nome ou CPF
// ============================================

function UnifiedSearch({
  onResults,
  onClear,
}: {
  onResults: (results: AsoQuestionario[]) => void;
  onClear: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        if (hasSearched) {
          onClear();
          setHasSearched(false);
        }
        return;
      }
      setLoading(true);
      try {
        const data = await questionarioAPI.buscar(trimmed);
        onResults(data);
        setHasSearched(true);
        if (data.length === 0) {
          toast.info("Nenhum questionário encontrado para este termo.");
        }
      } catch {
        toast.error("Erro ao buscar questionários.");
      } finally {
        setLoading(false);
      }
    },
    [hasSearched, onResults, onClear, toast],
  );

  const debouncedSearch = useMemo(() => debounce(doSearch, 400), [doSearch]);

  const handleChange = (value: string) => {
    setQuery(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setQuery("");
    setHasSearched(false);
    onClear();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
        <input
          className="input pl-10 pr-8 !py-2 text-sm"
          placeholder="Buscar por nome ou CPF..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-text-200" />
        )}
      </div>
      {query && (
        <button
          className="btn-ghost btn-sm text-text-200"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
          Limpar
        </button>
      )}
    </div>
  );
}

// ============================================
// Modal de vinculação de empresa
// ============================================

interface VincularEmpresaModalProps {
  questionario: AsoQuestionario;
  onClose: () => void;
  onSuccess: () => void;
}

function VincularEmpresaModal({
  questionario,
  onClose,
  onSuccess,
}: VincularEmpresaModalProps) {
  const toast = useToast();
  const [paciente, setPaciente] = useState<PacienteRecord | null>(null);
  const [empresa, setEmpresa] = useState<AutocompleteEmpresa | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!questionario.cpf_paciente) return;
    pacientesAPI
      .getByCpf(questionario.cpf_paciente)
      .then((pac) => {
        setPaciente(pac);
        if (pac.empresa) {
          // pré-preenche se já vinculado
          setEmpresa({
            nome: pac.empresa.nome,
            cnpj_raw: pac.cnpj_empresa_raw as number,
          } as AutocompleteEmpresa);
        }
      })
      .catch(() => toast.error("Erro ao carregar dados do paciente."))
      .finally(() => setFetching(false));
  }, [questionario.cpf_paciente, toast]);

  const handleSave = async () => {
    if (!empresa || !paciente) return;
    setSaving(true);
    try {
      await pacientesAPI.vincularEmpresa(paciente.id, empresa.cnpj_raw);
      toast.success(`${paciente.nome} vinculado a ${empresa.nome}!`);
      onSuccess();
      onClose();
    } catch {
      toast.error("Erro ao vincular paciente à empresa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-bg-100 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-100" />
              <h3 className="font-semibold text-text-100">
                Vincular à Empresa
              </h3>
            </div>
            <button className="btn-ghost btn-icon btn-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {fetching ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary-100" />
            </div>
          ) : (
            <>
              {paciente && (
                <div className="flex items-center gap-3 p-3 bg-bg-200 rounded-xl">
                  <User className="h-4 w-4 text-text-200 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-100 truncate">
                      {paciente.nome}
                    </p>
                    <p className="text-xs text-text-200">
                      {formatCpf(paciente.cpf_raw)}
                    </p>
                  </div>
                  {paciente.empresa && (
                    <span className="ml-auto text-xs bg-success-light text-success px-2 py-0.5 rounded-full shrink-0">
                      já vinculado
                    </span>
                  )}
                </div>
              )}

              <EntityPicker<AutocompleteEmpresa>
                title="Empresa"
                placeholder="Buscar por nome ou CNPJ..."
                selected={empresa}
                onSelect={setEmpresa}
                onClear={() => setEmpresa(null)}
                load={(q) => autocompleteAPI.empresas(q, 10)}
                renderItem={(e) => ({
                  title: e.nome,
                  subtitle: formatCnpj(String(e.cnpj_raw)),
                })}
                minChars={2}
              />

              <div className="flex gap-2 justify-end pt-2">
                <button className="btn-ghost" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!empresa || saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  Vincular
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// Card de questionário
// ============================================

function QuestionarioCard({
  q,
  onView,
  onDownloadPdf,
  onVincularEmpresa,
}: {
  q: AsoQuestionario;
  onView: () => void;
  onDownloadPdf: (modo: PdfModo) => void;
  onVincularEmpresa: () => void;
}) {
  const { total, respondidas, alertas, pct } = calcStats(q);
  const [menuOpen, setMenuOpen] = useState(false);

  const nomePaciente = q.nome_paciente;
  const cpfFormatado = q.cpf_paciente ? formatCpf(q.cpf_paciente) : "—";

  return (
    <div className="card hover:shadow-md transition-all group border border-bg-300 hover:border-primary-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <StatusBadge status={q.status} />
            <span className="text-xs text-text-200 bg-bg-200 px-2 py-0.5 rounded-full">
              {ORIGEM_LABELS[q.origem]}
            </span>
            {q.aso_id && (
              <span className="text-xs text-text-200 bg-bg-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                ASO #{q.aso_id}
              </span>
            )}
          </div>

          {/* Paciente: nome em destaque, CPF secundário */}
          {nomePaciente ? (
            <div className="mb-1">
              <p className="font-semibold text-text-100 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-text-200 shrink-0" />
                {nomePaciente}
              </p>
              <p className="text-xs text-text-200 pl-5">{cpfFormatado}</p>
            </div>
          ) : (
            <p className="font-semibold text-text-100 mb-1">
              CPF: {cpfFormatado}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-bg-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-100 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-text-200 tabular-nums shrink-0">
              {respondidas}/{total}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-text-200">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(q.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {alertas > 0 && (
              <span className="flex items-center gap-1 text-primary-100">
                <CheckCircle className="h-3 w-3" />
                {alertas} sim
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            className="btn-ghost btn-icon btn-sm"
            title="Ver detalhes"
            onClick={onView}
          >
            <Eye className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              className="btn-ghost btn-icon btn-sm"
              title="Baixar PDF"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <FileDown className="h-4 w-4" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-bg-100 border border-bg-300 rounded-xl shadow-lg z-40 py-1">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-text-100 hover:bg-bg-200 flex items-center gap-2"
                    onClick={() => {
                      onDownloadPdf("preenchido");
                      setMenuOpen(false);
                    }}
                  >
                    <FileDown className="h-4 w-4 text-primary-100" />
                    Ficha Preenchida
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-text-100 hover:bg-bg-200 flex items-center gap-2"
                    onClick={() => {
                      onDownloadPdf("parcial");
                      setMenuOpen(false);
                    }}
                  >
                    <FileText className="h-4 w-4 text-warning" />
                    Só Dados do Paciente
                  </button>
                  {q.aso_id && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-text-100 hover:bg-bg-200 flex items-center gap-2"
                      onClick={() => {
                        onDownloadPdf("branco");
                        setMenuOpen(false);
                      }}
                    >
                      <Printer className="h-4 w-4 text-text-200" />
                      Ficha em Branco
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Botões de Ação Extras */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-bg-200">
        {q.nome_paciente ? (
          <button
            className="btn-ghost btn-sm text-text-200 hover:text-primary-100"
            onClick={onVincularEmpresa}
            title="Vincular paciente a uma empresa"
          >
            <Building2 className="h-3.5 w-3.5" />
            Vincular empresa
          </button>
        ) : (
          <span className="text-xs text-text-200 italic">
            Paciente não cadastrado
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function QuestionarioPanel() {
  const toast = useToast();
  const [pendentes, setPendentes] = useState<AsoQuestionario[]>([]);
  const [filteredList, setFilteredList] = useState<AsoQuestionario[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingBranca, setLoadingBranca] = useState(false);
  const [selected, setSelected] = useState<AsoQuestionario | null>(null);
  const [vincularTarget, setVincularTarget] = useState<AsoQuestionario | null>(
    null,
  );

  const fetchPendentes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await questionarioAPI.listarPendentes();
      setPendentes(data);
      setFilteredList(null);
    } catch {
      toast.error("Erro ao carregar questionários pendentes.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPendentes();
  }, [fetchPendentes]);

  // --- PDF Downloads ---
  const handleDownloadPdf = async (q: AsoQuestionario, modo: PdfModo) => {
    try {
      let blob: Blob;
      if (q.aso_id) {
        blob = await questionarioAPI.gerarPdf(q.aso_id, modo);
      } else {
        blob = await questionarioAPI.gerarFichaClinica(q.id, modo);
      }
      const suffix = modo !== "preenchido" ? `_${modo}` : "";
      const ref = q.aso_id ? `aso_${q.aso_id}` : `ficha_${q.id}`;
      downloadBlob(blob, `questionario_${ref}${suffix}.pdf`);
      toast.success("PDF gerado!");
    } catch {
      toast.error("Erro ao gerar PDF.");
    }
  };

  const handleDownloadBranca = async () => {
    setLoadingBranca(true);
    try {
      const blob = await questionarioAPI.gerarFichaBranca();
      downloadBlob(blob, "ficha_clinica_branca.pdf");
      toast.success("Ficha em branco gerada!");
    } catch {
      toast.error("Erro ao gerar ficha em branco.");
    } finally {
      setLoadingBranca(false);
    }
  };

  const displayList = filteredList ?? pendentes;
  const isFiltered = filteredList !== null;

  return (
    <div className="space-y-6">
      <InfoBanner />
      <StatsRow pendentes={pendentes} />
      <QuickActions
        onDownloadBranca={handleDownloadBranca}
        loadingBranca={loadingBranca}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-text-100">
            Questionários Recebidos
          </h3>
          <p className="text-sm text-text-200">
            Respostas recebidas via Google Forms aguardando vinculação
          </p>
        </div>
        <button
          className="btn-ghost btn-sm"
          onClick={fetchPendentes}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <UnifiedSearch
        onResults={setFilteredList}
        onClear={() => setFilteredList(null)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary-100" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="card text-center py-12 border-2 border-dashed border-bg-300">
          <Inbox className="h-12 w-12 mx-auto text-text-200 mb-3 opacity-50" />
          <p className="font-medium text-text-100 mb-1">
            {isFiltered
              ? "Nenhum questionário encontrado"
              : "Nenhum questionário pendente"}
          </p>
          <p className="text-sm text-text-200 max-w-md mx-auto">
            {isFiltered
              ? "Verifique o nome ou CPF informado e tente novamente."
              : "Quando um paciente preencher o formulário via Google Forms, as respostas aparecerão aqui automaticamente."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayList.map((q) => (
            <QuestionarioCard
              key={q.id}
              q={q}
              onView={() => setSelected(q)}
              onDownloadPdf={(modo) => handleDownloadPdf(q, modo)}
              onVincularEmpresa={() => setVincularTarget(q)}
            />
          ))}
        </div>
      )}

      {selected && (
        <QuestionarioDetail
          questionario={selected}
          onClose={() => setSelected(null)}
          onDownloadPdf={(modo) =>
            handleDownloadPdf(selected, modo ?? "preenchido")
          }
          onRefresh={fetchPendentes}
        />
      )}

      {vincularTarget && (
        <VincularEmpresaModal
          questionario={vincularTarget}
          onClose={() => setVincularTarget(null)}
          onSuccess={fetchPendentes}
        />
      )}
    </div>
  );
}
