/**
 * Página principal do módulo Farmácia / Controle de Estoque
 *
 * Tabs: Dashboard · Medicamentos · Movimentações · Fornecedores
 *
 * Conceitos-chave (exibidos como dicas na UI):
 * - Catálogo de medicamentos: lista de todos os medicamentos que a clínica trabalha
 * - Lotes: cada entrada física de medicamento, com validade própria
 * - Semáforo de validade: 🟢 >180d, 🟠 90–180d, 🔴 <90d, ⛔ vencido
 * - FEFO: First Expired, First Out — dispensação automática pelo lote mais próximo do vencimento
 * - Dispensação: entrega de medicamento ao paciente, com registro de CPF e opcionalmente CRM
 * - Movimentações: histórico imutável de todas as entradas, saídas, ajustes e descartes
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Package,
  Send,
  Truck,
  AlertTriangle,
  RefreshCw,
  Plus,
  Search,
  X,
  BarChart3,
  ArrowRightLeft,
  Info,
  Loader2,
  Bell,
  ChevronRight,
  ShieldAlert,
  PackagePlus,
  Eye,
  Edit3,
  Trash2,
  HelpCircle,
  PackageX,
  FileText,
  Users,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast";
import {
  CorValidadeBadge,
  AlertasPanel,
  MedicamentoFormModal,
  LoteFormModal,
  DispensacaoModal,
  MovimentacaoModal,
  FornecedorFormModal,
} from "../components";
import { medicamentosAPI, lotesAPI, estoqueAPI, fornecedoresAPI } from "../api";
import type {
  Medicamento,
  Lote,
  Movimentacao,
  Fornecedor,
  DashboardEstoque,
  AlertaEstoque,
  MedicamentoFormData,
  LoteFormData,
  DispensacaoFormData,
  FornecedorFormData,
  MovimentacaoFilters,
  CorValidade,
  MedicamentoAutocomplete,
  MotivoDescarte,
} from "../types";
import {
  TIPO_MOVIMENTACAO_LABELS,
  TIPO_MOVIMENTACAO_COLORS,
  COR_VALIDADE_CONFIG,
  CLASSIFICACAO_LABELS,
} from "../types";

type FarmaciaTab =
  | "dashboard"
  | "medicamentos"
  | "movimentacoes"
  | "fornecedores";

const TABS: {
  id: FarmaciaTab;
  label: string;
  icon: typeof Pill;
  desc: string;
}[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: BarChart3,
    desc: "Visão geral do estoque",
  },
  {
    id: "medicamentos",
    label: "Medicamentos",
    icon: Pill,
    desc: "Catálogo e lotes",
  },
  {
    id: "movimentacoes",
    label: "Movimentações",
    icon: ArrowRightLeft,
    desc: "Histórico de entradas e saídas",
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    icon: Truck,
    desc: "Distribuidoras e fabricantes",
  },
];

// ─── Empty State genérico ────────────────────────────────────
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
}: {
  icon: typeof Pill;
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

// ─── Dica inline ─────────────────────────────────────────────
function InlineTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 mb-5">
      <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

// ─── Formato BR ──────────────────────────────────────────────
function dateBR(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function dateTimeBR(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
function currency(v?: number) {
  if (v === undefined || v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════
export default function FarmaciaPage() {
  const toast = useToast();
  const [tab, setTab] = useState<FarmaciaTab>("dashboard");

  // Data
  const [dashboard, setDashboard] = useState<DashboardEstoque | null>(null);
  const [alertas, setAlertas] = useState<AlertaEstoque[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // Loading
  const [dashLoading, setDashLoading] = useState(false);
  const [medLoading, setMedLoading] = useState(false);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [movLoading, setMovLoading] = useState(false);
  const [fornLoading, setFornLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [dispensacaoModalOpen, setDispensacaoModalOpen] = useState(false);
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [fornModalOpen, setFornModalOpen] = useState(false);

  // Edit / selection state
  const [editMed, setEditMed] = useState<Medicamento | null>(null);
  const [editForn, setEditForn] = useState<Fornecedor | null>(null);
  const [selectedMed, setSelectedMed] = useState<Medicamento | null>(null);
  const [preselectedDispMed, setPreselectedDispMed] =
    useState<MedicamentoAutocomplete | null>(null);
  const [movModalTipo, setMovModalTipo] = useState<
    "ENTRADA" | "AJUSTE" | "DESCARTE"
  >("ENTRADA");
  const [movModalLote, setMovModalLote] = useState<Lote | null>(null);
  const [movModalMedNome, setMovModalMedNome] = useState("");

  // Filters
  const [medSearch, setMedSearch] = useState("");
  const [movFilters, setMovFilters] = useState<MovimentacaoFilters>({});
  const [fornSearch, setFornSearch] = useState("");
  const [showAlertas, setShowAlertas] = useState(false);

  // ── Loaders ────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    try {
      setDashLoading(true);
      const [d, a] = await Promise.all([
        estoqueAPI.getDashboard(),
        estoqueAPI.getAlertas(),
      ]);
      setDashboard(d);
      setAlertas(a.alertas ?? []);
    } catch {
      toast.error("Erro ao carregar dashboard");
    } finally {
      setDashLoading(false);
    }
  }, []);

  const loadMedicamentos = useCallback(async () => {
    try {
      setMedLoading(true);
      const data = await medicamentosAPI.list({
        search: medSearch || undefined,
        include_estoque: true,
        limit: 200,
      });
      setMedicamentos(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar medicamentos");
    } finally {
      setMedLoading(false);
    }
  }, [medSearch]);

  const loadLotes = useCallback(async (medId: number) => {
    try {
      setLotesLoading(true);
      const data = await lotesAPI.listByMedicamento(medId);
      setLotes(data.lotes ?? []);
    } catch {
      setLotes([]);
    } finally {
      setLotesLoading(false);
    }
  }, []);

  const loadMovimentacoes = useCallback(async () => {
    try {
      setMovLoading(true);
      const data = await estoqueAPI.getMovimentacoes(movFilters);
      setMovimentacoes(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar movimentações");
    } finally {
      setMovLoading(false);
    }
  }, [movFilters]);

  const loadFornecedores = useCallback(async () => {
    try {
      setFornLoading(true);
      const data = await fornecedoresAPI.list({
        search: fornSearch || undefined,
        limit: 200,
      });
      setFornecedores(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar fornecedores");
    } finally {
      setFornLoading(false);
    }
  }, [fornSearch]);

  // ── Effects ────────────────────────────────────────────────

  useEffect(() => {
    loadDashboard();
  }, []);
  useEffect(() => {
    if (tab === "medicamentos") loadMedicamentos();
  }, [tab, medSearch]);
  useEffect(() => {
    if (tab === "movimentacoes") loadMovimentacoes();
  }, [tab, movFilters]);
  useEffect(() => {
    if (tab === "fornecedores") loadFornecedores();
  }, [tab, fornSearch]);
  useEffect(() => {
    if (selectedMed) loadLotes(selectedMed.id);
  }, [selectedMed]);

  // ── Handlers ───────────────────────────────────────────────

  const wrap = async (fn: () => Promise<void>, successMsg?: string) => {
    try {
      setSaving(true);
      await fn();
      if (successMsg) toast.success(successMsg);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Erro na operação");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMed = (d: MedicamentoFormData) =>
    wrap(async () => {
      await medicamentosAPI.create(d);
      setMedModalOpen(false);
      setEditMed(null);
      loadMedicamentos();
      loadDashboard();
    }, "Medicamento cadastrado");

  const handleUpdateMed = (d: MedicamentoFormData) =>
    wrap(async () => {
      if (!editMed) return;
      await medicamentosAPI.update(editMed.id, d);
      setMedModalOpen(false);
      setEditMed(null);
      loadMedicamentos();
      loadDashboard();
    }, "Medicamento atualizado");

  const handleCreateLote = (d: LoteFormData) =>
    wrap(async () => {
      if (!selectedMed) return;
      await lotesAPI.create(selectedMed.id, d);
      setLoteModalOpen(false);
      loadLotes(selectedMed.id);
      loadDashboard();
    }, "Lote cadastrado");

  const handleDispensar = (d: DispensacaoFormData) =>
    wrap(async () => {
      await estoqueAPI.dispensar(d);
      setDispensacaoModalOpen(false);
      setPreselectedDispMed(null);
      loadDashboard();
      if (tab === "medicamentos") loadMedicamentos();
      if (selectedMed) loadLotes(selectedMed.id);
    }, "Dispensação realizada (FEFO)");

  // ✅ FIX: assinatura do MovimentacaoModal (ENTRADA) é (loteId, quantidade, obs?)
  const handleEntrada = async (
    loteId: number,
    quantidade: number,
    obs?: string,
  ) =>
    wrap(async () => {
      await estoqueAPI.registrarEntrada({
        lote_id: loteId,
        quantidade,
        observacoes: obs,
      });
      setMovModalOpen(false);
      if (selectedMed) loadLotes(selectedMed.id);
      loadDashboard();
    }, "Entrada registrada");

  // ✅ OK: assinatura do MovimentacaoModal (AJUSTE) é (loteId, quantidade, positivo, obs?)
  const handleAjuste = async (
    loteId: number,
    quantidade: number,
    positivo: boolean,
    obs?: string,
  ) =>
    wrap(async () => {
      await estoqueAPI.registrarAjuste({
        lote_id: loteId,
        quantidade,
        positivo,
        observacoes: obs,
      });
      setMovModalOpen(false);
      if (selectedMed) loadLotes(selectedMed.id);
      loadDashboard();
    }, "Ajuste registrado");

  const handleDescarte = async (
    loteId: number,
    qtd: number,
    motivo: string,
    obs?: string,
  ) =>
    wrap(async () => {
      await estoqueAPI.registrarDescarte({
        lote_id: loteId,
        quantidade: qtd,
        motivo: motivo as MotivoDescarte,
        observacoes: obs,
      });
      setMovModalOpen(false);
      if (selectedMed) loadLotes(selectedMed.id);
      loadDashboard();
    }, "Descarte registrado");

  const handleCreateForn = (d: FornecedorFormData) =>
    wrap(async () => {
      await fornecedoresAPI.create(d);
      setFornModalOpen(false);
      setEditForn(null);
      loadFornecedores();
    }, "Fornecedor cadastrado");

  const handleUpdateForn = (d: FornecedorFormData) =>
    wrap(async () => {
      if (!editForn) return;
      await fornecedoresAPI.update(editForn.id, d);
      setFornModalOpen(false);
      setEditForn(null);
      loadFornecedores();
    }, "Fornecedor atualizado");

  const openMovModal = (
    tipo: "ENTRADA" | "AJUSTE" | "DESCARTE",
    lote: Lote,
    medNome: string,
  ) => {
    setMovModalTipo(tipo);
    setMovModalLote(lote);
    setMovModalMedNome(medNome);
    setMovModalOpen(true);
  };

  const openDispensacaoMed = (med: Medicamento) => {
    setPreselectedDispMed({
      id: med.id,
      nome_comercial: med.nome_comercial,
      principio_ativo: med.principio_ativo,
      concentracao: med.concentracao,
      estoque_total: med.estoque_total ?? 0,
      classificacao_anvisa: med.classificacao_anvisa,
    } as MedicamentoAutocomplete);
    setDispensacaoModalOpen(true);
  };

  // ── Alertas count ──────────────────────────────────────────
  const alertasCriticos = alertas.filter(
    (a) => a.urgencia === "CRITICA",
  ).length;

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 rounded-2xl">
            <Pill className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Farmácia</h1>
            <p className="text-sm text-secondary-500">
              Controle de estoque, dispensação e rastreabilidade de medicamentos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {alertasCriticos > 0 && (
            <button
              onClick={() => setShowAlertas(!showAlertas)}
              className="relative btn-ghost text-red-600"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {alertasCriticos}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              setPreselectedDispMed(null);
              setDispensacaoModalOpen(true);
            }}
            className="btn-primary"
          >
            <Send className="h-4 w-4" /> Dispensar
          </button>
        </div>
      </div>

      {/* ── Stats Cards ──────────────────────────────────── */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Medicamentos",
              value: dashboard.total_medicamentos,
              icon: Pill,
              color: "text-teal-600 bg-teal-100",
            },
            {
              label: "Lotes ativos",
              value: dashboard.total_lotes_ativos,
              icon: Package,
              color: "text-blue-600 bg-blue-100",
            },
            {
              label: "Alertas",
              value: dashboard.total_alertas,
              icon: AlertTriangle,
              color: alertasCriticos
                ? "text-red-600 bg-red-100"
                : "text-yellow-600 bg-yellow-100",
              click: () => setShowAlertas(true),
            },
            {
              label: "Valor estoque",
              value: currency(dashboard.valor_total_estoque),
              icon: BarChart3,
              color: "text-emerald-600 bg-emerald-100",
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`card p-4 ${s.click ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
              onClick={s.click}
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

      {/* ── Semáforo Resumo ──────────────────────────────── */}
      {dashboard && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-secondary-500 mr-1">Validades:</span>
          {(
            Object.entries(dashboard.por_cor_validade ?? {}) as [
              CorValidade,
              number,
            ][]
          ).map(([cor, count]) => (
            <span
              key={cor}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${COR_VALIDADE_CONFIG[cor]?.bg ?? ""} ${COR_VALIDADE_CONFIG[cor]?.text ?? ""} ${COR_VALIDADE_CONFIG[cor]?.border ?? ""}`}
            >
              {COR_VALIDADE_CONFIG[cor]?.icon} {COR_VALIDADE_CONFIG[cor]?.label}
              : <strong>{count}</strong>
            </span>
          ))}
          {(dashboard.abaixo_minimo ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
              📦 Abaixo do mínimo: <strong>{dashboard.abaixo_minimo}</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Alertas Panel ────────────────────────────────── */}
      <AnimatePresence>
        {showAlertas && (
          <AlertasPanel
            alertas={alertas}
            onClose={() => setShowAlertas(false)}
            loading={dashLoading}
          />
        )}
      </AnimatePresence>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex gap-1 bg-bg-200 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? "bg-bg-100 text-primary-600 shadow-sm" : "text-secondary-500 hover:text-secondary-700"}`}
          >
            <t.icon className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* ═══ DASHBOARD ═══════════════════════════════════ */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              <InlineTip>
                <strong>Como funciona a farmácia?</strong> Cadastre medicamentos
                no catálogo, registre lotes com validade ao recebê-los e
                dispense ao paciente. O sistema controla estoque, vencimentos
                (semáforo de cores) e exige CRM para medicamentos controlados
                (ANVISA).
              </InlineTip>

              {/* Acesso rápido */}
              <div>
                <h3 className="text-lg font-semibold text-secondary-800 mb-3">
                  Acesso rápido
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Novo medicamento",
                      desc: "Cadastrar no catálogo",
                      icon: PackagePlus,
                      color: "bg-teal-50 text-teal-600",
                      fn: () => {
                        setEditMed(null);
                        setMedModalOpen(true);
                      },
                    },
                    {
                      label: "Dispensar",
                      desc: "Entregar ao paciente (FEFO)",
                      icon: Send,
                      color: "bg-blue-50 text-blue-600",
                      fn: () => {
                        setPreselectedDispMed(null);
                        setDispensacaoModalOpen(true);
                      },
                    },
                    {
                      label: "Movimentações",
                      desc: "Histórico completo",
                      icon: ArrowRightLeft,
                      color: "bg-amber-50 text-amber-600",
                      fn: () => setTab("movimentacoes"),
                    },
                    {
                      label: "Fornecedores",
                      desc: "Distribuidoras cadastradas",
                      icon: Truck,
                      color: "bg-purple-50 text-purple-600",
                      fn: () => setTab("fornecedores"),
                    },
                  ].map((item, i) => (
                    <motion.button
                      key={item.label}
                      onClick={item.fn}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="card p-4 text-left hover:shadow-md transition-shadow group"
                    >
                      <div
                        className={`p-2 rounded-xl ${item.color} inline-flex mb-3`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-secondary-900 mb-0.5">
                        {item.label}
                      </p>
                      <p className="text-xs text-secondary-400">{item.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Resumo validades */}
              {dashboard && (
                <div>
                  <h3 className="text-lg font-semibold text-secondary-800 mb-3">
                    Resumo de validades
                  </h3>
                  <p className="text-xs text-secondary-400 mb-4">
                    O semáforo de validade classifica automaticamente os lotes
                    conforme a proximidade do vencimento, permitindo ação
                    preventiva e cumprindo a regra FEFO.
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {(
                      [
                        "VERDE",
                        "LARANJA",
                        "VERMELHO",
                        "VENCIDO",
                      ] as CorValidade[]
                    ).map((cor) => {
                      const cfg = COR_VALIDADE_CONFIG[cor];
                      const count = dashboard.por_cor_validade?.[cor] ?? 0;
                      return (
                        <div
                          key={cor}
                          className={`card p-4 border-l-4 ${cfg?.border ?? ""}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{cfg?.icon}</span>
                            <span
                              className={`text-sm font-semibold ${cfg?.text ?? ""}`}
                            >
                              {cfg?.label}
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-secondary-900">
                            {count}
                          </p>
                          <p className="text-[11px] text-secondary-400 mt-1">
                            {cor === "VERDE" &&
                              "Lotes com mais de 180 dias de validade"}
                            {cor === "LARANJA" &&
                              "Lotes com 90 a 180 dias até o vencimento"}
                            {cor === "VERMELHO" &&
                              "Lotes com menos de 90 dias — priorize o uso"}
                            {cor === "VENCIDO" &&
                              "Lotes expirados — devem ser descartados"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ MEDICAMENTOS ════════════════════════════════ */}
          {tab === "medicamentos" && (
            <div>
              <InlineTip>
                <strong>Catálogo de medicamentos:</strong> aqui estão todos os
                medicamentos que a clínica trabalha. Clique em "Ver lotes" para
                gerenciar as entradas físicas (lotes) de cada um. A barra de
                estoque mostra o nível atual em relação ao máximo configurado.
              </InlineTip>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                  <input
                    className="input pl-10"
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    placeholder="Buscar medicamento..."
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={loadMedicamentos} className="btn-secondary">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditMed(null);
                      setMedModalOpen(true);
                    }}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4" />{" "}
                    <span className="hidden sm:inline">Novo medicamento</span>
                  </button>
                </div>
              </div>

              {/* Loading */}
              {medLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              )}

              {/* Empty */}
              {!medLoading && medicamentos.length === 0 && (
                <EmptyState
                  icon={Pill}
                  title={
                    medSearch
                      ? "Nenhum medicamento encontrado"
                      : "Nenhum medicamento cadastrado"
                  }
                  description={
                    medSearch
                      ? `Não encontramos medicamentos para "${medSearch}". Tente outro termo ou cadastre um novo.`
                      : "O catálogo de medicamentos está vazio. Cadastre o primeiro medicamento para começar a controlar o estoque da farmácia."
                  }
                  action={
                    !medSearch
                      ? () => {
                          setEditMed(null);
                          setMedModalOpen(true);
                        }
                      : undefined
                  }
                  actionLabel="Cadastrar medicamento"
                />
              )}

              {/* Grid + Drawer */}
              {!medLoading && medicamentos.length > 0 && (
                <div className="flex gap-6">
                  {/* Cards grid */}
                  <div
                    className={`flex-1 grid grid-cols-1 ${selectedMed ? "md:grid-cols-1 xl:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"} gap-4`}
                  >
                    {medicamentos.map((med, i) => {
                      const estoquePercent = med.estoque_maximo
                        ? Math.min(
                            100,
                            ((med.estoque_total ?? 0) / med.estoque_maximo) *
                              100,
                          )
                        : 0;
                      const abaixoMin =
                        (med.estoque_total ?? 0) < (med.estoque_minimo ?? 0);
                      return (
                        <motion.div
                          key={med.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="card p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-secondary-900 truncate">
                                {med.nome_comercial}
                              </p>
                              <p className="text-xs text-secondary-500 truncate">
                                {med.principio_ativo}
                                {med.concentracao
                                  ? ` · ${med.concentracao}`
                                  : ""}
                              </p>
                            </div>
                            {med.is_controlado && (
                              <span title="Medicamento controlado (ANVISA)">
                                <ShieldAlert className="h-4 w-4 text-red-500 flex-shrink-0" />
                              </span>
                            )}
                          </div>

                          {/* Barra de estoque */}
                          <div className="mb-2">
                            <div className="flex justify-between text-[11px] text-secondary-400 mb-1">
                              <span>Estoque: {med.estoque_total ?? 0}</span>
                              <span>Máx: {med.estoque_maximo ?? "—"}</span>
                            </div>
                            <div className="h-2 bg-bg-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${abaixoMin ? "bg-red-400" : estoquePercent > 75 ? "bg-green-400" : estoquePercent > 40 ? "bg-blue-400" : "bg-amber-400"}`}
                                style={{ width: `${estoquePercent}%` }}
                              />
                            </div>
                            {abaixoMin && (
                              <p className="text-[11px] text-red-500 mt-1">
                                ⚠ Abaixo do mínimo ({med.estoque_minimo})
                              </p>
                            )}
                          </div>

                          {/* Classificação */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-bg-200 text-secondary-500">
                              {CLASSIFICACAO_LABELS[
                                med.classificacao_anvisa as keyof typeof CLASSIFICACAO_LABELS
                              ] ?? med.classificacao_anvisa}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedMed(med)}
                              className="btn-secondary text-xs flex-1"
                            >
                              <Eye className="h-3.5 w-3.5" /> Lotes
                            </button>
                            <button
                              onClick={() => openDispensacaoMed(med)}
                              className="btn-secondary text-xs flex-1"
                              disabled={(med.estoque_total ?? 0) === 0}
                            >
                              <Send className="h-3.5 w-3.5" /> Dispensar
                            </button>
                            <button
                              onClick={() => {
                                setEditMed(med);
                                setMedModalOpen(true);
                              }}
                              className="btn-ghost text-xs"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Lotes Drawer */}
                  <AnimatePresence>
                    {selectedMed && (
                      <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.25 }}
                        className="w-full max-w-sm bg-bg-100 border border-bg-300 rounded-2xl shadow-lg p-5 sticky top-4 self-start max-h-[80vh] overflow-y-auto hidden md:block"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-secondary-900 truncate">
                              {selectedMed.nome_comercial}
                            </h3>
                            <p className="text-xs text-secondary-500">
                              Lotes deste medicamento
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedMed(null)}
                            className="btn-icon btn-ghost"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => setLoteModalOpen(true)}
                          className="btn-primary w-full mb-4 text-sm"
                        >
                          <Plus className="h-4 w-4" /> Novo lote
                        </button>

                        {lotesLoading && (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                          </div>
                        )}

                        {!lotesLoading && lotes.length === 0 && (
                          <div className="text-center py-8">
                            <Package className="h-8 w-8 text-secondary-300 mx-auto mb-2" />
                            <p className="text-sm text-secondary-500">
                              Nenhum lote cadastrado
                            </p>
                            <p className="text-xs text-secondary-400 mt-1">
                              Cadastre o primeiro lote para dar entrada no
                              estoque deste medicamento.
                            </p>
                          </div>
                        )}

                        {!lotesLoading && lotes.length > 0 && (
                          <div className="space-y-3">
                            {lotes.map((lote) => (
                              <div
                                key={lote.id}
                                className="p-3 bg-bg-200/50 rounded-xl border border-bg-300"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-secondary-800">
                                    Lote: {lote.numero_lote}
                                  </span>
                                  {lote.cor_validade && (
                                    <CorValidadeBadge
                                      cor={lote.cor_validade}
                                      diasParaVencer={lote.dias_para_vencer}
                                    />
                                  )}
                                </div>
                                <p className="text-xs text-secondary-500">
                                  Qtd: <strong>{lote.quantidade_atual}</strong>{" "}
                                  · Val: {dateBR(lote.data_validade)}
                                </p>
                                {lote.localizacao && (
                                  <p className="text-[11px] text-secondary-400">
                                    📍 {lote.localizacao}
                                  </p>
                                )}

                                <div className="flex gap-1.5 mt-2">
                                  <button
                                    onClick={() =>
                                      openMovModal(
                                        "ENTRADA",
                                        lote,
                                        selectedMed.nome_comercial,
                                      )
                                    }
                                    className="btn-ghost text-[11px] text-green-600"
                                    title="Registrar entrada"
                                  >
                                    📥 Entrada
                                  </button>
                                  <button
                                    onClick={() =>
                                      openMovModal(
                                        "AJUSTE",
                                        lote,
                                        selectedMed.nome_comercial,
                                      )
                                    }
                                    className="btn-ghost text-[11px] text-amber-600"
                                    title="Ajustar estoque"
                                  >
                                    📊 Ajuste
                                  </button>
                                  <button
                                    onClick={() =>
                                      openMovModal(
                                        "DESCARTE",
                                        lote,
                                        selectedMed.nome_comercial,
                                      )
                                    }
                                    className="btn-ghost text-[11px] text-red-600"
                                    title="Descartar"
                                  >
                                    🗑️ Descarte
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* ═══ MOVIMENTAÇÕES ════════════════════════════════ */}
          {tab === "movimentacoes" && (
            <div>
              <InlineTip>
                <strong>Movimentações:</strong> registro imutável de todas as
                operações no estoque. Cada entrada, saída, dispensação, ajuste
                ou descarte gera uma linha neste histórico, formando a trilha de
                auditoria (audit trail) do controle farmacêutico.
              </InlineTip>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="flex-1">
                  <select
                    className="select"
                    value={movFilters.tipo ?? ""}
                    onChange={(e) =>
                      setMovFilters((f) => ({
                        ...f,
                        tipo: (e.target.value ||
                          undefined) as MovimentacaoFilters["tipo"],
                      }))
                    }
                  >
                    <option value="">Todos os tipos</option>
                    {Object.entries(TIPO_MOVIMENTACAO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    className="input"
                    type="date"
                    value={movFilters.data_inicio ?? ""}
                    onChange={(e) =>
                      setMovFilters((f) => ({
                        ...f,
                        data_inicio: e.target.value || undefined,
                      }))
                    }
                    title="Data início"
                  />
                  <input
                    className="input"
                    type="date"
                    value={movFilters.data_fim ?? ""}
                    onChange={(e) =>
                      setMovFilters((f) => ({
                        ...f,
                        data_fim: e.target.value || undefined,
                      }))
                    }
                    title="Data fim"
                  />
                  <button onClick={loadMovimentacoes} className="btn-secondary">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {movLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              )}

              {!movLoading && movimentacoes.length === 0 && (
                <EmptyState
                  icon={ArrowRightLeft}
                  title="Nenhuma movimentação encontrada"
                  description={
                    movFilters.tipo || movFilters.data_inicio
                      ? "Nenhum registro corresponde aos filtros aplicados. Tente ajustar o tipo ou o período."
                      : "O histórico de movimentações está vazio. Ele será preenchido automaticamente conforme você registrar entradas, dispensações, ajustes ou descartes."
                  }
                />
              )}

              {!movLoading && movimentacoes.length > 0 && (
                <div className="table-container">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3">
                          Data
                        </th>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3">
                          Tipo
                        </th>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3">
                          Medicamento
                        </th>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3 hidden sm:table-cell">
                          Lote
                        </th>
                        <th className="text-right text-xs font-semibold text-secondary-500 p-3">
                          Qtd
                        </th>
                        <th className="text-right text-xs font-semibold text-secondary-500 p-3 hidden md:table-cell">
                          Saldo
                        </th>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3 hidden lg:table-cell">
                          Paciente
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimentacoes.map((mov) => {
                        const tipoColor =
                          TIPO_MOVIMENTACAO_COLORS[
                            mov.tipo as keyof typeof TIPO_MOVIMENTACAO_COLORS
                          ] ?? "bg-gray-100 text-gray-700";
                        return (
                          <tr
                            key={mov.id}
                            className="border-t border-bg-200 hover:bg-bg-200/50 transition-colors"
                          >
                            <td className="p-3 text-xs text-secondary-700">
                              {dateTimeBR(mov.data_movimentacao)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tipoColor}`}
                              >
                                {TIPO_MOVIMENTACAO_LABELS[
                                  mov.tipo as keyof typeof TIPO_MOVIMENTACAO_LABELS
                                ] ?? mov.tipo}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-secondary-800 font-medium">
                              {mov.medicamento_nome ?? "—"}
                            </td>
                            <td className="p-3 text-xs text-secondary-500 hidden sm:table-cell">
                              {mov.numero_lote ?? "—"}
                            </td>
                            <td className="p-3 text-xs text-right font-semibold text-secondary-900">
                              {mov.quantidade > 0
                                ? `+${mov.quantidade}`
                                : mov.quantidade}
                            </td>
                            <td className="p-3 text-xs text-right text-secondary-500 hidden md:table-cell">
                              {mov.saldo_anterior} → {mov.saldo_posterior}
                            </td>
                            <td className="p-3 text-xs text-secondary-500 hidden lg:table-cell">
                              {mov.nome_paciente ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ FORNECEDORES ════════════════════════════════ */}
          {tab === "fornecedores" && (
            <div>
              <InlineTip>
                <strong>Fornecedores:</strong> são as distribuidoras e
                fabricantes que fornecem medicamentos à clínica. Cadastre seus
                fornecedores para associá-los aos lotes na entrada do estoque e
                facilitar rastreabilidade e contato em caso de recall.
              </InlineTip>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                  <input
                    className="input pl-10"
                    value={fornSearch}
                    onChange={(e) => setFornSearch(e.target.value)}
                    placeholder="Buscar fornecedor..."
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={loadFornecedores} className="btn-secondary">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditForn(null);
                      setFornModalOpen(true);
                    }}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4" />{" "}
                    <span className="hidden sm:inline">Novo fornecedor</span>
                  </button>
                </div>
              </div>

              {fornLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              )}

              {!fornLoading && fornecedores.length === 0 && (
                <EmptyState
                  icon={Truck}
                  title={
                    fornSearch
                      ? "Nenhum fornecedor encontrado"
                      : "Nenhum fornecedor cadastrado"
                  }
                  description={
                    fornSearch
                      ? `Nenhum fornecedor corresponde a "${fornSearch}". Tente outro termo.`
                      : "Cadastre seus fornecedores para associá-los aos lotes de medicamentos. Isso facilita rastreabilidade e contato em caso de recall."
                  }
                  action={
                    !fornSearch
                      ? () => {
                          setEditForn(null);
                          setFornModalOpen(true);
                        }
                      : undefined
                  }
                  actionLabel="Cadastrar fornecedor"
                />
              )}

              {!fornLoading && fornecedores.length > 0 && (
                <div className="table-container">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3">
                          Nome
                        </th>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3 hidden sm:table-cell">
                          CNPJ
                        </th>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3 hidden md:table-cell">
                          Telefone
                        </th>
                        <th className="text-left text-xs font-semibold text-secondary-500 p-3 hidden lg:table-cell">
                          Cidade/UF
                        </th>
                        <th className="text-center text-xs font-semibold text-secondary-500 p-3">
                          Status
                        </th>
                        <th className="text-right text-xs font-semibold text-secondary-500 p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fornecedores.map((f) => (
                        <tr
                          key={f.id}
                          className="border-t border-bg-200 hover:bg-bg-200/50 transition-colors"
                        >
                          <td className="p-3 text-sm font-medium text-secondary-900">
                            {f.nome}
                          </td>
                          <td className="p-3 text-xs text-secondary-500 hidden sm:table-cell">
                            {f.cnpj ?? "—"}
                          </td>
                          <td className="p-3 text-xs text-secondary-500 hidden md:table-cell">
                            {f.telefone ?? "—"}
                          </td>
                          <td className="p-3 text-xs text-secondary-500 hidden lg:table-cell">
                            {f.cidade && f.uf ? `${f.cidade}/${f.uf}` : "—"}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${f.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {f.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setEditForn(f);
                                setFornModalOpen(true);
                              }}
                              className="btn-ghost text-xs"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Modals ────────────────────────────────────────── */}
      <MedicamentoFormModal
        isOpen={medModalOpen}
        onClose={() => {
          setMedModalOpen(false);
          setEditMed(null);
        }}
        onSubmit={editMed ? handleUpdateMed : handleCreateMed}
        initialData={editMed}
        saving={saving}
      />

      <LoteFormModal
        isOpen={loteModalOpen}
        onClose={() => setLoteModalOpen(false)}
        onSubmit={handleCreateLote}
        medicamento={selectedMed}
        saving={saving}
      />

      <DispensacaoModal
        isOpen={dispensacaoModalOpen}
        onClose={() => {
          setDispensacaoModalOpen(false);
          setPreselectedDispMed(null);
        }}
        onSubmit={handleDispensar}
        saving={saving}
        preselectedMed={preselectedDispMed}
      />

      <MovimentacaoModal
        isOpen={movModalOpen}
        onClose={() => setMovModalOpen(false)}
        tipo={movModalTipo}
        lote={movModalLote}
        medicamentoNome={movModalMedNome}
        saving={saving}
        onEntrada={handleEntrada}
        onAjuste={handleAjuste}
        onDescarte={handleDescarte}
      />

      <FornecedorFormModal
        isOpen={fornModalOpen}
        onClose={() => {
          setFornModalOpen(false);
          setEditForn(null);
        }}
        onSubmit={editForn ? handleUpdateForn : handleCreateForn}
        initialData={editForn}
        saving={saving}
      />
    </div>
  );
}
