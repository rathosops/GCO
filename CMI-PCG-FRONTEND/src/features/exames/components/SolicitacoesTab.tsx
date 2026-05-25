/**
 * Aba de Histórico de Solicitações de Exames
 *
 * Features:
 * - Listagem completa com filtros (busca, status, período)
 * - Alteração de status inline
 * - Download de PDF (com ou sem valores)
 * - Paginação
 * - Responsivo (cards em mobile, tabela em desktop)
 * - Quick stats no topo
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Calendar,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Ban,
  CheckCircle2,
  ExternalLink,
  Receipt,
  Download,
  FileText,
} from "lucide-react";
import { useSolicitacoes } from "../hooks";
import { solicitacoesExamesAPI } from "../api";
import type { SolicitacaoExame, SolicitacaoStatus } from "../types";

// ── Status config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  SolicitacaoStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  PENDENTE: {
    label: "Pendente",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  FATURADO: {
    label: "Faturado",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  EXTERNO: {
    label: "Externo",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: <ExternalLink className="h-3.5 w-3.5" />,
  },
  CANCELADO: {
    label: "Cancelado",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: <Ban className="h-3.5 w-3.5" />,
  },
};

const STATUS_OPTIONS: SolicitacaoStatus[] = [
  "PENDENTE",
  "FATURADO",
  "EXTERNO",
  "CANCELADO",
];
const PAGE_SIZE = 20;

// ── Helper: trigger blob download ───────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── StatusBadge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: SolicitacaoStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDENTE;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ── StatusDropdown ──────────────────────────────────────────────────────
function StatusDropdown({
  current,
  onSelect,
  loading,
}: {
  current: SolicitacaoStatus;
  onSelect: (status: SolicitacaoStatus) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading || current === "CANCELADO"}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
          transition-all hover:bg-bg-200 disabled:opacity-50 disabled:cursor-not-allowed
          ${loading ? "animate-pulse" : ""}
        `}
        title={
          current === "CANCELADO" ? "Solicitação cancelada" : "Alterar status"
        }
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ChevronDown className="h-3 w-3 text-text-200" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-40 bg-bg-100 border border-bg-300 rounded-xl shadow-lg py-1 min-w-[140px]"
            >
              {STATUS_OPTIONS.filter((s) => s !== current).map((status) => {
                const config = STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    onClick={() => {
                      onSelect(status);
                      setOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-xs font-medium
                      hover:bg-bg-200 transition-colors ${config.color}
                    `}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── PdfDownloadDropdown ─────────────────────────────────────────────────
function PdfDownloadDropdown({
  solicitacao,
  downloadingId,
  onDownload,
}: {
  solicitacao: SolicitacaoExame;
  downloadingId: string | null;
  onDownload: (id: number, semValores: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const isDownloading =
    downloadingId === `${solicitacao.id}-com` ||
    downloadingId === `${solicitacao.id}-sem`;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isDownloading}
        className={`
          inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium
          text-primary-100 hover:bg-primary-100/10 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title="Baixar PDF"
      >
        {isDownloading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-40 bg-bg-100 border border-bg-300 rounded-xl shadow-lg py-1 min-w-[180px]"
            >
              <button
                onClick={() => {
                  onDownload(solicitacao.id, false);
                  setOpen(false);
                }}
                disabled={downloadingId === `${solicitacao.id}-com`}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-100 hover:bg-bg-200 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                Com valores
                {downloadingId === `${solicitacao.id}-com` && (
                  <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                )}
              </button>
              <button
                onClick={() => {
                  onDownload(solicitacao.id, true);
                  setOpen(false);
                }}
                disabled={downloadingId === `${solicitacao.id}-sem`}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-100 hover:bg-bg-200 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                Sem valores
                {downloadingId === `${solicitacao.id}-sem` && (
                  <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                )}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── SolicitacaoCard (mobile) ────────────────────────────────────────────
function SolicitacaoCard({
  solicitacao,
  onStatusChange,
  updatingId,
  downloadingId,
  onDownload,
}: {
  solicitacao: SolicitacaoExame;
  onStatusChange: (id: number, status: SolicitacaoStatus) => void;
  updatingId: number | null;
  downloadingId: string | null;
  onDownload: (id: number, semValores: boolean) => void;
}) {
  const examesList = solicitacao.exames
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-100 text-sm truncate">
            {solicitacao.nome_paciente}
          </p>
          <p className="text-xs text-text-200 mt-0.5">
            CPF: {solicitacao.cpf_paciente} • {solicitacao.data} às{" "}
            {solicitacao.hora}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PdfDownloadDropdown
            solicitacao={solicitacao}
            downloadingId={downloadingId}
            onDownload={onDownload}
          />
          <StatusBadge status={solicitacao.status} />
          <StatusDropdown
            current={solicitacao.status}
            onSelect={(s) => onStatusChange(solicitacao.id, s)}
            loading={updatingId === solicitacao.id}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {examesList.slice(0, 4).map((nome, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-bg-200 rounded text-[11px] text-text-200 font-medium"
          >
            {nome}
          </span>
        ))}
        {examesList.length > 4 && (
          <span className="px-2 py-0.5 bg-primary-100/10 text-primary-100 rounded text-[11px] font-medium">
            +{examesList.length - 4}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-bg-200">
        <p className="text-xs text-text-200">
          {solicitacao.nome_medico ? `Dr(a). ${solicitacao.nome_medico}` : "—"}
        </p>
        <div className="text-right">
          {solicitacao.valor_desconto > 0 && (
            <p className="text-[10px] text-red-500 line-through tabular-nums">
              R$ {solicitacao.soma_dos_valores.toFixed(2)}
            </p>
          )}
          <p className="font-bold text-sm text-text-100 tabular-nums">
            R$ {solicitacao.valor_final.toFixed(2)}
          </p>
        </div>
      </div>

      {solicitacao.observacoes && (
        <p className="text-xs text-text-200 bg-bg-200 rounded-lg p-2 italic">
          {solicitacao.observacoes}
        </p>
      )}
    </motion.div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────
export function SolicitacoesTab() {
  const { items, loading, filters, setFilter, reload } = useSolicitacoes({
    limit: PAGE_SIZE,
  });

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const handleStatusChange = useCallback(
    async (id: number, newStatus: SolicitacaoStatus) => {
      setUpdatingId(id);
      try {
        await solicitacoesExamesAPI.updateStatus(id, newStatus);
        reload();
      } catch (err: any) {
        alert(err?.response?.data?.error || "Erro ao atualizar status");
      } finally {
        setUpdatingId(null);
      }
    },
    [reload],
  );

  const handleDownloadPdf = useCallback(
    async (id: number, semValores: boolean) => {
      const key = `${id}-${semValores ? "sem" : "com"}`;
      setDownloadingId(key);
      try {
        const blob = await solicitacoesExamesAPI.downloadPdf(id, semValores);
        const sufixo = semValores ? "_sem_valores" : "";
        downloadBlob(blob, `solicitacao_${id}${sufixo}.pdf`);
      } catch (err: any) {
        alert(err?.response?.data?.error || "Erro ao baixar PDF");
      } finally {
        setDownloadingId(null);
      }
    },
    [],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      setFilter("offset", newPage * PAGE_SIZE);
    },
    [setFilter],
  );

  const hasMore = items.length === PAGE_SIZE;

  const quickStats = useMemo(() => {
    const total = items.length;
    const pendentes = items.filter((s) => s.status === "PENDENTE").length;
    const faturados = items.filter((s) => s.status === "FATURADO").length;
    const valorTotal = items.reduce((a, s) => a + s.valor_final, 0);
    return { total, pendentes, faturados, valorTotal };
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-text-100 tabular-nums">
            {quickStats.total}
          </p>
          <p className="text-[11px] text-text-200 font-medium">Nesta página</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-amber-600 tabular-nums">
            {quickStats.pendentes}
          </p>
          <p className="text-[11px] text-text-200 font-medium">Pendentes</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">
            {quickStats.faturados}
          </p>
          <p className="text-[11px] text-text-200 font-medium">Faturados</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-primary-100 tabular-nums">
            R$ {quickStats.valorTotal.toFixed(0)}
          </p>
          <p className="text-[11px] text-text-200 font-medium">Valor Total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-200" />
            <input
              type="text"
              className="input pl-10 pr-10 py-2 w-full text-sm"
              placeholder="Buscar por paciente ou exame..."
              value={filters.search || ""}
              onChange={(e) => {
                setFilter("search", e.target.value);
                setPage(0);
              }}
            />
            {filters.search && (
              <button
                onClick={() => {
                  setFilter("search", "");
                  setPage(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-200 hover:text-text-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            className="input py-2 px-3 w-full sm:w-auto min-w-[150px] text-sm"
            value={filters.status || ""}
            onChange={(e) => {
              setFilter("status", e.target.value as SolicitacaoStatus | "");
              setPage(0);
            }}
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>

          <div className="flex w-full sm:w-auto gap-2 justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-ghost py-2 px-3 flex items-center justify-center text-sm shrink-0 ${showFilters ? "text-primary-100" : ""}`}
            >
              <Filter className="h-4 w-4 mr-1.5" />
              <span>Filtros</span>
            </button>

            <button
              onClick={reload}
              className="btn-ghost py-2 px-3 flex items-center justify-center shrink-0"
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-bg-200">
                <Calendar className="h-4 w-4 text-text-200 shrink-0" />
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    className="input py-1.5 text-sm w-[150px]"
                    value={filters.data_inicio || ""}
                    onChange={(e) => {
                      setFilter("data_inicio", e.target.value);
                      setPage(0);
                    }}
                  />
                  <span className="text-text-200 text-sm">até</span>
                  <input
                    type="date"
                    className="input py-1.5 text-sm w-[150px]"
                    value={filters.data_fim || ""}
                    onChange={(e) => {
                      setFilter("data_fim", e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                {(filters.data_inicio || filters.data_fim) && (
                  <button
                    onClick={() => {
                      setFilter("data_inicio", "");
                      setFilter("data_fim", "");
                      setPage(0);
                    }}
                    className="btn-ghost btn-sm text-red-500"
                  >
                    <X className="h-3.5 w-3.5" /> Limpar
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary-100 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <Receipt className="empty-state-icon" />
            <p className="empty-state-title">Nenhuma solicitação encontrada</p>
            <p className="empty-state-description">
              {filters.search || filters.status || filters.data_inicio
                ? "Ajuste os filtros para ver mais resultados."
                : "As solicitações de exames aparecerão aqui."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden lg:block">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-[200px]">Paciente</th>
                    <th className="w-[100px]">Data</th>
                    <th>Exames</th>
                    <th className="w-[140px]">Médico</th>
                    <th className="w-[100px] text-right">Valor</th>
                    <th className="w-[150px] text-center">Status</th>
                    <th className="w-[60px] text-center">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((sol, idx) => {
                    const examesList = sol.exames
                      .split(",")
                      .map((e) => e.trim())
                      .filter(Boolean);
                    return (
                      <motion.tr
                        key={sol.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                      >
                        <td>
                          <p className="font-medium text-text-100 text-sm truncate max-w-[180px]">
                            {sol.nome_paciente}
                          </p>
                          <p className="text-[11px] text-text-200">
                            {sol.cpf_paciente}
                          </p>
                        </td>
                        <td>
                          <p className="text-sm text-text-100">{sol.data}</p>
                          <p className="text-[11px] text-text-200">
                            {sol.hora}
                          </p>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {examesList.slice(0, 3).map((nome, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-bg-200 rounded text-[10px] text-text-200 font-medium truncate max-w-[130px]"
                                title={nome}
                              >
                                {nome}
                              </span>
                            ))}
                            {examesList.length > 3 && (
                              <span
                                className="px-1.5 py-0.5 bg-primary-100/10 text-primary-100 rounded text-[10px] font-medium cursor-help"
                                title={examesList.slice(3).join(", ")}
                              >
                                +{examesList.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <p className="text-sm text-text-200 truncate max-w-[130px]">
                            {sol.nome_medico
                              ? `Dr(a). ${sol.nome_medico}`
                              : "—"}
                          </p>
                        </td>
                        <td className="text-right">
                          {sol.valor_desconto > 0 && (
                            <p className="text-[10px] text-red-400 line-through tabular-nums">
                              R$ {sol.soma_dos_valores.toFixed(2)}
                            </p>
                          )}
                          <p className="font-semibold text-sm text-text-100 tabular-nums">
                            R$ {sol.valor_final.toFixed(2)}
                          </p>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <StatusBadge status={sol.status} />
                            <StatusDropdown
                              current={sol.status}
                              onSelect={(s) => handleStatusChange(sol.id, s)}
                              loading={updatingId === sol.id}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="flex justify-center">
                            <PdfDownloadDropdown
                              solicitacao={sol}
                              downloadingId={downloadingId}
                              onDownload={handleDownloadPdf}
                            />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet: Cards */}
          <div className="lg:hidden space-y-3">
            {items.map((sol) => (
              <SolicitacaoCard
                key={sol.id}
                solicitacao={sol}
                onStatusChange={handleStatusChange}
                updatingId={updatingId}
                downloadingId={downloadingId}
                onDownload={handleDownloadPdf}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-text-200">
              Página {page + 1}
              {items.length > 0 && (
                <span>
                  {" "}
                  • {items.length} registro{items.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                className="btn-ghost btn-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasMore}
                className="btn-ghost btn-sm disabled:opacity-40"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
