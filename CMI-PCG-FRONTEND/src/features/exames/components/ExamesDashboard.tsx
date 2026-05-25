/**
 * Dashboard de estatísticas de exames
 * Cards com KPIs e distribuição por tipo
 */

import { motion } from 'framer-motion';
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Activity,
  PackageX,
  Layers,
  DollarSign,
} from 'lucide-react';
import type { ExameStats } from '../types';
import { n } from '../types';

interface ExamesDashboardProps {
  stats: ExameStats | null;
  loading?: boolean;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}

function StatCard({ label, value, subtitle, icon, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.3 }}
      className="card flex items-center gap-4"
    >
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-200 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-text-100 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-text-200 mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-bg-300/50" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 bg-bg-300/50 rounded" />
        <div className="h-7 w-14 bg-bg-300/50 rounded" />
      </div>
    </div>
  );
}

export function ExamesDashboard({ stats, loading }: ExamesDashboardProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const taxaAtivos = stats.total > 0 ? ((stats.ativos / stats.total) * 100).toFixed(0) : '0';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Cadastrado"
        value={stats.total}
        subtitle={`${stats.por_tipo.length} tipos diferentes`}
        icon={<FlaskConical className="h-5 w-5 text-white" />}
        color="bg-primary-100"
        delay={0}
      />
      <StatCard
        label="Ativos"
        value={stats.ativos}
        subtitle={`${taxaAtivos}% do total`}
        icon={<Activity className="h-5 w-5 text-white" />}
        color="bg-emerald-500"
        delay={1}
      />
      <StatCard
        label="Valor Médio Venda"
        value={`R$ ${n(stats.media_valor_venda).toFixed(2)}`}
        subtitle={`Custo médio: R$ ${n(stats.media_valor_cmi).toFixed(2)}`}
        icon={<DollarSign className="h-5 w-5 text-white" />}
        color="bg-blue-500"
        delay={2}
      />
      <StatCard
        label="Inativos"
        value={stats.inativos}
        subtitle={stats.sem_codigo > 0 ? `${stats.sem_codigo} sem código` : 'Todos com código'}
        icon={<PackageX className="h-5 w-5 text-white" />}
        color="bg-bg-300"
        delay={3}
      />
    </div>
  );
}

/**
 * Mini-chart de distribuição por tipo (usado na aba Relatórios)
 */
interface TipoDistribuicaoProps {
  data: { tipo: string; total: number }[];
}

export function TipoDistribuicao({ data }: TipoDistribuicaoProps) {
  if (!data.length) {
    return (
      <p className="text-text-200 text-center py-8 text-sm">Nenhum dado disponível</p>
    );
  }

  const max = Math.max(...data.map((d) => d.total));

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = max > 0 ? (item.total / max) * 100 : 0;
        return (
          <motion.div
            key={item.tipo}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3"
          >
            <span className="text-sm text-text-200 w-28 truncate shrink-0" title={item.tipo}>
              {item.tipo}
            </span>
            <div className="flex-1 h-2.5 bg-bg-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.04 + 0.15, duration: 0.4 }}
                className="h-full bg-primary-100 rounded-full"
              />
            </div>
            <span className="text-sm font-semibold text-text-100 w-8 text-right tabular-nums">
              {item.total}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}