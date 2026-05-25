// src/features/empresas/components/EmpresaDetail.tsx
/**
 * Detalhe da empresa com sub-tabs ocupacionais
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Layers,
  Briefcase,
  Users,
  Clock,
  BarChart3,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Search,
  RefreshCw,
  AlertTriangle,
  UserMinus,
  UserCheck,
  MapPin,
  Phone,
  Mail,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/components/feedback/toast";
import {
  useEmpresa,
  useEmpresaDashboard,
  useSetores,
  useCargos,
  useVinculos,
  usePeriodicosPendentes,
  useEmpresaMutations,
} from "../hooks";
import { SetorFormModal } from "./SetorFormModal";
import { CargoFormModal } from "./CargoFormModal";
import { VinculoFormModal } from "./VinculoFormModal";
import type {
  EmpresaDetalheTab,
  Setor,
  Cargo,
  Trabalhador,
  StatusTrabalhador,
  SetorFormData,
  CargoFormData,
  VinculoFormData,
  RiscosOcupacionais,
} from "../types";
import {
  GRAU_RISCO_CONFIG,
  STATUS_VINCULO_OPTIONS,
  CATEGORIAS_RISCO,
} from "../types";

// ── Sub-tab config ───────────────────────────────────────────
const TABS: { id: EmpresaDetalheTab; label: string; icon: LucideIcon }[] = [
  { id: "info", label: "Informações", icon: Building2 },
  { id: "setores", label: "Setores", icon: Layers },
  { id: "cargos", label: "Cargos", icon: Briefcase },
  { id: "vinculos", label: "Trabalhadores", icon: Users },
  { id: "periodicos", label: "Periódicos", icon: Clock },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
];

// ── Helpers ──────────────────────────────────────────────────
const dateBR = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

function StatusBadge({ status }: { status: StatusTrabalhador }) {
  const cfg = STATUS_VINCULO_OPTIONS.find((s) => s.value === status);
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
        cfg?.color ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {cfg?.label ?? status}
    </span>
  );
}

function RiscoChips({ riscos }: { riscos: RiscosOcupacionais }) {
  const items = Object.entries(riscos).flatMap(
    ([cat, list]: [string, string[] | undefined]) =>
      (list ?? []).map((r: string) => ({ cat, r })),
  );

  if (!items.length) {
    return (
      <span className="text-xs text-slate-400">Nenhum risco cadastrado</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ cat, r }, i) => (
        <span
          key={i}
          className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600"
        >
          {CATEGORIAS_RISCO.find((c) => c.key === (cat as any))?.icon} {r}
        </span>
      ))}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  empresaId: number;
  onBack: () => void;
}

export function EmpresaDetail({ empresaId, onBack }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<EmpresaDetalheTab>("info");
  const [vinculoSearch, setVinculoSearch] = useState("");

  // Data hooks
  const {
    empresa,
    loading: empLoading,
    reload: reloadEmpresa,
  } = useEmpresa(empresaId);
  const {
    dashboard,
    loading: dashLoading,
    reload: reloadDash,
  } = useEmpresaDashboard(empresaId);
  const {
    setores,
    loading: setLoading,
    reload: reloadSetores,
  } = useSetores(empresaId);
  const {
    cargos,
    loading: carLoading,
    reload: reloadCargos,
  } = useCargos(empresaId);

  const {
    vinculos,
    total: vinTotal,
    loading: vinLoading,
    filters: vinFilters,
    updateFilters,
    reload: reloadVinculos,
  } = useVinculos(empresaId);

  const {
    pendentes,
    loading: perLoading,
    reload: reloadPeriodicos,
  } = usePeriodicosPendentes(empresaId);

  const {
    saving,
    createSetor,
    updateSetor,
    deleteSetor,
    createCargo,
    updateCargo,
    deleteCargo,
    createVinculo,
    desligarVinculo,
    reativarVinculo,
  } = useEmpresaMutations();

  // Modals
  const [setorModal, setSetorModal] = useState(false);
  const [editSetor, setEditSetor] = useState<Setor | null>(null);
  const [cargoModal, setCargoModal] = useState(false);
  const [editCargo, setEditCargo] = useState<Cargo | null>(null);
  const [vinculoModal, setVinculoModal] = useState(false);

  // Handlers
  const wrap = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  const handleCreateSetor = (d: SetorFormData) =>
    wrap(async () => {
      await createSetor(empresaId, d);
      setSetorModal(false);
      setEditSetor(null);
      reloadSetores();
    }, "Setor criado");

  const handleUpdateSetor = (d: SetorFormData) =>
    wrap(async () => {
      if (!editSetor) return;
      await updateSetor(empresaId, editSetor.id, d);
      setSetorModal(false);
      setEditSetor(null);
      reloadSetores();
    }, "Setor atualizado");

  const handleDeleteSetor = (setor: Setor) =>
    wrap(async () => {
      await deleteSetor(empresaId, setor.id);
      reloadSetores();
    }, `Setor '${setor.nome}' removido`);

  const handleCreateCargo = (d: CargoFormData) =>
    wrap(async () => {
      await createCargo(empresaId, d);
      setCargoModal(false);
      setEditCargo(null);
      reloadCargos();
    }, "Cargo criado");

  const handleUpdateCargo = (d: CargoFormData) =>
    wrap(async () => {
      if (!editCargo) return;
      await updateCargo(empresaId, editCargo.id, d);
      setCargoModal(false);
      setEditCargo(null);
      reloadCargos();
    }, "Cargo atualizado");

  const handleDeleteCargo = (cargo: Cargo) =>
    wrap(async () => {
      await deleteCargo(empresaId, cargo.id);
      reloadCargos();
    }, `Cargo '${cargo.nome}' removido`);

  const handleCreateVinculo = (d: VinculoFormData) =>
    wrap(async () => {
      await createVinculo(empresaId, d);
      setVinculoModal(false);
      reloadVinculos();
      reloadDash();
    }, "Vínculo criado");

  const isLegado = (t: Trabalhador) => (t as any).status === "LEGADO";

  const handleDesligar = (t: Trabalhador) => {
    if (isLegado(t)) {
      toast.error("Registro legado: não é possível desligar.");
      return;
    }
    const dt = prompt("Data de desligamento (YYYY-MM-DD):");
    if (!dt) return;
    wrap(async () => {
      await desligarVinculo((t as any).id, dt);
      reloadVinculos();
      reloadDash();
    }, "Trabalhador desligado");
  };

  const handleReativar = (t: Trabalhador) => {
    if (isLegado(t)) {
      toast.error("Registro legado: não é possível reativar.");
      return;
    }
    wrap(async () => {
      await reativarVinculo((t as any).id);
      reloadVinculos();
      reloadDash();
    }, "Vínculo reativado");
  };

  if (empLoading || !empresa) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const grauCfg = empresa.grau_risco
    ? GRAU_RISCO_CONFIG[empresa.grau_risco]
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 truncate">
              {empresa.nome}
            </h2>
            {grauCfg && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${grauCfg.color}`}
                title={grauCfg.desc}
              >
                {grauCfg.label}
              </span>
            )}
            {!empresa.ativo && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Inativa
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {empresa.cnpj}{" "}
            {empresa.razao_social && empresa.razao_social !== empresa.nome
              ? `· ${empresa.razao_social}`
              : ""}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.id
                ? "bg-white text-primary-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* ═══ INFO ════════════════════════════════════ */}
          {tab === "info" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Dados da Empresa
                </h3>
                <div className="space-y-2 text-sm text-slate-600">
                  {empresa.cnae && (
                    <p>
                      <span className="font-medium">CNAE:</span> {empresa.cnae}{" "}
                      {empresa.cnae_descricao
                        ? `— ${empresa.cnae_descricao}`
                        : ""}
                    </p>
                  )}
                  {empresa.inscricao_estadual && (
                    <p>
                      <span className="font-medium">IE:</span>{" "}
                      {empresa.inscricao_estadual}
                    </p>
                  )}
                  {empresa.inscricao_municipal && (
                    <p>
                      <span className="font-medium">IM:</span>{" "}
                      {empresa.inscricao_municipal}
                    </p>
                  )}
                  {empresa.observacoes && (
                    <p className="text-xs text-slate-500 italic">
                      {empresa.observacoes}
                    </p>
                  )}
                </div>
              </div>

              <div className="card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Endereço e Contato
                </h3>
                <div className="space-y-2 text-sm text-slate-600">
                  {empresa.logradouro && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                      <span>
                        {empresa.logradouro}
                        {empresa.numero ? `, ${empresa.numero}` : ""}
                        {empresa.complemento ? ` - ${empresa.complemento}` : ""}
                        <br />
                        {empresa.bairro ? `${empresa.bairro} · ` : ""}
                        {empresa.cidade}/{empresa.uf}{" "}
                        {empresa.cep ? `· ${empresa.cep}` : ""}
                      </span>
                    </div>
                  )}
                  {empresa.numero_para_contato && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      {empresa.numero_para_contato}
                    </div>
                  )}
                  {empresa.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      {empresa.email}
                    </div>
                  )}
                </div>
                {empresa.contato_rh_nome && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Contato RH
                    </p>
                    <p className="text-sm text-slate-600">
                      {empresa.contato_rh_nome}{" "}
                      {empresa.contato_rh_telefone
                        ? `· ${empresa.contato_rh_telefone}`
                        : ""}{" "}
                      {empresa.contato_rh_email
                        ? `· ${empresa.contato_rh_email}`
                        : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ SETORES ═════════════════════════════════ */}
          {tab === "setores" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">
                  {setores.length} setor(es)
                </p>
                <button
                  onClick={() => {
                    setEditSetor(null);
                    setSetorModal(true);
                  }}
                  className="btn-primary text-sm"
                >
                  <Plus className="h-4 w-4" /> Novo Setor
                </button>
              </div>
              {setLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : setores.length === 0 ? (
                <div className="card p-8 text-center">
                  <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Nenhum setor cadastrado. Setores representam áreas da
                    empresa com riscos ocupacionais próprios.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {setores.map((s) => (
                    <div
                      key={s.id}
                      className={`card p-4 ${!s.ativo ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {s.nome}
                          </p>
                          {s.descricao && (
                            <p className="text-xs text-slate-500">
                              {s.descricao}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditSetor(s);
                              setSetorModal(true);
                            }}
                            className="btn-ghost text-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSetor(s)}
                            className="btn-ghost text-xs text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <RiscoChips riscos={s.riscos_ocupacionais} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ CARGOS ══════════════════════════════════ */}
          {tab === "cargos" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">
                  {cargos.length} cargo(s)
                </p>
                <button
                  onClick={() => {
                    setEditCargo(null);
                    setCargoModal(true);
                  }}
                  className="btn-primary text-sm"
                >
                  <Plus className="h-4 w-4" /> Novo Cargo
                </button>
              </div>
              {carLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : cargos.length === 0 ? (
                <div className="card p-8 text-center">
                  <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Nenhum cargo cadastrado. Cargos definem exames obrigatórios
                    e riscos do trabalhador.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cargos.map((c) => (
                    <div
                      key={c.id}
                      className={`card p-4 ${!c.ativo ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {c.nome}
                            </p>
                            {c.cbo && (
                              <span className="text-[11px] text-slate-400">
                                CBO {c.cbo}
                              </span>
                            )}
                            {c.manipula_alimentos && (
                              <span className="text-[11px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                                🍽️ Alimentos
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {c.setor_nome ? `Setor: ${c.setor_nome} · ` : ""}
                            Periodicidade: {c.periodicidade_meses}m
                            {c.total_trabalhadores_ativos !== undefined
                              ? ` · ${c.total_trabalhadores_ativos} trabalhador(es)`
                              : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditCargo(c);
                              setCargoModal(true);
                            }}
                            className="btn-ghost text-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCargo(c)}
                            className="btn-ghost text-xs text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {Object.entries(c.nrs_aplicaveis || {}).some(
                        ([, v]) => v,
                      ) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {Object.entries(c.nrs_aplicaveis || {})
                            .filter(([, v]) => v)
                            .map(([nr]) => (
                              <span
                                key={nr}
                                className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-200"
                              >
                                {nr.toUpperCase()}
                              </span>
                            ))}
                        </div>
                      )}

                      <RiscoChips riscos={c.riscos_ocupacionais} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ VINCULOS / TRABALHADORES ═════════════════ */}
          {tab === "vinculos" && (
            <div>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    className="input pl-10 text-sm"
                    placeholder="Buscar trabalhador..."
                    value={vinculoSearch}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVinculoSearch(v);
                      updateFilters({ search: v || undefined, offset: 0 });
                    }}
                  />
                </div>

                <select
                  className="select text-sm w-auto"
                  value={vinFilters.status ?? "todos"}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateFilters({
                      status: v === "todos" ? "todos" : (v as any),
                      offset: 0,
                    });
                  }}
                >
                  <option value="todos">Todos</option>
                  {STATUS_VINCULO_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setVinculoModal(true)}
                  className="btn-primary text-sm"
                >
                  <Plus className="h-4 w-4" /> Novo Vínculo
                </button>
              </div>

              {vinLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : vinculos.length === 0 ? (
                <div className="card p-8 text-center">
                  <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Nenhum trabalhador vinculado. Crie o primeiro vínculo para
                    associar um paciente à empresa.
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-semibold text-slate-500 p-3">
                          Trabalhador
                        </th>
                        <th className="text-left text-xs font-semibold text-slate-500 p-3 hidden sm:table-cell">
                          Função / Cargo
                        </th>
                        <th className="text-left text-xs font-semibold text-slate-500 p-3 hidden md:table-cell">
                          Admissão
                        </th>
                        <th className="text-center text-xs font-semibold text-slate-500 p-3">
                          Status
                        </th>
                        <th className="text-right text-xs font-semibold text-slate-500 p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {vinculos.map((v: Trabalhador) => (
                        <tr
                          key={(v as any).id}
                          className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-3">
                            <p className="text-sm font-medium text-slate-900">
                              {(v as any).paciente_nome ?? "—"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(v as any).paciente_cpf ?? "—"}{" "}
                              {(v as any).matricula
                                ? `· Mat: ${(v as any).matricula}`
                                : ""}
                            </p>
                          </td>

                          <td className="p-3 hidden sm:table-cell">
                            <p className="text-sm text-slate-800">
                              {(v as any).funcao ?? "—"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {(v as any).cargo_nome
                                ? `Cargo: ${(v as any).cargo_nome}`
                                : ""}
                              {(v as any).setor_nome
                                ? ` · ${(v as any).setor_nome}`
                                : ""}
                            </p>
                          </td>

                          <td className="p-3 text-xs text-slate-600 hidden md:table-cell">
                            {dateBR((v as any).data_admissao)}
                          </td>

                          <td className="p-3 text-center">
                            <StatusBadge status={(v as any).status as any} />
                          </td>

                          <td className="p-3 text-right">
                            {!isLegado(v) && (v as any).status === "ATIVO" && (
                              <button
                                onClick={() => handleDesligar(v)}
                                className="btn-ghost text-xs text-red-600"
                                title="Desligar"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {!isLegado(v) &&
                              (v as any).status === "DESLIGADO" && (
                                <button
                                  onClick={() => handleReativar(v)}
                                  className="btn-ghost text-xs text-green-600"
                                  title="Reativar"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 p-3">
                    {vinTotal} registro(s)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══ PERIÓDICOS ══════════════════════════════ */}
          {tab === "periodicos" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-500">
                    {pendentes.length} periódico(s) pendente(s) ou vencido(s)
                    nos próximos 30 dias
                  </p>
                </div>
                <button
                  onClick={reloadPeriodicos}
                  className="btn-secondary text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {perLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : pendentes.length === 0 ? (
                <div className="card p-8 text-center">
                  <Clock className="h-10 w-10 text-green-300 mx-auto mb-3" />
                  <p className="text-sm text-green-700 font-medium">
                    Todos os periódicos estão em dia!
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Nenhum trabalhador com exame periódico vencido ou a vencer
                    nos próximos 30 dias.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendentes.map((p) => (
                    <div
                      key={p.vinculo_id}
                      className={`card p-4 border-l-4 ${p.vencido ? "border-red-400" : "border-amber-400"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {p.paciente_nome}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.funcao} {p.cargo_nome ? `(${p.cargo_nome})` : ""}{" "}
                            {p.setor_nome ? `· ${p.setor_nome}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          {p.vencido ? (
                            <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Vencido
                              há {Math.abs(p.dias_para_vencer)} dia(s)
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">
                              Vence em {p.dias_para_vencer} dia(s) —{" "}
                              {dateBR(p.data_vencimento)}
                            </span>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Último ASO: {dateBR(p.ultimo_aso_data)} ·
                            Periodicidade: {p.periodicidade_meses}m
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ DASHBOARD ═══════════════════════════════ */}
          {tab === "dashboard" && (
            <div>
              {dashLoading || !dashboard ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Trabalhadores ativos",
                      value: dashboard.ativos,
                      icon: Users,
                      color: "bg-green-100 text-green-600",
                    },
                    {
                      label: "Total setores",
                      value: dashboard.total_setores,
                      icon: Layers,
                      color: "bg-violet-100 text-violet-600",
                    },
                    {
                      label: "Total cargos",
                      value: dashboard.total_cargos,
                      icon: Briefcase,
                      color: "bg-orange-100 text-orange-600",
                    },
                    {
                      label: "ASOs emitidos",
                      value: dashboard.total_asos_emitidos,
                      icon: ShieldAlert,
                      color: "bg-blue-100 text-blue-600",
                    },
                  ].map((s) => (
                    <div key={s.label} className="card p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${s.color}`}>
                          <s.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{s.label}</p>
                          <p className="text-lg font-bold text-slate-900">
                            {s.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Modals ────────────────────────────────────── */}
      <SetorFormModal
        isOpen={setorModal}
        onClose={() => {
          setSetorModal(false);
          setEditSetor(null);
        }}
        onSubmit={editSetor ? handleUpdateSetor : handleCreateSetor}
        initialData={editSetor}
        saving={saving}
      />

      <CargoFormModal
        isOpen={cargoModal}
        onClose={() => {
          setCargoModal(false);
          setEditCargo(null);
        }}
        onSubmit={editCargo ? handleUpdateCargo : handleCreateCargo}
        initialData={editCargo}
        setores={setores}
        saving={saving}
      />

      <VinculoFormModal
        isOpen={vinculoModal}
        onClose={() => setVinculoModal(false)}
        onSubmit={handleCreateVinculo}
        setores={setores}
        cargos={cargos}
        saving={saving}
      />
    </div>
  );
}
