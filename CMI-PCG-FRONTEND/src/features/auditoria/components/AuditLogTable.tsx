/**
 * Timeline de logs com filtros inline e detalhes expandíveis.
 *
 * Melhorias v2:
 * - Summary exibido inline na linha (sem precisar expandir)
 * - Lazy load do detalhe completo ao expandir (GET /audit-logs/:id)
 * - Recursos com labels vindos do backend
 * - Animações suaves de expand/collapse
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Filter,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import type { AuditLog, AuditLogFilters, AuditResource } from "../types";
import { ACTION_CONFIG } from "../types";
import { AuditLogDetails } from "./AuditLogDetails";
import { useAuditLogDetail } from "../hooks";

interface Props {
  logs: AuditLog[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: AuditLogFilters;
  resources: AuditResource[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  onFilterChange: <K extends keyof AuditLogFilters>(
    key: K,
    value: AuditLogFilters[K],
  ) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] || {
    label: action,
    color: "text-text-200",
    bg: "bg-bg-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

/**
 * Linha individual do log.
 *
 * - Exibe summary do backend inline (quando disponível)
 * - Ao expandir, carrega detalhe completo via GET /audit-logs/:id
 */
function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const {
    detail,
    loading: detailLoading,
    load: loadDetail,
    clear,
  } = useAuditLogDetail();

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      clear();
      return;
    }
    setOpen(true);
    loadDetail(log.id);
  };

  const resourceLabel = log.resource_label || log.resource;
  const summary = log.summary;

  return (
    <div
      className={`flex flex-col gap-1 p-3 rounded-xl transition-all border
        ${
          open
            ? "border-primary-200/30 bg-bg-200/30 shadow-sm"
            : "border-transparent hover:border-bg-300 hover:bg-bg-200/40"
        }`}
    >
      {/* Linha principal */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full text-left flex items-center gap-3 cursor-pointer"
        aria-expanded={open}
      >
        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-text-200 w-28 shrink-0">
          <Clock className="h-3 w-3" />
          {formatDate(log.created_at)}
        </div>

        {/* Action badge */}
        <ActionBadge action={log.action} />

        {/* Resource + summary */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-text-100 font-medium">
            {resourceLabel}
            {log.resource_id && (
              <span className="text-text-200 font-normal">
                {" "}
                #{log.resource_id}
              </span>
            )}
          </span>

          {/* Summary inline (novidade v2) */}
          {summary && (
            <p className="text-xs text-text-200 truncate mt-0.5">{summary}</p>
          )}
        </div>

        {/* Usuário */}
        <span className="text-xs text-text-200 truncate max-w-[160px] shrink-0 hidden sm:block">
          {log.user_nome || (log.user_id ? `User #${log.user_id}` : "Sistema")}
        </span>

        {/* Expand icon */}
        <span className="p-1 rounded-lg hover:bg-bg-200 shrink-0">
          {open ? (
            <ChevronUp className="h-4 w-4 text-text-200" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-200" />
          )}
        </span>
      </button>

      {/* Detalhes expandidos */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {detailLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 text-primary-100 animate-spin" />
                <span className="ml-2 text-xs text-text-200">
                  Carregando detalhes…
                </span>
              </div>
            ) : detail ? (
              <AuditLogDetails log={detail} />
            ) : (
              <AuditLogDetails log={log} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AuditLogTable({
  logs,
  total,
  loading,
  error,
  filters,
  resources,
  page,
  totalPages,
  hasMore,
  onFilterChange,
  onResetFilters,
  onPageChange,
}: Props) {
  const [showFilters, setShowFilters] = useState(true);

  const headerSubtitle = `${total.toLocaleString("pt-BR")} registros • clique para ver detalhes`;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100/10 rounded-lg">
            <Clock className="h-5 w-5 text-primary-100" />
          </div>
          <div>
            <h3 className="font-bold text-text-100">Histórico de Ações</h3>
            <p className="text-sm text-text-200">{headerSubtitle}</p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`btn-ghost btn-sm ${showFilters ? "text-primary-100" : ""}`}
        >
          <Filter className="h-4 w-4" /> Filtros
        </button>
      </div>

      {/* Filtros */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-3 p-3 bg-bg-200 rounded-xl">
              <select
                value={filters.action || ""}
                onChange={(e) =>
                  onFilterChange("action", e.target.value as any)
                }
                className="select text-sm min-w-[130px]"
              >
                <option value="">Todas ações</option>
                <option value="create">Criação</option>
                <option value="update">Edição</option>
                <option value="delete">Exclusão</option>
              </select>

              <select
                value={filters.resource || ""}
                onChange={(e) => onFilterChange("resource", e.target.value)}
                className="select text-sm min-w-[150px]"
              >
                <option value="">Todos módulos</option>
                {resources.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={filters.date_from || ""}
                onChange={(e) => onFilterChange("date_from", e.target.value)}
                className="input text-sm w-auto"
                placeholder="De"
              />

              <input
                type="date"
                value={filters.date_to || ""}
                onChange={(e) => onFilterChange("date_to", e.target.value)}
                className="input text-sm w-auto"
                placeholder="Até"
              />

              <button
                onClick={onResetFilters}
                className="btn-ghost btn-sm"
                title="Limpar filtros"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-7 w-7 text-primary-100 animate-spin" />
        </div>
      ) : logs.length > 0 ? (
        <div className="space-y-1 max-h-[600px] overflow-y-auto scrollbar-thin">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-text-200">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">Nenhum registro encontrado</p>
          <p className="text-xs mt-1">Tente ajustar os filtros</p>
        </div>
      )}

      {/* Paginação */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-bg-200">
          <p className="text-sm text-text-200">
            Página {page + 1} de {totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="btn-ghost btn-sm disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasMore}
              className="btn-ghost btn-sm disabled:opacity-40"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
