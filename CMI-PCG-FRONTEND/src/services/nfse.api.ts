// src/services/nfse.api.ts
/**
 * API Service para importação e reconciliação de NFS-e.
 *
 * Endpoints:
 *   POST /nfse/upload/preview  — Dry-run (não altera banco)
 *   POST /nfse/upload/apply    — Efetiva vinculações
 */
import api from './api';

// ============================================
// Types
// ============================================

export interface NfseMatchItem {
  nfse_numero: number;
  nfse_data: string;
  nfse_documento: string;
  nfse_nome: string;
  nfse_valor: number;
  pagamento_id: number | null;
  pagamento_valor: number | null;
  pagamento_nome: string | null;
  matched: boolean;
  already_linked: boolean;
  reason: string;
}

export interface NfseReconciliation {
  total_nfse_processadas: number;
  total_nfse_normais: number;
  total_nfse_canceladas: number;
  total_matched: number;
  total_unmatched: number;
  total_already_linked: number;
  applied: number;
  matched: NfseMatchItem[];
  unmatched: NfseMatchItem[];
  already_linked: NfseMatchItem[];
  errors: string[];
}

export interface NfseParseMeta {
  cnpj_prestador: string | null;
  razao_social: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  total_registros: number;
  total_normais: number;
  total_canceladas: number;
  erros_parse: string[];
}

export interface NfsePreviewResponse {
  parse: NfseParseMeta;
  reconciliation: NfseReconciliation;
}

export interface NfseApplyResponse {
  message: string;
  applied: number;
  reconciliation: NfseReconciliation;
}

// ============================================
// API Methods
// ============================================

export const nfseAPI = {
  /**
   * Upload PDF e retorna preview da reconciliação (dry-run).
   */
  preview: async (file: File): Promise<NfsePreviewResponse> => {
    const form = new FormData();
    form.append('file', file);

    const response = await api.post<NfsePreviewResponse>(
      '/nfse/upload/preview',
      form,
      { timeout: 60_000 },
    );
    return response.data;
  },

  /**
   * Upload PDF e efetiva as vinculações no banco.
   */
  apply: async (file: File): Promise<NfseApplyResponse> => {
    const form = new FormData();
    form.append('file', file);

    const response = await api.post<NfseApplyResponse>(
      '/nfse/upload/apply',
      form,
      { timeout: 60_000 },
    );
    return response.data;
  },
};

export default nfseAPI;