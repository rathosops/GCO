// src/features/financeiro/pages/FinanceiroPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Loader2,
  X,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Wallet,
  FileText,
  BarChart3,
  Receipt,
  Search,
  Upload,
  TrendingDown,
  PieChart,
} from "lucide-react";
import { pagamentosAPI } from "@/services/api";
import { Pagamento } from "@/types";
import { debounce } from "@/utils/debounce";
import { downloadTextFile } from "@/utils/csv";
import {
  PagamentoFormModal,
  PagamentoCard,
  FinanceiroFilters,
  FinanceiroFiltersState,
  ResumoGraficos,
  RelatoriosPdf,
  AnalyticsTab,
} from "@/features/financeiro/components";
import NfseImportModal from "@/features/financeiro/components/NfseImportModal";
import DespesasTab from "@/features/financeiro/components/DespesasTab";
import DespesasDRE from "@/features/financeiro/components/DespesasDRE";

type Tab = "lancamentos" | "despesas" | "analytics" | "dre" | "relatorios" | "graficos";

interface ResumoMensalData {
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  por_tipo: { tipo: string; total: number }[];
  por_origem: { origem: string; total: number }[];
  mes: number;
  ano: number;
}

const INITIAL_FILTERS: FinanceiroFiltersState = {
  searchInput: "",
  dataInicio: "",
  dataFim: "",
  origem: "",
  tipo: "",
  possuiDesconto: "",
  semVinculo: "",
  vinculadoNotaFiscal: "",
  numeroNotaFiscal: "",
  valor: "",
  order: "data_desc",
  limit: 12,
};

function moneyBR(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  try {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("lancamentos");

  // Lista + loading
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filters, setFilters] =
    useState<FinanceiroFiltersState>(INITIAL_FILTERS);
  const [search, setSearch] = useState("");

  // Paginação
  const [offset, setOffset] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // Modal CRUD
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingPagamento, setEditingPagamento] = useState<Pagamento | null>(
    null,
  );

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Resumo do mês
  const [resumoLoading, setResumoLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoMensalData | null>(null);

  // Nota fiscal
  const [notaFiscalPagamento, setNotaFiscalPagamento] =
    useState<Pagamento | null>(null);
  const [showNotaFiscal, setShowNotaFiscal] = useState(false);
  const [downloadingNotaFiscal, setDownloadingNotaFiscal] = useState(false);

  // NFS-e Import
  const [showNfseImport, setShowNfseImport] = useState(false);

  // Debounce da busca
  const debouncedSetSearch = useMemo(
    () =>
      debounce((value: string) => {
        setOffset(0);
        setSearch(value.trim());
      }, 400),
    [],
  );

  useEffect(() => {
    debouncedSetSearch(filters.searchInput);
  }, [filters.searchInput, debouncedSetSearch]);

  // Carregar pagamentos
  const loadPagamentos = useCallback(async () => {
    try {
      setLoading(true);

      const params: Record<string, unknown> = {
        limit: filters.limit,
        offset,
        order: filters.order,
      };

      if (search) params.search = search;
      if (filters.dataInicio) params.data_inicio = filters.dataInicio;
      if (filters.dataFim) params.data_fim = filters.dataFim;
      if (filters.origem) params.origem = filters.origem;
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.valor) params.valor = Number(filters.valor);
      if (filters.possuiDesconto !== "")
        params.possui_desconto = filters.possuiDesconto;
      if (filters.semVinculo !== "") params.sem_vinculo = filters.semVinculo;
      if (filters.vinculadoNotaFiscal !== "")
        params.vinculado_nota_fiscal = filters.vinculadoNotaFiscal;
      if (filters.numeroNotaFiscal)
        params.numero_nota_fiscal = filters.numeroNotaFiscal;

      const data = await pagamentosAPI.getAll(params);
      setPagamentos(Array.isArray(data) ? data : []);
      setHasNext(((data as any)?.length ?? 0) === filters.limit);
    } catch (e) {
      console.error("Erro ao carregar pagamentos:", e);
      setPagamentos([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [search, filters, offset]);

  useEffect(() => {
    loadPagamentos();
  }, [loadPagamentos]);

  // Carregar resumo mensal
  const loadResumoMensal = useCallback(async () => {
    try {
      setResumoLoading(true);
      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();
      const r = await pagamentosAPI.getResumoMensal(mes, ano);
      setResumo(r);
    } catch (e) {
      console.error("Erro ao carregar resumo mensal:", e);
      setResumo(null);
    } finally {
      setResumoLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumoMensal();
  }, [loadResumoMensal]);

  // Handlers de filtros
  const handleFilterChange = useCallback(
    <K extends keyof FinanceiroFiltersState>(
      key: K,
      value: FinanceiroFiltersState[K],
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

  // Modal handlers (CRUD)
  const openCreate = useCallback(() => {
    setMode("create");
    setEditingPagamento(null);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((p: Pagamento) => {
    setMode("edit");
    setEditingPagamento(p);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingPagamento(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    loadPagamentos();
    loadResumoMensal();
  }, [loadPagamentos, loadResumoMensal]);

  // Delete handlers
  const confirmDelete = useCallback((id: number) => {
    setDeletingId(id);
  }, []);

  const doDelete = useCallback(async () => {
    if (deletingId == null) return;
    try {
      setDeleting(true);
      await pagamentosAPI.delete(deletingId);
      setDeletingId(null);

      const willBeEmpty = pagamentos.length === 1 && offset > 0;
      if (willBeEmpty) {
        setOffset((o) => Math.max(0, o - filters.limit));
      } else {
        await loadPagamentos();
      }
      await loadResumoMensal();
    } catch (error: any) {
      console.error("Erro ao excluir pagamento:", error);
      alert(error?.response?.data?.error || "Erro ao excluir pagamento");
    } finally {
      setDeleting(false);
    }
  }, [
    deletingId,
    pagamentos.length,
    offset,
    filters.limit,
    loadPagamentos,
    loadResumoMensal,
  ]);

  // Export CSV
  const exportCsv = useCallback(() => {
    const header = [
      "id",
      "data",
      "origem",
      "tipo",
      "tipo_pessoa_pix",
      "conta_destinada_pix",
      "valor",
      "valor_desconto",
      "valor_liquido",
      "nome_do_paciente",
      "cpf",
      "nome_empresa",
      "empresa_id",
      "nome_convenio",
      "convenio_id",
      "descricao",
      "qtd_parcelas_credito",
      "vinculado_nota_fiscal",
      "numero_nota_fiscal",
    ];

    const rows = pagamentos.map((p: any) => [
      p.id ?? "",
      p.data ?? "",
      p.origem ?? "",
      p.tipo ?? "",
      p.tipo_pessoa_pix ?? "",
      p.conta_destinada_pix ?? "",
      p.valor ?? "",
      p.valor_desconto ?? "",
      p.valor_liquido ?? "",
      p.nome_do_paciente ?? "",
      p.cpf ?? "",
      p.nome_empresa ?? "",
      p.empresa_id ?? "",
      p.nome_convenio ?? "",
      p.convenio_id ?? "",
      p.descricao ?? "",
      p.qtd_parcelas_credito ?? "",
      p.vinculado_nota_fiscal ? "Sim" : "Não",
      p.numero_nota_fiscal ?? "",
    ]);

    const csv = [
      header.join(";"),
      ...rows.map((r) =>
        r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";"),
      ),
    ].join("\n");

    const dt = new Date();
    const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(dt.getDate()).padStart(2, "0")}`;

    downloadTextFile(`pagamentos_${stamp}.csv`, csv);
  }, [pagamentos]);

  // Totais da lista filtrada
  const totals = useMemo(() => {
    const bruto = pagamentos.reduce(
      (acc, p: any) => acc + Number(p.valor || 0),
      0,
    );
    const descontos = pagamentos.reduce(
      (acc, p: any) => acc + Number(p.valor_desconto || 0),
      0,
    );
    const liquido = bruto - descontos;
    return { bruto, descontos, liquido };
  }, [pagamentos]);

  // Nota fiscal: abrir/fechar modal
  const openNotaFiscal = useCallback((p: Pagamento) => {
    setNotaFiscalPagamento(p);
    setShowNotaFiscal(true);
  }, []);

  const closeNotaFiscal = useCallback(() => {
    if (downloadingNotaFiscal) return;
    setShowNotaFiscal(false);
    setNotaFiscalPagamento(null);
  }, [downloadingNotaFiscal]);

  // Nota fiscal: download PDF
  const handleDownloadNotaFiscal = useCallback(async () => {
    if (!notaFiscalPagamento?.id) return;
    try {
      setDownloadingNotaFiscal(true);
      const blobData = await pagamentosAPI.downloadNotaFiscal(
        notaFiscalPagamento.id,
      );
      const blob = new Blob([blobData], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dataLabel =
        (notaFiscalPagamento as any).data ||
        new Date().toISOString().split("T")[0];

      a.href = url;
      a.download = `nota_fiscal_pagamento_${notaFiscalPagamento.id}_${dataLabel}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar nota fiscal:", error);
      alert("Erro ao baixar nota fiscal em PDF.");
    } finally {
      setDownloadingNotaFiscal(false);
    }
  }, [notaFiscalPagamento]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">Financeiro</h2>
          <p className="text-secondary-500">
            Receitas, despesas, DRE, analytics e relatórios
          </p>
        </div>

        <div className="flex gap-3">
          {tab === "lancamentos" && (
            <>
              <button
                onClick={() => setShowNfseImport(true)}
                className="btn-secondary"
              >
                <Upload className="h-4 w-4" />
                Vincular NFS-e
              </button>

              <button
                onClick={exportCsv}
                className="btn-secondary"
                disabled={loading || pagamentos.length === 0}
              >
                <FileDown className="h-4 w-4" />
                Exportar CSV
              </button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openCreate}
                className="btn-primary"
              >
                <Plus className="h-4 w-4" />
                Novo Lançamento
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card flex flex-wrap gap-2">
        <button
          className={tab === "lancamentos" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("lancamentos")}
          type="button"
        >
          <Wallet className="h-4 w-4" />
          Receitas
        </button>

        <button
          className={tab === "despesas" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("despesas")}
          type="button"
        >
          <TrendingDown className="h-4 w-4" />
          Despesas
        </button>

        <button
          className={tab === "dre" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("dre")}
          type="button"
        >
          <PieChart className="h-4 w-4" />
          DRE
        </button>

        <button
          className={tab === "analytics" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("analytics")}
          type="button"
        >
          <Search className="h-4 w-4" />
          Analytics
        </button>

        <button
          className={tab === "relatorios" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("relatorios")}
          type="button"
        >
          <FileText className="h-4 w-4" />
          Relatórios PDF
        </button>

        <button
          className={tab === "graficos" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("graficos")}
          type="button"
        >
          <BarChart3 className="h-4 w-4" />
          Gráficos
        </button>
      </div>

      {/* Conteúdo das abas */}
      {tab === "lancamentos" && (
        <>
          {/* Filtros */}
          <FinanceiroFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            totals={totals}
          />

          {/* Lista */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
            </div>
          ) : pagamentos.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {pagamentos.map((p, idx) => (
                  <PagamentoCard
                    key={p.id}
                    pagamento={p}
                    index={idx}
                    onEdit={openEdit}
                    onDelete={confirmDelete}
                    onViewNotaFiscal={openNotaFiscal}
                  />
                ))}
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between">
                <button
                  className="btn-secondary"
                  onClick={() =>
                    setOffset((o) => Math.max(0, o - filters.limit))
                  }
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>

                <div className="text-sm text-secondary-600">
                  Página {Math.floor(offset / filters.limit) + 1}
                </div>

                <button
                  className="btn-secondary"
                  onClick={() => setOffset((o) => o + filters.limit)}
                  disabled={!hasNext}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="empty-state py-12">
                <Wallet className="empty-state-icon" />
                <p className="empty-state-title">
                  Nenhum lançamento encontrado
                </p>
                <p className="empty-state-description">
                  Ajuste filtros ou cadastre um novo lançamento.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "despesas" && <DespesasTab />}

      {tab === "dre" && <DespesasDRE />}

      {tab === "analytics" && <AnalyticsTab />}

      {tab === "relatorios" && <RelatoriosPdf />}

      {tab === "graficos" && (
        <ResumoGraficos resumo={resumo} loading={resumoLoading} />
      )}

      {/* Modal Create/Edit */}
      <PagamentoFormModal
        isOpen={showModal}
        onClose={closeModal}
        mode={mode}
        editingPagamento={editingPagamento}
        onSuccess={handleFormSuccess}
      />

      {/* Modal NFS-e Import */}
      <NfseImportModal
        isOpen={showNfseImport}
        onClose={() => setShowNfseImport(false)}
        onSuccess={() => {
          loadPagamentos();
          loadResumoMensal();
        }}
      />

      {/* Modal Confirm delete */}
      <AnimatePresence>
        {deletingId != null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => (deleting ? null : setDeletingId(null))}
              className="fixed inset-0 bg-black/50 z-40"
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-md"
              >
                <h3 className="text-lg font-bold text-secondary-900">
                  Confirmar exclusão
                </h3>

                <p className="text-sm text-secondary-600 mt-2">
                  Tem certeza que deseja excluir este lançamento? Essa ação não
                  pode ser desfeita.
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
                      "Excluir"
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal Nota Fiscal */}
      <AnimatePresence>
        {showNotaFiscal && notaFiscalPagamento && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeNotaFiscal}
              className="fixed inset-0 bg-black/50 z-40"
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary-600" />
                    <h3 className="text-xl font-bold text-secondary-900">
                      Nota fiscal do pagamento
                    </h3>
                  </div>

                  <button
                    onClick={closeNotaFiscal}
                    className="btn-icon btn-ghost"
                    type="button"
                    disabled={downloadingNotaFiscal}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {(() => {
                  const p: any = notaFiscalPagamento;
                  const valor = Number(p.valor || 0);
                  const valorDesconto = Number(p.valor_desconto || 0);
                  const valorLiquido =
                    p.valor_liquido ?? valor - valorDesconto;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-secondary-500">
                            Nº Nota Fiscal
                          </p>
                          <p className="text-lg font-bold text-secondary-900">
                            {p.numero_nota_fiscal || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-secondary-500">
                            Data
                          </p>
                          <p className="font-medium text-secondary-900">
                            {p.data || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 p-3 bg-secondary-50 rounded-xl">
                        <div>
                          <p className="text-xs text-secondary-500">
                            Valor bruto
                          </p>
                          <p className="text-lg font-bold">
                            {moneyBR(valor)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-secondary-500">
                            Desconto
                          </p>
                          <p className="text-lg font-bold text-danger">
                            {valorDesconto > 0
                              ? `- ${moneyBR(valorDesconto)}`
                              : moneyBR(0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-secondary-500">
                            Valor líquido
                          </p>
                          <p className="text-lg font-bold text-primary-600">
                            {moneyBR(valorLiquido)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-secondary-500">
                          Detalhes do pagamento
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm text-secondary-700">
                          {p.nome_do_paciente && (
                            <p>
                              <span className="font-medium">Paciente:</span>{" "}
                              {p.nome_do_paciente}
                            </p>
                          )}
                          {p.cpf && (
                            <p>
                              <span className="font-medium">CPF:</span>{" "}
                              {p.cpf}
                            </p>
                          )}
                          {p.nome_empresa && (
                            <p>
                              <span className="font-medium">Empresa:</span>{" "}
                              {p.nome_empresa}
                            </p>
                          )}
                          {p.nome_convenio && (
                            <p>
                              <span className="font-medium">Convênio:</span>{" "}
                              {p.nome_convenio}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Origem:</span>{" "}
                            {p.origem}
                          </p>
                          <p>
                            <span className="font-medium">Tipo:</span>{" "}
                            {p.tipo}
                          </p>

                          {p.tipo === "PIX" && p.tipo_pessoa_pix && (
                            <p>
                              <span className="font-medium">Tipo PIX:</span>{" "}
                              {p.tipo_pessoa_pix === "PF"
                                ? "Pessoa Física (PF)"
                                : "Pessoa Jurídica (PJ)"}
                            </p>
                          )}

                          {p.tipo === "PIX" && p.conta_destinada_pix && (
                            <p>
                              <span className="font-medium">Conta PIX:</span>{" "}
                              {p.conta_destinada_pix === "PF"
                                ? "Pessoa Física (PF)"
                                : "Pessoa Jurídica (PJ)"}
                            </p>
                          )}

                          {p.qtd_parcelas_credito && p.tipo === "CRÉDITO" && (
                            <p>
                              <span className="font-medium">Parcelas:</span>{" "}
                              {p.qtd_parcelas_credito}x
                            </p>
                          )}
                        </div>
                      </div>

                      {p.descricao && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-secondary-500">
                            Observações
                          </p>
                          <p className="text-sm text-secondary-700 whitespace-pre-wrap">
                            {p.descricao}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end pt-4">
                        <button
                          type="button"
                          className="btn-primary inline-flex items-center gap-2"
                          onClick={handleDownloadNotaFiscal}
                          disabled={downloadingNotaFiscal}
                        >
                          {downloadingNotaFiscal ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          Baixar nota fiscal (PDF)
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}