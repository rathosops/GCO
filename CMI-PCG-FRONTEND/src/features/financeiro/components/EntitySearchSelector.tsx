// src/features/financeiro/components/EntitySearchSelector.tsx
import { useState, useCallback, ReactNode } from 'react';
import { Search, X, Loader2, Check, ChevronDown, User, Building2, HandCoins } from 'lucide-react';

export interface EntityOption {
  id: number | string;
  label: string;
  sublabel?: string;
  meta?: string;
  icon?: ReactNode;
}

interface EntitySearchSelectorProps {
  // Configuração
  title: string;
  placeholder?: string;
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
  
  // Estado de busca
  query: string;
  onQueryChange: (q: string) => void;
  loading?: boolean;
  minChars?: number;
  
  // Opções e seleção
  options: EntityOption[];
  selected: EntityOption | null;
  onSelect: (option: EntityOption) => void;
  onClear: () => void;
  
  // Renderização customizada
  emptyMessage?: string;
  renderOption?: (option: EntityOption, isSelected: boolean) => ReactNode;
}

export default function EntitySearchSelector({
  title,
  placeholder = 'Digite para buscar...',
  hint,
  icon,
  disabled = false,
  query,
  onQueryChange,
  loading = false,
  minChars = 2,
  options,
  selected,
  onSelect,
  onClear,
  emptyMessage,
  renderOption,
}: EntitySearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback((option: EntityOption) => {
    onSelect(option);
    setIsOpen(false);
    onQueryChange('');
  }, [onSelect, onQueryChange]);

  const handleClear = useCallback(() => {
    onClear();
    onQueryChange('');
    setIsOpen(false);
  }, [onClear, onQueryChange]);

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange(e.target.value);
    if (!isOpen) setIsOpen(true);
  }, [onQueryChange, isOpen]);

  const showResults = isOpen && query.length >= minChars;
  const showMinCharsHint = isOpen && query.length > 0 && query.length < minChars;

  return (
    <div className={`relative ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-secondary-900">{title}</span>
        </div>
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-secondary-500 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <X className="h-4 w-4" />
            Limpar
          </button>
        )}
      </div>

      {hint && !selected && (
        <p className="text-sm text-secondary-500 mb-3">{hint}</p>
      )}

      {/* Selecionado */}
      {selected ? (
        <div className="p-4 rounded-xl bg-primary-50 border-2 border-primary-200">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-primary-900">
                {selected.label}
              </p>
              {selected.sublabel && (
                <p className="text-sm text-primary-700 mt-1">
                  {selected.sublabel}
                </p>
              )}
              {selected.meta && (
                <p className="text-sm text-primary-600 mt-1">{selected.meta}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-primary-100 transition-colors flex-shrink-0"
            >
              <ChevronDown className={`h-5 w-5 text-primary-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      ) : (
        /* Campo de busca */
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="input pl-12 pr-12 py-3 text-base"
            disabled={disabled}
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-500 animate-spin" />
          )}
        </div>
      )}

      {/* Dropdown de resultados */}
      {(showResults || showMinCharsHint || (isOpen && selected)) && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-secondary-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
          {/* Campo de busca quando já tem selecionado */}
          {selected && isOpen && (
            <div className="p-3 border-b border-secondary-100 bg-secondary-50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
                <input
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  placeholder="Buscar outro..."
                  className="input pl-12 pr-12 py-3 text-base"
                  autoFocus
                />
                {loading && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-500 animate-spin" />
                )}
              </div>
            </div>
          )}

          {/* Hint de caracteres mínimos */}
          {showMinCharsHint && (
            <div className="p-6 text-base text-secondary-500 text-center">
              Digite pelo menos {minChars} caracteres para buscar
            </div>
          )}

          {/* Lista de resultados */}
          {showResults && (
            <div className="overflow-y-auto max-h-64">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
                </div>
              ) : options.length > 0 ? (
                <div className="divide-y divide-secondary-100">
                  {options.map((option) => {
                    const isSelected = selected?.id === option.id;
                    
                    if (renderOption) {
                      return (
                        <button
                          key={String(option.id)}
                          type="button"
                          onClick={() => handleSelect(option)}
                          className="w-full text-left"
                        >
                          {renderOption(option, isSelected)}
                        </button>
                      );
                    }
                    
                    return (
                      <button
                        key={String(option.id)}
                        type="button"
                        onClick={() => handleSelect(option)}
                        className={`w-full text-left p-4 hover:bg-secondary-50 transition-colors flex items-center justify-between gap-4 ${
                          isSelected ? 'bg-primary-50' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-medium text-secondary-900">
                            {option.label}
                          </p>
                          {option.sublabel && (
                            <p className="text-sm text-secondary-500 mt-1">
                              {option.sublabel}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {option.meta && (
                            <span className="text-sm text-secondary-500">
                              {option.meta}
                            </span>
                          )}
                          {isSelected && (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary-100">
                              <Check className="h-4 w-4 text-primary-600" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-base text-secondary-500 text-center">
                  {emptyMessage || 'Nenhum resultado encontrado'}
                </div>
              )}
            </div>
          )}

          {/* Fechar */}
          {isOpen && (
            <div className="p-3 border-t border-secondary-100 bg-secondary-50">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full text-sm text-secondary-600 hover:text-secondary-800 py-2 font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overlay para fechar ao clicar fora */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Componentes pré-configurados para cada tipo de entidade
export function PacienteSelector(props: Omit<EntitySearchSelectorProps, 'icon' | 'title'> & { title?: string }) {
  return (
    <EntitySearchSelector
      icon={<User className="h-5 w-5 text-primary-600" />}
      title="Paciente"
      placeholder="Buscar por nome ou CPF..."
      hint="Digite o nome ou CPF do paciente"
      emptyMessage="Nenhum paciente encontrado"
      {...props}
    />
  );
}

export function EmpresaSelector(props: Omit<EntitySearchSelectorProps, 'icon' | 'title'> & { title?: string }) {
  return (
    <EntitySearchSelector
      icon={<Building2 className="h-5 w-5 text-primary-600" />}
      title="Empresa"
      placeholder="Buscar por nome ou CNPJ..."
      hint="Digite o nome ou CNPJ da empresa"
      emptyMessage="Nenhuma empresa encontrada"
      {...props}
    />
  );
}

export function ConvenioSelector(props: Omit<EntitySearchSelectorProps, 'icon' | 'title'> & { title?: string }) {
  return (
    <EntitySearchSelector
      icon={<HandCoins className="h-5 w-5 text-primary-600" />}
      title="Convênio"
      placeholder="Buscar por nome ou CNPJ..."
      hint="Digite o nome ou CNPJ do convênio"
      emptyMessage="Nenhum convênio encontrado"
      {...props}
    />
  );
}