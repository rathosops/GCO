// src/pages/HomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Calendar,
  FileText,
  DollarSign,
  TestTube,
  Pill,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  Activity,
  UserPlus,
  CalendarPlus,
  ClipboardPlus,
  Stethoscope,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/services/api";

// ─── Helpers ──────────────────────────────────────────────────

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name?: string | null): string {
  return (name ?? "Usuário").split(/\s/)[0] || "Usuário";
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPercent(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// ─── Animation ────────────────────────────────────────────────

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// ─── Types ────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
}

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface ActivityItem {
  id: number;
  tipo: string;
  titulo: string;
  descricao: string;
  horario: string;
}

interface ScheduleItem {
  hora: string;
  paciente: string;
  procedimento: string;
  status: string;
}

// ─── Static data ──────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Novo Agendamento", icon: CalendarPlus, path: "/agendamentos" },
  { label: "Novo Paciente", icon: UserPlus, path: "/pacientes" },
  { label: "Nova Consulta", icon: ClipboardPlus, path: "/consultas" },
  { label: "Solicitar Exame", icon: Stethoscope, path: "/exames" },
];

const STATUS_CLASSES: Record<string, { label: string; cls: string }> = {
  AGENDADO: { label: "Agendado", cls: "bg-primary-300 text-primary-100" },
  CONFIRMADO: { label: "Confirmado", cls: "bg-success-light text-success" },
  REALIZADO: { label: "Realizado", cls: "bg-success-light text-success" },
  CANCELADO: { label: "Cancelado", cls: "bg-danger-light text-danger" },
  FALTOU: { label: "Faltou", cls: "bg-warning-light text-warning" },
};

const TIPO_ICON: Record<string, React.ElementType> = {
  consulta: FileText,
  agendamento: Calendar,
  pagamento: DollarSign,
  paciente: Users,
};

// ─── Component ────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [statsRes, activityRes, scheduleRes] = await Promise.allSettled([
          api.get("/dashboard/stats"),
          api.get("/dashboard/atividades-recentes"),
          api.get("/agendamentos", {
            params: {
              dia: new Date().toISOString().slice(0, 10),
              limit: 10,
              order: "hora_asc",
            },
          }),
        ]);
        if (!alive) return;

        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (activityRes.status === "fulfilled") {
          const d =
            activityRes.value.data?.data ?? activityRes.value.data ?? [];
          setRecentActivity(Array.isArray(d) ? d.slice(0, 6) : []);
        }
        if (scheduleRes.status === "fulfilled") {
          const d =
            scheduleRes.value.data?.data ?? scheduleRes.value.data ?? [];
          setSchedule(Array.isArray(d) ? d.slice(0, 8) : []);
        }
      } catch {
        /* silencioso */
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // KPIs
  const kpis = useMemo<KPI[]>(() => {
    const s = stats;
    if (!s) return [];
    const prev = s.faturamentoMesAnterior ?? 0;
    const fatVar = prev > 0 ? ((s.faturamentoMes - prev) / prev) * 100 : 0;
    return [
      { label: "Pacientes", value: String(s.totalPacientes ?? 0), icon: Users },
      {
        label: "Consultas Hoje",
        value: String(s.consultasHoje ?? 0),
        sub: `${s.consultasMes ?? 0} este mês`,
        icon: FileText,
      },
      {
        label: "Agendamentos",
        value: String(s.agendamentosHoje ?? 0),
        sub: `${s.agendamentosAmanha ?? 0} amanhã`,
        icon: Calendar,
      },
      {
        label: "Faturamento",
        value: fmtCurrency(s.faturamentoMes ?? 0),
        trend: fatVar,
        icon: DollarSign,
      },
    ];
  }, [stats]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="p-4 xl:p-6 space-y-6 animate-pulse max-w-[1440px] mx-auto">
        <div className="h-8 w-64 bg-bg-300 rounded-lg" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-bg-300 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-bg-300 rounded-2xl" />
          <div className="h-72 bg-bg-300 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-5 max-w-[1440px] mx-auto"
    >
      {/* ═══ Header ═══ */}
      <motion.div
        variants={fadeUp}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1"
      >
        <div>
          <h2 className="text-2xl xl:text-3xl font-bold text-text-100">
            {greetingByHour()}, {firstName(user?.nome ?? user?.usuario)}
          </h2>
          <p className="text-sm text-text-200 capitalize">{dateStr}</p>
        </div>
        <p className="text-xs text-text-200 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Atualizado às{" "}
          {now.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </motion.div>

      {/* ═══ KPI Cards ═══ */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4"
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="card relative overflow-hidden">
              {/* Accent bar usando primary (funciona em qualquer tema) */}
              <div className="absolute inset-y-0 left-0 w-1 bg-primary-100 rounded-l-xl" />

              <div className="flex items-start justify-between pl-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-200 uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <p className="text-xl xl:text-2xl font-bold text-text-100 mt-1 truncate">
                    {kpi.value}
                  </p>
                  {kpi.sub && (
                    <p className="text-xs text-text-200 mt-0.5">{kpi.sub}</p>
                  )}
                  {kpi.trend != null && kpi.trend !== 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1 ${kpi.trend > 0 ? "text-success" : "text-danger"}`}
                    >
                      {kpi.trend > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {fmtPercent(kpi.trend)}
                    </span>
                  )}
                </div>
                <div className="p-2 rounded-xl bg-primary-300 text-primary-100 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ═══ Quick Actions ═══ */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="card-interactive flex items-center gap-3 text-left group"
              type="button"
            >
              <div className="p-2.5 rounded-xl bg-primary-300 text-primary-100 shrink-0 group-hover:bg-primary-100 group-hover:text-white transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-text-100 group-hover:text-primary-100 transition-colors">
                {a.label}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* ═══ Schedule + Activity ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Agenda */}
        <motion.div variants={fadeUp} className="lg:col-span-3">
          <div className="card h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary-100" />
                Agenda de Hoje
              </h3>
              <button
                onClick={() => navigate("/agendamentos")}
                className="text-xs font-medium text-primary-100 hover:text-primary-200 flex items-center gap-1"
                type="button"
              >
                Ver tudo <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {schedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="h-10 w-10 text-bg-300 mb-2" />
                <p className="text-sm text-text-200">
                  Nenhum agendamento para hoje
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] xl:max-h-[380px] overflow-y-auto pr-1">
                {schedule.map((item, idx) => {
                  const st =
                    STATUS_CLASSES[item.status] ?? STATUS_CLASSES.AGENDADO;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl bg-bg-200 hover:bg-bg-300 transition-colors"
                    >
                      <div className="text-center shrink-0 w-14">
                        <p className="text-sm font-bold text-text-100">
                          {(item.hora ?? "").slice(0, 5)}
                        </p>
                      </div>
                      <div className="h-8 w-px bg-bg-300 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-100 truncate">
                          {item.paciente || "Paciente"}
                        </p>
                        <p className="text-xs text-text-200 truncate">
                          {item.procedimento || "—"}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st!.cls}`}
                      >
                        {st!.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Activity */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <div className="card h-full">
            <h3 className="text-base font-bold text-text-100 flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-primary-100" />
              Atividade Recente
            </h3>

            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Activity className="h-10 w-10 text-bg-300 mb-2" />
                <p className="text-sm text-text-200">Sem atividade recente</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[320px] xl:max-h-[380px] overflow-y-auto pr-1">
                {recentActivity.map((item) => {
                  const Icon = TIPO_ICON[item.tipo] || Activity;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-bg-200 transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-bg-200 shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-text-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-100 truncate">
                          {item.titulo}
                        </p>
                        <p className="text-xs text-text-200 truncate">
                          {item.descricao}
                        </p>
                      </div>
                      <span className="text-[10px] text-text-200 whitespace-nowrap shrink-0">
                        {item.horario}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ═══ Quick links ═══ */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {[
          { icon: HeartPulse, label: "ASOs Pendentes", path: "/aso" },
          { icon: TestTube, label: "Exames Solicitados", path: "/exames" },
          { icon: Pill, label: "Estoque Farmácia", path: "/farmacia" },
        ].map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="card-interactive flex items-center gap-3 text-left"
            type="button"
          >
            <Icon className="h-5 w-5 text-primary-100 shrink-0" />
            <span className="text-sm font-medium text-text-100 flex-1">
              {label}
            </span>
            <ArrowRight className="h-4 w-4 text-text-200" />
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
