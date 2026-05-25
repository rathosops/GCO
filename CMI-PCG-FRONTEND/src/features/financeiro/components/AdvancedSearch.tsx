// src/features/financeiro/components/AdvancedSearch.tsx
import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  X,
  Calendar,
  DollarSign,
  Building2,
  User,
  HandCoins,
  Receipt,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileDown,
  Eye,
} from "lucide-react";
import { analyticsAPI } from "@/services/analytics.api";
import type {
  AdvancedSearchFilters,
  AdvancedSearchResult,
  AdvancedSearchPayment,
} from "@/types/analytics.types";
import { downloadTextFile } from "@/utils/csv";

function moneyBR(value: number): string {
  try {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

const INITIAL_FILTERS: AdvancedSearchFilters = {
  data_inicio: "",
  data_fim: "",
  origem: "",
  tipo: "",
  valor_min: undefined,
  valor_max: undefined,
  possui_desconto: undefined,
  vinculado_nota_fiscal: undefined,
  search: "",
  limit: 20,
  offset: 0,
  order: "data_desc",
};

export default function AdvancedSearch() {
  const [filters, setFilters] =
    useState<AdvancedSearchFilters>(INITIAL_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvancedSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] =
    useState<AdvancedSearchPayment | null>(null);

  const updateFilter = useCallback(
    <K extends keyof AdvancedSearchFilters>(
      key: K,
      value: AdvancedSearchFilters[K],
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value, offset: 0 }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setResult(null);
    setError(null);
  }, []);

  const handleSearch = useCallback(
    async (newOffset?: number) => {
      setLoading(true);
      setError(null);

      try {
        const params: AdvancedSearchFilters = {
          ...filters,
          offset: newOffset ?? filters.offset,
        };

        // Remove campos vazios
        Object.keys(params).forEach((key) => {
          const k = key as keyof AdvancedSearchFilters;
          if (params[k] === "" || params[k] === undefined) {
            delete params[k];
          }
        });

        const data = await analyticsAPI.search(params);
        setResult(data);
        if (newOffset !== undefined) {
          setFilters((prev) => ({ ...prev, offset: newOffset }));
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || "Erro ao buscar pagamentos");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  const handleExportCsv = useCallback(() => {
    if (!result?.pagamentos?.length) return;

    const header = [
      "ID",
      "Data",
      "Tipo",
      "Origem",
      "Valor",
      "Desconto",
      "Líquido",
      "Paciente",
      "CPF",
      "Empresa",
      "Convênio",
      "Nota Fiscal",
      "Descrição",
    ];

    const rows = result.pagamentos.map((p) => [
      p.id,
      p.data,
      p.tipo,
      p.origem,
      p.valor,
      p.valor_desconto,
      p.valor_liquido,
      p.nome_do_paciente ?? "",
      p.cpf ?? "",
      p.nome_empresa ?? "",
      p.nome_convenio ?? "",
      p.numero_nota_fiscal ?? "",
      p.descricao ?? "",
    ]);

    const csv = [
      header.join(";"),
      ...rows.map((r) =>
        r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";"),
      ),
    ].join("\n");

    const dt = new Date();
    const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    downloadTextFile(`busca_avancada_${stamp}.csv`, csv);
  }, [result]);

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.data_inicio ||
      filters.data_fim ||
      filters.origem ||
      filters.tipo ||
      filters.valor_min ||
      filters.valor_max ||
      filters.search ||
      filters.possui_desconto !== undefined ||
      filters.vinculado_nota_fiscal !== undefined
    );
  }, [filters]);

  const currentPage =
    Math.floor((filters.offset ?? 0) / (filters.limit ?? 20)) + 1;
  const totalPages = result
    ? Math.ceil(result.total / (filters.limit ?? 20))
    : 0;

  return (
    <div className="space-y-4">
      {/* Filtros Principais */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-bold text-secondary-900">
              Busca Avançada
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="btn-ghost text-sm text-secondary-600"
                type="button"
              >
                <X className="h-4 w-4" />
                Limpar
              </button>
            )}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="btn-secondary text-sm"
              type="button"
            >
              <Filter className="h-4 w-4" />
              {showAdvanced ? "Menos filtros" : "Mais filtros"}
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Busca textual + datas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="label">Busca geral</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Nome, CPF, descrição, nº nota fiscal..."
                value={filters.search ?? ""}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="label">Data início</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="date"
                value={filters.data_inicio ?? ""}
                onChange={(e) => updateFilter("data_inicio", e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="label">Data fim</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="date"
                value={filters.data_fim ?? ""}
                onChange={(e) => updateFilter("data_fim", e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
        </div>

        {/* Filtros avançados */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t border-secondary-100">
                <div>
                  <label className="label">Origem</label>
                  <select
                    value={filters.origem ?? ""}
                    onChange={(e) => updateFilter("origem", e.target.value)}
                    className="select"
                  >
                    <option value="">Todas</option>
                    <option value="PACIENTE">Paciente</option>
                    <option value="EMPRESA">Empresa</option>
                    <option value="CONVÊNIO">Convênio</option>
                    <option value="OUTROS">Outros</option>
                    <option value="EXAMES">Exames</option>
                  </select>
                </div>

                <div>
                  <label className="label">Tipo</label>
                  <select
                    value={filters.tipo ?? ""}
                    onChange={(e) => updateFilter("tipo", e.target.value)}
                    className="select"
                  >
                    <option value="">Todos</option>
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="DÉBITO">Débito</option>
                    <option value="CRÉDITO">Crédito</option>
                    <option value="TRANSFERÊNCIA BANCÁRIA">
                      Transferência
                    </option>
                  </select>
                </div>

                <div>
                  <label className="label">Valor mínimo</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={filters.valor_min ?? ""}
                      onChange={(e) =>
                        updateFilter(
                          "valor_min",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Valor máximo</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={filters.valor_max ?? ""}
                      onChange={(e) =>
                        updateFilter(
                          "valor_max",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Desconto</label>
                  <select
                    value={
                      filters.possui_desconto === undefined
                        ? ""
                        : filters.possui_desconto
                          ? "true"
                          : "false"
                    }
                    onChange={(e) =>
                      updateFilter(
                        "possui_desconto",
                        e.target.value === ""
                          ? undefined
                          : e.target.value === "true",
                      )
                    }
                    className="select"
                  >
                    <option value="">Todos</option>
                    <option value="true">Com desconto</option>
                    <option value="false">Sem desconto</option>
                  </select>
                </div>

                <div>
                  <label className="label flex items-center gap-1">
                    <Receipt className="h-4 w-4" />
                    Nota Fiscal
                  </label>
                  <select
                    value={
                      filters.vinculado_nota_fiscal === undefined
                        ? ""
                        : filters.vinculado_nota_fiscal
                          ? "true"
                          : "false"
                    }
                    onChange={(e) =>
                      updateFilter(
                        "vinculado_nota_fiscal",
                        e.target.value === ""
                          ? undefined
                          : e.target.value === "true",
                      )
                    }
                    className="select"
                  >
                    <option value="">Todos</option>
                    <option value="true">Com nota fiscal</option>
                    <option value="false">Sem nota fiscal</option>
                  </select>
                </div>

                <div>
                  <label className="label">Ordenação</label>
                  <select
                    value={filters.order ?? "data_desc"}
                    onChange={(e) =>
                      updateFilter("order", e.target.value as any)
                    }
                    className="select"
                  >
                    <option value="data_desc">Data (mais recente)</option>
                    <option value="data_asc">Data (mais antiga)</option>
                    <option value="valor_desc">Valor (maior)</option>
                    <option value="valor_asc">Valor (menor)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Resultados</label>
                  <select
                    value={filters.limit ?? 20}
                    onChange={(e) =>
                      updateFilter("limit", Number(e.target.value))
                    }
                    className="select"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão de busca */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => handleSearch(0)}
            className="btn-primary"
            disabled={loading}
            type="button"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            Buscar
          </button>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 rounded-xl bg-danger-light border border-danger/20 text-danger">
          {error}
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="card space-y-4">
          {/* Header dos resultados */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-secondary-900">
                {result.total} resultado{result.total !== 1 ? "s" : ""}{" "}
                encontrado{result.total !== 1 ? "s" : ""}
              </h4>
              <p className="text-sm text-secondary-500">
                Total: {moneyBR(result.resumo.total_bruto)} bruto |{" "}
                {moneyBR(result.resumo.total_liquido)} líquido
              </p>
            </div>

            <button
              onClick={handleExportCsv}
              className="btn-secondary"
              disabled={!result.pagamentos?.length}
              type="button"
            >
              <FileDown className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>

          {/* Tabela de resultados */}
          {result.pagamentos?.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Origem</th>
                    <th>Nome</th>
                    <th className="text-right">Valor</th>
                    <th className="text-right">Líquido</th>
                    <th>NF</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {result.pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{p.data}</td>
                      <td>
                        <span className="badge-info">{p.tipo}</span>
                      </td>
                      <td>
                        <span className="badge-secondary">{p.origem}</span>
                      </td>
                      <td className="max-w-[200px] truncate">
                        {p.nome_do_paciente ||
                          p.nome_empresa ||
                          p.nome_convenio ||
                          "—"}
                      </td>
                      <td className="text-right font-medium">
                        {moneyBR(p.valor)}
                      </td>
                      <td className="text-right font-medium text-primary-600">
                        {moneyBR(p.valor_liquido)}
                      </td>
                      <td>
                        {p.vinculado_nota_fiscal ? (
                          <span className="badge-success">
                            <Receipt className="h-3 w-3 mr-1" />
                            {p.numero_nota_fiscal || "Sim"}
                          </span>
                        ) : (
                          <span className="text-secondary-400">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedPayment(p)}
                          className="btn-ghost btn-sm"
                          type="button"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state py-8">
              <Search className="empty-state-icon" />
              <p className="empty-state-title">Nenhum resultado</p>
              <p className="empty-state-description">
                Ajuste os filtros e tente novamente.
              </p>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-secondary-100">
              <button
                onClick={() =>
                  handleSearch(
                    Math.max(0, (filters.offset ?? 0) - (filters.limit ?? 20)),
                  )
                }
                className="btn-secondary"
                disabled={currentPage <= 1 || loading}
                type="button"
              >
                Anterior
              </button>

              <span className="text-sm text-secondary-600">
                Página {currentPage} de {totalPages}
              </span>

              <button
                onClick={() =>
                  handleSearch((filters.offset ?? 0) + (filters.limit ?? 20))
                }
                className="btn-secondary"
                disabled={currentPage >= totalPages || loading}
                type="button"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de detalhes */}
      <AnimatePresence>
        {selectedPayment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPayment(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-secondary-900">
                    Detalhes do Pagamento
                  </h3>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="btn-icon btn-ghost"
                    type="button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-secondary-500">ID</p>
                      <p className="font-medium">#{selectedPayment.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500">Data</p>
                      <p className="font-medium">{selectedPayment.data}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500">Tipo</p>
                      <p className="font-medium">{selectedPayment.tipo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500">Origem</p>
                      <p className="font-medium">{selectedPayment.origem}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-3 bg-secondary-50 rounded-xl">
                    <div>
                      <p className="text-xs text-secondary-500">Valor bruto</p>
                      <p className="text-lg font-bold">
                        {moneyBR(selectedPayment.valor)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500">Desconto</p>
                      <p className="text-lg font-bold text-danger">
                        {selectedPayment.valor_desconto > 0
                          ? moneyBR(selectedPayment.valor_desconto)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500">Líquido</p>
                      <p className="text-lg font-bold text-primary-600">
                        {moneyBR(selectedPayment.valor_liquido)}
                      </p>
                    </div>
                  </div>

                  {selectedPayment.nome_do_paciente && (
                    <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl">
                      <User className="h-5 w-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-indigo-600">Paciente</p>
                        <p className="font-medium text-indigo-900">
                          {selectedPayment.nome_do_paciente}
                        </p>
                        {selectedPayment.cpf && (
                          <p className="text-xs text-indigo-700">
                            CPF: {selectedPayment.cpf}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedPayment.nome_empresa && (
                    <div className="flex items-center gap-2 p-3 bg-cyan-50 rounded-xl">
                      <Building2 className="h-5 w-5 text-cyan-600" />
                      <div>
                        <p className="text-xs text-cyan-600">Empresa</p>
                        <p className="font-medium text-cyan-900">
                          {selectedPayment.nome_empresa}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedPayment.nome_convenio && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl">
                      <HandCoins className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="text-xs text-amber-600">Convênio</p>
                        <p className="font-medium text-amber-900">
                          {selectedPayment.nome_convenio}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedPayment.vinculado_nota_fiscal && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
                      <Receipt className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-xs text-green-600">Nota Fiscal</p>
                        <p className="font-medium text-green-900">
                          Nº {selectedPayment.numero_nota_fiscal || "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedPayment.descricao && (
                    <div>
                      <p className="text-xs text-secondary-500 mb-1">
                        Descrição
                      </p>
                      <p className="text-sm text-secondary-700">
                        {selectedPayment.descricao}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-secondary-100">
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="btn-secondary w-full"
                    type="button"
                  >
                    Fechar
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
