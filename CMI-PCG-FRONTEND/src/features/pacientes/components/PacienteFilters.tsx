/**
 * Filtros de Pacientes — theme-aware
 */

import { useState } from "react";
import { Search, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import type { PacienteFilters, NivelFidelidade } from "../types";

interface PacienteFiltersProps {
  filters: PacienteFilters;
  onFiltersChange: (filters: Partial<PacienteFilters>) => void;
  onClear: () => void;
  resultCount?: number;
  loading?: boolean;
}

export function PacienteFiltersBar({
  filters,
  onFiltersChange,
  onClear,
  resultCount,
  loading,
}: PacienteFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFiltersCount = [
    filters.sexo,
    typeof filters.vinculado_a_empresa === "boolean" ? true : null,
    typeof filters.vinculado_a_convenio === "boolean" ? true : null,
    filters.cidade,
    filters.uf,
    filters.nivel_fidelidade,
  ].filter(Boolean).length;

  return (
    <div className="card space-y-4" id="pacientes-filtros">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-200" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou email..."
            value={filters.search || ""}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="input pl-10"
          />
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`btn-secondary ${activeFiltersCount > 0 ? "ring-2 ring-primary-200" : ""}`}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary-100 text-white text-xs rounded-full">
              {activeFiltersCount}
            </span>
          )}
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button onClick={onClear} className="btn-ghost text-sm">
            <X className="h-4 w-4" /> Limpar
          </button>
        )}
      </div>

      {resultCount !== undefined && (
        <div className="text-sm text-text-200">
          {loading ? "Buscando..." : `${resultCount} paciente(s) encontrado(s)`}
        </div>
      )}

      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-bg-300">
          <div>
            <label className="label">Sexo</label>
            <select
              value={filters.sexo || ""}
              onChange={(e) => onFiltersChange({ sexo: e.target.value as any })}
              className="select"
            >
              <option value="">Todos</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
          <div>
            <label className="label">Vínculo Empresa</label>
            <select
              value={
                filters.vinculado_a_empresa === ""
                  ? ""
                  : filters.vinculado_a_empresa
                    ? "true"
                    : "false"
              }
              onChange={(e) => {
                const v = e.target.value;
                onFiltersChange({
                  vinculado_a_empresa: v === "" ? "" : v === "true",
                });
              }}
              className="select"
            >
              <option value="">Todos</option>
              <option value="true">Vinculados</option>
              <option value="false">Não vinculados</option>
            </select>
          </div>
          <div>
            <label className="label">Vínculo Convênio</label>
            <select
              value={
                filters.vinculado_a_convenio === ""
                  ? ""
                  : filters.vinculado_a_convenio
                    ? "true"
                    : "false"
              }
              onChange={(e) => {
                const v = e.target.value;
                onFiltersChange({
                  vinculado_a_convenio: v === "" ? "" : v === "true",
                });
              }}
              className="select"
            >
              <option value="">Todos</option>
              <option value="true">Vinculados</option>
              <option value="false">Não vinculados</option>
            </select>
          </div>
          <div>
            <label className="label">Nível Fidelidade</label>
            <select
              value={filters.nivel_fidelidade || ""}
              onChange={(e) =>
                onFiltersChange({
                  nivel_fidelidade: e.target.value as NivelFidelidade | "",
                  include_frequency:
                    e.target.value !== "" ? true : filters.include_frequency,
                })
              }
              className="select"
            >
              <option value="">Todos</option>
              <option value="novo">🆕 Novo</option>
              <option value="bronze">🥉 Bronze</option>
              <option value="prata">🥈 Prata</option>
              <option value="ouro">🥇 Ouro</option>
            </select>
          </div>
          <div>
            <label className="label">Estado (UF)</label>
            <input
              type="text"
              value={filters.uf || ""}
              onChange={(e) =>
                onFiltersChange({ uf: e.target.value.toUpperCase() })
              }
              className="input"
              placeholder="SP, RJ..."
              maxLength={2}
            />
          </div>
          <div>
            <label className="label">Cidade</label>
            <input
              type="text"
              value={filters.cidade || ""}
              onChange={(e) => onFiltersChange({ cidade: e.target.value })}
              className="input"
              placeholder="São Paulo..."
            />
          </div>
          <div>
            <label className="label">Ordenar por</label>
            <select
              value={filters.order || "nome_asc"}
              onChange={(e) =>
                onFiltersChange({ order: e.target.value as any })
              }
              className="select"
            >
              <option value="nome_asc">Nome (A-Z)</option>
              <option value="nome_desc">Nome (Z-A)</option>
              <option value="recente">Mais recentes</option>
              <option value="antigo">Mais antigos</option>
            </select>
          </div>
          <div>
            <label className="label">Por página</label>
            <select
              value={filters.limit || 12}
              onChange={(e) =>
                onFiltersChange({ limit: Number(e.target.value) })
              }
              className="select"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default PacienteFiltersBar;
