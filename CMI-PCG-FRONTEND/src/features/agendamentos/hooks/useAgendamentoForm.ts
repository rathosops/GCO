import { useMemo, useState } from 'react';
import type { Agendamento } from '@/types';
import type { FormState } from '../types';
import { isHoraHHmm, normalizeHora } from '../utils/agendamentos.helpers';

export const emptyForm = (): FormState => ({
  nome_paciente: '',
  cpf_paciente: '',
  numero_de_contato: '',
  numero_de_protocolo: '',
  procedimento: 'Consulta Ocupacional',
  hora: '',
  observacoes: '',
});

export interface PacientePreFill {
  nome: string;
  cpf: string;
  telefone?: string | number | null;
}

export function useAgendamentoForm(opts: { agendamentos: Agendamento[] }) {
  const { agendamentos } = opts;

  const [showModal, setShowModal] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);

  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [touched, setTouched] = useState<{ hora?: boolean; nome_paciente?: boolean }>({});
  const [formError, setFormError] = useState<string>('');

  const horasOcupadasSemAtual = useMemo(() => {
    const ignoreId = editingAgendamento?.id ?? null;
    const horas = agendamentos
      .filter((a) => (ignoreId ? a.id !== ignoreId : true))
      .map((a) => normalizeHora(a.hora))
      .filter(Boolean);
    return new Set(horas);
  }, [agendamentos, editingAgendamento]);

  const horaNormalizada = useMemo(() => normalizeHora(formData.hora), [formData.hora]);

  const hasConflict = useMemo(() => {
    if (!horaNormalizada || !isHoraHHmm(horaNormalizada)) return false;
    return horasOcupadasSemAtual.has(horaNormalizada);
  }, [horaNormalizada, horasOcupadasSemAtual]);

  const fieldErrors = useMemo(() => {
    const errs: { nome_paciente?: string; hora?: string } = {};

    if (touched.nome_paciente && !(formData.nome_paciente || '').trim()) {
      errs.nome_paciente = 'Nome é obrigatório.';
    }

    if (touched.hora) {
      const h = normalizeHora(formData.hora);
      if (!h) errs.hora = 'Horário é obrigatório.';
      else if (!isHoraHHmm(h)) errs.hora = 'Use HH:MM.';
    }

    return errs;
  }, [formData, touched]);

  const validateForm = () => {
    const nomeOk = (formData.nome_paciente || '').trim().length > 0;
    const hora = normalizeHora(formData.hora);

    if (!nomeOk) return 'Informe o nome do paciente.';
    if (!hora) return 'Informe o horário.';
    if (!isHoraHHmm(hora)) return 'Horário inválido. Use HH:MM.';
    return '';
  };

  const openCreateModal = () => {
    setFormError('');
    setTouched({});
    setEditingAgendamento(null);
    setFormData(emptyForm());
    setShowModal(true);
  };

  /** Abre modal de criação com dados do paciente pré-preenchidos */
  const openCreateModalWithPaciente = (paciente: PacientePreFill) => {
    setFormError('');
    setTouched({});
    setEditingAgendamento(null);
    setFormData({
      ...emptyForm(),
      nome_paciente: paciente.nome || '',
      cpf_paciente: paciente.cpf ? String(paciente.cpf).replace(/\D/g, '') : '',
      numero_de_contato: paciente.telefone ? String(paciente.telefone) : '',
    });
    setShowModal(true);
  };

  const openEditModal = (ag: Agendamento) => {
    setFormError('');
    setTouched({});
    setEditingAgendamento(ag);
    setFormData({
      nome_paciente: ag.nome_paciente || '',
      cpf_paciente: ag.cpf_paciente ? String(ag.cpf_paciente) : '',
      numero_de_contato: ag.numero_de_contato ? String(ag.numero_de_contato) : '',
      numero_de_protocolo: ag.numero_de_protocolo ? String(ag.numero_de_protocolo) : '',
      procedimento: ag.procedimento || 'Consulta Ocupacional',
      hora: normalizeHora(ag.hora) || '',
      observacoes: ag.observacoes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAgendamento(null);
    setFormError('');
    setTouched({});
  };

  return {
    // modal
    showModal,
    openCreateModal,
    openCreateModalWithPaciente,
    openEditModal,
    closeModal,
    editingAgendamento,

    // form
    formData,
    setFormData,
    touched,
    setTouched,
    formError,
    setFormError,
    validateForm,
    fieldErrors,

    // computed
    horaNormalizada,
    hasConflict,
  };
}