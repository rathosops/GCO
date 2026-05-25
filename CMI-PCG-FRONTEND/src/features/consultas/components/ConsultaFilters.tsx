/**
 * Barra de filtros para listagem de consultas
 */

import { useState } from 'react';
import { Search, Filter, X, SlidersHorizontal, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import type { ConsultaFilters, ConsultaOrder } from '@/features/consultas/types/consultas.types';

interface ConsultaFiltersBarProps {
  filters: ConsultaFilters;
  tipos: string[];
  medicos: { crm: number | string; nome: string }[];
  onChange: <K extends keyof ConsultaFilters>(key: K, value: ConsultaFilters[K]) => void;
  onReset: () => void;
  resultCount?: number;
}

const ORDER_OPTIONS: { value: ConsultaOrder; label: string }[] = [
  { value: 'data_desc', label: 'Mais Recentes' },
  { value: 'data_asc', label: 'Mais Antigas' },
  { value: 'paciente_asc', label: 'Paciente (A-Z)' },
  { value: 'medico_asc', label: 'Médico (A-Z)' },
];

export function ConsultaFiltersBar({
  filters,
  tipos,
  medicos,
  onChange,
  onReset,
  resultCount,
}: ConsultaFiltersBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilters =
    filters.search ||
    filters.tipo ||
    filters.cpf_paciente ||
    filters.crm_medico ||
    filters.data ||
    filters.data_inicio ||
    filters.data_fim ||
    filters.houve_exame !== undefined ||
    filters.houve_prescricao !== undefined;

  return (
    <div className="card space-y-4">
      {/* Busca principal */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            className="input pl-10 pr-10"
            placeholder="Buscar por paciente, CPF, médico, CRM, tipo, anamnese..."
            value={filters.search || ''}
            onChange={(e) => onChange('search', e.target.value)}
          />
          {filters.search && (
            <button
              onClick={() => onChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-secondary-400 hover:text-secondary-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tipo */}
        <div className="w-full md:w-56">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <select
              className="select pl-10"
              value={filters.tipo || ''}
              onChange={(e) => onChange('tipo', e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ordenação */}
        <div className="w-full md:w-44">
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <select
              className="select pl-10"
              value={filters.order || 'data_desc'}
              onChange={(e) => onChange('order', e.target.value as ConsultaOrder)}
            >
              {ORDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botão filtros avançados */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`btn-secondary ${showAdvanced ? 'bg-primary-100' : ''}`}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Filtros avançados */}
      {showAdvanced && (
        <div className="pt-4 border-t space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPF do paciente */}
            <div>
              <label className="label text-xs">CPF do Paciente</label>
              <input
                type="text"
                className="input"
                placeholder="000.000.000-00"
                value={filters.cpf_paciente || ''}
                onChange={(e) => onChange('cpf_paciente', e.target.value)}
              />
            </div>

            {/* Médico */}
            <div>
              <label className="label text-xs">Médico</label>
              <select
                className="select"
                value={filters.crm_medico || ''}
                onChange={(e) => onChange('crm_medico', e.target.value)}
              >
                <option value="">Todos</option>
                {medicos.map((m) => (
                  <option key={String(m.crm)} value={String(m.crm)}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Data específica */}
            <div>
              <label className="label text-xs">Data Específica</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                <input
                  type="date"
                  className="input pl-10"
                  value={filters.data || ''}
                  onChange={(e) => onChange('data', e.target.value)}
                />
              </div>
            </div>

            {/* Range: Data início */}
            <div>
              <label className="label text-xs">Data Início</label>
              <input
                type="date"
                className="input"
                value={filters.data_inicio || ''}
                onChange={(e) => onChange('data_inicio', e.target.value)}
              />
            </div>

            {/* Range: Data fim */}
            <div>
              <label className="label text-xs">Data Fim</label>
              <input
                type="date"
                className="input"
                value={filters.data_fim || ''}
                onChange={(e) => onChange('data_fim', e.target.value)}
              />
            </div>

            {/* Houve exame */}
            <div>
              <label className="label text-xs">Solicitou Exame?</label>
              <select
                className="select"
                value={filters.houve_exame === undefined ? '' : String(filters.houve_exame)}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange('houve_exame', val === '' ? '' : val === 'true');
                }}
              >
                <option value="">Todos</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>

            {/* Houve prescrição */}
            <div>
              <label className="label text-xs">Houve Prescrição?</label>
              <select
                className="select"
                value={filters.houve_prescricao === undefined ? '' : String(filters.houve_prescricao)}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange('houve_prescricao', val === '' ? '' : val === 'true');
                }}
              >
                <option value="">Todos</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé: contador + limpar */}
      <div className="flex items-center justify-between">
        {resultCount !== undefined && (
          <p className="text-sm text-secondary-500">
            {resultCount} consulta{resultCount !== 1 ? 's' : ''} encontrada{resultCount !== 1 ? 's' : ''}
          </p>
        )}

        {hasActiveFilters && (
          <button onClick={onReset} className="btn-ghost btn-sm text-primary-600">
            <X className="h-4 w-4" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}