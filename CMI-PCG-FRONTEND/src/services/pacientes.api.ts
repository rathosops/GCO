import api from '@/services/api';

export interface PacienteRecord {
  id: number;
  nome: string;
  cpf: string;
  cpf_raw: string;
  vinculado_a_empresa: boolean;
  cnpj_empresa_raw: number | null;
  empresa: { id: number; nome: string; cnpj: string } | null;
}

export const pacientesAPI = {
  getByCpf: async (cpf: string): Promise<PacienteRecord> => {
    const { data } = await api.get(`/pacientes/cpf/${cpf}`);
    return data;
  },
  vincularEmpresa: async (
    pacienteId: number,
    cnpjEmpresa: number | string,
  ): Promise<void> => {
    await api.put(`/pacientes/${pacienteId}`, {
      cnpj_empresa: cnpjEmpresa,
      vinculado_a_empresa: true,
    });
  },
};