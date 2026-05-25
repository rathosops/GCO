// src/features/financeiro/components/DespesasFilters.tsx
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  ListChecks,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarClock,
  Ban,
  CalendarDays,
} from "lucide-react";
import {
  CATEGORIA_LABELS,
  CENTRO_CUSTO_LABELS,
  STATUS_LABELS,
  FORMA_PAGAMENTO_LABELS,
  RECORRENCIA_LABELS,
} from "@/types/despesas.types";
import type { Situacao, TipoData } from "@/services/despesas.api";
import { formatCurrencyBRL } from "@/utils/formatters";

export interface DespesasFiltersState {
  searchInput: string;

  // Filtros intuitivos principais
  situacao: Situacao | "";
  mes: string; // '' | '1'..'12'
  ano: string; // '' | 'YYYY'
  tipo_data: TipoData; // default: 'competencia'

  // Classificação
  categoria: string;
  tipo_custo: string;
  centro_custo: string;
  status: string;
  recorrencia: string;
  forma_pagamento: string;

  // Intervalos avançados
  data_vencimento_inicio: string;
  data_vencimento_fim: string;
  data_competencia_inicio: string;
  data_competencia_fim: string;
  data_criacao_inicio: string;
  data_criacao_fim: string;

  // Faixa de valor
  valor_min: string;
  valor_max: string;

  order: string;
  limit: number;
}

interface DespesasFiltersProps {
  filters: DespesasFiltersState;
  onChange: <K extends keyof DespesasFiltersState>(
    key: K,
    value: DespesasFiltersState[K],
  ) => void;
  onReset: () => void;
  totals?: { total: number; pendente: number; atrasado: number };
}

// ── Utils ─────────────────────────────────────────────────────────────
const MESES = [
  { v: "1", l: "Janeiro" },
  { v: "2", l: "Fevereiro" },
  { v: "3", l: "Março" },
  { v: "4", l: "Abril" },
  { v: "5", l: "Maio" },
  { v: "6", l: "Junho" },
  { v: "7", l: "Julho" },
  { v: "8", l: "Agosto" },
  { v: "9", l: "Setembro" },
  { v: "10", l: "Outubro" },
  { v: "11", l: "Novembro" },
  { v: "12", l: "Dezembro" },
];

const TIPO_DATA_OPTIONS: { value: TipoData; label: string; hint: string }[] = [
  {
    value: "competencia",
    label: "Competência",
    hint: "Mês a que a despesa se refere",
  },
  {
    value: "vencimento",
    label: "Vencimento",
    hint: "Mês em que a despesa vence",
  },
  {
    value: "pagamento",
    label: "Pagamento",
    hint: "Mês em que foi efetivamente paga",
  },
  {
    value: "criacao",
    label: "Cadastro",
    hint: "Mês em que foi registrada no sistema",
  },
];

const SITUACAO_CHIPS: {
  value: Situacao | "";
  label: string;
  Icon: typeof ListChecks;
  activeClass: string;
}[] = [
  {
    value: "",
    label: "Todas",
    Icon: ListChecks,
    activeClass: "bg-primary-600 text-white border-primary-600",
  },
  {
    value: "pagas",
    label: "Pagas",
    Icon: CheckCircle2,
    activeClass: "bg-green-600 text-white border-green-600",
  },
  {
    value: "pendentes",
    label: "Pendentes",
    Icon: Clock,
    activeClass: "bg-amber-500 text-white border-amber-500",
  },
  {
    value: "atrasadas",
    label: "Atrasadas",
    Icon: AlertTriangle,
    activeClass: "bg-red-600 text-white border-red-600",
  },
  {
    value: "vencendo",
    label: "Vencendo (7d)",
    Icon: CalendarClock,
    activeClass: "bg-orange-500 text-white border-orange-500",
  },
  {
    value: "canceladas",
    label: "Canceladas",
    Icon: Ban,
    activeClass: "bg-secondary-600 text-white border-secondary-600",
  },
];

function buildAnos(): string[] {
  const atual = new Date().getFullYear();
  const arr: string[] = [];
  for (let y = atual + 1; y >= atual - 5; y--) arr.push(String(y));
  return arr;
}

// ── Componente ────────────────────────────────────────────────────────
export default function DespesasFilters({
  filters,
  onChange,
  onReset,
  totals,
}: DespesasFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const anos = useMemo(buildAnos, []);

  const hasFilters = !!(
    filters.searchInput ||
    filters.situacao ||
    filters.mes ||
    filters.ano ||
    filters.categoria ||
    filters.tipo_custo ||
    filters.centro_custo ||
    filters.status ||
    filters.recorrencia ||
    filters.forma_pagamento ||
    filters.data_vencimento_inicio ||
    filters.data_vencimento_fim ||
    filters.data_competencia_inicio ||
    filters.data_competencia_fim ||
    filters.data_criacao_inicio ||
    filters.data_criacao_fim ||
    filters.valor_min ||
    filters.valor_max
  );

  const advancedCount = [
    filters.tipo_custo,
    filters.centro_custo,
    filters.status,
    filters.recorrencia,
    filters.forma_pagamento,
    filters.data_vencimento_inicio,
    filters.data_vencimento_fim,
    filters.data_competencia_inicio,
    filters.data_competencia_fim,
    filters.data_criacao_inicio,
    filters.data_criacao_fim,
    filters.valor_min,
    filters.valor_max,
  ].filter(Boolean).length;

  const tipoDataHint = TIPO_DATA_OPTIONS.find(
    (t) => t.value === filters.tipo_data,
  )?.hint;

  return (
    <div className="card space-y-4">
      {/* Totais resumidos da lista filtrada */}
      {totals &&
        (totals.total > 0 || totals.pendente > 0 || totals.atrasado > 0) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm pb-3 border-b border-secondary-100">
            <span className="text-secondary-600">
              Total filtrado:{" "}
              <strong className="text-secondary-900">
                {formatCurrencyBRL(totals.total)}
              </strong>
            </span>
            {totals.pendente > 0 && (
              <span className="text-amber-700">
                Pendente: <strong>{formatCurrencyBRL(totals.pendente)}</strong>
              </span>
            )}
            {totals.atrasado > 0 && (
              <span className="text-red-700">
                Atrasado: <strong>{formatCurrencyBRL(totals.atrasado)}</strong>
              </span>
            )}
          </div>
        )}

      {/* Linha 1: Busca + ações */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
          <input
            type="text"
            placeholder="Buscar por descrição, fornecedor ou nº do documento..."
            value={filters.searchInput}
            onChange={(e) => onChange("searchInput", e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {hasFilters && (
            <button
              onClick={onReset}
              className="btn-ghost text-sm whitespace-nowrap"
              type="button"
            >
              <X className="h-4 w-4" /> Limpar
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-secondary text-sm whitespace-nowrap"
            type="button"
          >
            <Filter className="h-4 w-4" />
            Avançado
            {advancedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary-600 text-white">
                {advancedCount}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Linha 2: Mês / Ano / Tipo de data + Categoria */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="label text-xs flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Mês
          </label>
          <select
            value={filters.mes}
            onChange={(e) => onChange("mes", e.target.value)}
            className="select"
          >
            <option value="">Todos os meses</option>
            {MESES.map((m) => (
              <option key={m.v} value={m.v}>
                {m.l}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label text-xs">Ano</label>
          <select
            value={filters.ano}
            onChange={(e) => onChange("ano", e.target.value)}
            className="select"
          >
            <option value="">Todos os anos</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="label text-xs">Filtrar mês por</label>
          <select
            value={filters.tipo_data}
            onChange={(e) => onChange("tipo_data", e.target.value as TipoData)}
            className="select"
            disabled={!filters.mes && !filters.ano}
            title={tipoDataHint}
          >
            {TIPO_DATA_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="label text-xs">Categoria</label>
          <select
            value={filters.categoria}
            onChange={(e) => onChange("categoria", e.target.value)}
            className="select"
          >
            <option value="">Todas as categorias</option>
            {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hint do tipo de data */}
      {(filters.mes || filters.ano) && tipoDataHint && (
        <p className="text-xs text-secondary-500 -mt-1 inline-flex items-center gap-1.5">
          <Info className="h-3 w-3" />
          {tipoDataHint}.
        </p>
      )}

      {/* Linha 3: Chips de situação */}
      <div className="flex flex-wrap gap-2">
        {SITUACAO_CHIPS.map(({ value, label, Icon, activeClass }) => {
          const isActive = filters.situacao === value;
          return (
            <button
              key={value || "todas"}
              type="button"
              onClick={() => onChange("situacao", value)}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                isActive
                  ? activeClass
                  : "bg-white text-secondary-600 border-secondary-200 hover:border-secondary-400",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Painel avançado */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-secondary-100 space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary-50 text-sm text-primary-700">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Filtros adicionais para análises específicas. Os filtros são
                  cumulativos (AND) e se aplicam <em>além</em> de mês, situação
                  e categoria já selecionados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="label text-xs">Tipo de custo</label>
                  <select
                    value={filters.tipo_custo}
                    onChange={(e) => onChange("tipo_custo", e.target.value)}
                    className="select"
                  >
                    <option value="">Fixo e variável</option>
                    <option value="FIXO">Apenas fixo</option>
                    <option value="VARIAVEL">Apenas variável</option>
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Centro de custo</label>
                  <select
                    value={filters.centro_custo}
                    onChange={(e) => onChange("centro_custo", e.target.value)}
                    className="select"
                  >
                    <option value="">Todos os setores</option>
                    {Object.entries(CENTRO_CUSTO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Status (granular)</label>
                  <select
                    value={filters.status}
                    onChange={(e) => onChange("status", e.target.value)}
                    className="select"
                  >
                    <option value="">Todos os status</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Recorrência</label>
                  <select
                    value={filters.recorrencia}
                    onChange={(e) => onChange("recorrencia", e.target.value)}
                    className="select"
                  >
                    <option value="">Todas</option>
                    {Object.entries(RECORRENCIA_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Forma de pagamento</label>
                  <select
                    value={filters.forma_pagamento}
                    onChange={(e) =>
                      onChange("forma_pagamento", e.target.value)
                    }
                    className="select"
                  >
                    <option value="">Todas</option>
                    {Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Vencimento de</label>
                  <input
                    type="date"
                    value={filters.data_vencimento_inicio}
                    onChange={(e) =>
                      onChange("data_vencimento_inicio", e.target.value)
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label text-xs">Vencimento até</label>
                  <input
                    type="date"
                    value={filters.data_vencimento_fim}
                    onChange={(e) =>
                      onChange("data_vencimento_fim", e.target.value)
                    }
                    className="input"
                  />
                </div>

                <div>
                  <label className="label text-xs">Competência de</label>
                  <input
                    type="date"
                    value={filters.data_competencia_inicio}
                    onChange={(e) =>
                      onChange("data_competencia_inicio", e.target.value)
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label text-xs">Competência até</label>
                  <input
                    type="date"
                    value={filters.data_competencia_fim}
                    onChange={(e) =>
                      onChange("data_competencia_fim", e.target.value)
                    }
                    className="input"
                  />
                </div>

                <div>
                  <label className="label text-xs">Cadastrada de</label>
                  <input
                    type="date"
                    value={filters.data_criacao_inicio}
                    onChange={(e) =>
                      onChange("data_criacao_inicio", e.target.value)
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label text-xs">Cadastrada até</label>
                  <input
                    type="date"
                    value={filters.data_criacao_fim}
                    onChange={(e) =>
                      onChange("data_criacao_fim", e.target.value)
                    }
                    className="input"
                  />
                </div>

                <div>
                  <label className="label text-xs">Valor mínimo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={filters.valor_min}
                    onChange={(e) => onChange("valor_min", e.target.value)}
                    className="input"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="label text-xs">Valor máximo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={filters.valor_max}
                    onChange={(e) => onChange("valor_max", e.target.value)}
                    className="input"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="label text-xs">Ordenar por</label>
                  <select
                    value={filters.order}
                    onChange={(e) => onChange("order", e.target.value)}
                    className="select"
                  >
                    <option value="vencimento_desc">
                      Vencimento mais recente
                    </option>
                    <option value="vencimento_asc">
                      Vencimento mais antigo
                    </option>
                    <option value="valor_desc">Maior valor primeiro</option>
                    <option value="valor_asc">Menor valor primeiro</option>
                    <option value="competencia_desc">
                      Competência mais recente
                    </option>
                    <option value="competencia_asc">
                      Competência mais antiga
                    </option>
                    <option value="criacao_desc">Cadastro mais recente</option>
                    <option value="criacao_asc">Cadastro mais antigo</option>
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Itens por página</label>
                  <select
                    value={filters.limit}
                    onChange={(e) => onChange("limit", Number(e.target.value))}
                    className="select"
                  >
                    <option value={12}>12 itens</option>
                    <option value={24}>24 itens</option>
                    <option value={50}>50 itens</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
