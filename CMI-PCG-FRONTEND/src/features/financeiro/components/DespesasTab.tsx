// src/features/financeiro/components/DespesasTab.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Receipt,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Info,
} from "lucide-react";
import { debounce } from "@/utils/debounce";
import { downloadTextFile } from "@/utils/csv";
import { formatCurrencyBRL } from "@/utils/formatters";
import { despesasAPI } from "@/services/despesas.api";
import type { TipoData } from "@/services/despesas.api";
import type { Despesa, DespesaResumoMensal } from "@/types/despesas.types";
import DespesaCard from "./DespesaCard";
import DespesaFormModal from "./DespesaFormModal";
import DespesasFilters, { type DespesasFiltersState } from "./DespesasFilters";

const MONTH_NAMES = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const TIPO_DATA_KPI_LABEL: Record<TipoData, string> = {
  competencia: "Competência",
  vencimento: "Vencimento",
  pagamento: "Pagamento",
  criacao: "Cadastro",
};

const INITIAL_FILTERS: DespesasFiltersState = {
  searchInput: "",
  situacao: "",
  mes: "",
  ano: "",
  tipo_data: "competencia",
  categoria: "",
  tipo_custo: "",
  centro_custo: "",
  status: "",
  recorrencia: "",
  forma_pagamento: "",
  data_vencimento_inicio: "",
  data_vencimento_fim: "",
  data_competencia_inicio: "",
  data_competencia_fim: "",
  data_criacao_inicio: "",
  data_criacao_fim: "",
  valor_min: "",
  valor_max: "",
  order: "vencimento_desc",
  limit: 12,
};

export default function DespesasTab() {
  // Lista
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DespesasFiltersState>(INITIAL_FILTERS);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  const [payingDespesa, setPayingDespesa] = useState<Despesa | null>(null);
  const [payForm, setPayForm] = useState({
    forma_pagamento: "",
    conta_saida: "",
  });
  const [paying, setPaying] = useState(false);

  const [cancellingDespesa, setCancellingDespesa] = useState<Despesa | null>(
    null,
  );
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Resumo (KPIs)
  const [resumo, setResumo] = useState<DespesaResumoMensal | null>(null);
  const [resumoLoading, setResumoLoading] = useState(true);

  // Mês/Ano efetivos para o resumo: usa filtro se houver, caso contrário hoje
  const now = useMemo(() => new Date(), []);
  const mesEfetivo = filters.mes ? Number(filters.mes) : now.getMonth() + 1;
  const anoEfetivo = filters.ano ? Number(filters.ano) : now.getFullYear();
  const tipoDataEfetivo = filters.tipo_data;
  const mesNome = MONTH_NAMES[mesEfetivo];

  // Debounce search
  const debouncedSetSearch = useMemo(
    () =>
      debounce((v: string) => {
        setOffset(0);
        setSearch(v.trim());
      }, 400),
    [],
  );
  useEffect(() => {
    debouncedSetSearch(filters.searchInput);
  }, [filters.searchInput, debouncedSetSearch]);

  // Load despesas
  const loadDespesas = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        limit: filters.limit,
        offset,
        order: filters.order,
        tipo_data: filters.tipo_data,
      };
      if (search) params.search = search;
      if (filters.situacao) params.situacao = filters.situacao;
      if (filters.mes) params.mes = Number(filters.mes);
      if (filters.ano) params.ano = Number(filters.ano);
      if (filters.categoria) params.categoria = filters.categoria;
      if (filters.tipo_custo) params.tipo_custo = filters.tipo_custo;
      if (filters.centro_custo) params.centro_custo = filters.centro_custo;
      if (filters.status) params.status = filters.status;
      if (filters.recorrencia) params.recorrencia = filters.recorrencia;
      if (filters.forma_pagamento)
        params.forma_pagamento = filters.forma_pagamento;
      if (filters.data_vencimento_inicio)
        params.data_vencimento_inicio = filters.data_vencimento_inicio;
      if (filters.data_vencimento_fim)
        params.data_vencimento_fim = filters.data_vencimento_fim;
      if (filters.data_competencia_inicio)
        params.data_competencia_inicio = filters.data_competencia_inicio;
      if (filters.data_competencia_fim)
        params.data_competencia_fim = filters.data_competencia_fim;
      if (filters.data_criacao_inicio)
        params.data_criacao_inicio = filters.data_criacao_inicio;
      if (filters.data_criacao_fim)
        params.data_criacao_fim = filters.data_criacao_fim;
      if (filters.valor_min) params.valor_min = Number(filters.valor_min);
      if (filters.valor_max) params.valor_max = Number(filters.valor_max);

      const dataRes = await despesasAPI.getAll(params as never);
      setDespesas(Array.isArray(dataRes) ? dataRes : []);
      setHasNext((dataRes?.length ?? 0) === filters.limit);
    } catch (e) {
      console.error("Erro ao carregar despesas:", e);
      setDespesas([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [search, filters, offset]);

  useEffect(() => {
    loadDespesas();
  }, [loadDespesas]);

  // Load resumo (sincronizado com mês/ano/tipo_data do filtro)
  const loadResumo = useCallback(async () => {
    try {
      setResumoLoading(true);
      const r = await despesasAPI.getResumo(
        mesEfetivo,
        anoEfetivo,
        tipoDataEfetivo,
      );
      setResumo(r);
    } catch (e) {
      console.error("Erro ao carregar resumo despesas:", e);
    } finally {
      setResumoLoading(false);
    }
  }, [mesEfetivo, anoEfetivo, tipoDataEfetivo]);

  useEffect(() => {
    loadResumo();
  }, [loadResumo]);

  // Handlers
  const handleFilterChange = useCallback(
    <K extends keyof DespesasFiltersState>(
      key: K,
      value: DespesasFiltersState[K],
    ) => {
      setOffset(0);
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setOffset(0);
    setFilters(INITIAL_FILTERS);
    setSearch("");
  }, []);

  const refresh = useCallback(() => {
    loadDespesas();
    loadResumo();
  }, [loadDespesas, loadResumo]);

  const openCreate = useCallback(() => {
    setMode("create");
    setEditingDespesa(null);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((d: Despesa) => {
    setMode("edit");
    setEditingDespesa(d);
    setShowModal(true);
  }, []);

  // Quick filter shortcuts (KPI cards clicáveis)
  const setQuickSituacao = useCallback(
    (situacao: DespesasFiltersState["situacao"]) => {
      setOffset(0);
      setFilters((prev) => ({
        ...prev,
        situacao: prev.situacao === situacao ? "" : situacao,
      }));
    },
    [],
  );

  // Pagar
  const handlePagar = useCallback(async () => {
    if (!payingDespesa?.id) return;
    setPaying(true);
    try {
      await despesasAPI.marcarPaga(payingDespesa.id, {
        forma_pagamento: payForm.forma_pagamento || undefined,
        conta_saida: payForm.conta_saida || undefined,
      });
      setPayingDespesa(null);
      setPayForm({ forma_pagamento: "", conta_saida: "" });
      refresh();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error?.response?.data?.error || "Erro ao marcar como paga");
    } finally {
      setPaying(false);
    }
  }, [payingDespesa, payForm, refresh]);

  // Cancelar
  const handleCancelar = useCallback(async () => {
    if (!cancellingDespesa?.id) return;
    setCancelling(true);
    try {
      await despesasAPI.cancelar(
        cancellingDespesa.id,
        cancelMotivo || undefined,
      );
      setCancellingDespesa(null);
      setCancelMotivo("");
      refresh();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error?.response?.data?.error || "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  }, [cancellingDespesa, cancelMotivo, refresh]);

  // Delete
  const doDelete = useCallback(async () => {
    if (deletingId == null) return;
    setDeleting(true);
    try {
      await despesasAPI.delete(deletingId);
      setDeletingId(null);
      refresh();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error?.response?.data?.error || "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  }, [deletingId, refresh]);

  // Helper: pega o valor efetivo de uma despesa (preferindo o que veio do backend)
  const getValorEfetivo = useCallback((d: Despesa): number => {
    if (typeof d.valor_efetivo === "number") return d.valor_efetivo;
    if (d.status === "PAGA" && d.valor_pago != null) {
      return Number(d.valor_pago);
    }
    const valor = Number(d.valor || 0);
    const desconto = Number(d.valor_desconto || 0);
    const juros = Number(d.valor_juros_multa || 0);
    return valor + juros - desconto;
  }, []);

  // Export CSV
  const exportCsv = useCallback(() => {
    const header = [
      "id",
      "descricao",
      "categoria",
      "tipo_custo",
      "centro_custo",
      "valor_cadastrado",
      "valor_desconto",
      "valor_juros_multa",
      "valor_pago",
      "valor_efetivo",
      "status",
      "data_vencimento",
      "data_competencia",
      "data_pagamento",
      "forma_pagamento",
      "fornecedor_nome",
      "numero_documento",
    ];
    const rows = despesas.map((d) => [
      d.id ?? "",
      d.descricao,
      d.categoria,
      d.tipo_custo,
      d.centro_custo ?? "",
      d.valor,
      d.valor_desconto ?? "",
      d.valor_juros_multa ?? "",
      d.valor_pago ?? "",
      formatCurrencyBRL(getValorEfetivo(d)),
      d.status,
      d.data_vencimento,
      d.data_competencia,
      d.data_pagamento ?? "",
      d.forma_pagamento ?? "",
      d.fornecedor_nome ?? "",
      d.numero_documento ?? "",
    ]);
    const csv = [
      header.join(";"),
      ...rows.map((r) =>
        r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";"),
      ),
    ].join("\n");
    const stamp = new Date().toISOString().split("T")[0];
    downloadTextFile(`despesas_${stamp}.csv`, csv);
  }, [despesas, getValorEfetivo]);

  // Totais da página atual — usa valor_efetivo (real para pagas, líquido p/ outras)
  const totals = useMemo(() => {
    const total = despesas.reduce((a, d) => a + getValorEfetivo(d), 0);
    const pendente = despesas
      .filter((d) => d.status === "PENDENTE")
      .reduce((a, d) => a + getValorEfetivo(d), 0);
    const atrasado = despesas
      .filter(
        (d) =>
          d.status === "ATRASADA" ||
          (d.status === "PENDENTE" &&
            d.data_vencimento < new Date().toISOString().split("T")[0]),
      )
      .reduce((a, d) => a + getValorEfetivo(d), 0);
    return { total, pendente, atrasado };
  }, [despesas, getValorEfetivo]);

  const kpiPeriodoLabel = `${mesNome}/${anoEfetivo} · ${TIPO_DATA_KPI_LABEL[tipoDataEfetivo]}`;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
           KPI Cards — Resumo do período selecionado
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setQuickSituacao("")}
          className={`card text-left transition-all hover:shadow-md ${
            filters.situacao === "" ? "ring-2 ring-primary-300" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-red-100 rounded-xl flex-shrink-0">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary-500 leading-tight">
                Total de despesas
              </p>
              <p className="text-xs text-secondary-400">{kpiPeriodoLabel}</p>
              <p className="text-xl font-bold text-red-600 mt-1">
                {resumoLoading ? "..." : formatCurrencyBRL(resumo?.total)}
              </p>
            </div>
          </div>
        </motion.button>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          onClick={() => setQuickSituacao("pagas")}
          className={`card text-left transition-all hover:shadow-md ${
            filters.situacao === "pagas" ? "ring-2 ring-green-300" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary-500 leading-tight">
                Pagas no período
              </p>
              <p className="text-xs text-secondary-400">Clique para filtrar</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                {resumoLoading ? "..." : formatCurrencyBRL(resumo?.total_pago)}
              </p>
            </div>
          </div>
        </motion.button>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          onClick={() => setQuickSituacao("pendentes")}
          className={`card text-left transition-all hover:shadow-md ${
            filters.situacao === "pendentes" ? "ring-2 ring-amber-300" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary-500 leading-tight">
                Pendentes
              </p>
              <p className="text-xs text-secondary-400">Aguardando quitação</p>
              <p className="text-xl font-bold text-amber-600 mt-1">
                {resumoLoading ? "..." : formatCurrencyBRL(resumo?.total_pendente)}
              </p>
            </div>
          </div>
        </motion.button>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          onClick={() => setQuickSituacao("atrasadas")}
          className={`card text-left transition-all hover:shadow-md ${
            filters.situacao === "atrasadas" ? "ring-2 ring-red-300" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-red-100 rounded-xl flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary-500 leading-tight">
                Atrasadas
              </p>
              <p className="text-xs text-secondary-400">Vencidas e não pagas</p>
              <p className="text-xl font-bold text-red-700 mt-1">
                {resumoLoading ? "..." : formatCurrencyBRL(resumo?.total_atrasado)}
              </p>
            </div>
          </div>
        </motion.button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           Ações
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-sm text-secondary-500 flex items-center gap-1.5">
          <Info className="h-4 w-4" />
          Cadastre e gerencie todos os gastos operacionais da clínica.
        </p>

        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={exportCsv}
            className="btn-secondary"
            disabled={loading || !despesas.length}
          >
            <FileDown className="h-4 w-4" /> Exportar CSV
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Nova Despesa
          </motion.button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           Filtros
         ═══════════════════════════════════════════════════════════════ */}
      <DespesasFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        totals={totals}
      />

      {/* ═══════════════════════════════════════════════════════════════
           Lista
         ═══════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
        </div>
      ) : despesas.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {despesas.map((d, idx) => (
              <DespesaCard
                key={d.id}
                despesa={d}
                index={idx}
                onEdit={openEdit}
                onDelete={(id) => setDeletingId(id)}
                onPagar={(dp) => setPayingDespesa(dp)}
                onCancelar={(dc) => setCancellingDespesa(dc)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              className="btn-secondary"
              onClick={() => setOffset((o) => Math.max(0, o - filters.limit))}
              disabled={offset === 0}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <div className="text-sm text-secondary-600">
              Página {Math.floor(offset / filters.limit) + 1}
            </div>
            <button
              className="btn-secondary"
              onClick={() => setOffset((o) => o + filters.limit)}
              disabled={!hasNext}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state py-12">
            <Receipt className="empty-state-icon" />
            <p className="empty-state-title">Nenhuma despesa encontrada</p>
            <p className="empty-state-description">
              Ajuste os filtros ou clique em "Nova Despesa" para registrar
              gastos como aluguel, salários, insumos médicos, contas de
              água/luz, etc.
            </p>
          </div>
        </div>
      )}

      {/* Modal Create/Edit */}
      <DespesaFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDespesa(null);
        }}
        mode={mode}
        editingDespesa={editingDespesa}
        onSuccess={refresh}
      />

      {/* Modal Pagar */}
      <AnimatePresence>
        {payingDespesa && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !paying && setPayingDespesa(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-md"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-xl">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-secondary-900">
                      Confirmar pagamento
                    </h3>
                  </div>
                  <button
                    onClick={() => setPayingDespesa(null)}
                    className="btn-icon btn-ghost"
                    disabled={paying}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-secondary-50 mb-4">
                  <p className="text-sm font-medium text-secondary-900">
                    {payingDespesa.descricao}
                  </p>
                  <p className="text-lg font-bold text-secondary-900 mt-1">
                    {formatCurrencyBRL(payingDespesa.valor)}
                  </p>
                  <p className="text-xs text-secondary-500 mt-0.5">
                    Vencimento: {payingDespesa.data_vencimento}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">Como foi pago?</label>
                    <select
                      value={payForm.forma_pagamento}
                      onChange={(e) =>
                        setPayForm((p) => ({
                          ...p,
                          forma_pagamento: e.target.value,
                        }))
                      }
                      className="select"
                    >
                      <option value="">
                        — Selecione a forma de pagamento —
                      </option>
                      <option value="PIX">PIX</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="DEBITO_AUTOMATICO">
                        Débito Automático
                      </option>
                      <option value="TRANSFERENCIA">Transferência</option>
                      <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                      <option value="CARTAO_DEBITO">Cartão de Débito</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">De qual conta saiu?</label>
                    <input
                      value={payForm.conta_saida}
                      onChange={(e) =>
                        setPayForm((p) => ({
                          ...p,
                          conta_saida: e.target.value,
                        }))
                      }
                      className="input"
                      placeholder="Ex: Bradesco PJ, Nubank PJ, Caixa..."
                    />
                    <p className="text-xs text-secondary-400 mt-1">
                      Opcional — útil para conciliação bancária.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => setPayingDespesa(null)}
                    disabled={paying}
                  >
                    Voltar
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={handlePagar}
                    disabled={paying}
                  >
                    {paying ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Confirmar pagamento
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal Cancelar */}
      <AnimatePresence>
        {cancellingDespesa && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !cancelling && setCancellingDespesa(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-md"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-secondary-900">
                      Cancelar despesa
                    </h3>
                    <p className="text-xs text-secondary-500">
                      Despesas canceladas não poderão ser pagas.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-secondary-50 mb-4">
                  <p className="text-sm font-medium text-secondary-900">
                    {cancellingDespesa.descricao}
                  </p>
                  <p className="text-lg font-bold text-secondary-900 mt-1">
                    {formatCurrencyBRL(cancellingDespesa.valor)}
                  </p>
                </div>

                <div>
                  <label className="label">Motivo (opcional)</label>
                  <input
                    value={cancelMotivo}
                    onChange={(e) => setCancelMotivo(e.target.value)}
                    className="input"
                    placeholder="Ex: Cobrança duplicada, serviço não prestado..."
                  />
                  <p className="text-xs text-secondary-400 mt-1">
                    O motivo será registrado nas observações.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => setCancellingDespesa(null)}
                    disabled={cancelling}
                  >
                    Voltar
                  </button>
                  <button
                    className="btn-danger flex-1"
                    onClick={handleCancelar}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Confirmar cancelamento"
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal Delete */}
      <AnimatePresence>
        {deletingId != null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleting && setDeletingId(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-md"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-red-100 rounded-xl">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-secondary-900">
                    Excluir despesa permanentemente
                  </h3>
                </div>

                <p className="text-sm text-secondary-600">
                  Tem certeza que deseja excluir esta despesa?{" "}
                  <strong>Essa ação não pode ser desfeita</strong> e o registro
                  será removido de todos os relatórios.
                </p>

                <div className="flex gap-3 mt-6">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => setDeletingId(null)}
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn-danger flex-1"
                    onClick={doDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Excluir permanentemente"
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
