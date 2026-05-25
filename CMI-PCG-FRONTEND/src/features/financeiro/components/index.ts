// src/features/financeiro/components/index.ts
export { default as EntitySearchSelector, PacienteSelector, EmpresaSelector, ConvenioSelector } from './EntitySearchSelector';
export type { EntityOption } from './EntitySearchSelector';

export { default as PagamentoForm } from './PagamentoForm';
export { default as PagamentoFormModal } from './PagamentoFormModal';
export { default as PagamentoCard } from './PagamentoCard';
export { default as FinanceiroFilters } from './FinanceiroFilters';
export type { FinanceiroFiltersState } from './FinanceiroFilters';

export { default as ResumoMensal, ResumoGraficos } from './ResumoMensal';
export { default as RelatoriosPdf } from './RelatoriosPdf';

// Analytics components
export { default as AnalyticsTab } from './AnalyticsTab';
export { default as AnalyticsKPIs } from './AnalyticsKPIs';
export {
  PeriodChart,
  CategoryPieChart,
  TopEntitiesChart,
  TrendsChart,
  MiniBarChart,
} from './AnalyticsCharts';
export { default as AdvancedSearch } from './AdvancedSearch';
export { default as FindSumTool } from './FindSumTool';

// NFS-e Import
export { default as NfseImportModal } from './NfseImportModal';

// Despesas components
export { default as DespesaCard } from './DespesaCard';
export { default as DespesaForm } from './DespesaForm';
export { default as DespesaFormModal } from './DespesaFormModal';
export { default as DespesasFilters } from './DespesasFilters';
export type { DespesasFiltersState } from './DespesasFilters';
export { default as DespesasTab } from './DespesasTab';
export { default as DespesasDRE } from './DespesasDRE';