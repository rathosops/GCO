// src/features/financeiro/components/AnalyticsCharts.tsx
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, BarChart3, PieChart, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import type {
  AnalyticsByPeriod,
  AnalyticsByCategory,
  TopEntity,
  TrendsResult,
} from '@/types/analytics.types';

// ============================================
// Constants
// ============================================
const COLORS = [
  '#FF6600', // primary
  '#10b981', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
] as const;

// ============================================
// Helper Functions (Safe)
// ============================================

/**
 * Converte número para formato de moeda brasileira
 * Retorna "R$ 0,00" para valores inválidos
 */
function moneyBR(value: unknown): string {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formato abreviado para valores grandes
 */
function shortMoney(value: unknown): string {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  if (num >= 1_000_000) return `R$ ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `R$ ${(num / 1_000).toFixed(1)}K`;
  return moneyBR(num);
}

/**
 * Formata número com casas decimais de forma segura
 */
function safeFixed(value: unknown, decimals = 1): string {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return num.toFixed(decimals);
}

/**
 * Garante que o valor é um array
 */
function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Retorna número seguro (0 se inválido)
 */
function safeNumber(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}

// ============================================
// Custom Tooltip Component
// ============================================
interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-secondary-200 rounded-xl p-3 shadow-lg">
      <p className="text-sm font-semibold text-secondary-900 mb-2">{label ?? ''}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {moneyBR(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ============================================
// Loading Component
// ============================================
function ChartLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================
function ChartEmpty({ message = 'Sem dados disponíveis' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-secondary-500">
      {message}
    </div>
  );
}

// ============================================
// Gráfico de Receita por Período (Barras)
// ============================================
interface PeriodChartProps {
  data?: AnalyticsByPeriod[] | null;
  loading?: boolean;
  title?: string;
}

export function PeriodChart({ 
  data, 
  loading = false, 
  title = 'Receita por Período' 
}: PeriodChartProps) {
  const chartData = useMemo(() => {
    const safeData = ensureArray<AnalyticsByPeriod>(data);
    return safeData.map((d) => ({
      name: d?.label ?? '',
      'Receita Bruta': safeNumber(d?.total_bruto),
      'Receita Líquida': safeNumber(d?.total_liquido),
      Descontos: safeNumber(d?.total_descontos),
      Quantidade: safeNumber(d?.quantidade),
    }));
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary-600" />
        <h3 className="text-lg font-bold text-secondary-900">{title}</h3>
      </div>

      {loading ? (
        <ChartLoading />
      ) : chartData.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={shortMoney}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Receita Bruta" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Receita Líquida" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty message="Sem dados para o período selecionado" />
      )}
    </motion.div>
  );
}

// ============================================
// Gráfico de Pizza por Categoria
// ============================================
interface CategoryPieChartProps {
  data?: AnalyticsByCategory[] | null;
  loading?: boolean;
  title?: string;
}

export function CategoryPieChart({ 
  data, 
  loading = false, 
  title = 'Distribuição' 
}: CategoryPieChartProps) {
  const chartData = useMemo(() => {
    const safeData = ensureArray<AnalyticsByCategory>(data);
    return safeData.map((d) => ({
      name: d?.categoria || 'Não informado',
      value: safeNumber(d?.total_liquido),
      percentual: safeNumber(d?.percentual),
    }));
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-primary-600" />
        <h3 className="text-lg font-bold text-secondary-900">{title}</h3>
      </div>

      {loading ? (
        <ChartLoading />
      ) : chartData.length > 0 ? (
        <div className="h-72 flex items-center">
          <div className="w-1/2 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => moneyBR(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                  }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          <div className="w-1/2 space-y-2 pl-4">
            {chartData.map((item, index) => (
              <div key={`legend-${index}-${item.name}`} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-secondary-700 truncate flex-1">
                  {item.name}
                </span>
                <span className="text-sm font-medium text-secondary-900">
                  {safeFixed(item.percentual, 1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ChartEmpty />
      )}
    </motion.div>
  );
}

// ============================================
// Gráfico de Ranking (Top Entities)
// ============================================
interface TopEntitiesChartProps {
  data?: TopEntity[] | null;
  loading?: boolean;
  title?: string;
}

export function TopEntitiesChart({ 
  data, 
  loading = false, 
  title = 'Top Entidades' 
}: TopEntitiesChartProps) {
  const safeData = useMemo(() => ensureArray<TopEntity>(data), [data]);
  
  const maxValue = useMemo(() => {
    if (safeData.length === 0) return 1;
    const values = safeData.map((d) => safeNumber(d?.total_liquido));
    return Math.max(...values, 1);
  }, [safeData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary-600" />
        <h3 className="text-lg font-bold text-secondary-900">{title}</h3>
      </div>

      {loading ? (
        <ChartLoading />
      ) : safeData.length > 0 ? (
        <div className="space-y-3">
          {safeData.slice(0, 10).map((item, index) => {
            const totalLiquido = safeNumber(item?.total_liquido);
            const pct = (totalLiquido / maxValue) * 100;
            const itemKey = item?.id ?? `item-${index}`;
            
            return (
              <div key={itemKey} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-secondary-800 truncate font-medium">
                      {item?.nome ?? 'N/A'}
                    </span>
                  </div>
                  <span className="text-secondary-600 flex-shrink-0 ml-2">
                    {moneyBR(totalLiquido)}
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="h-2 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ChartEmpty />
      )}
    </motion.div>
  );
}

// ============================================
// Gráfico de Tendências (Area)
// ============================================
interface TrendsChartProps {
  data?: TrendsResult | null;
  loading?: boolean;
  title?: string;
}

export function TrendsChart({ 
  data, 
  loading = false, 
  title = 'Tendência' 
}: TrendsChartProps) {
  const chartData = useMemo(() => {
    const dados = data?.dados;
    if (!Array.isArray(dados)) return [];
    
    return dados.map((d) => ({
      name: d?.label ?? '',
      Valor: safeNumber(d?.valor),
      'Variação %': safeNumber(d?.variacao_pct),
    }));
  }, [data]);

  const metricaLabel = useMemo(() => {
    const metrica = data?.metrica;
    switch (metrica) {
      case 'receita': return 'Receita';
      case 'quantidade': return 'Quantidade';
      case 'ticket_medio': return 'Ticket Médio';
      default: return 'Valor';
    }
  }, [data?.metrica]);

  const formatValue = (value: number): string => {
    if (data?.metrica === 'quantidade') {
      return safeNumber(value).toLocaleString('pt-BR');
    }
    return moneyBR(value);
  };

  // Calcular tendência média de forma segura
  const tendenciaMedia = safeNumber(data?.tendencia_media_pct);
  const hasTendencia = data != null && typeof data.tendencia_media_pct === 'number';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-bold text-secondary-900">{title}</h3>
        </div>
        {hasTendencia && (
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            tendenciaMedia >= 0
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {tendenciaMedia >= 0 ? '+' : ''}
            {safeFixed(tendenciaMedia, 1)}% média
          </div>
        )}
      </div>

      {loading ? (
        <ChartLoading />
      ) : chartData.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6600" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF6600" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={(v) => data?.metrica === 'quantidade' ? String(v) : shortMoney(v)}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Valor') return [formatValue(value), metricaLabel];
                  return [safeFixed(value, 1) + '%', name];
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="Valor"
                stroke="#FF6600"
                strokeWidth={2}
                fill="url(#colorValor)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty />
      )}
    </motion.div>
  );
}

// ============================================
// Mini Bar Chart (para cards compactos)
// ============================================
interface MiniChartData {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data?: MiniChartData[] | null;
  title: string;
  loading?: boolean;
}

export function MiniBarChart({ 
  data, 
  title, 
  loading = false 
}: MiniBarChartProps) {
  const safeData = useMemo(() => ensureArray<MiniChartData>(data), [data]);
  
  const maxValue = useMemo(() => {
    if (safeData.length === 0) return 1;
    const values = safeData.map((d) => safeNumber(d?.value));
    return Math.max(...values, 1);
  }, [safeData]);

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary-600" />
        <h3 className="text-lg font-bold text-secondary-900">{title}</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : safeData.length > 0 ? (
        <div className="space-y-2">
          {safeData.map((item, index) => {
            const itemValue = safeNumber(item?.value);
            const pct = Math.max(0, Math.min(100, (itemValue / maxValue) * 100));
            const itemKey = item?.label ?? `mini-${index}`;
            
            return (
              <div key={itemKey} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-secondary-700">
                  <span className="font-medium truncate">{item?.label ?? 'N/A'}</span>
                  <span className="text-secondary-600">{moneyBR(itemValue)}</span>
                </div>
                <div className="h-2 w-full bg-secondary-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-secondary-500">Sem dados.</p>
      )}
    </div>
  );
}