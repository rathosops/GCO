/**
 * Modal de criação de Receituário Médico
 *
 * Fluxo:
 * 1. Selecionar paciente (nome/CPF) e médico (nome/CRM) via autocomplete
 * 2. Escolher tipo de receita (SIMPLES / CONTROLE_ESPECIAL / ANTIMICROBIANO)
 * 3. Adicionar N itens (medicamentos) com posologia
 * 4. Opcionalmente vincular a consulta
 * 5. Confirmar e salvar
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Search,
  Pill,
  Info,
  Gift,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Copy,
  User,
  UserCog,
  XCircle,
} from "lucide-react";
import { debounce } from "@/utils/debounce";
import { onlyDigits, formatCpf } from "@/utils/formatters";
import { medicamentosAPI } from "@/features/farmacia/api";
import type { MedicamentoAutocomplete } from "@/features/farmacia/types";
import type {
  TipoReceita,
  ReceituarioCreatePayload,
  ReceituarioItemFormData,
} from "../types";
import {
  TIPO_RECEITA_CONFIG,
  FORMA_FARMACEUTICA_LABELS,
  VIA_ADMINISTRACAO_LABELS,
  UNIDADES_QUANTIDADE,
} from "../types";

// ✅ APIs já existentes no projeto
import { autocompleteAPI } from "@/services/autocomplete.api";
import { medicosApi } from "@/features/medicos/api";

// =============================================================================
// Types locais (evita depender do shape exato de outros módulos)
// =============================================================================

type PacienteAutocompleteItem = {
  id: number;
  nome: string;
  cpf: string; // pode vir formatado ou não
};

type MedicoAutocompleteItem = {
  id: number;
  nome: string;
  crm: string; // pode vir com UF/formatos diferentes -> vamos usar onlyDigits quando precisar
  especialidade?: string;
};

// =============================================================================
// Hooks auxiliares
// =============================================================================

function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: () => void,
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      handler();
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// =============================================================================
// Componente: AutocompleteSelect (reutilizável)
// =============================================================================

function AutocompleteSelect<T extends { id: number }>({
  label,
  placeholder,
  icon: Icon,
  query,
  setQuery,
  loading,
  results,
  onSelect,
  renderItem,
  onClear,
  required,
}: {
  label: string;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
  query: string;
  setQuery: (v: string) => void;
  loading: boolean;
  results: T[];
  onSelect: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  onClear?: () => void;
  required?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useOnClickOutside(wrapRef, () => setOpen(false));

  const hasResults = open && results.length > 0;

  return (
    <div className="relative" ref={wrapRef}>
      <label className="label">
        {label} {required ? "*" : ""}
      </label>

      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />

        <input
          className="input pl-10 pr-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />

        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-secondary-400" />
        ) : onClear && query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-200"
            title="Limpar"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            <XCircle className="h-4 w-4 text-secondary-400" />
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {hasResults && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto border border-bg-300 rounded-xl bg-bg-100 shadow-lg"
          >
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-bg-200 transition-colors border-b border-bg-200 last:border-b-0"
              >
                {renderItem(item)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Item vazio
// =============================================================================

const EMPTY_ITEM: ReceituarioItemFormData = {
  medicamento_id: null,
  nome_medicamento: "",
  principio_ativo: "",
  concentracao: "",
  forma_farmaceutica: "",
  via_administracao: "ORAL",
  posologia: "",
  quantidade: null,
  unidade_quantidade: "CP",
  duracao_dias: null,
  uso_continuo: false,
  is_amostra_gratis: false,
  observacoes: "",
};

// =============================================================================
// Subcomponente: Formulário de Item
// =============================================================================

function ItemForm({
  item,
  index,
  onChange,
  onRemove,
  onDuplicate,
  expanded,
  onToggle,
  total,
}: {
  item: ReceituarioItemFormData;
  index: number;
  onChange: (
    idx: number,
    field: keyof ReceituarioItemFormData,
    value: any,
  ) => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  expanded: boolean;
  onToggle: () => void;
  total: number;
}) {
  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState<MedicamentoAutocomplete[]>([]);
  const [searching, setSearching] = useState(false);
  const [showMedSearch, setShowMedSearch] = useState(false);

  const searchMeds = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setMedResults([]);
        return;
      }
      try {
        setSearching(true);
        const data = await medicamentosAPI.autocomplete(q);
        setMedResults(Array.isArray(data) ? data : []);
      } catch {
        setMedResults([]);
      } finally {
        setSearching(false);
      }
    }, 350),
    [],
  );

  useEffect(() => {
    searchMeds(medSearch);
  }, [medSearch]); // eslint-disable-line

  const selectMed = (m: MedicamentoAutocomplete) => {
    onChange(index, "medicamento_id", m.id);
    onChange(index, "nome_medicamento", m.nome_comercial);
    onChange(index, "principio_ativo", m.principio_ativo);
    onChange(index, "concentracao", m.concentracao ?? "");
    setShowMedSearch(false);
    setMedSearch("");
    setMedResults([]);
  };

  const clearMed = () => {
    onChange(index, "medicamento_id", null);
    onChange(index, "nome_medicamento", "");
    onChange(index, "principio_ativo", "");
    onChange(index, "concentracao", "");
  };

  return (
    <div className="border border-bg-300 rounded-xl overflow-hidden">
      {/* Header colapsável */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-bg-200/50 hover:bg-bg-200 transition-colors text-left"
      >
        <GripVertical className="h-4 w-4 text-secondary-300 flex-shrink-0" />
        <span className="text-xs font-bold text-primary-600 bg-primary-100/20 px-2 py-0.5 rounded-md">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-secondary-800 truncate">
          {item.nome_medicamento || "Novo medicamento"}
          {item.concentracao ? ` ${item.concentracao}` : ""}
        </span>
        {item.is_amostra_gratis && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-0.5">
            <Gift className="h-3 w-3" /> Amostra
          </span>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(index);
            }}
            className="p-1 hover:bg-secondary-200 rounded transition-colors"
            title="Duplicar item"
          >
            <Copy className="h-3.5 w-3.5 text-secondary-400" />
          </button>
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(index);
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Remover item"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-secondary-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-secondary-400" />
          )}
        </div>
      </button>

      {/* Corpo expandido */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Medicamento: busca do estoque ou digitação livre */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Medicamento *</label>
                  <button
                    type="button"
                    className="text-[11px] text-primary-600 hover:underline"
                    onClick={() => {
                      setShowMedSearch(!showMedSearch);
                      clearMed();
                    }}
                  >
                    {showMedSearch
                      ? "Digitar manualmente"
                      : "Buscar no estoque"}
                  </button>
                </div>

                {showMedSearch ? (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                      <input
                        className="input pl-10"
                        value={medSearch}
                        onChange={(e) => setMedSearch(e.target.value)}
                        placeholder="Buscar por nome ou princípio ativo..."
                      />
                      {searching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-secondary-400" />
                      )}
                    </div>
                    {medResults.length > 0 && (
                      <div className="mt-1 max-h-36 overflow-y-auto border border-bg-300 rounded-lg">
                        {medResults.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => selectMed(m)}
                            className="w-full text-left px-3 py-2 hover:bg-bg-200 transition-colors border-b border-bg-200 last:border-b-0"
                          >
                            <p className="text-sm font-medium text-secondary-900">
                              {m.nome_comercial}
                              {m.concentracao ? ` ${m.concentracao}` : ""}
                            </p>
                            <p className="text-xs text-secondary-500">
                              {m.principio_ativo} · Estoque: {m.estoque_total}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    {item.medicamento_id && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Pill className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-secondary-900 truncate">
                            {item.nome_medicamento}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:underline"
                          onClick={clearMed}
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <input
                        className="input"
                        value={item.nome_medicamento}
                        onChange={(e) =>
                          onChange(index, "nome_medicamento", e.target.value)
                        }
                        placeholder="Nome do medicamento *"
                        required
                      />
                    </div>
                    <div>
                      <input
                        className="input"
                        value={item.principio_ativo ?? ""}
                        onChange={(e) =>
                          onChange(index, "principio_ativo", e.target.value)
                        }
                        placeholder="Princípio ativo"
                      />
                    </div>
                    <div>
                      <input
                        className="input"
                        value={item.concentracao ?? ""}
                        onChange={(e) =>
                          onChange(index, "concentracao", e.target.value)
                        }
                        placeholder="Concentração (ex: 500mg)"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Posologia (campo principal) */}
              <div>
                <label className="label">Posologia / Modo de uso *</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={item.posologia}
                  onChange={(e) => onChange(index, "posologia", e.target.value)}
                  placeholder="Ex: Tomar 1 comprimido de 8 em 8 horas por 7 dias"
                  required
                />
                <p className="text-[11px] text-secondary-400 mt-1">
                  Instrução de uso que aparecerá na receita impressa
                </p>
              </div>

              {/* Detalhes em grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label">Forma farmacêutica</label>
                  <select
                    className="select"
                    value={item.forma_farmaceutica ?? ""}
                    onChange={(e) =>
                      onChange(index, "forma_farmaceutica", e.target.value)
                    }
                  >
                    <option value="">—</option>
                    {Object.entries(FORMA_FARMACEUTICA_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Via de administração</label>
                  <select
                    className="select"
                    value={item.via_administracao ?? "ORAL"}
                    onChange={(e) =>
                      onChange(index, "via_administracao", e.target.value)
                    }
                  >
                    {Object.entries(VIA_ADMINISTRACAO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Quantidade</label>
                  <div className="flex gap-1">
                    <input
                      className="input flex-1"
                      type="number"
                      min={1}
                      value={item.quantidade ?? ""}
                      onChange={(e) =>
                        onChange(
                          index,
                          "quantidade",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      placeholder="Qtd"
                    />
                    <select
                      className="select w-24"
                      value={item.unidade_quantidade ?? "CP"}
                      onChange={(e) =>
                        onChange(index, "unidade_quantidade", e.target.value)
                      }
                    >
                      {UNIDADES_QUANTIDADE.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Duração (dias)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={item.duracao_dias ?? ""}
                    onChange={(e) =>
                      onChange(
                        index,
                        "duracao_dias",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="Ex: 7"
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-secondary-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    checked={item.uso_continuo ?? false}
                    onChange={(e) =>
                      onChange(index, "uso_continuo", e.target.checked)
                    }
                  />
                  Uso contínuo
                </label>
                <label className="flex items-center gap-2 text-sm text-secondary-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-secondary-300 text-green-600 focus:ring-green-500"
                    checked={item.is_amostra_gratis ?? false}
                    onChange={(e) =>
                      onChange(index, "is_amostra_gratis", e.target.checked)
                    }
                  />
                  <span className="flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5 text-green-600" /> Amostra
                    grátis (dispensar do estoque)
                  </span>
                </label>
              </div>

              {/* Observações do item */}
              <div>
                <label className="label">Observações do item</label>
                <input
                  className="input"
                  value={item.observacoes ?? ""}
                  onChange={(e) =>
                    onChange(index, "observacoes", e.target.value)
                  }
                  placeholder="Instruções adicionais para este medicamento..."
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Props
// =============================================================================

interface ReceituarioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReceituarioCreatePayload) => Promise<void>;
  saving: boolean;
  /** Pré-preencher CPF do paciente (ex: vindo de consulta) */
  prefilledCpf?: string;
  /** Pré-preencher CRM do médico */
  prefilledCrm?: number;
  /** Pré-preencher consulta_id */
  prefilledConsultaId?: number;
}

// =============================================================================
// Componente principal
// =============================================================================

export function ReceituarioFormModal({
  isOpen,
  onClose,
  onSubmit,
  saving,
  prefilledCpf,
  prefilledCrm,
  prefilledConsultaId,
}: ReceituarioFormModalProps) {
  // Header fields (valores canônicos que vão pro payload)
  const [cpf, setCpf] = useState("");
  const [crm, setCrm] = useState("");
  const [tipoReceita, setTipoReceita] = useState<TipoReceita>("SIMPLES");
  const [consultaId, setConsultaId] = useState<string>("");
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const [orientacoesPaciente, setOrientacoesPaciente] = useState("");

  // UI do autocomplete (texto digitado / exibido)
  const [pacienteQ, setPacienteQ] = useState("");
  const [medicoQ, setMedicoQ] = useState("");

  const [pacienteResults, setPacienteResults] = useState<
    PacienteAutocompleteItem[]
  >([]);
  const [medicoResults, setMedicoResults] = useState<MedicoAutocompleteItem[]>(
    [],
  );

  const [pacienteLoading, setPacienteLoading] = useState(false);
  const [medicoLoading, setMedicoLoading] = useState(false);

  // Itens
  const [itens, setItens] = useState<ReceituarioItemFormData[]>([
    { ...EMPTY_ITEM },
  ]);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;

    const cpfPref = prefilledCpf ? formatCpf(prefilledCpf) : "";
    const crmPref = prefilledCrm ? String(prefilledCrm) : "";

    setCpf(cpfPref);
    setCrm(crmPref);

    // Texto “bonito” caso venha pré-preenchido sem nome
    setPacienteQ(cpfPref ? `CPF: ${cpfPref}` : "");
    setMedicoQ(crmPref ? `CRM: ${crmPref}` : "");

    setConsultaId(prefilledConsultaId ? String(prefilledConsultaId) : "");
    setTipoReceita("SIMPLES");
    setObservacoesGerais("");
    setOrientacoesPaciente("");
    setItens([{ ...EMPTY_ITEM }]);
    setExpandedIdx(0);

    setPacienteResults([]);
    setMedicoResults([]);
    setPacienteLoading(false);
    setMedicoLoading(false);
  }, [isOpen, prefilledCpf, prefilledCrm, prefilledConsultaId]);

  // Autocomplete: pacientes
  const searchPacientes = useCallback(
    debounce(async (q: string) => {
      const query = q.trim();
      if (query.length < 2) {
        setPacienteResults([]);
        return;
      }
      try {
        setPacienteLoading(true);
        const data = await autocompleteAPI.pacientes(query, { limit: 10 });
        // mapeia só o necessário
        const mapped: PacienteAutocompleteItem[] = (
          Array.isArray(data) ? data : []
        ).map((p: any) => ({
          id: p.id,
          nome: p.nome,
          cpf: String(p.cpf ?? p.cpf_raw ?? ""),
        }));
        setPacienteResults(mapped);
      } catch {
        setPacienteResults([]);
      } finally {
        setPacienteLoading(false);
      }
    }, 350),
    [],
  );

  // Autocomplete: médicos
  const searchMedicos = useCallback(
    debounce(async (q: string) => {
      const query = q.trim();
      if (query.length < 2) {
        setMedicoResults([]);
        return;
      }
      try {
        setMedicoLoading(true);
        const data = await medicosApi.autocomplete(query, 10);
        const mapped: MedicoAutocompleteItem[] = (
          Array.isArray(data) ? data : []
        ).map((m: any) => ({
          id: m.id,
          nome: m.nome,
          crm: String(m.crm ?? ""),
          especialidade: m.especialidade,
        }));
        setMedicoResults(mapped);
      } catch {
        setMedicoResults([]);
      } finally {
        setMedicoLoading(false);
      }
    }, 350),
    [],
  );

  useEffect(() => {
    searchPacientes(pacienteQ);
  }, [pacienteQ]); // eslint-disable-line

  useEffect(() => {
    searchMedicos(medicoQ);
  }, [medicoQ]); // eslint-disable-line

  const selectPaciente = (p: PacienteAutocompleteItem) => {
    const cpfFmt = formatCpf(p.cpf);
    setCpf(cpfFmt);
    setPacienteQ(`${p.nome} • ${cpfFmt}`);
    setPacienteResults([]);
  };

  const selectMedico = (m: MedicoAutocompleteItem) => {
    // mantém o que o backend espera: Number(onlyDigits(crm))
    setCrm(m.crm);
    setMedicoQ(`${m.nome} • CRM ${m.crm}`);
    setMedicoResults([]);
  };

  const clearPaciente = () => {
    setCpf("");
    setPacienteQ("");
    setPacienteResults([]);
  };

  const clearMedico = () => {
    setCrm("");
    setMedicoQ("");
    setMedicoResults([]);
  };

  // Item handlers
  const updateItem = (
    idx: number,
    field: keyof ReceituarioItemFormData,
    value: any,
  ) => {
    setItens((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    );
  };

  const addItem = () => {
    setItens((prev) => [...prev, { ...EMPTY_ITEM }]);
    setExpandedIdx(itens.length);
  };

  const removeItem = (idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(Math.max(0, idx - 1));
    else if (expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const duplicateItem = (idx: number) => {
    const clone = { ...itens[idx] };
    const newItens = [...itens];
    newItens.splice(idx + 1, 0, clone);
    setItens(newItens);
    setExpandedIdx(idx + 1);
  };

  // Validação
  const cpfClean = useMemo(() => onlyDigits(cpf), [cpf]);
  const cpfValid = cpfClean.length === 11;

  const crmClean = useMemo(() => onlyDigits(crm), [crm]);
  const crmValid = crmClean.length > 0;

  const itensValid =
    itens.length > 0 &&
    itens.every((it) => it.nome_medicamento.trim() && it.posologia.trim());

  const canSubmit = cpfValid && crmValid && itensValid && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    await onSubmit({
      cpf_paciente: cpfClean,
      crm_medico: Number(crmClean),
      tipo_receita: tipoReceita,
      consulta_id: consultaId ? Number(consultaId) : undefined,
      observacoes_gerais: observacoesGerais || undefined,
      orientacoes_paciente: orientacoesPaciente || undefined,
      itens: itens.map((it) => ({
        ...it,
        nome_medicamento: it.nome_medicamento.trim(),
        posologia: it.posologia.trim(),
        quantidade: it.quantidade || undefined,
        duracao_dias: it.duracao_dias || undefined,
      })),
    });
  };

  if (!isOpen) return null;

  const tipoCfg = TIPO_RECEITA_CONFIG[tipoReceita];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-6 px-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-100 rounded-2xl shadow-2xl w-full max-w-4xl mb-8 overflow-hidden flex flex-col max-h-[95vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-bg-300 bg-bg-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-100/20 rounded-xl">
                <FileText className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-secondary-900">
                  Nova Receita Médica
                </h2>
                <p className="text-xs text-secondary-500">
                  Prescrição com {itens.length}{" "}
                  {itens.length === 1 ? "medicamento" : "medicamentos"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon btn-ghost"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form body */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-5 sm:p-6"
          >
            <div className="space-y-6">
              {/* ── Seção: Tipo de Receita ─────────────────── */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">
                  Tipo de Receita
                </h4>
                <p className="text-xs text-secondary-400 mb-3">
                  Selecione conforme a classificação dos medicamentos prescritos
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(TIPO_RECEITA_CONFIG) as TipoReceita[]).map(
                    (t) => {
                      const cfg = TIPO_RECEITA_CONFIG[t];
                      const selected = tipoReceita === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTipoReceita(t)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? `${cfg.border} ${cfg.bg} ${cfg.cor} shadow-sm`
                              : "border-bg-300 text-secondary-500 hover:bg-bg-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{cfg.icon}</span>
                            <span className="text-sm font-semibold">
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80">
                            {cfg.validade} dias · {cfg.vias}{" "}
                            {cfg.vias === 1 ? "via" : "vias"}
                          </p>
                        </button>
                      );
                    },
                  )}
                </div>

                {/* Dica contextual */}
                <div
                  className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg text-xs ${tipoCfg.bg} ${tipoCfg.cor} border ${tipoCfg.border}`}
                >
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{tipoCfg.descricao}</span>
                </div>
              </section>

              {/* ── Seção: Paciente e Médico (AUTOCOMPLETE) ───────────────── */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">
                  Paciente e Prescritor
                </h4>
                <p className="text-xs text-secondary-400 mb-3">
                  Selecione o paciente (nome/CPF) e o médico (nome/CRM)
                  disponíveis no sistema
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <AutocompleteSelect<PacienteAutocompleteItem>
                    label="Paciente (nome/CPF)"
                    placeholder="Digite nome ou CPF..."
                    icon={({ className }) => <User className={className} />}
                    query={pacienteQ}
                    setQuery={(v) => setPacienteQ(v)}
                    loading={pacienteLoading}
                    results={pacienteResults}
                    onSelect={selectPaciente}
                    onClear={clearPaciente}
                    required
                    renderItem={(p) => (
                      <>
                        <p className="text-sm font-medium text-secondary-900">
                          {p.nome}
                        </p>
                        <p className="text-xs text-secondary-500">
                          CPF: {formatCpf(p.cpf)}
                        </p>
                      </>
                    )}
                  />

                  <AutocompleteSelect<MedicoAutocompleteItem>
                    label="Médico (nome/CRM)"
                    placeholder="Digite nome ou CRM..."
                    icon={({ className }) => <UserCog className={className} />}
                    query={medicoQ}
                    setQuery={(v) => setMedicoQ(v)}
                    loading={medicoLoading}
                    results={medicoResults}
                    onSelect={selectMedico}
                    onClear={clearMedico}
                    required
                    renderItem={(m) => (
                      <>
                        <p className="text-sm font-medium text-secondary-900">
                          {m.nome}
                        </p>
                        <p className="text-xs text-secondary-500">
                          CRM: {m.crm}
                          {m.especialidade ? ` · ${m.especialidade}` : ""}
                        </p>
                      </>
                    )}
                  />

                  <div>
                    <label className="label">Consulta (ID)</label>
                    <input
                      className="input"
                      value={consultaId}
                      onChange={(e) => setConsultaId(e.target.value)}
                      placeholder="Opcional"
                      type="number"
                    />
                    <p className="text-[11px] text-secondary-400 mt-1">
                      Vincular à consulta de origem
                    </p>
                  </div>
                </div>

                {/* Feedbacks de validação (mantém a lógica original) */}
                {(pacienteQ || cpf) && !cpfValid && (
                  <p className="text-[11px] text-red-500 mt-2">
                    Selecione um paciente válido (CPF incompleto)
                  </p>
                )}
                {(medicoQ || crm) && !crmValid && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Selecione um médico válido (CRM obrigatório)
                  </p>
                )}

                {/* Inputs canônicos (ocultos) para manter compatibilidade */}
                <input type="hidden" value={cpf} readOnly />
                <input type="hidden" value={crm} readOnly />
              </section>

              {/* ── Seção: Medicamentos ────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-base font-semibold text-secondary-800">
                    Medicamentos ({itens.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn-secondary text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar item
                  </button>
                </div>
                <p className="text-xs text-secondary-400 mb-4">
                  Adicione os medicamentos prescritos. Use "Buscar no estoque"
                  para vincular ao catálogo da farmácia ou digite manualmente
                  para medicamentos externos.
                </p>

                <div className="space-y-3">
                  {itens.map((item, idx) => (
                    <ItemForm
                      key={idx}
                      item={item}
                      index={idx}
                      onChange={updateItem}
                      onRemove={removeItem}
                      onDuplicate={duplicateItem}
                      expanded={expandedIdx === idx}
                      onToggle={() =>
                        setExpandedIdx(expandedIdx === idx ? -1 : idx)
                      }
                      total={itens.length}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 w-full py-2.5 border-2 border-dashed border-bg-300 rounded-xl text-sm text-secondary-400 hover:text-primary-600 hover:border-primary-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Adicionar mais um medicamento
                </button>
              </section>

              {/* ── Seção: Orientações ─────────────────────── */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">
                  Orientações
                </h4>
                <p className="text-xs text-secondary-400 mb-3">
                  Campos opcionais que aparecerão na receita impressa
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="label">Observações gerais</label>
                    <textarea
                      className="textarea"
                      rows={2}
                      value={observacoesGerais}
                      onChange={(e) => setObservacoesGerais(e.target.value)}
                      placeholder="Observações técnicas ou restrições alimentares..."
                    />
                  </div>
                  <div>
                    <label className="label">Orientações ao paciente</label>
                    <textarea
                      className="textarea"
                      rows={2}
                      value={orientacoesPaciente}
                      onChange={(e) => setOrientacoesPaciente(e.target.value)}
                      placeholder="Ex: Retornar em 7 dias se não houver melhora. Evitar exposição solar durante o tratamento."
                    />
                  </div>
                </div>
              </section>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-t border-bg-300 bg-bg-200/50">
            <p className="text-xs text-secondary-400 hidden sm:block">
              {itens.length}{" "}
              {itens.length === 1 ? "medicamento" : "medicamentos"} ·{" "}
              {tipoCfg.label} · {tipoCfg.validade} dias de validade
            </p>
            <div className="flex gap-3 flex-1 sm:flex-none">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 sm:flex-none"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="btn-primary flex-1 sm:flex-none"
                disabled={!canSubmit}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Emitir Receita
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
