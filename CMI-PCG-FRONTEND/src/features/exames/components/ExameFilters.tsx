/**
 * Filtros para listagem de exames com abas de categoria
 */

import { Search, X, SlidersHorizontal } from 'lucide-react';
import type { ExameFilters, ExameOrder, ExameCategoria } from '../types';
import { EXAME_CATEGORIAS } from '../types';

interface ExameFiltersBarProps {
  filters: ExameFilters;
  tipos: string[];
  categoria: ExameCategoria;
  onCategoriaChange: (cat: ExameCategoria) => void;
  onChange: <K extends keyof ExameFilters>(key: K, value: ExameFilters[K]) => void;
  onReset: () => void;
  resultCount?: number;
}

const ORDER_OPTIONS: { value: ExameOrder; label: string }[] = [
  { value: 'nome_asc', label: 'Nome (A-Z)' },
  { value: 'nome_desc', label: 'Nome (Z-A)' },
  { value: 'valor_asc', label: 'Menor Valor' },
  { value: 'valor_desc', label: 'Maior Valor' },
  { value: 'codigo_asc', label: 'Código' },
  { value: 'tipo_asc', label: 'Tipo' },
  { value: 'created_desc', label: 'Mais Recentes' },
];

export function ExameFiltersBar({
  filters,
  tipos,
  categoria,
  onCategoriaChange,
  onChange,
  onReset,
  resultCount,
}: ExameFiltersBarProps) {
  const hasActiveFilters =
    filters.search ||
    filters.tipo ||
    filters.ativo === false ||
    filters.valor_min ||
    filters.valor_max;

  return (
    <div className="space-y-3">
      {/* Abas de categoria */}
      <div className="flex items-center gap-1 p-1 bg-bg-200 rounded-xl overflow-x-auto">
        {EXAME_CATEGORIAS.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => onCategoriaChange(cat.value)}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all
              ${
                categoria === cat.value
                  ? 'bg-primary-100 text-white shadow-sm'
                  : 'text-text-200 hover:text-text-100 hover:bg-bg-100'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Barra de busca + filtros inline */}
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
            <input
              type="text"
              className="input pl-10 pr-10"
              placeholder="Buscar por nome, código ou tipo..."
              value={filters.search || ''}
              onChange={(e) => onChange('search', e.target.value)}
            />
            {filters.search && (
              <button
                onClick={() => onChange('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-200 hover:text-text-100 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              className="input py-2 min-w-[130px] text-sm"
              value={filters.tipo || ''}
              onChange={(e) => onChange('tipo', e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>

            <select
              className="input py-2 min-w-[100px] text-sm"
              value={filters.ativo === undefined ? '' : String(filters.ativo)}
              onChange={(e) => {
                const val = e.target.value;
                onChange('ativo', val === '' ? undefined : val === 'true');
              }}
            >
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
              <option value="">Todos</option>
            </select>

            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-text-200" />
              <select
                className="input py-2 min-w-[130px] text-sm"
                value={filters.order || 'nome_asc'}
                onChange={(e) => onChange('order', e.target.value as ExameOrder)}
              >
                {ORDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filtros de valor + contador */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-text-200">Valor:</span>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-200">R$</span>
              <input
                type="number"
                className="input py-1.5 pl-7 w-20 text-sm"
                placeholder="Mín"
                value={filters.valor_min || ''}
                onChange={(e) => onChange('valor_min', parseFloat(e.target.value) || undefined)}
              />
            </div>
            <span className="text-text-200">–</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-200">R$</span>
              <input
                type="number"
                className="input py-1.5 pl-7 w-20 text-sm"
                placeholder="Máx"
                value={filters.valor_max || ''}
                onChange={(e) => onChange('valor_max', parseFloat(e.target.value) || undefined)}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button onClick={onReset} className="btn-ghost btn-sm text-primary-100 ml-auto">
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}

          {resultCount !== undefined && (
            <p className="text-text-200 ml-auto tabular-nums">
              {resultCount} exame{resultCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}