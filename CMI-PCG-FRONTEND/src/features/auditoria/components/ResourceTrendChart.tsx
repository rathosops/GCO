/**
 * Atividade por módulo com indicadores de tendência (delta).
 *
 * Mostra barras horizontais + seta de variação vs período anterior.
 * Segue princípio de "context & frame of reference" (DataCamp 2025).
 */

import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Minus, BarChart3 } from 'lucide-react';
import type { ResourceTrend } from '../types';

interface Props {
  data: ResourceTrend[];
  loading?: boolean;
}

const BAR_COLORS = [
  'from-primary-100 to-primary-200',
  'from-emerald-500 to-emerald-400',
  'from-blue-500 to-blue-400',
  'from-violet-500 to-violet-400',
  'from-amber-500 to-amber-400',
  'from-pink-500 to-pink-400',
  'from-cyan-500 to-cyan-400',
  'from-rose-500 to-rose-400',
  'from-teal-500 to-teal-400',
  'from-indigo-500 to-indigo-400',
];

function DeltaBadge({ delta, deltaPct }: { delta: number; deltaPct: number | null }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-text-200">
        <Minus className="h-3 w-3" /> estável
      </span>
    );
  }

  const isUp = delta > 0;
  const color = isUp ? 'text-emerald-600' : 'text-red-500';
  const Icon = isUp ? ArrowUp : ArrowDown;
  const label = deltaPct !== null ? `${isUp ? '+' : ''}${deltaPct}%` : `${isUp ? '+' : ''}${delta}`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function ResourceTrendChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-6 bg-bg-200 rounded w-48" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 bg-bg-200 rounded" />
        ))}
      </div>
    );
  }

  if (!data.length) return null;

  const max = data[0]?.count || 1;
  const top = data.slice(0, 10);

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <BarChart3 className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-text-100">Atividade por Módulo</h3>
          <p className="text-sm text-text-200">Comparativo com o período anterior</p>
        </div>
      </div>

      <div className="space-y-3">
        {top.map((item, idx) => {
          const pct = (item.count / max) * 100;
          const color = BAR_COLORS[idx % BAR_COLORS.length];

          return (
            <div key={item.resource} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-100 font-medium">{item.label}</span>
                <div className="flex items-center gap-2">
                  <DeltaBadge delta={item.delta} deltaPct={item.delta_pct} />
                  <span className="text-sm text-text-200 tabular-nums font-medium w-8 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-bg-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.04 }}
                  className={`h-full bg-gradient-to-r ${color} rounded-full`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}