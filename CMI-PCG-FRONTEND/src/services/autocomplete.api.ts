// src/services/autocomplete.api.ts
import api from './api';

export interface AutocompletePaciente {
  id: number;
  nome: string;
  cpf: string;
  cpf_raw: number;
  empresa_nome?: string;
  empresa_id?: number;
  convenio_nome?: string;
  convenio_id?: number;
}

export interface AutocompleteEmpresa {
  id: number;
  nome: string;
  cnpj: string;
  cnpj_raw: number;
  total_pacientes: number;
  email?: string;
}

export interface AutocompleteConvenio {
  id: number;
  nome: string;
  cnpj: string;
  cnpj_raw: number;
  emite_guia: boolean;
  total_pacientes: number;
  email?: string;
}

export interface AutocompleteAllResult {
  pacientes: AutocompletePaciente[];
  empresas: AutocompleteEmpresa[];
  convenios: AutocompleteConvenio[];
}

export const autocompleteAPI = {
  /**
   * Busca pacientes para autocomplete
   * @param q - termo de busca (nome ou CPF)
   * @param options - filtros opcionais
   */
  pacientes: async (
    q: string,
    options?: { empresa_id?: number; convenio_id?: number; limit?: number }
  ): Promise<AutocompletePaciente[]> => {
    const params: Record<string, string | number> = { q };
    if (options?.empresa_id) params.empresa_id = options.empresa_id;
    if (options?.convenio_id) params.convenio_id = options.convenio_id;
    if (options?.limit) params.limit = options.limit;
    
    const response = await api.get<AutocompletePaciente[]>('/autocomplete/pacientes', { params });
    return response.data;
  },

  /**
   * Busca empresas para autocomplete
   * @param q - termo de busca (nome ou CNPJ)
   */
  empresas: async (q: string, limit?: number): Promise<AutocompleteEmpresa[]> => {
    const params: Record<string, string | number> = { q };
    if (limit) params.limit = limit;
    
    const response = await api.get<AutocompleteEmpresa[]>('/autocomplete/empresas', { params });
    return response.data;
  },

  /**
   * Busca convênios para autocomplete
   * @param q - termo de busca (nome ou CNPJ)
   */
  convenios: async (q: string, limit?: number): Promise<AutocompleteConvenio[]> => {
    const params: Record<string, string | number> = { q };
    if (limit) params.limit = limit;
    
    const response = await api.get<AutocompleteConvenio[]>('/autocomplete/convenios', { params });
    return response.data;
  },

  /**
   * Busca unificada em todas as entidades
   * @param q - termo de busca
   * @param types - tipos para buscar (default: todos)
   */
  all: async (
    q: string, 
    types?: ('pacientes' | 'empresas' | 'convenios')[], 
    limit?: number
  ): Promise<AutocompleteAllResult> => {
    const params: Record<string, string | number> = { q };
    if (types?.length) params.types = types.join(',');
    if (limit) params.limit = limit;
    
    const response = await api.get<AutocompleteAllResult>('/autocomplete/all', { params });
    return response.data;
  },
};

export default autocompleteAPI;