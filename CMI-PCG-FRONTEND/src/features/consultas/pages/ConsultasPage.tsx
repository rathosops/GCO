// src/features/consultas/pages/ConsultasPage.tsx

/**
 * Página de Consultas - CMI-PCG
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import {
  Plus,
  Loader2,
  Stethoscope,
  BarChart3,
  AlertTriangle,
  Calendar,
  FileText,
} from 'lucide-react';

import {
  useConsultas,
  useConsultaStats,
  useConsultaTipos,
  useConsultaDeps,
} from '@/features/consultas/hooks';

import {
  ConsultaFormModal,
  ConsultaFiltersBar,
  ConsultaCard,
  ConsultaStatsCards,
  ConsultasPorTipoReport,
  ConsultasPorMedicoReport,
  PacientesFrequentesReport,
  ResumoMensalReport,
  ProntuarioTab,
} from '@/features/consultas/components';

import { AgendamentosDiaSection } from '@/features/consultas/components/AgendamentosDiaSection';
import { useAgendamentosHoje } from '@/features/consultas/hooks/useAgendamentosHoje';

import { consultasAPI } from '@/features/consultas/api/consultas.api';
import type { Consulta, ConsultaFormData } from '@/features/consultas/types/consultas.types';
import type { Agendamento, Paciente } from '@/types';
import type { AutocompletePaciente } from '@/services/autocomplete.api';
import { useToast } from '@/components/feedback/toast';
import { onlyDigits } from '@/utils/formatters';

type Tab = 'lista' | 'prontuarios' | 'relatorios';

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const payload = err.response?.data as any;
    const apiMsg =
      payload?.error ||
      payload?.message ||
      (typeof payload === 'string' ? payload : null) ||
      err.message;
    return status ? `(${status}) ${apiMsg}` : apiMsg;
  }
  if (err instanceof Error) return err.message;
  return 'Erro inesperado';
}

export default function ConsultasPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('lista');

  const {
    items: consultas,
    loading,
    error,
    filters,
    setFilter,
    resetFilters,
    reload,
    hasMore,
    loadMore,
    total,
  } = useConsultas();

  const { stats, loading: statsLoading, reload: reloadStats } = useConsultaStats();
  const { tipos } = useConsultaTipos();
  const { medicos, procedimentos, loading: depsLoading } = useConsultaDeps();

  const {
    agendamentos: agendamentosHoje,
    loading: agendamentosLoading,
    error: agendamentosError,
    reload: reloadAgendamentos,
  } = useAgendamentosHoje();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingConsulta, setEditingConsulta] = useState<Consulta | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [prefilledData, setPrefilledData] = useState<{
    cpf_paciente?: string;
    nome_paciente?: string;
    tipo?: string;
  } | null>(null);

  const [deletingConsulta, setDeletingConsulta] = useState<Consulta | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = useCallback(() => {
    setEditingConsulta(null);
    setPrefilledData(null);
    setShowFormModal(true);
  }, []);

  const handleIniciarAtendimento = useCallback(
    (agendamento: Agendamento, paciente: Paciente | AutocompletePaciente | null) => {
      let cpfPaciente = '';
      let nomePaciente = agendamento.nome_paciente || '';

      if (paciente) {
        const cpfValue = 'cpf_raw' in paciente ? paciente.cpf_raw : paciente.cpf;
        cpfPaciente = onlyDigits(String(cpfValue || ''));
        nomePaciente = paciente.nome || nomePaciente;
      } else if (agendamento.cpf_paciente) {
        cpfPaciente = onlyDigits(String(agendamento.cpf_paciente));
      }

      const tipoConsulta = agendamento.procedimento || '';

      setEditingConsulta(null);
      setPrefilledData({
        cpf_paciente: cpfPaciente,
        nome_paciente: nomePaciente,
        tipo: tipoConsulta,
      });
      setShowFormModal(true);
    },
    []
  );

  const handleEdit = useCallback(
    async (consulta: Consulta) => {
      try {
        const full = await consultasAPI.getById(consulta.id);
        setEditingConsulta(full);
        setPrefilledData(null);
        setShowFormModal(true);
      } catch (err) {
        toast.error(extractErrorMessage(err), 'Falha ao carregar consulta');
      }
    },
    [toast]
  );

  const handleSave = useCallback(
    async (data: ConsultaFormData) => {
      setFormLoading(true);
      try {
        if (editingConsulta?.id) {
          await consultasAPI.update(editingConsulta.id, data);
          toast.success('Consulta atualizada com sucesso.', 'Sucesso');
        } else {
          await consultasAPI.create(data);
          toast.success('Consulta cadastrada com sucesso.', 'Sucesso');
        }

        setShowFormModal(false);
        setEditingConsulta(null);
        setPrefilledData(null);
        await reload();
        await reloadStats();
        await reloadAgendamentos();
      } catch (err) {
        toast.error(extractErrorMessage(err), 'Não foi possível salvar');
      } finally {
        setFormLoading(false);
      }
    },
    [editingConsulta, reload, reloadStats, reloadAgendamentos, toast]
  );

  const handleDelete = useCallback((consulta: Consulta) => {
    setDeletingConsulta(consulta);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deletingConsulta) return;

    setDeleting(true);
    try {
      await consultasAPI.delete(deletingConsulta.id);
      toast.success('Consulta excluída com sucesso.', 'Sucesso');
      setDeletingConsulta(null);
      await reload();
      await reloadStats();
    } catch (err) {
      toast.error(extractErrorMessage(err), 'Não foi possível excluir');
    } finally {
      setDeleting(false);
    }
  }, [deletingConsulta, reload, reloadStats, toast]);

  const handleCloseModal = useCallback(() => {
    setShowFormModal(false);
    setEditingConsulta(null);
    setPrefilledData(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">Consultas</h2>
          <p className="text-secondary-500">Registro e acompanhamento de consultas médicas</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {tab === 'lista' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              className="btn-primary"
              disabled={depsLoading}
            >
              <Plus className="h-4 w-4" />
              Nova Consulta
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card flex flex-col sm:flex-row gap-2">
        <button
          className={tab === 'lista' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('lista')}
        >
          <Stethoscope className="h-4 w-4" />
          Consultas
        </button>
        <button
          className={tab === 'prontuarios' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('prontuarios')}
        >
          <FileText className="h-4 w-4" />
          Prontuários
        </button>
        <button
          className={tab === 'relatorios' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('relatorios')}
        >
          <BarChart3 className="h-4 w-4" />
          Relatórios
        </button>
      </div>

      {/* Stats Cards - apenas na aba lista */}
      {tab === 'lista' && <ConsultaStatsCards stats={stats} loading={statsLoading} />}

      {/* Conteúdo por Tab */}
      {tab === 'lista' && (
        <>
          <AgendamentosDiaSection
            agendamentos={agendamentosHoje}
            loading={agendamentosLoading}
            error={agendamentosError}
            onReload={reloadAgendamentos}
            onIniciarAtendimento={handleIniciarAtendimento}
          />

          <ConsultaFiltersBar
            filters={filters}
            tipos={tipos}
            medicos={medicos.map((m) => ({ crm: m.crm, nome: m.nome }))}
            onChange={setFilter}
            onReset={resetFilters}
            resultCount={total}
          />

          {error && (
            <div className="card bg-red-50 border-red-200 text-red-700">
              <p>{error}</p>
            </div>
          )}

          {loading && consultas.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
            </div>
          ) : consultas.length > 0 ? (
            <div className="space-y-4">
              {consultas.map((consulta, idx) => (
                <ConsultaCard
                  key={(consulta as any).id}
                  consulta={consulta as Consulta}
                  index={idx}
                  onEdit={() => handleEdit(consulta as Consulta)}
                  onDelete={() => handleDelete(consulta as Consulta)}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button onClick={loadMore} className="btn-secondary" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar mais'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state py-16">
                <Calendar className="empty-state-icon" />
                <p className="empty-state-title">Nenhuma consulta encontrada</p>
                <p className="empty-state-description">Ajuste os filtros ou registre uma nova consulta.</p>
                <button className="btn-primary mt-4" onClick={handleCreate}>
                  <Plus className="h-4 w-4" />
                  Registrar Consulta
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'prontuarios' && <ProntuarioTab />}

      {tab === 'relatorios' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConsultasPorTipoReport />
          <ConsultasPorMedicoReport />
          <PacientesFrequentesReport />
          <ResumoMensalReport />
        </div>
      )}

      {/* Modal de Formulário */}
      <AnimatePresence>
        {showFormModal && (
          <ConsultaFormModal
            consulta={editingConsulta}
            medicos={medicos}
            procedimentos={procedimentos}
            onSave={handleSave}
            onClose={handleCloseModal}
            loading={formLoading}
            initialData={prefilledData}
          />
        )}
      </AnimatePresence>

      {/* Modal de Delete */}
      <AnimatePresence>
        {deletingConsulta && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleting && setDeletingConsulta(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-md"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-secondary-900">Confirmar Exclusão</h3>
                </div>
                <p className="text-secondary-600 mb-2">Deseja realmente excluir esta consulta?</p>
                <div className="p-3 bg-secondary-50 rounded-lg mb-4">
                  <p className="font-semibold text-secondary-900">
                    {deletingConsulta.nome_paciente || 'Paciente'}
                  </p>
                  <p className="text-sm text-secondary-600">
                    {deletingConsulta.tipo} • {deletingConsulta.data_br || deletingConsulta.data}
                  </p>
                </div>
                <p className="text-sm text-secondary-500 mb-6">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingConsulta(null)}
                    className="btn-secondary flex-1"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="btn-danger flex-1"
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}