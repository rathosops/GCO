// src/features/aso/api/aso-questionario.api.ts

import api from '@/services/api';
import type {
    AsoQuestionario,
    AnamneseGrupos,
    ExameClinico,
    FormLinkResponse,
} from '../types/aso-questionario.types';

export type PdfModo = 'preenchido' | 'parcial' | 'branco';

export const questionarioAPI = {
    /** Template vazio da anamnese (cacheado no backend) */
    getTemplate: async (): Promise<AnamneseGrupos> => {
        const { data } = await api.get('/aso-questionarios/template');
        return data;
    },

    /** Busca questionário vinculado a um ASO (com auto-link de pendente) */
    getByAso: async (asoId: number): Promise<AsoQuestionario | null> => {
        const { data } = await api.get(`/aso-questionarios/${asoId}`);
        if (data.data === null) return null;
        if (data.id) return data as AsoQuestionario;
        return null;
    },

    /** Cria questionário manual vinculado ao ASO */
    create: async (asoId: number, payload?: {
        anamnese?: Partial<AnamneseGrupos>;
        exame_clinico?: Partial<ExameClinico>;
        observacoes_medicas?: string;
    }): Promise<AsoQuestionario> => {
        const { data } = await api.post(`/aso-questionarios/${asoId}`, payload || {});
        return data;
    },

    /** Atualiza respostas / exame clínico (merge parcial) */
    update: async (asoId: number, payload: {
        anamnese?: Partial<AnamneseGrupos>;
        exame_clinico?: Partial<ExameClinico>;
        observacoes_medicas?: string;
    }): Promise<AsoQuestionario> => {
        const { data } = await api.put(`/aso-questionarios/${asoId}`, payload);
        return data;
    },

    /** Vincula questionário pendente ao ASO */
    vincular: async (asoId: number, questionarioId?: number): Promise<AsoQuestionario> => {
        const { data } = await api.post(`/aso-questionarios/${asoId}/vincular`, {
            questionario_id: questionarioId,
        });
        return data;
    },

    /** Marca como completo (médico finalizou) */
    finalizar: async (asoId: number): Promise<AsoQuestionario> => {
        const { data } = await api.post(`/aso-questionarios/${asoId}/finalizar`);
        return data;
    },

    /** Lista todos os questionários pendentes */
    listarPendentes: async (): Promise<AsoQuestionario[]> => {
        const { data } = await api.get('/aso-questionarios/pendentes');
        return data;
    },

    /** Pendentes de um CPF específico */
    listarPendentesCpf: async (cpf: string): Promise<AsoQuestionario[]> => {
        const { data } = await api.get(`/aso-questionarios/pendentes/${cpf}`);
        return data;
    },

    /**
     * Busca questionários pendentes por nome (parcial) ou CPF (dígitos).
     * O backend detecta automaticamente o tipo de busca.
     */
    buscar: async (q: string): Promise<AsoQuestionario[]> => {
        const { data } = await api.get('/aso-questionarios/buscar', { params: { q } });
        return data;
    },

        /** Gera link do Google Form pré-preenchido */
    gerarLinkForm: async (asoId: number): Promise<FormLinkResponse> => {
        const { data } = await api.get(`/aso-questionarios/${asoId}/gerar-link-form`);
        return data;
    },

    /**
     * Gera PDF da ficha clínica a partir do questionário (NÃO exige ASO).
     *
     * Endpoint: GET /aso-questionarios/ficha/<questionarioId>/pdf
     *
     * Usado para o médico revisar a anamnese ANTES de criar o ASO.
     * Se o questionário já estiver vinculado a um ASO, inclui dados do ASO.
     *
     * @param questionarioId - ID do questionário
     * @param modo - 'preenchido' (respostas) | 'parcial' (só dados do paciente)
     */
    gerarFichaClinica: async (questionarioId: number, modo: PdfModo = 'preenchido'): Promise<Blob> => {
        const params = modo !== 'preenchido' ? { modo } : {};
        const { data } = await api.get(`/aso-questionarios/ficha/${questionarioId}/pdf`, {
            params,
            responseType: 'blob',
            timeout: 30000,
        });
        return data;
    },

    /**
     * Gera PDF do questionário vinculado a um ASO (exige ASO).
     *
     * Endpoint: GET /aso-questionarios/<asoId>/pdf
     */
    gerarPdf: async (asoId: number, modo: PdfModo = 'preenchido'): Promise<Blob> => {
        const params = modo !== 'preenchido' ? { modo } : {};
        const { data } = await api.get(`/aso-questionarios/${asoId}/pdf`, {
            params,
            responseType: 'blob',
            timeout: 30000,
        });
        return data;
    },

    /** Gera ficha clínica totalmente em branco (sem ASO vinculado) */
    gerarFichaBranca: async (): Promise<Blob> => {
        const { data } = await api.get('/aso-questionarios/ficha-branca', {
            responseType: 'blob',
            timeout: 30000,
        });
        return data;
    },
};

export default questionarioAPI;