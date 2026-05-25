/**
 * Filtros de Médicos
 * 
 * Barra de busca e filtros avançados.
 */

import { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { MedicoFilters } from '../types';
import { ESPECIALIDADES_COMUNS } from '../types';


interface MedicoFiltersProps {
  filters: MedicoFilters;
  onFiltersChange: (filters: Partial<MedicoFilters>) => void;
  onClear: () => void;
  resultCount?: number;
  loading?: boolean;
}


export function MedicoFiltersBar({
  filters,
  onFiltersChange,
  onClear,
  resultCount,
  loading,
}: MedicoFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Contar filtros ativos
  const activeFiltersCount = [
    filters.especialidade,
    filters.sexo,
    filters.crm,
  ].filter(Boolean).length;
  
  const handleSearchChange = (value: string) => {
    onFiltersChange({ search: value });
  };
  
  return (
    <div className="card space-y-4" id="medicos-filtros">
      {/* Barra principal */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Campo de busca */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CRM ou especialidade..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input pl-10"
          />
        </div>
        
        {/* Botão filtros avançados */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`btn-secondary ${activeFiltersCount > 0 ? 'ring-2 ring-primary-300' : ''}`}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary-500 text-white text-xs rounded-full">
              {activeFiltersCount}
            </span>
          )}
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </button>
        
        {/* Limpar filtros */}
        {activeFiltersCount > 0 && (
          <button onClick={onClear} className="btn-ghost text-sm">
            <X className="h-4 w-4" />
            Limpar
          </button>
        )}
      </div>
      
      {/* Resultado count */}
      {resultCount !== undefined && (
        <div className="text-sm text-secondary-500">
          {loading ? 'Buscando...' : `${resultCount} médico(s) encontrado(s)`}
        </div>
      )}
      
      {/* Filtros avançados */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-secondary-200">
          {/* Especialidade */}
          <div>
            <label className="label">Especialidade</label>
            <select
              value={filters.especialidade || ''}
              onChange={(e) => onFiltersChange({ especialidade: e.target.value })}
              className="select"
            >
              <option value="">Todas</option>
              {ESPECIALIDADES_COMUNS.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </div>
          
          {/* Sexo */}
          <div>
            <label className="label">Sexo</label>
            <select
              value={filters.sexo || ''}
              onChange={(e) => onFiltersChange({ sexo: e.target.value as 'M' | 'F' | '' })}
              className="select"
            >
              <option value="">Todos</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
          
          {/* CRM */}
          <div>
            <label className="label">CRM</label>
            <input
              type="text"
              placeholder="Número do CRM"
              value={filters.crm || ''}
              onChange={(e) => onFiltersChange({ crm: e.target.value })}
              className="input"
            />
          </div>
          
          {/* Ordenação */}
          <div>
            <label className="label">Ordenar por</label>
            <select
              value={filters.order || 'nome_asc'}
              onChange={(e) => onFiltersChange({ order: e.target.value as MedicoFilters['order'] })}
              className="select"
            >
              <option value="nome_asc">Nome (A-Z)</option>
              <option value="nome_desc">Nome (Z-A)</option>
              <option value="crm_asc">CRM (Crescente)</option>
              <option value="crm_desc">CRM (Decrescente)</option>
              <option value="consultas_desc">Mais Consultas</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}


export default MedicoFiltersBar;