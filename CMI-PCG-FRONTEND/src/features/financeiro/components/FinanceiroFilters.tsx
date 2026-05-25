// src/features/financeiro/components/FinanceiroFilters.tsx
import { Search, Calendar, Receipt } from 'lucide-react';

export interface FinanceiroFiltersState {
  searchInput: string;
  dataInicio: string;
  dataFim: string;
  origem: string;
  tipo: string;
  possuiDesconto: boolean | '';
  semVinculo: boolean | '';
  vinculadoNotaFiscal: boolean | '';
  numeroNotaFiscal: string;
  valor: string;
  order: 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc';
  limit: number;
}

interface FinanceiroFiltersProps {
  filters: FinanceiroFiltersState;
  onChange: <K extends keyof FinanceiroFiltersState>(
    key: K,
    value: FinanceiroFiltersState[K]
  ) => void;
  onReset: () => void;
  totals: {
    bruto: number;
    descontos: number;
    liquido: number;
  };
}

function moneyBR(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

export default function FinanceiroFilters({
  filters,
  onChange,
  onReset,
  totals,
}: FinanceiroFiltersProps) {
  const hasActiveFilters = !!(
    filters.searchInput ||
    filters.dataInicio ||
    filters.dataFim ||
    filters.origem ||
    filters.tipo ||
    filters.valor ||
    filters.possuiDesconto !== '' ||
    filters.semVinculo !== '' ||
    filters.vinculadoNotaFiscal !== '' ||
    filters.numeroNotaFiscal
  );

  return (
    <div className="card space-y-4">
      {/* Busca principal */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            placeholder="Buscar por paciente, empresa, convênio, descrição ou nº nota fiscal..."
            value={filters.searchInput}
            onChange={(e) => onChange('searchInput', e.target.value)}
            className="input pl-10"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="btn-secondary text-sm whitespace-nowrap"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Grid de filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Data início</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => onChange('dataInicio', e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div>
          <label className="label">Data fim</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="date"
              value={filters.dataFim}
              onChange={(e) => onChange('dataFim', e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div>
          <label className="label">Valor exato (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Ex: 150,00"
            value={filters.valor}
            onChange={(e) => onChange('valor', e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Origem</label>
          <select
            value={filters.origem}
            onChange={(e) => onChange('origem', e.target.value)}
            className="select"
          >
            <option value="">Todas</option>
            <option value="PACIENTE">Paciente</option>
            <option value="EMPRESA">Empresa</option>
            <option value="CONVÊNIO">Convênio</option>
            <option value="OUTROS">Outros</option>
            <option value="EXAMES">Exames</option>
          </select>
        </div>

        <div>
          <label className="label">Tipo</label>
          <select
            value={filters.tipo}
            onChange={(e) => onChange('tipo', e.target.value)}
            className="select"
          >
            <option value="">Todos</option>
            <option value="PIX">PIX</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="DÉBITO">Débito</option>
            <option value="CRÉDITO">Crédito</option>
            <option value="TRANSFERÊNCIA BANCÁRIA">Transferência</option>
          </select>
        </div>

        <div>
          <label className="label">Desconto</label>
          <select
            value={filters.possuiDesconto === '' ? '' : filters.possuiDesconto ? 'true' : 'false'}
            onChange={(e) =>
              onChange(
                'possuiDesconto',
                e.target.value === '' ? '' : e.target.value === 'true'
              )
            }
            className="select"
          >
            <option value="">Todos</option>
            <option value="true">Com desconto</option>
            <option value="false">Sem desconto</option>
          </select>
        </div>

        <div>
          <label className="label">Vínculo</label>
          <select
            value={filters.semVinculo === '' ? '' : filters.semVinculo ? 'true' : 'false'}
            onChange={(e) =>
              onChange(
                'semVinculo',
                e.target.value === '' ? '' : e.target.value === 'true'
              )
            }
            className="select"
          >
            <option value="">Todos</option>
            <option value="true">Somente avulsos</option>
            <option value="false">Somente vinculados</option>
          </select>
        </div>

        <div>
          <label className="label flex items-center gap-1">
            <Receipt className="h-4 w-4" />
            Nota fiscal
          </label>
          <select
            value={filters.vinculadoNotaFiscal === '' ? '' : filters.vinculadoNotaFiscal ? 'true' : 'false'}
            onChange={(e) =>
              onChange(
                'vinculadoNotaFiscal',
                e.target.value === '' ? '' : e.target.value === 'true'
              )
            }
            className="select"
          >
            <option value="">Todos</option>
            <option value="true">Com nota fiscal</option>
            <option value="false">Sem nota fiscal</option>
          </select>
        </div>

        <div>
          <label className="label">Nº Nota fiscal</label>
          <input
            type="text"
            placeholder="Buscar por número..."
            value={filters.numeroNotaFiscal}
            onChange={(e) => onChange('numeroNotaFiscal', e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Ordenação</label>
          <select
            value={filters.order}
            onChange={(e) => onChange('order', e.target.value as any)}
            className="select"
          >
            <option value="data_desc">Data (mais recente)</option>
            <option value="data_asc">Data (mais antiga)</option>
            <option value="valor_desc">Valor (maior)</option>
            <option value="valor_asc">Valor (menor)</option>
          </select>
        </div>

        <div>
          <label className="label">Por página</label>
          <select
            value={filters.limit}
            onChange={(e) => onChange('limit', Number(e.target.value))}
            className="select"
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-secondary-50 border border-secondary-100">
          <p className="text-xs text-secondary-500">Total bruto (lista)</p>
          <p className="text-lg font-semibold text-secondary-900">
            {moneyBR(totals.bruto)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-secondary-50 border border-secondary-100">
          <p className="text-xs text-secondary-500">Descontos (lista)</p>
          <p className="text-lg font-semibold text-secondary-900">
            {moneyBR(totals.descontos)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-secondary-50 border border-secondary-100">
          <p className="text-xs text-secondary-500">Total líquido (lista)</p>
          <p className="text-lg font-semibold text-secondary-900">
            {moneyBR(totals.liquido)}
          </p>
        </div>
      </div>
    </div>
  );
}