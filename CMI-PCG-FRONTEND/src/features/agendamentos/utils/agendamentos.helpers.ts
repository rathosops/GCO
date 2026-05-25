import type { Agendamento, AgendamentoStatus } from '@/types';

export const procedimentosDisponiveis = [
  'Consulta Ocupacional',
  'Consulta Particular',
  'Exame Admissional',
  'Exame Demissional',
  'Exame Periódico',
  'Retorno',
  'IMESC',
];

export const statusOptions: { value: AgendamentoStatus; label: string; color: string }[] = [
  { value: 'AGENDADO', label: 'Agendado', color: 'bg-secondary-100 text-secondary-700' },
  { value: 'CONFIRMADO', label: 'Confirmado', color: 'bg-success-light text-success-dark' },
  { value: 'REALIZADO', label: 'Realizado', color: 'bg-primary-100 text-primary-700' },
  { value: 'CANCELADO', label: 'Cancelado', color: 'bg-danger-light text-danger-dark' },
  { value: 'FALTOU', label: 'Faltou', color: 'bg-warning-light text-warning-dark' },
];

export function normalizeHora(h?: string) {
  if (!h) return '';
  return h.length >= 5 ? h.slice(0, 5) : h;
}

export function isHoraHHmm(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function statusFromAgendamento(a: Agendamento): AgendamentoStatus {
  if (a.paciente_compareceu === true) return 'REALIZADO';
  if (a.paciente_compareceu === false) return 'FALTOU';
  return (a.status as AgendamentoStatus) || 'AGENDADO';
}

export function extractApiErrorMessage(err: unknown): string {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.error ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    'Erro inesperado'
  );
}

export function normalizeText(s?: any) {
  return String(s ?? '').trim().toLowerCase();
}

export function normalizeDigits(s?: any) {
  return String(s ?? '').replace(/\D/g, '');
}
