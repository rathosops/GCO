/**
 * Modal para criar solicitação de exames
 *
 * Melhorias:
 *   - Seleção de médico solicitante via autocomplete (/api/medicos/autocomplete)
 *   - CRM enviado ao backend para inclusão no PDF com RQE
 *   - Opção de gerar PDF com valores, sem valores ou ambos
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  FileText,
  User,
  Search,
  Check,
  Percent,
  Download,
  Stethoscope,
} from 'lucide-react';
import { useExames, useExameSelection } from '../hooks';
import { solicitacoesExamesAPI } from '../api';
import { ExameListItem } from './ExameCard';
import type { Exame, SolicitacaoStatus } from '../types';
import { n } from '../types';

interface SolicitacaoExameModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  examesSelecionados?: Exame[];
}

interface PacienteOption {
  id: number;
  nome: string;
  cpf: string;
}

interface MedicoOption {
  id: number;
  nome: string;
  crm: number;
  crm_formatado: string;
  especialidade: string | null;
}

type TipoPdf = 'com_valores' | 'sem_valores' | 'ambos';

const STATUS_OPTIONS: { value: SolicitacaoStatus; label: string }[] = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'FATURADO', label: 'Faturado' },
  { value: 'EXTERNO', label: 'Externo' },
];

const PDF_OPTIONS: { value: TipoPdf; label: string; desc: string }[] = [
  { value: 'com_valores', label: 'Com valores', desc: 'Inclui coluna de valor e total' },
  { value: 'sem_valores', label: 'Sem valores', desc: 'Apenas exames, sem preços' },
  { value: 'ambos', label: 'Ambos', desc: 'Gera 2 PDFs simultaneamente' },
];

export function SolicitacaoExameModal({
  onClose,
  onSuccess,
  examesSelecionados,
}: SolicitacaoExameModalProps) {
  const [step, setStep] = useState<'paciente' | 'exames' | 'resumo'>('paciente');
  const [paciente, setPaciente] = useState<PacienteOption | null>(null);
  const [pacienteSearch, setPacienteSearch] = useState('');
  const [pacientesResults, setPacientesResults] = useState<PacienteOption[]>([]);
  const [searchingPaciente, setSearchingPaciente] = useState(false);

  // Médico solicitante
  const [medico, setMedico] = useState<MedicoOption | null>(null);
  const [medicoSearch, setMedicoSearch] = useState('');
  const [medicosResults, setMedicosResults] = useState<MedicoOption[]>([]);
  const [searchingMedico, setSearchingMedico] = useState(false);
  const [showMedicoDropdown, setShowMedicoDropdown] = useState(false);
  const medicoSearchRef = useRef<HTMLInputElement>(null);
  const medicoDropdownRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<SolicitacaoStatus>('PENDENTE');
  const [observacoes, setObservacoes] = useState('');
  const [salvarSolicitacao, setSalvarSolicitacao] = useState(true);
  const [tipoPdf, setTipoPdf] = useState<TipoPdf>('com_valores');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { filteredItems: exames, loading: loadingExames, filters, setFilter } = useExames();
  const selection = useExameSelection();

  useState(() => {
    if (examesSelecionados?.length) {
      selection.selectAll(examesSelecionados);
      setStep('paciente');
    }
  });

  // ── Fechar dropdown médico ao clicar fora ─────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        medicoDropdownRef.current &&
        !medicoDropdownRef.current.contains(e.target as Node) &&
        medicoSearchRef.current &&
        !medicoSearchRef.current.contains(e.target as Node)
      ) {
        setShowMedicoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Busca paciente ────────────────────────────────────────────────────
  const searchPaciente = useCallback(async (query: string) => {
    if (query.length < 2) {
      setPacientesResults([]);
      return;
    }
    setSearchingPaciente(true);
    try {
      const response = await fetch(
        `/api/autocomplete/pacientes?q=${encodeURIComponent(query)}&limit=10`
      );
      const data = await response.json();
      setPacientesResults(data.map((p: any) => ({ id: p.id, nome: p.nome, cpf: p.cpf })));
    } catch {
      /* silent */
    } finally {
      setSearchingPaciente(false);
    }
  }, []);

  // ── Busca médico ──────────────────────────────────────────────────────
  const searchMedico = useCallback(async (query: string) => {
    if (query.length < 2) {
      setMedicosResults([]);
      setShowMedicoDropdown(false);
      return;
    }
    setSearchingMedico(true);
    try {
      const response = await fetch(
        `/api/medicos/autocomplete?q=${encodeURIComponent(query)}&limit=10`
      );
      const data = await response.json();
      setMedicosResults(
        data.map((m: any) => ({
          id: m.id,
          nome: m.nome,
          crm: m.crm,
          crm_formatado: m.crm_formatado,
          especialidade: m.especialidade,
        }))
      );
      setShowMedicoDropdown(true);
    } catch {
      /* silent */
    } finally {
      setSearchingMedico(false);
    }
  }, []);

  // ── Helper: trigger download de blob ──────────────────────────────────
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (gerarPdf: boolean) => {
    if (!paciente || selection.selected.length === 0) {
      setError('Selecione um paciente e pelo menos um exame');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const examesIds = selection.selected.map((e) => e.id);
      const nomeSafe = paciente.nome.replace(/\s+/g, '_');

      if (gerarPdf) {
        if (tipoPdf === 'ambos') {
          // Gera PDF COM valores (salva solicitação nesse primeiro)
          const blobCom = await solicitacoesExamesAPI.gerarPdf(
            paciente.id,
            examesIds,
            salvarSolicitacao,
            status,
            medico?.crm,
            false,
          );
          triggerDownload(blobCom, `solicitacao_exames_${nomeSafe}.pdf`);

          // Gera PDF SEM valores (sem salvar de novo)
          const blobSem = await solicitacoesExamesAPI.gerarPdf(
            paciente.id,
            examesIds,
            false,
            status,
            medico?.crm,
            true,
          );
          triggerDownload(blobSem, `solicitacao_exames_${nomeSafe}_sem_valores.pdf`);
        } else {
          const semValores = tipoPdf === 'sem_valores';
          const blob = await solicitacoesExamesAPI.gerarPdf(
            paciente.id,
            examesIds,
            salvarSolicitacao,
            status,
            medico?.crm,
            semValores,
          );
          const sufixo = semValores ? '_sem_valores' : '';
          triggerDownload(blob, `solicitacao_exames_${nomeSafe}${sufixo}.pdf`);
        }
      } else if (salvarSolicitacao) {
        const payload = {
          paciente_id: paciente.id,
          exames_ids: examesIds,
          status,
          observacoes: observacoes || undefined,
          crm_medico: medico?.crm || undefined,
          desconto_percentual: selection.descontoPercentual || undefined,
          desconto_valor: selection.descontoPercentual ? undefined : selection.desconto || undefined,
          gerar_pdf: false,
        };
        await solicitacoesExamesAPI.create(payload);
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao criar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = ['paciente', 'exames', 'resumo'] as const;
  const stepIdx = STEPS.indexOf(step);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-bg-300">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-100">Nova Solicitação de Exames</h3>
                <p className="text-sm text-text-200">
                  {step === 'paciente' && 'Selecione o paciente'}
                  {step === 'exames' && 'Selecione os exames'}
                  {step === 'resumo' && 'Confirme os dados'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost" disabled={submitting}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-2 py-4">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step === s ? 'bg-primary-100 text-white' : ''}
                    ${stepIdx > i ? 'bg-emerald-500 text-white' : ''}
                    ${stepIdx < i ? 'bg-bg-200 text-text-200' : ''}
                  `}
                >
                  {stepIdx > i ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={`w-12 h-1 mx-2 rounded ${stepIdx > i ? 'bg-emerald-500' : 'bg-bg-200'}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto py-4">
            {/* ═══════════════════════ STEP: PACIENTE ═══════════════════════ */}
            {step === 'paciente' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-200" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="Buscar paciente por nome ou CPF..."
                    value={pacienteSearch}
                    onChange={(e) => {
                      setPacienteSearch(e.target.value);
                      searchPaciente(e.target.value);
                    }}
                  />
                  {searchingPaciente && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-200 animate-spin" />
                  )}
                </div>

                {paciente && (
                  <div className="p-4 bg-primary-100/5 rounded-xl border border-primary-100/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-text-100">{paciente.nome}</p>
                          <p className="text-sm text-text-200">CPF: {paciente.cpf}</p>
                        </div>
                      </div>
                      <button onClick={() => setPaciente(null)} className="btn-ghost btn-sm text-red-500">
                        Trocar
                      </button>
                    </div>
                  </div>
                )}

                {!paciente && pacientesResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {pacientesResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPaciente(p);
                          setPacientesResults([]);
                          setPacienteSearch('');
                        }}
                        className="p-3 rounded-xl border border-bg-300 hover:bg-bg-200 cursor-pointer transition"
                      >
                        <p className="font-medium text-text-100">{p.nome}</p>
                        <p className="text-sm text-text-200">CPF: {p.cpf}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════ STEP: EXAMES ════════════════════════ */}
            {step === 'exames' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-200" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="Buscar exames..."
                    value={filters.search || ''}
                    onChange={(e) => setFilter('search', e.target.value)}
                  />
                </div>

                {selection.selected.length > 0 && (
                  <div className="p-3 bg-primary-100/5 rounded-xl border border-primary-100/20">
                    <p className="text-sm font-medium text-primary-100">
                      {selection.selected.length} exame(s) selecionado(s) – Total: R${' '}
                      {selection.totalVenda.toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {loadingExames ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-100" />
                    </div>
                  ) : (
                    exames.map((exame) => (
                      <ExameListItem
                        key={exame.id}
                        exame={exame}
                        isSelected={selection.isSelected(exame.id)}
                        onToggle={() => selection.toggle(exame)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════ STEP: RESUMO ════════════════════════ */}
            {step === 'resumo' && (
              <div className="space-y-6">
                {/* Paciente */}
                <div>
                  <h4 className="font-semibold text-text-100 mb-2 text-sm">Paciente</h4>
                  <div className="p-3 bg-bg-200 rounded-xl">
                    <p className="font-medium text-text-100">{paciente?.nome}</p>
                    <p className="text-sm text-text-200">CPF: {paciente?.cpf}</p>
                  </div>
                </div>

                {/* Médico Solicitante */}
                <div>
                  <h4 className="font-semibold text-text-100 mb-2 text-sm">
                    Médico Solicitante <span className="text-text-200 font-normal">(opcional)</span>
                  </h4>

                  {medico ? (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500 rounded-lg">
                            <Stethoscope className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-text-100 text-sm">
                              Dr(a). {medico.nome}
                            </p>
                            <p className="text-xs text-text-200">
                              {medico.crm_formatado}
                              {medico.especialidade && ` • ${medico.especialidade}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setMedico(null);
                            setMedicoSearch('');
                          }}
                          className="btn-ghost btn-sm text-red-500"
                        >
                          Trocar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
                      <input
                        ref={medicoSearchRef}
                        type="text"
                        className="input pl-10 text-sm"
                        placeholder="Buscar médico por nome ou CRM..."
                        value={medicoSearch}
                        onChange={(e) => {
                          setMedicoSearch(e.target.value);
                          searchMedico(e.target.value);
                        }}
                        onFocus={() => {
                          if (medicosResults.length > 0) setShowMedicoDropdown(true);
                        }}
                      />
                      {searchingMedico && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200 animate-spin" />
                      )}

                      {/* Dropdown de resultados */}
                      <AnimatePresence>
                        {showMedicoDropdown && medicosResults.length > 0 && (
                          <motion.div
                            ref={medicoDropdownRef}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute z-20 w-full mt-1 bg-bg-100 border border-bg-300 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                          >
                            {medicosResults.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setMedico(m);
                                  setMedicoSearch('');
                                  setMedicosResults([]);
                                  setShowMedicoDropdown(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-200 transition-colors border-b border-bg-200 last:border-b-0"
                              >
                                <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
                                  <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-text-100 text-sm truncate">
                                    Dr(a). {m.nome}
                                  </p>
                                  <p className="text-xs text-text-200">
                                    {m.crm_formatado}
                                    {m.especialidade && ` • ${m.especialidade}`}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Exames */}
                <div>
                  <h4 className="font-semibold text-text-100 mb-2 text-sm">
                    Exames ({selection.selected.length})
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selection.selected.map((e) => (
                      <div key={e.id} className="flex justify-between p-2 bg-bg-200 rounded-lg text-sm">
                        <span className="text-text-100">{e.nome}</span>
                        <span className="font-medium text-text-100 tabular-nums">
                          R$ {n(e.valor_venda).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desconto */}
                <div>
                  <h4 className="font-semibold text-text-100 mb-2 text-sm">Desconto</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        className="input pr-8 text-sm"
                        placeholder="0"
                        value={selection.descontoPercentual || ''}
                        onChange={(e) => {
                          selection.setDescontoPercentual(parseFloat(e.target.value) || 0);
                          selection.setDesconto(0);
                        }}
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-200 text-xs">R$</span>
                      <input
                        type="number"
                        className="input pl-10 text-sm"
                        placeholder="0,00"
                        value={selection.descontoPercentual > 0 ? '' : selection.desconto || ''}
                        onChange={(e) => {
                          selection.setDesconto(parseFloat(e.target.value) || 0);
                          selection.setDescontoPercentual(0);
                        }}
                        disabled={selection.descontoPercentual > 0}
                      />
                    </div>
                  </div>
                </div>

                {/* Totais */}
                <div className="p-4 bg-primary-100/5 rounded-xl border border-primary-100/20 space-y-2">
                  <div className="flex justify-between text-sm text-text-200">
                    <span>Subtotal:</span>
                    <span className="tabular-nums">R$ {selection.totalVenda.toFixed(2)}</span>
                  </div>
                  {selection.desconto > 0 && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Desconto:</span>
                      <span className="tabular-nums">- R$ {selection.desconto.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-primary-100/20">
                    <span className="text-text-100">Total:</span>
                    <span className="text-primary-100 tabular-nums">R$ {selection.totalFinal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Status + Observações */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as SolicitacaoStatus)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Observações</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Opcional"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Tipo de PDF */}
                <div>
                  <h4 className="font-semibold text-text-100 mb-2 text-sm">Tipo de Guia (PDF)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {PDF_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`
                          flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all text-center
                          ${tipoPdf === opt.value
                            ? 'border-primary-100 bg-primary-100/5'
                            : 'border-bg-300 hover:border-bg-200 hover:bg-bg-200'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name="tipoPdf"
                          value={opt.value}
                          checked={tipoPdf === opt.value}
                          onChange={() => setTipoPdf(opt.value)}
                          className="sr-only"
                        />
                        <span className={`text-sm font-semibold ${tipoPdf === opt.value ? 'text-primary-100' : 'text-text-100'}`}>
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-text-200 leading-tight">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salvarSolicitacao}
                    onChange={(e) => setSalvarSolicitacao(e.target.checked)}
                    className="h-4 w-4 rounded border-bg-300 text-primary-100"
                  />
                  <span className="text-sm text-text-200">Salvar solicitação no sistema</span>
                </label>

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between pt-4 border-t border-bg-300">
            <button
              onClick={() => {
                if (step === 'exames') setStep('paciente');
                if (step === 'resumo') setStep('exames');
              }}
              className="btn-secondary"
              disabled={step === 'paciente' || submitting}
            >
              Voltar
            </button>
            <div className="flex gap-2">
              {step === 'resumo' ? (
                <>
                  <button
                    onClick={() => handleSubmit(false)}
                    className="btn-secondary"
                    disabled={submitting || !salvarSolicitacao}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                  </button>
                  <button onClick={() => handleSubmit(true)} className="btn-primary" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Gerar PDF
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (step === 'paciente' && paciente) setStep('exames');
                    if (step === 'exames' && selection.selected.length > 0) setStep('resumo');
                  }}
                  className="btn-primary"
                  disabled={
                    (step === 'paciente' && !paciente) ||
                    (step === 'exames' && selection.selected.length === 0)
                  }
                >
                  Próximo
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}