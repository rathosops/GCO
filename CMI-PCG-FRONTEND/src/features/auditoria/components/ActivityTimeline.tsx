/**
 * Gráfico de atividade ao longo do tempo (AreaChart).
 *
 * Mostra volume diário de ações com área preenchida,
 * tooltip interativo e label contextual.
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { TimelinePoint } from '../types';

interface Props {
  data: TimelinePoint[];
  loading?: boolean;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const d = new Date(label + 'T00:00:00');
  const formatted = d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  return (
    <div className="rounded-lg border border-bg-300 bg-bg-100 px-3 py-2 shadow-md">
      <p className="text-xs text-text-200">{formatted}</p>
      <p className="text-sm font-bold text-text-100">
        {value} {value === 1 ? 'ação' : 'ações'}
      </p>
    </div>
  );
}

export function ActivityTimeline({ data, loading }: Props) {
  // Agrupar por semana se >60 dias para não poluir o eixo X
  const chartData = useMemo(() => {
    if (data.length <= 60) return data;

    const weeks: Record<string, number> = {};
    data.forEach((d) => {
      const dt = new Date(d.date + 'T00:00:00');
      // Agrupar por semana (pegar segunda-feira)
      const day = dt.getDay();
      const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dt);
      monday.setDate(diff);
      const key = monday.toISOString().split('T')[0];
      weeks[key] = (weeks[key] || 0) + d.count;
    });

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [data]);

  // Calcular média
  const avg = useMemo(() => {
    if (!data.length) return 0;
    const total = data.reduce((s, d) => s + d.count, 0);
    return Math.round(total / data.length);
  }, [data]);

  if (loading) {
    return <div className="card animate-pulse h-64" />;
  }

  if (!data.length) return null;

  // Label de ticks espaçados
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-primary-100" />
          </div>
          <div>
            <h3 className="font-bold text-text-100">Atividade ao Longo do Tempo</h3>
            <p className="text-sm text-text-200">
              Média de <strong>{avg}</strong> {avg === 1 ? 'ação' : 'ações'}/dia
              {data.length > 60 && ' (agrupado por semana)'}
            </p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary-100)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary-100)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-300)" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11, fill: 'var(--text-200)' }}
            interval={tickInterval}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-200)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--primary-100)"
            strokeWidth={2}
            fill="url(#colorCount)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}