// src/features/financeiro/hooks/useAutocomplete.ts
import { useState, useEffect, useMemo, useCallback } from 'react';
import { debounce } from '@/utils/debounce';
import autocompleteAPI, {
  AutocompletePaciente,
  AutocompleteEmpresa,
  AutocompleteConvenio,
} from '@/services/autocomplete.api';

interface UseAutocompleteOptions {
  minChars?: number;
  debounceMs?: number;
  limit?: number;
}

interface UseAutocompleteResult<T> {
  query: string;
  setQuery: (q: string) => void;
  items: T[];
  loading: boolean;
  error: string | null;
  clear: () => void;
}

/**
 * Hook genérico para autocomplete com debounce
 */
function useAutocomplete<T>(
  fetchFn: (q: string) => Promise<T[]>,
  options: UseAutocompleteOptions = {}
): UseAutocompleteResult<T> {
  const { minChars = 2, debounceMs = 300 } = options;
  
  const [query, setQueryRaw] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce da query
  const debouncedSetQuery = useMemo(
    () => debounce((q: string) => setDebouncedQuery(q), debounceMs),
    [debounceMs]
  );

  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    debouncedSetQuery(q);
  }, [debouncedSetQuery]);

  // Busca quando query muda
  useEffect(() => {
    let cancelled = false;

    const search = async () => {
      const trimmed = debouncedQuery.trim();
      
      if (trimmed.length < minChars) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await fetchFn(trimmed);
        if (!cancelled) {
          setItems(Array.isArray(results) ? results : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Erro na busca');
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    search();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, minChars, fetchFn]);

  const clear = useCallback(() => {
    setQueryRaw('');
    setDebouncedQuery('');
    setItems([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    items,
    loading,
    error,
    clear,
  };
}

/**
 * Hook específico para autocomplete de pacientes
 */
export function usePacientesAutocomplete(
  options?: UseAutocompleteOptions & { empresa_id?: number; convenio_id?: number }
) {
  const { empresa_id, convenio_id, limit, ...rest } = options || {};
  
  const fetchFn = useCallback(
    (q: string) => autocompleteAPI.pacientes(q, { empresa_id, convenio_id, limit }),
    [empresa_id, convenio_id, limit]
  );
  
  return useAutocomplete<AutocompletePaciente>(fetchFn, rest);
}

/**
 * Hook específico para autocomplete de empresas
 */
export function useEmpresasAutocomplete(options?: UseAutocompleteOptions) {
  const { limit, ...rest } = options || {};
  
  const fetchFn = useCallback(
    (q: string) => autocompleteAPI.empresas(q, limit),
    [limit]
  );
  
  return useAutocomplete<AutocompleteEmpresa>(fetchFn, rest);
}

/**
 * Hook específico para autocomplete de convênios
 */
export function useConveniosAutocomplete(options?: UseAutocompleteOptions) {
  const { limit, ...rest } = options || {};
  
  const fetchFn = useCallback(
    (q: string) => autocompleteAPI.convenios(q, limit),
    [limit]
  );
  
  return useAutocomplete<AutocompleteConvenio>(fetchFn, rest);
}

export default useAutocomplete;