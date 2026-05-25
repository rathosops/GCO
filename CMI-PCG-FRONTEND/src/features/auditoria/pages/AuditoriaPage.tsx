/**
 * Página de Auditoria v2 — CMI-PCG
 *
 * Design: Data Storytelling + Narrative-driven dashboards.
 * Abas: Visão Geral | Colaboradores | Histórico
 */

import { useState } from "react";
import { Eye, Users, Clock, RefreshCw } from "lucide-react";

import { useAuditLogs, useAuditInsights, useAuditResources } from "../hooks";
import {
  NarrativeInsightCards,
  ActivityTimeline,
  ActivityHeatmap,
  UserInsightCards,
  ResourceTrendChart,
  ActionDonut,
  AuditLogTable,
} from "../components";

type Tab = "visao_geral" | "colaboradores" | "historico";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "visao_geral",
    label: "Visão Geral",
    icon: <Eye className="h-4 w-4" />,
  },
  {
    key: "colaboradores",
    label: "Colaboradores",
    icon: <Users className="h-4 w-4" />,
  },
  { key: "historico", label: "Histórico", icon: <Clock className="h-4 w-4" /> },
];

const PERIOD_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
];

export default function AuditoriaPage() {
  const [tab, setTab] = useState<Tab>("visao_geral");
  const [periodDays, setPeriodDays] = useState(30);

  const {
    insights,
    loading: insightsLoading,
    reload: reloadInsights,
  } = useAuditInsights(periodDays);

  const {
    logs,
    total,
    loading: logsLoading,
    error: logsError,
    filters,
    setFilter,
    resetFilters,
    reload: reloadLogs,
    page,
    setPage,
    totalPages,
    hasMore,
  } = useAuditLogs();

  const { resources } = useAuditResources();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-100">Auditoria</h2>
          <p className="text-sm text-text-200">
            Insights de atividade, comportamento dos colaboradores e histórico
            completo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="select text-sm"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Últimos {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              reloadInsights();
              reloadLogs();
            }}
            className="btn-ghost btn-sm"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cards narrativos */}
      <NarrativeInsightCards
        cards={insights?.narrative_cards || []}
        loading={insightsLoading}
      />

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-200 rounded-xl w-full sm:w-fit overflow-x-auto">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg
              transition-all whitespace-nowrap ${
                tab === key
                  ? "bg-primary-100 text-white shadow-sm"
                  : "text-text-200 hover:text-text-100 hover:bg-bg-100"
              }`}
            onClick={() => setTab(key)}
          >
            <span className="flex items-center justify-center gap-2">
              {icon} {label}
            </span>
          </button>
        ))}
      </div>

      {/* TAB: Visão Geral */}
      {tab === "visao_geral" && (
        <div className="space-y-5">
          <ActivityTimeline
            data={insights?.activity_timeline || []}
            loading={insightsLoading}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ActivityHeatmap
              data={insights?.heatmap_data || []}
              loading={insightsLoading}
            />
            <ActionDonut
              data={insights?.action_distribution || []}
              total={insights?.total_actions || 0}
              loading={insightsLoading}
            />
          </div>

          <ResourceTrendChart
            data={insights?.resource_trend || []}
            loading={insightsLoading}
          />
        </div>
      )}

      {/* TAB: Colaboradores */}
      {tab === "colaboradores" && (
        <UserInsightCards
          profiles={insights?.user_profiles || []}
          loading={insightsLoading}
        />
      )}

      {/* TAB: Histórico */}
      {tab === "historico" && (
        <AuditLogTable
          logs={logs}
          total={total}
          loading={logsLoading}
          error={logsError}
          filters={filters}
          resources={resources}
          page={page}
          totalPages={totalPages}
          hasMore={hasMore}
          onFilterChange={setFilter}
          onResetFilters={resetFilters}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
