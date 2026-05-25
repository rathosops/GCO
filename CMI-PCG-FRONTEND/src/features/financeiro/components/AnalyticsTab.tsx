// src/features/financeiro/components/AnalyticsTab.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Search,
  Calculator,
  TrendingUp,
  Calendar,
  RefreshCw,
  Loader2,
  Building2,
  HandCoins,
  Users,
} from 'lucide-react';
import { analyticsAPI } from '@/services/analytics.api';
import type {
  AnalyticsSummary,
  AnalyticsByPeriod,
  AnalyticsByCategory,
  TopEntity,
  TrendsResult,
  AgrupamentoPeriodo,
  CategoriaAgrupamento,
  EntidadeTipo,
} from '@/types/analytics.types';

import AnalyticsKPIs from './AnalyticsKPIs';
import {
  PeriodChart,
  CategoryPieChart,
  TopEntitiesChart,
  TrendsChart,
} from './AnalyticsCharts';
import AdvancedSearch from './AdvancedSearch';
import FindSumTool from './FindSumTool';

type SubTab = 'dashboard' | 'search' | 'find-sum';

// Helpers para datas
function getDateRange(range: 'week' | 'month' | 'quarter' | 'year' | 'ytd'): { inicio: string; fim: string } {
  const now = new Date();
  const fim = now.toISOString().split('T')[0];
  let inicio: Date;

  switch (range) {
    case 'week':
      inicio = new Date(now);
      inicio.setDate(now.getDate() - 7);
      break;
    case 'month':
      inicio = new Date(now);
      inicio.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      inicio = new Date(now);
      inicio.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      inicio = new Date(now);
      inicio.setFullYear(now.getFullYear() - 1);
      break;
    case 'ytd':
      inicio = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      inicio = new Date(now);
      inicio.setMonth(now.getMonth() - 1);
  }

  return {
    inicio: inicio.toISOString().split('T')[0],
    fim,
  };
}

export default function AnalyticsTab() {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');

  // Período selecionado
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'ytd'>('month');
  const [customDates, setCustomDates] = useState<{ inicio: string; fim: string } | null>(null);

  // Estados de dados
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [byPeriod, setByPeriod] = useState<AnalyticsByPeriod[]>([]);
  const [byOrigem, setByOrigem] = useState<AnalyticsByCategory[]>([]);
  const [byTipo, setByTipo] = useState<AnalyticsByCategory[]>([]);
  const [topEmpresas, setTopEmpresas] = useState<TopEntity[]>([]);
  const [topConvenios, setTopConvenios] = useState<TopEntity[]>([]);
  const [topPacientes, setTopPacientes] = useState<TopEntity[]>([]);
  const [trends, setTrends] = useState<TrendsResult | null>(null);

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPeriod, setLoadingPeriod] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);

  // Configurações de visualização
  const [agrupamentoPeriodo, setAgrupamentoPeriodo] = useState<AgrupamentoPeriodo>('dia');
  const [topEntidadeTipo, setTopEntidadeTipo] = useState<EntidadeTipo>('empresa');

  // Datas efetivas
  const effectiveDates = useMemo(() => {
    if (customDates) return customDates;
    return getDateRange(dateRange);
  }, [dateRange, customDates]);

  // Carregar dados do dashboard
  const loadDashboardData = useCallback(async () => {
    const { inicio, fim } = effectiveDates;

    // Summary
    setLoadingSummary(true);
    try {
      const summaryData = await analyticsAPI.getSummary({
        data_inicio: inicio,
        data_fim: fim,
        comparar_periodo_anterior: true,
      });
      setSummary(summaryData);
    } catch (err) {
      console.error('Erro ao carregar summary:', err);
    } finally {
      setLoadingSummary(false);
    }

    // By Period
    setLoadingPeriod(true);
    try {
      const periodData = await analyticsAPI.getByPeriod({
        data_inicio: inicio,
        data_fim: fim,
        agrupamento: agrupamentoPeriodo,
      });
      setByPeriod(Array.isArray(periodData) ? periodData : []);
    } catch (err) {
      console.error('Erro ao carregar by-period:', err);
      setByPeriod([]);
    } finally {
      setLoadingPeriod(false);
    }

    // By Category (Origem e Tipo)
    setLoadingCategories(true);
    try {
      const [origemData, tipoData] = await Promise.all([
        analyticsAPI.getByCategory({
          data_inicio: inicio,
          data_fim: fim,
          categoria: 'origem',
        }),
        analyticsAPI.getByCategory({
          data_inicio: inicio,
          data_fim: fim,
          categoria: 'tipo',
        }),
      ]);
      setByOrigem(Array.isArray(origemData) ? origemData : []);
      setByTipo(Array.isArray(tipoData) ? tipoData : []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
      setByOrigem([]);
      setByTipo([]);
    } finally {
      setLoadingCategories(false);
    }

    // Top Entities
    setLoadingTop(true);
    try {
      const [empresasData, conveniosData, pacientesData] = await Promise.all([
        analyticsAPI.getTopEntities({
          data_inicio: inicio,
          data_fim: fim,
          entidade: 'empresa',
          limite: 10,
        }),
        analyticsAPI.getTopEntities({
          data_inicio: inicio,
          data_fim: fim,
          entidade: 'convenio',
          limite: 10,
        }),
        analyticsAPI.getTopEntities({
          data_inicio: inicio,
          data_fim: fim,
          entidade: 'paciente',
          limite: 10,
        }),
      ]);
      setTopEmpresas(Array.isArray(empresasData) ? empresasData : []);
      setTopConvenios(Array.isArray(conveniosData) ? conveniosData : []);
      setTopPacientes(Array.isArray(pacientesData) ? pacientesData : []);
    } catch (err) {
      console.error('Erro ao carregar top entities:', err);
      setTopEmpresas([]);
      setTopConvenios([]);
      setTopPacientes([]);
    } finally {
      setLoadingTop(false);
    }

    // Trends
    setLoadingTrends(true);
    try {
      const trendsData = await analyticsAPI.getTrends({
        meses: 6,
        metrica: 'receita',
      });
      setTrends(trendsData);
    } catch (err) {
      console.error('Erro ao carregar trends:', err);
      setTrends(null);
    } finally {
      setLoadingTrends(false);
    }
  }, [effectiveDates, agrupamentoPeriodo]);

  // Carregar ao montar e quando mudar período
  useEffect(() => {
    if (subTab === 'dashboard') {
      loadDashboardData();
    }
  }, [subTab, loadDashboardData]);

  // Recarregar quando mudar agrupamento
  const handleAgrupamentoChange = useCallback(async (newAgrupamento: AgrupamentoPeriodo) => {
    setAgrupamentoPeriodo(newAgrupamento);
    setLoadingPeriod(true);
    try {
      const periodData = await analyticsAPI.getByPeriod({
        data_inicio: effectiveDates.inicio,
        data_fim: effectiveDates.fim,
        agrupamento: newAgrupamento,
      });
      setByPeriod(Array.isArray(periodData) ? periodData : []);
    } catch (err) {
      console.error('Erro ao carregar by-period:', err);
      setByPeriod([]);
    } finally {
      setLoadingPeriod(false);
    }
  }, [effectiveDates]);

  // Top entities data baseado na seleção
  const topEntitiesData = useMemo(() => {
    switch (topEntidadeTipo) {
      case 'empresa': return topEmpresas;
      case 'convenio': return topConvenios;
      case 'paciente': return topPacientes;
      default: return topEmpresas;
    }
  }, [topEntidadeTipo, topEmpresas, topConvenios, topPacientes]);

  const isLoadingAny = loadingSummary || loadingPeriod || loadingCategories || loadingTop || loadingTrends;

  return (
    <div className="space-y-6">
      {/* Sub-tabs de navegação */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubTab('dashboard')}
            className={subTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}
            type="button"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </button>
          <button
            onClick={() => setSubTab('search')}
            className={subTab === 'search' ? 'btn-primary' : 'btn-secondary'}
            type="button"
          >
            <Search className="h-4 w-4" />
            Busca Avançada
          </button>
          <button
            onClick={() => setSubTab('find-sum')}
            className={subTab === 'find-sum' ? 'btn-primary' : 'btn-secondary'}
            type="button"
          >
            <Calculator className="h-4 w-4" />
            Encontrar Soma
          </button>
        </div>
      </div>

      {/* Conteúdo baseado na sub-tab */}
      {subTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Filtros de período */}
          <div className="card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary-600" />
                <span className="font-medium text-secondary-900">Período:</span>

                <div className="flex flex-wrap gap-2">
                  {(['week', 'month', 'quarter', 'year', 'ytd'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        setDateRange(range);
                        setCustomDates(null);
                      }}
                      className={`btn-sm ${dateRange === range && !customDates ? 'btn-primary' : 'btn-secondary'}`}
                      type="button"
                    >
                      {range === 'week' && '7 dias'}
                      {range === 'month' && '30 dias'}
                      {range === 'quarter' && '90 dias'}
                      {range === 'year' && '1 ano'}
                      {range === 'ytd' && 'Ano atual'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDates?.inicio ?? effectiveDates.inicio}
                  onChange={(e) => setCustomDates((prev) => ({
                    inicio: e.target.value,
                    fim: prev?.fim ?? effectiveDates.fim,
                  }))}
                  className="input py-1.5 text-sm w-36"
                />
                <span className="text-secondary-500">até</span>
                <input
                  type="date"
                  value={customDates?.fim ?? effectiveDates.fim}
                  onChange={(e) => setCustomDates((prev) => ({
                    inicio: prev?.inicio ?? effectiveDates.inicio,
                    fim: e.target.value,
                  }))}
                  className="input py-1.5 text-sm w-36"
                />

                <button
                  onClick={loadDashboardData}
                  className="btn-secondary btn-sm"
                  disabled={isLoadingAny}
                  type="button"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingAny ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <AnalyticsKPIs summary={summary} loading={loadingSummary} />

          {/* Gráficos principais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receita por período */}
            <div className="lg:col-span-2">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary-600" />
                    <h3 className="text-lg font-bold text-secondary-900">Receita por Período</h3>
                  </div>

                  <div className="flex gap-2">
                    {(['dia', 'semana', 'mes'] as AgrupamentoPeriodo[]).map((agr) => (
                      <button
                        key={agr}
                        onClick={() => handleAgrupamentoChange(agr)}
                        className={`btn-sm ${agrupamentoPeriodo === agr ? 'btn-primary' : 'btn-secondary'}`}
                        type="button"
                      >
                        {agr === 'dia' && 'Dia'}
                        {agr === 'semana' && 'Semana'}
                        {agr === 'mes' && 'Mês'}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingPeriod ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                  </div>
                ) : (
                  <PeriodChart data={byPeriod} loading={false} title="" />
                )}
              </div>
            </div>

            {/* Distribuição por origem */}
            <CategoryPieChart
              data={byOrigem}
              loading={loadingCategories}
              title="Distribuição por Origem"
            />

            {/* Distribuição por tipo */}
            <CategoryPieChart
              data={byTipo}
              loading={loadingCategories}
              title="Distribuição por Tipo de Pagamento"
            />
          </div>

          {/* Top Entities + Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Entidades */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-bold text-secondary-900">Top por Receita</h3>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => setTopEntidadeTipo('empresa')}
                    className={`btn-sm ${topEntidadeTipo === 'empresa' ? 'btn-primary' : 'btn-ghost'}`}
                    title="Empresas"
                    type="button"
                  >
                    <Building2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTopEntidadeTipo('convenio')}
                    className={`btn-sm ${topEntidadeTipo === 'convenio' ? 'btn-primary' : 'btn-ghost'}`}
                    title="Convênios"
                    type="button"
                  >
                    <HandCoins className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTopEntidadeTipo('paciente')}
                    className={`btn-sm ${topEntidadeTipo === 'paciente' ? 'btn-primary' : 'btn-ghost'}`}
                    title="Pacientes"
                    type="button"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <TopEntitiesChart
                data={topEntitiesData}
                loading={loadingTop}
                title=""
              />
            </div>

            {/* Tendências */}
            <TrendsChart
              data={trends}
              loading={loadingTrends}
              title="Tendência de Receita (6 meses)"
            />
          </div>
        </div>
      )}

      {subTab === 'search' && <AdvancedSearch />}

      {subTab === 'find-sum' && <FindSumTool />}
    </div>
  );
}