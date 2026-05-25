/**
 * Página principal do módulo de Receituários Médicos
 *
 * Features:
 * - Dashboard com estatísticas e acesso rápido
 * - Listagem de receituários com filtros avançados
 * - Criação de nova receita via modal
 * - Visualização detalhada com dispensação de itens
 * - Download de PDF
 * - Cancelamento com motivo obrigatório
 *
 * Regulamentação:
 * - SIMPLES: 30 dias, 1 via (venda livre / sob prescrição)
 * - CONTROLE ESPECIAL: 30 dias, 2 vias (C1–C5 ANVISA)
 * - ANTIMICROBIANO: 10 dias, 2 vias com retenção
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Download,
  Eye,
  Ban,
  Send,
  Filter,
  Calendar,
  User,
  UserCog,
  Pill,
  ClipboardList,
  HelpCircle,
  BarChart3,
  ArrowRightLeft,
  X,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast";
import {
  ReceituarioFormModal,
  ReceituarioDetailModal,
  TipoReceitaBadge,
  StatusBadge,
} from "../components";
import { receituariosAPI } from "../api";
import type {
  Receituario,
  ReceituarioCreatePayload,
  ReceituarioFilters,
  ReceituarioStats,
  TipoReceita,
  StatusReceituario,
} from "../types";
import { TIPO_RECEITA_CONFIG, STATUS_CONFIG } from "../types";

// ─── Helpers ─────────────────────────────────────────────────

function dateBR(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ─── InlineTip ───────────────────────────────────────────────

function InlineTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 mb-5">
      <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="p-4 bg-bg-200 rounded-2xl mb-4">
        <Icon className="h-10 w-10 text-secondary-300" />
      </div>
      <h3 className="text-lg font-semibold text-secondary-700 mb-2">{title}</h3>
      <p className="text-sm text-secondary-400 max-w-md mb-6">{description}</p>
      {action && actionLabel && (
        <button onClick={action} className="btn-primary">
          <Plus className="h-4 w-4" /> {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function ReceituariosPage() {
  const toast = useToast();

  // Data
  const [receituarios, setReceituarios] = useState<Receituario[]>([]);
  const [stats, setStats] = useState<ReceituarioStats | null>(null);
  const [selectedRec, setSelectedRec] = useState<Receituario | null>(null);

  // Loading
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState<ReceituarioFilters>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ── Loaders ────────────────────────────────────────────────

  const loadReceituarios = useCallback(async () => {
    try {
      setLoading(true);
      const data = await receituariosAPI.list({
        ...filters,
        cpf_paciente:
          searchTerm.replace(/\D/g, "") || filters.cpf_paciente || undefined,
        limit: 100,
      });
      setReceituarios(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar receituários");
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await receituariosAPI.getStats();
      setStats(data);
    } catch {
      // silencioso — stats é secundário
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    try {
      setSaving(true);
      const data = await receituariosAPI.getById(id);
      setSelectedRec(data);
      setDetailModalOpen(true);
    } catch {
      toast.error("Erro ao carregar receituário");
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Effects ────────────────────────────────────────────────

  useEffect(() => {
    loadReceituarios();
    loadStats();
  }, []);

  useEffect(() => {
    loadReceituarios();
  }, [filters]);

  // ── Handlers ───────────────────────────────────────────────

  const wrap = async (fn: () => Promise<void>, successMsg?: string) => {
    try {
      setSaving(true);
      await fn();
      if (successMsg) toast.success(successMsg);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? e?.message ?? "Erro na operação");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = (data: ReceituarioCreatePayload) =>
    wrap(async () => {
      await receituariosAPI.create(data);
      setFormModalOpen(false);
      loadReceituarios();
      loadStats();
    }, "Receituário emitido com sucesso");

  const handleDispensarItem = async (receituarioId: number, itemId: number) => {
    await wrap(async () => {
      const result = await receituariosAPI.dispensarItem(receituarioId, itemId);
      // Atualiza o detalhe em tela
      if (result.data) setSelectedRec(result.data);
      loadReceituarios();
      loadStats();
    }, "Item dispensado com sucesso");
  };

  const handleCancel = async (id: number, motivo: string) => {
    await wrap(async () => {
      await receituariosAPI.cancel(id, motivo);
      setDetailModalOpen(false);
      setSelectedRec(null);
      loadReceituarios();
      loadStats();
    }, "Receituário cancelado");
  };

  const handleDownloadPdf = async (id: number) => {
    try {
      const blob = await receituariosAPI.downloadPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receituario_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleSearch = () => {
    loadReceituarios();
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100/20 rounded-2xl">
            <FileText className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">
              Receituários
            </h1>
            <p className="text-sm text-secondary-500">
              Prescrições médicas, dispensação e controle regulatório
            </p>
          </div>
        </div>

        <button onClick={() => setFormModalOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Nova Receita
        </button>
      </div>

      {/* ── Stats Cards ──────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Total",
              value: stats.total,
              icon: FileText,
              color: "text-primary-600 bg-primary-100/20",
            },
            {
              label: "Ativas",
              value: stats.por_status?.ATIVA ?? 0,
              icon: ClipboardList,
              color: "text-green-600 bg-green-100",
            },
            {
              label: "Dispensadas",
              value: stats.por_status?.DISPENSADA ?? 0,
              icon: Send,
              color: "text-blue-600 bg-blue-100",
            },
            {
              label: "Amostras grátis",
              value: stats.total_amostras ?? 0,
              icon: Pill,
              color: "text-teal-600 bg-teal-100",
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-secondary-500">{s.label}</p>
                  <p className="text-lg font-bold text-secondary-900">
                    {s.value}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Tipo Resumo ──────────────────────────────────── */}
      {stats && stats.por_tipo && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-secondary-500 mr-1">Por tipo:</span>

          {Array.isArray(stats.por_tipo)
            ? stats.por_tipo.map((row: any) => {
                const tipo = row.tipo as TipoReceita;
                const count = Number(row.total ?? 0);
                const cfg = TIPO_RECEITA_CONFIG[tipo];

                return (
                  <span
                    key={tipo}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${cfg?.bg ?? ""} ${cfg?.cor ?? ""} ${cfg?.border ?? ""}`}
                  >
                    {cfg?.icon} {cfg?.label}: <strong>{count}</strong>
                  </span>
                );
              })
            : (Object.entries(stats.por_tipo) as [TipoReceita, number][]).map(
                ([tipo, count]) => {
                  const cfg = TIPO_RECEITA_CONFIG[tipo];
                  return (
                    <span
                      key={tipo}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${cfg?.bg ?? ""} ${cfg?.cor ?? ""} ${cfg?.border ?? ""}`}
                    >
                      {cfg?.icon} {cfg?.label}: <strong>{count}</strong>
                    </span>
                  );
                },
              )}
        </div>
      )}

      {/* ── Dica ─────────────────────────────────────────── */}
      <InlineTip>
        <strong>Como funciona?</strong> Crie uma receita associando paciente
        (CPF), médico (CRM) e medicamentos. Escolha o tipo conforme a
        classificação: <strong>Simples</strong> para medicamentos comuns,{" "}
        <strong>Controle Especial</strong> para substâncias controladas
        (ANVISA), ou <strong>Antimicrobiano</strong> para antibióticos. Após
        emitir, você pode dispensar itens do estoque da farmácia e gerar o PDF
        para impressão.
      </InlineTip>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Buscar por CPF do paciente..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary ${showFilters ? "bg-primary-100/20 text-primary-600" : ""}`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {(filters.tipo_receita ||
                filters.status ||
                filters.data_inicio) && (
                <span className="h-2 w-2 bg-primary-500 rounded-full" />
              )}
            </button>
            <button onClick={handleSearch} className="btn-secondary">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFormModalOpen(true)}
              className="btn-primary sm:hidden"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filtros expandidos */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-bg-200/50 rounded-xl border border-bg-300 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select
                    className="select"
                    value={filters.tipo_receita ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        tipo_receita: (e.target.value ||
                          undefined) as ReceituarioFilters["tipo_receita"],
                      }))
                    }
                  >
                    <option value="">Todos</option>
                    {(Object.keys(TIPO_RECEITA_CONFIG) as TipoReceita[]).map(
                      (t) => (
                        <option key={t} value={t}>
                          {TIPO_RECEITA_CONFIG[t].label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="select"
                    value={filters.status ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        status: (e.target.value ||
                          undefined) as ReceituarioFilters["status"],
                      }))
                    }
                  >
                    <option value="">Todos</option>
                    {(Object.keys(STATUS_CONFIG) as StatusReceituario[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {STATUS_CONFIG[s].label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="label">Data início</label>
                  <input
                    className="input"
                    type="date"
                    value={filters.data_inicio ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        data_inicio: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Data fim</label>
                  <input
                    className="input"
                    type="date"
                    value={filters.data_fim ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        data_fim: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>
              {(filters.tipo_receita ||
                filters.status ||
                filters.data_inicio ||
                filters.data_fim) && (
                <button
                  className="mt-2 text-xs text-primary-600 hover:underline"
                  onClick={() => {
                    setFilters({});
                    setSearchTerm("");
                  }}
                >
                  Limpar todos os filtros
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Loading ──────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────── */}
      {!loading && receituarios.length === 0 && (
        <EmptyState
          icon={FileText}
          title={
            searchTerm || filters.tipo_receita || filters.status
              ? "Nenhum receituário encontrado"
              : "Nenhum receituário emitido"
          }
          description={
            searchTerm || filters.tipo_receita || filters.status
              ? "Nenhum resultado para os filtros aplicados. Tente ajustar a busca."
              : "Comece emitindo a primeira receita médica. Ela ficará vinculada ao paciente e ao médico prescritor, com geração automática de PDF."
          }
          action={
            !(searchTerm || filters.tipo_receita || filters.status)
              ? () => setFormModalOpen(true)
              : undefined
          }
          actionLabel="Emitir receita"
        />
      )}

      {/* ── Lista ────────────────────────────────────────── */}
      {!loading && receituarios.length > 0 && (
        <div className="space-y-3">
          {receituarios.map((rec, i) => {
            const statusEfetivo = rec.status_efetivo ?? rec.status;
            const tipoCfg = TIPO_RECEITA_CONFIG[rec.tipo_receita];
            const totalItens = rec.total_itens ?? rec.itens?.length ?? 0;
            const totalDisp = rec.total_dispensados ?? 0;

            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Info principal */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-xl flex-shrink-0 ${tipoCfg?.bg ?? "bg-secondary-100"}`}
                    >
                      <FileText
                        className={`h-5 w-5 ${tipoCfg?.cor ?? "text-secondary-600"}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-secondary-900">
                          Receita #{rec.id}
                        </span>
                        <TipoReceitaBadge tipo={rec.tipo_receita} />
                        <StatusBadge
                          status={rec.status}
                          statusEfetivo={statusEfetivo}
                        />
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {rec.paciente?.nome ?? `CPF: ${rec.cpf_paciente}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserCog className="h-3 w-3" />
                          {rec.medico?.nome ?? `CRM: ${rec.crm_medico}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {dateBR(rec.data_prescricao)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Pill className="h-3 w-3" />
                          {totalItens} {totalItens === 1 ? "item" : "itens"}
                          {totalDisp > 0 &&
                            ` · ${totalDisp} dispensado${totalDisp > 1 ? "s" : ""}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => loadDetail(rec.id)}
                      className="btn-secondary text-xs"
                      title="Ver detalhes"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Detalhes</span>
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(rec.id)}
                      className="btn-ghost text-xs"
                      title="Baixar PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Contagem */}
          <p className="text-xs text-secondary-400 text-center py-2">
            {receituarios.length} receituário
            {receituarios.length !== 1 ? "s" : ""} encontrado
            {receituarios.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      <ReceituarioFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleCreate}
        saving={saving}
      />

      <ReceituarioDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedRec(null);
        }}
        receituario={selectedRec}
        onDispensarItem={handleDispensarItem}
        onCancel={handleCancel}
        onDownloadPdf={handleDownloadPdf}
        saving={saving}
      />
    </div>
  );
}
