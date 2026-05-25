import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ClipboardList,
  Clock,
  Stethoscope,
  CheckCircle,
  XCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast";
import { periciasImescAPI } from "../api";
import { PericiaCard } from "../components/PericiaCard";
import { PericiaFormModal } from "../components/PericiaFormModal";
import { ParecerSocialModal } from "../components/ParecerSocialModal";
import { ParecerMedicoModal } from "../components/ParecerMedicoModal";
import { PericiaDetailModal } from "../components/PericiaDetailModal";
import type {
  PericiaIMESC,
  PericiaFormData,
  ParecerSocialData,
  ParecerMedicoData,
  PericiaFilters,
  PericiaStats,
  PericiaStatus,
} from "../types";
import { STATUS_LABELS } from "../types";

export function PericiasImescPage() {
  const toast = useToast();
  const [pericias, setPericias] = useState<PericiaIMESC[]>([]);
  const [stats, setStats] = useState<PericiaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<PericiaFilters>({
    search: "",
    status: "",
    data_inicio: "",
    data_fim: "",
  });

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [medicoModalOpen, setMedicoModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPericia, setSelectedPericia] = useState<PericiaIMESC | null>(null);

  const fetchPericias = useCallback(async () => {
    try {
      setLoading(true);
      const cleanFilters: PericiaFilters = {};
      if (filters.search) cleanFilters.search = filters.search;
      if (filters.status) cleanFilters.status = filters.status;
      if (filters.data_inicio) cleanFilters.data_inicio = filters.data_inicio;
      if (filters.data_fim) cleanFilters.data_fim = filters.data_fim;
      
      setPericias(await periciasImescAPI.list(cleanFilters));
    } catch {
      toast.error("Tente novamente em alguns instantes.", "Erro ao carregar perícias");
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await periciasImescAPI.getStats());
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchPericias();
    fetchStats();
  }, [fetchPericias, fetchStats]);

  const handleCreate = async (data: PericiaFormData) => {
    try {
      setSaving(true);
      await periciasImescAPI.create(data);
      toast.success("Perícia cadastrada com sucesso!");
      setFormModalOpen(false);
      fetchPericias();
      fetchStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Tente novamente.", "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: PericiaFormData) => {
    if (!selectedPericia) return;
    try {
      setSaving(true);
      await periciasImescAPI.update(selectedPericia.id, data);
      toast.success("Perícia atualizada com sucesso!");
      setFormModalOpen(false);
      setSelectedPericia(null);
      fetchPericias();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Tente novamente.", "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pericia: PericiaIMESC) => {
    if (!confirm(`Excluir perícia ${pericia.protocolo}?`)) return;
    try {
      await periciasImescAPI.delete(pericia.id);
      toast.success("Perícia excluída com sucesso!");
      fetchPericias();
      fetchStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Tente novamente.", "Erro ao excluir");
    }
  };

  const handleParecerSocial = async (data: ParecerSocialData) => {
    if (!selectedPericia) return;
    try {
      setSaving(true);
      const result = await periciasImescAPI.registrarParecerSocial(selectedPericia.id, data);
      toast.success("Triagem social registrada com sucesso!");
      setSocialModalOpen(false);
      setSelectedPericia(result.pericia);
      fetchPericias();
      fetchStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Tente novamente.", "Erro ao registrar triagem");
    } finally {
      setSaving(false);
    }
  };

  const handleParecerMedico = async (data: ParecerMedicoData) => {
    if (!selectedPericia) return;
    try {
      setSaving(true);
      const result = await periciasImescAPI.registrarParecerMedico(selectedPericia.id, data);
      toast.success("Perícia concluída com sucesso!");
      setMedicoModalOpen(false);
      setSelectedPericia(result.pericia);
      fetchPericias();
      fetchStats();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Tente novamente.", "Erro ao registrar parecer");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async (pericia: PericiaIMESC) => {
    try {
      const blob = await periciasImescAPI.downloadPdf(pericia.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pericia-imesc-${pericia.protocolo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF gerado com sucesso!");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Tente novamente.", "Erro ao gerar PDF");
    }
  };

  const clearFilters = () => {
    setFilters({ search: "", status: "", data_inicio: "", data_fim: "" });
  };

  const hasActiveFilters = filters.search || filters.status || filters.data_inicio || filters.data_fim;

  const statsCards = [
    {
      label: "Aguardando Triagem",
      value: stats?.aguardando_triagem || 0,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      onClick: () => setFilters({ ...filters, status: "aguardando_triagem" }),
    },
    {
      label: "Aguardando Médico",
      value: stats?.aguardando_medico || 0,
      icon: Stethoscope,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      onClick: () => setFilters({ ...filters, status: "aguardando_medico" }),
    },
    {
      label: "Concluídas",
      value: stats?.concluidas || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
      onClick: () => setFilters({ ...filters, status: "concluido" }),
    },
    {
      label: "Canceladas",
      value: stats?.canceladas || 0,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      onClick: () => setFilters({ ...filters, status: "cancelado" }),
    },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 rounded-xl">
            <ClipboardList className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-secondary-900">Perícias IMESC</h1>
            <p className="text-sm text-secondary-500">
              {stats?.total || 0} perícias · {stats?.pericias_hoje || 0} hoje · {stats?.pericias_mes || 0} este mês
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setSelectedPericia(null);
            setFormModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Nova Perícia
        </button>
      </div>

      {/* Stats Cards - Clicáveis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {statsCards.map((stat, i) => (
          <motion.button
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={stat.onClick}
            className={`${stat.bg} rounded-xl p-3 sm:p-4 border ${stat.border} hover:shadow-md transition-all text-left ${
              filters.status === stat.label.toLowerCase().replace(/ /g, "_").replace("concluídas", "concluido").replace("canceladas", "cancelado")
                ? "ring-2 ring-offset-2 ring-primary-200"
                : ""
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color} flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-secondary-900">{stat.value}</p>
                <p className="text-xs sm:text-sm text-secondary-600 truncate">{stat.label}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col gap-3">
          {/* Linha principal de filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Buscar por protocolo ou paciente..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input w-full pl-10"
              />
            </div>
            <div className="relative min-w-[180px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as PericiaStatus | "" })}
                className="input w-full pl-10 appearance-none"
              >
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="btn-secondary"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Período</span>
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { fetchPericias(); fetchStats(); }}
              className="btn-secondary"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>

          {/* Filtros avançados */}
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-secondary-200"
            >
              <div className="flex-1">
                <label className="block text-xs font-medium text-secondary-500 mb-1">Data Início</label>
                <input
                  type="date"
                  value={filters.data_inicio}
                  onChange={(e) => setFilters({ ...filters, data_inicio: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-secondary-500 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={filters.data_fim}
                  onChange={(e) => setFilters({ ...filters, data_fim: e.target.value })}
                  className="input w-full"
                />
              </div>
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button onClick={clearFilters} className="btn-ghost text-red-600 hover:bg-red-50">
                    Limpar filtros
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : pericias.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="h-12 w-12 text-secondary-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-secondary-700 mb-2">Nenhuma perícia encontrada</h3>
          <p className="text-secondary-500 mb-4">
            {hasActiveFilters ? "Ajuste os filtros para ver resultados." : "Cadastre a primeira perícia."}
          </p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className="btn-secondary">
              Limpar filtros
            </button>
          ) : (
            <button
              onClick={() => { setSelectedPericia(null); setFormModalOpen(true); }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Nova Perícia
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pericias.map((p, i) => (
            <PericiaCard
              key={p.id}
              pericia={p}
              index={i}
              onView={() => {
                setSelectedPericia(p);
                setDetailModalOpen(true);
              }}
              onEdit={() => {
                setSelectedPericia(p);
                setFormModalOpen(true);
              }}
              onDelete={() => handleDelete(p)}
              onParecerSocial={() => {
                setSelectedPericia(p);
                setSocialModalOpen(true);
              }}
              onParecerMedico={() => {
                setSelectedPericia(p);
                setMedicoModalOpen(true);
              }}
              onDownloadPdf={() => handleDownloadPdf(p)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <PericiaFormModal
        isOpen={formModalOpen}
        onClose={() => { setFormModalOpen(false); setSelectedPericia(null); }}
        onSubmit={selectedPericia ? handleUpdate : handleCreate}
        initialData={selectedPericia}
        saving={saving}
      />
      <ParecerSocialModal
        isOpen={socialModalOpen}
        onClose={() => { setSocialModalOpen(false); setSelectedPericia(null); }}
        onSubmit={handleParecerSocial}
        pericia={selectedPericia}
        saving={saving}
      />
      <ParecerMedicoModal
        isOpen={medicoModalOpen}
        onClose={() => { setMedicoModalOpen(false); setSelectedPericia(null); }}
        onSubmit={handleParecerMedico}
        pericia={selectedPericia}
        saving={saving}
      />
      <PericiaDetailModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedPericia(null); }}
        pericia={selectedPericia}
        onEdit={() => {
          setDetailModalOpen(false);
          setFormModalOpen(true);
        }}
        onParecerSocial={() => {
          setDetailModalOpen(false);
          setSocialModalOpen(true);
        }}
        onParecerMedico={() => {
          setDetailModalOpen(false);
          setMedicoModalOpen(true);
        }}
        onDownloadPdf={() => selectedPericia && handleDownloadPdf(selectedPericia)}
      />
    </div>
  );
}

export default PericiasImescPage;
