/**
 * Página principal do módulo Empresas — Ocupacional
 *
 * Três estados visuais:
 *   1. Lista de empresas (aba "Empresas")
 *   2. Detalhe de empresa (sub-tabs: info, setores, cargos, vínculos, periódicos, dashboard)
 *   3. Faturamento posterior (aba "Faturamento Posterior")
 *      → lista empresas com flag → detalhe com histórico/resumo/PDFs
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Calendar,
  DollarSign,
  Edit2,
  Eye,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast";
import { useEmpresas, useEmpresaMutations } from "../hooks";
import {
  useFaturamentoEmpresas,
  useFaturamentoMutations,
} from "../hooks/useFaturamentoPosterior";
import { EmpresaFormModal, EmpresaDetail } from "../components";
import { FaturamentoEmpresaDetail } from "../components/FaturamentoEmpresaDetail";
import { FaturamentoConfigModal } from "../components/FaturamentoConfigModal";
import type { Empresa, EmpresaFormData, FaturamentoConfig } from "../types";
import { GRAU_RISCO_CONFIG } from "../types";

// ── Tipos locais ─────────────────────────────────────────────
type TopTab = "empresas" | "faturamento";

// ── Helpers ──────────────────────────────────────────────────
const currency = (v: number | null | undefined) =>
  `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ── Confirm modal ────────────────────────────────────────────
function DeleteConfirm({
  empresa,
  onConfirm,
  onCancel,
  loading,
}: {
  empresa: Empresa;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="card w-full max-w-md"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Excluir Empresa
              </h3>
              <p className="text-sm text-slate-500">
                Esta ação não pode ser desfeita
              </p>
            </div>
          </div>
          <p className="text-slate-700 mb-6">
            Tem certeza que deseja excluir <strong>{empresa.nome}</strong>?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="btn-danger flex-1"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Excluir"
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function EmpresasPage() {
  const toast = useToast();

  // ── Top tab ──────────────────────────────────────────
  const [topTab, setTopTab] = useState<TopTab>("empresas");

  // ── Lista de empresas (aba Empresas) ─────────────────
  const { empresas, total, loading, filters, updateFilters, reload } =
    useEmpresas();
  const { saving, createEmpresa, updateEmpresa, deleteEmpresa } =
    useEmpresaMutations();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState<Empresa | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ── Faturamento posterior (aba Faturamento) ──────────
  const {
    empresas: fatEmpresas,
    total: fatTotal,
    loading: fatLoading,
    search: fatSearch,
    setSearch: setFatSearch,
    reload: reloadFat,
  } = useFaturamentoEmpresas();
  const { saving: fatSaving, updateConfig: fatUpdateConfig } =
    useFaturamentoMutations();

  const [fatSelectedEmpresa, setFatSelectedEmpresa] = useState<Empresa | null>(
    null,
  );
  const [fatConfigTarget, setFatConfigTarget] = useState<Empresa | null>(null);

  // ── Handlers — Empresas ──────────────────────────────
  const handleCreate = async (data: EmpresaFormData) => {
    try {
      await createEmpresa(data);
      setFormOpen(false);
      toast.success("Empresa cadastrada com sucesso!");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdate = async (data: EmpresaFormData) => {
    if (!editEmpresa) return;
    try {
      await updateEmpresa(editEmpresa.id, data);
      setEditEmpresa(null);
      setFormOpen(false);
      toast.success("Empresa atualizada com sucesso!");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmpresa(deleteTarget.id);
      setDeleteTarget(null);
      toast.success("Empresa excluída com sucesso!");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      updateFilters({ search: term || undefined });
    },
    [updateFilters],
  );

  // ── Handlers — Faturamento ───────────────────────────
  const handleFatSaveConfig = async (config: Partial<FaturamentoConfig>) => {
    if (!fatConfigTarget) return;
    try {
      await fatUpdateConfig(fatConfigTarget.id, config);
      setFatConfigTarget(null);
      toast.success("Configuração de faturamento salva!");
      reloadFat();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Render: Detalhe de empresa (aba Empresas) ────────
  if (selectedId) {
    return (
      <EmpresaDetail
        empresaId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  // ── Render: Detalhe de faturamento (aba Faturamento) ─
  if (fatSelectedEmpresa) {
    return (
      <FaturamentoEmpresaDetail
        empresa={fatSelectedEmpresa}
        onBack={() => {
          setFatSelectedEmpresa(null);
          reloadFat();
        }}
        onConfigSaved={reloadFat}
      />
    );
  }

  // ── Render: Lista (ambas as abas) ────────────────────
  return (
    <div className="space-y-6">
      {/* ═══ Header + Top Tabs ═══════════════════════ */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Empresas</h2>
            <p className="text-slate-500">
              Gestão ocupacional e faturamento de empresas conveniadas
            </p>
          </div>
          {topTab === "empresas" && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setEditEmpresa(null);
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="h-5 w-5" /> Nova Empresa
            </motion.button>
          )}
        </div>

        {/* Top tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTopTab("empresas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              topTab === "empresas"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Empresas
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                topTab === "empresas"
                  ? "bg-slate-200 text-slate-700"
                  : "bg-slate-200/60 text-slate-500"
              }`}
            >
              {total}
            </span>
          </button>
          <button
            onClick={() => setTopTab("faturamento")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              topTab === "faturamento"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Receipt className="h-4 w-4" />
            Faturamento Posterior
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                topTab === "faturamento"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200/60 text-slate-500"
              }`}
            >
              {fatTotal}
            </span>
          </button>
        </div>
      </div>

      {/* ═══ Conteúdo da aba ativa ═══════════════════ */}
      <AnimatePresence mode="wait">
        {topTab === "empresas" ? (
          <motion.div
            key="tab-empresas"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Busca */}
            <div className="card">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, razão social..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Grid de empresas */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
            ) : empresas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {empresas.map((emp, index) => {
                  const grau = emp.grau_risco
                    ? GRAU_RISCO_CONFIG[emp.grau_risco]
                    : null;
                  return (
                    <motion.div
                      key={emp.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: index * 0.03,
                      }}
                      className="card group cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedId(emp.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 bg-cyan-100 rounded-xl group-hover:bg-cyan-200 transition-colors">
                            <Building2 className="h-5 w-5 text-cyan-600" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900 truncate">
                              {emp.nome}
                            </h3>
                            <p className="text-xs text-slate-500">{emp.cnpj}</p>
                          </div>
                        </div>
                        <div
                          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEditEmpresa(emp);
                              setFormOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(emp)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {grau && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${grau.color}`}
                          >
                            {grau.label}
                          </span>
                        )}
                        {emp.cnae && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            CNAE {emp.cnae}
                          </span>
                        )}
                        {!emp.ativo && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                            Inativa
                          </span>
                        )}
                        {emp.faturamento_posterior && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Fat. Posterior
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-1.5 text-xs text-slate-600">
                        {emp.cidade && emp.uf && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              {emp.cidade}/{emp.uf}
                            </span>
                          </div>
                        )}
                        {emp.numero_para_contato && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{emp.numero_para_contato}</span>
                          </div>
                        )}
                        {emp.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Eye className="h-3 w-3" /> Clique para ver detalhes
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="card">
                <div className="flex flex-col items-center justify-center py-16">
                  <Building2 className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-lg font-semibold text-slate-700 mb-1">
                    Nenhuma empresa encontrada
                  </p>
                  <p className="text-sm text-slate-500">
                    {searchTerm
                      ? "Tente buscar com outros termos."
                      : "Cadastre a primeira empresa para começar."}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ═══ ABA FATURAMENTO POSTERIOR ═══════════ */
          <motion.div
            key="tab-faturamento"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Explicação contextual */}
            <div className="card p-4 bg-emerald-50 border-emerald-200">
              <p className="text-sm text-emerald-800">
                <strong>Faturamento posterior:</strong> empresas cujos pacientes
                são atendidos gratuitamente na clínica. Ao final do período, é
                emitido um relatório com todos os atendimentos e um recibo de
                cobrança consolidado com os valores acordados por consulta e
                ASO.
              </p>
            </div>

            {/* Busca */}
            <div className="card">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar empresa por nome ou razão social..."
                  value={fatSearch}
                  onChange={(e) => setFatSearch(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Grid faturamento */}
            {fatLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              </div>
            ) : fatEmpresas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {fatEmpresas.map((emp, index) => (
                  <motion.div
                    key={emp.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="card group cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setFatSelectedEmpresa(emp)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                          <Building2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {emp.nome}
                          </h3>
                          <p className="text-xs text-slate-500">{emp.cnpj}</p>
                        </div>
                      </div>
                      <div
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFatConfigTarget(emp);
                        }}
                      >
                        <button
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Configurar faturamento"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Badges de valores */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {emp.dia_faturamento && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Dia {emp.dia_faturamento}
                        </span>
                      )}
                      {emp.valor_por_consulta != null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          Consulta: {currency(emp.valor_por_consulta)}
                        </span>
                      )}
                      {emp.valor_por_aso != null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          ASO: {currency(emp.valor_por_aso)}
                        </span>
                      )}
                    </div>

                    {/* Obs de faturamento */}
                    {emp.observacoes_faturamento && (
                      <p className="text-xs text-slate-500 italic mb-3 line-clamp-2">
                        {emp.observacoes_faturamento}
                      </p>
                    )}

                    {/* Info adicional */}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {emp.contato_rh_nome && (
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span>RH: {emp.contato_rh_nome}</span>
                        </div>
                      )}
                      {emp.cidade && emp.uf && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          {emp.cidade}/{emp.uf}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Ver atendimentos e gerar cobrança
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="card">
                <div className="flex flex-col items-center justify-center py-16">
                  <Receipt className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-lg font-semibold text-slate-700 mb-1">
                    Nenhuma empresa com faturamento posterior
                  </p>
                  <p className="text-sm text-slate-500 text-center max-w-md">
                    {fatSearch
                      ? "Nenhuma empresa encontrada com esse termo."
                      : 'Para ativar, edite uma empresa na aba "Empresas" e habilite o faturamento posterior nas configurações.'}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Modals ═════════════════════════════════ */}
      <EmpresaFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditEmpresa(null);
        }}
        onSubmit={editEmpresa ? handleUpdate : handleCreate}
        initialData={editEmpresa}
        saving={saving}
      />

      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirm
            empresa={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fatConfigTarget && (
          <FaturamentoConfigModal
            isOpen={!!fatConfigTarget}
            onClose={() => setFatConfigTarget(null)}
            onSubmit={handleFatSaveConfig}
            empresa={fatConfigTarget}
            saving={fatSaving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
