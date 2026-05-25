import type { Agendamento } from '@/types';

export type FormState = {
  nome_paciente: string;
  cpf_paciente: string;
  numero_de_contato: string;
  numero_de_protocolo: string;
  procedimento: string;
  hora: string; // HH:MM
  observacoes: string;
};

export type ImportResult = {
  message: string;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; error: string }[];
};

export type DuplicatesInfo = {
  groups: number;
  extras: number;
  byKey: Record<string, number[]>; // key -> ids
};

export type AgendamentoId = NonNullable<Agendamento['id']>;
