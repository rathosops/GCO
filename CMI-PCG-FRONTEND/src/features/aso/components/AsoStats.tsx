// src/features/aso/components/AsoStats.tsx

import { useEffect, useState } from 'react';
import {
  BarChart3,
  Users,
  FileCheck,
  Building2,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { asoAPI } from '../api/aso.api';
import type { AsoStatsResponse } from '../types/aso.types';
import { TIPOS_EXAME_MAP, CONCLUSAO_MAP } from '../types/aso.types';

// ============================================
// KPI Card
// ============================================

function KpiCard({ label, value, icon: Icon, color = 'primary' }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const colorMap = {
    primary: 'bg-primary-100/10 text-primary-100',
    success: 'bg-green-50 text-green-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
  };

  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${colorMap[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-text-100 tabular-nums">{value}</p>
        <p className="text-sm text-text-200 truncate">{label}</p>
      </div>
    </div>
  );
}

// ============================================
// Mini bar (horizontal)
// ============================================

function MiniBar({ label, value, total, color }: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-text-200 group-hover:text-text-100 transition-colors">
          {label}
        </span>
        <span className="text-sm font-semibold text-text-100 tabular-nums">
          {value}
          <span className="text-text-200 font-normal ml-1 text-xs">
            ({pct.toFixed(0)}%)
          </span>
        </span>
      </div>
      <div className="h-2.5 bg-bg-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ============================================
// Top empresas list
// ============================================

function TopEmpresasList({ empresas }: { empresas: { nome: string; total: number }[] }) {
  if (!empresas.length) {
    return (
      <p className="text-sm text-text-200 py-4 text-center">
        Nenhum dado disponível.
      </p>
    );
  }

  const max = empresas[0]?.total || 1;

  return (
    <div className="space-y-3">
      {empresas.map((emp, idx) => (
        <div key={idx} className="flex items-center gap-3 group">
          <span className="text-xs font-bold text-text-200 w-5 text-right tabular-nums">
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-text-100 truncate pr-2 group-hover:text-primary-100 transition-colors">
                {emp.nome}
              </span>
              <span className="text-sm font-semibold text-text-100 tabular-nums shrink-0">
                {emp.total}
              </span>
            </div>
            <div className="h-1.5 bg-bg-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-100/70 transition-all duration-500"
                style={{ width: `${(emp.total / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function AsoStats() {
  const [stats, setStats] = useState<AsoStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await asoAPI.stats();
      setStats(data);
    } catch {
      setError('Não foi possível carregar as estatísticas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-100" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card text-center py-12">
        <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
        <p className="text-text-200 mb-4">{error}</p>
        <button className="btn-secondary" onClick={fetchStats}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  const tipoColors = ['#FF6600', '#ff983f', '#2563eb', '#7c3aed', '#059669'];
  const conclusaoColors: Record<string, string> = {
    APTO: '#16a34a',
    INAPTO: '#dc2626',
    APTO_COM_RESTRICOES: '#d97706',
  };

  const conclusaoIcons: Record<string, React.ElementType> = {
    APTO: ShieldCheck,
    INAPTO: ShieldX,
    APTO_COM_RESTRICOES: ShieldAlert,
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total de ASOs"
          value={stats.total}
          icon={FileCheck}
          color="primary"
        />
        <KpiCard
          label="Pacientes Únicos"
          value={stats.pacientes_unicos}
          icon={Users}
          color="success"
        />
        <KpiCard
          label="Empresas Ativas"
          value={stats.top_empresas.length}
          icon={Building2}
          color="warning"
        />
        <KpiCard
          label="Taxa Aptidão"
          value={
            stats.total > 0
              ? `${(((stats.por_conclusao.APTO || 0) / stats.total) * 100).toFixed(0)}%`
              : '—'
          }
          icon={TrendingUp}
          color="success"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Por tipo de exame */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-5 w-5 text-primary-100" />
            <h3 className="font-semibold text-text-100">Por Tipo de Exame</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.por_tipo_exame).map(([key, value], idx) => (
              <MiniBar
                key={key}
                label={TIPOS_EXAME_MAP[key] || key}
                value={value}
                total={stats.total}
                color={tipoColors[idx % tipoColors.length]}
              />
            ))}
          </div>
        </div>

        {/* Por conclusão */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="h-5 w-5 text-primary-100" />
            <h3 className="font-semibold text-text-100">Por Conclusão</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(stats.por_conclusao).map(([key, value]) => {
              const Icon = conclusaoIcons[key] || ShieldCheck;
              const color = conclusaoColors[key] || '#888';
              const pct = stats.total > 0 ? ((value / stats.total) * 100).toFixed(0) : '0';

              return (
                <div key={key} className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ background: `${color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-100">
                        {CONCLUSAO_MAP[key] || key}
                      </span>
                      <span className="text-lg font-bold tabular-nums" style={{ color }}>
                        {value}
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-200 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top empresas */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="h-5 w-5 text-primary-100" />
            <h3 className="font-semibold text-text-100">Top Empresas</h3>
          </div>
          <TopEmpresasList empresas={stats.top_empresas} />
        </div>
      </div>
    </div>
  );
}