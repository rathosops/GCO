// src/features/financeiro/components/AnalyticsKPIs.tsx
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  HandCoins,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import type { AnalyticsSummary } from '@/types/analytics.types';

interface AnalyticsKPIsProps {
  summary: AnalyticsSummary | null;
  loading: boolean;
}

function moneyBR(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

function formatVariation(value: number): { text: string; color: string; icon: typeof ArrowUpRight } {
  if (value > 0) {
    return {
      text: `+${value.toFixed(1)}%`,
      color: 'text-green-600',
      icon: ArrowUpRight,
    };
  }
  if (value < 0) {
    return {
      text: `${value.toFixed(1)}%`,
      color: 'text-red-600',
      icon: ArrowDownRight,
    };
  }
  return {
    text: '0%',
    color: 'text-secondary-500',
    icon: Minus,
  };
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  variation?: number;
  loading?: boolean;
  delay?: number;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  variation,
  loading,
  delay = 0,
}: KPICardProps) {
  const variationInfo = variation !== undefined ? formatVariation(variation) : null;
  const VariationIcon = variationInfo?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05 }}
      className="card"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-secondary-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-secondary-900 truncate">
            {loading ? '...' : value}
          </p>
          {subtitle && (
            <p className="text-xs text-secondary-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>

      {variationInfo && !loading && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-secondary-100">
          {VariationIcon && <VariationIcon className={`h-4 w-4 ${variationInfo.color}`} />}
          <span className={`text-sm font-medium ${variationInfo.color}`}>
            {variationInfo.text}
          </span>
          <span className="text-xs text-secondary-500">vs período anterior</span>
        </div>
      )}
    </motion.div>
  );
}

export default function AnalyticsKPIs({ summary, loading }: AnalyticsKPIsProps) {
  const comp = summary?.comparativo_anterior;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Receita Bruta */}
      <KPICard
        title="Receita Bruta"
        value={moneyBR(summary?.total_bruto ?? 0)}
        icon={DollarSign}
        iconBg="bg-green-100"
        iconColor="text-green-600"
        variation={comp?.variacao_bruto_pct}
        loading={loading}
        delay={0}
      />

      {/* Receita Líquida */}
      <KPICard
        title="Receita Líquida"
        value={moneyBR(summary?.total_liquido ?? 0)}
        icon={TrendingUp}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        variation={comp?.variacao_liquido_pct}
        loading={loading}
        delay={1}
      />

      {/* Ticket Médio */}
      <KPICard
        title="Ticket Médio"
        value={moneyBR(summary?.ticket_medio ?? 0)}
        subtitle={`${summary?.quantidade ?? 0} transações`}
        icon={Receipt}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        loading={loading}
        delay={2}
      />

      {/* Descontos */}
      <KPICard
        title="Total Descontos"
        value={moneyBR(summary?.total_descontos ?? 0)}
        icon={TrendingDown}
        iconBg="bg-red-100"
        iconColor="text-red-600"
        loading={loading}
        delay={3}
      />

      {/* Pacientes Únicos */}
      <KPICard
        title="Pacientes Únicos"
        value={summary?.pacientes_unicos ?? 0}
        icon={Users}
        iconBg="bg-indigo-100"
        iconColor="text-indigo-600"
        loading={loading}
        delay={4}
      />

      {/* Empresas Únicas */}
      <KPICard
        title="Empresas Únicas"
        value={summary?.empresas_unicas ?? 0}
        icon={Building2}
        iconBg="bg-cyan-100"
        iconColor="text-cyan-600"
        loading={loading}
        delay={5}
      />

      {/* Convênios Únicos */}
      <KPICard
        title="Convênios Únicos"
        value={summary?.convenios_unicos ?? 0}
        icon={HandCoins}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        loading={loading}
        delay={6}
      />

      {/* Quantidade de Transações */}
      <KPICard
        title="Total Transações"
        value={summary?.quantidade ?? 0}
        variation={comp?.variacao_quantidade_pct}
        icon={Receipt}
        iconBg="bg-pink-100"
        iconColor="text-pink-600"
        loading={loading}
        delay={7}
      />
    </div>
  );
}