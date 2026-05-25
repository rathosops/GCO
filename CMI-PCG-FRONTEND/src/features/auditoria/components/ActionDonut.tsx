/**
 * Distribuição de ações (create/update/delete) em donut chart.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers } from 'lucide-react';
import type { ActionDistribution } from '../types';
import { ACTION_CONFIG } from '../types';

interface Props {
  data: ActionDistribution[];
  total: number;
  loading?: boolean;
}

const COLORS: Record<string, string> = {
  create: '#10b981', // emerald
  update: '#3b82f6', // blue
  delete: '#ef4444', // red
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const cfg = ACTION_CONFIG[name] || { label: name };

  return (
    <div className="rounded-lg border border-bg-300 bg-bg-100 px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-text-100">{cfg.label}</p>
      <p className="text-sm font-bold text-text-100">{value} ações</p>
    </div>
  );
}

export function ActionDonut({ data, total, loading }: Props) {
  if (loading || !data.length) {
    return <div className="card animate-pulse h-48" />;
  }

  const chartData = data.map((d) => ({
    name: d.action,
    value: d.count,
  }));

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Layers className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-bold text-text-100">Tipos de Ação</h3>
          <p className="text-sm text-text-200">Distribuição create/update/delete</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative w-32 h-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={3}
                dataKey="value"
                animationDuration={600}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[entry.name] || '#94a3b8'}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centro do donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-text-100">{total}</span>
            <span className="text-[10px] text-text-200">total</span>
          </div>
        </div>

        {/* Legenda */}
        <div className="space-y-2 flex-1">
          {data.map((d) => {
            const cfg = ACTION_CONFIG[d.action] || { label: d.action, color: 'text-text-200', bg: 'bg-bg-200' };
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;

            return (
              <div key={d.action} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[d.action] || '#94a3b8' }}
                  />
                  <span className="text-sm text-text-100">{cfg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-200 tabular-nums">{d.count}</span>
                  <span className="text-xs text-text-200 w-9 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}