// src/features/financeiro/components/NfseImportModal.tsx
import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Receipt,
} from 'lucide-react';
import { nfseAPI } from '@/services/nfse.api';
import type {
  NfsePreviewResponse,
  NfseApplyResponse,
  NfseMatchItem,
} from '@/services/nfse.api';

// ============================================
// Types
// ============================================

type Step = 'upload' | 'preview' | 'applying' | 'done';

interface NfseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ============================================
// Helpers
// ============================================

function moneyBR(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

function formatDoc(doc: string): string {
  const d = (doc || '').replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return doc;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

function fileSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

// ============================================
// Sub-components
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className={`p-3 rounded-xl border ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function MatchTable({
  title,
  items,
  color,
  icon: Icon,
  defaultOpen = false,
}: {
  title: string;
  items: NfseMatchItem[];
  color: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <div className={`border rounded-xl overflow-hidden ${color}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-semibold">
            {title} ({items.length})
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t">
                    <th className="px-3 py-2 text-left text-xs font-semibold">NF</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Data</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Tomador</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold">Valor NF</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Pagamento</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={`${item.nfse_numero}-${idx}`} className="border-t">
                      <td className="px-3 py-2 font-medium">{item.nfse_numero}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(item.nfse_data)}</td>
                      <td className="px-3 py-2">
                        <p className="truncate max-w-[140px]" title={item.nfse_nome}>
                          {item.nfse_nome}
                        </p>
                        <p className="text-xs opacity-70">{formatDoc(item.nfse_documento)}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                        {moneyBR(item.nfse_valor)}
                      </td>
                      <td className="px-3 py-2">
                        {item.pagamento_id ? (
                          <div>
                            <p className="font-medium">#{item.pagamento_id}</p>
                            {item.pagamento_nome && (
                              <p className="text-xs opacity-70 truncate max-w-[120px]">
                                {item.pagamento_nome}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs opacity-50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs opacity-80 max-w-[160px] truncate" title={item.reason}>
                        {item.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function NfseImportModal({
  isOpen,
  onClose,
  onSuccess,
}: NfseImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NfsePreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<NfseApplyResponse | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state
  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setDragOver(false);
    setLoading(false);
    setError(null);
    setPreview(null);
    setApplyResult(null);
  }, []);

  const handleClose = useCallback(() => {
    if (loading) return;
    reset();
    onClose();
  }, [loading, reset, onClose]);

  // File validation
  const validateFile = useCallback((f: File): string | null => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      return 'Apenas arquivos PDF são aceitos.';
    }
    if (f.size > 10 * 1024 * 1024) {
      return 'O arquivo excede o limite de 10 MB.';
    }
    return null;
  }, []);

  // File selection
  const handleFileSelect = useCallback(
    (f: File) => {
      const err = validateFile(f);
      if (err) {
        setError(err);
        return;
      }
      setFile(f);
      setError(null);
    },
    [validateFile],
  );

  // Drag events
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFileSelect(f);
      // Reset input para permitir re-selecionar o mesmo arquivo
      if (inputRef.current) inputRef.current.value = '';
    },
    [handleFileSelect],
  );

  // Preview
  const handlePreview = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const result = await nfseAPI.preview(file);
      setPreview(result);
      setStep('preview');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detalhes?.join(', ') ||
        'Erro ao processar o PDF. Verifique se é um relatório de NFS-e válido.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [file]);

  // Apply
  const handleApply = useCallback(async () => {
    if (!file) return;

    setStep('applying');
    setLoading(true);
    setError(null);

    try {
      const result = await nfseAPI.apply(file);
      setApplyResult(result);
      setStep('done');
      onSuccess();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        'Erro ao aplicar vinculações. Tente novamente.';
      setError(msg);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  }, [file, onSuccess]);

  // Preview stats
  const stats = useMemo(() => {
    if (!preview) return null;
    const { reconciliation: r, parse: p } = preview;
    return { r, p };
  }, [preview]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary-100/10">
                <Receipt className="h-5 w-5 text-primary-100" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary-900">
                  Vincular NFS-e a Pagamentos
                </h3>
                <p className="text-sm text-secondary-500">
                  Importe o PDF de notas fiscais da prefeitura
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="btn-icon btn-ghost"
              type="button"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { key: 'upload', label: '1. Upload' },
              { key: 'preview', label: '2. Conferir' },
              { key: 'done', label: '3. Aplicar' },
            ].map((s, i) => {
              const isActive =
                s.key === step ||
                (s.key === 'done' && step === 'applying');
              const isPast =
                (s.key === 'upload' && step !== 'upload') ||
                (s.key === 'preview' && (step === 'applying' || step === 'done'));

              return (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={`w-8 h-0.5 ${
                        isPast ? 'bg-primary-100' : 'bg-secondary-200'
                      }`}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-white'
                        : isPast
                          ? 'bg-primary-100/10 text-primary-100'
                          : 'bg-secondary-100 text-secondary-500'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-danger-light border border-danger/20 text-danger mb-4 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Erro</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {/* ========== STEP: Upload ========== */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-8
                  flex flex-col items-center justify-center gap-3
                  cursor-pointer transition-all duration-200
                  ${
                    dragOver
                      ? 'border-primary-100 bg-primary-100/5 scale-[1.01]'
                      : file
                        ? 'border-primary-200 bg-primary-100/5'
                        : 'border-secondary-300 hover:border-primary-200 hover:bg-secondary-50'
                  }
                `}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  onChange={onInputChange}
                  className="hidden"
                />

                {file ? (
                  <>
                    <div className="p-3 rounded-xl bg-primary-100/10">
                      <FileText className="h-8 w-8 text-primary-100" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-secondary-900">{file.name}</p>
                      <p className="text-sm text-secondary-500 mt-1">
                        {fileSizeMB(file.size)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setError(null);
                      }}
                      className="btn-ghost text-sm text-secondary-500"
                    >
                      <X className="h-4 w-4" />
                      Remover
                    </button>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-xl bg-secondary-100">
                      <Upload className="h-8 w-8 text-secondary-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-secondary-900">
                        Arraste o PDF aqui ou clique para selecionar
                      </p>
                      <p className="text-sm text-secondary-500 mt-1">
                        Relatório de NFS-e da Prefeitura (máx. 10 MB)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Info */}
              <div className="p-4 rounded-xl bg-secondary-50 border border-secondary-100">
                <p className="text-sm text-secondary-700">
                  <strong>Como funciona:</strong> O sistema lê o PDF de NFS-e emitidas,
                  extrai os dados (CPF/CNPJ, valor, data) e cruza automaticamente com
                  os pagamentos cadastrados. Você confere o resultado antes de confirmar.
                </p>
              </div>

              {/* Action */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handlePreview}
                  className="btn-primary"
                  disabled={!file || loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-5 w-5" />
                  )}
                  Analisar PDF
                </button>
              </div>
            </div>
          )}

          {/* ========== STEP: Preview ========== */}
          {step === 'preview' && stats && (
            <div className="space-y-4">
              {/* Parse info */}
              <div className="p-4 rounded-xl bg-secondary-50 border border-secondary-100">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary-700">
                  {stats.p.razao_social && (
                    <p>
                      <span className="font-medium">Prestador:</span>{' '}
                      {stats.p.razao_social}
                    </p>
                  )}
                  {stats.p.cnpj_prestador && (
                    <p>
                      <span className="font-medium">CNPJ:</span>{' '}
                      {formatDoc(stats.p.cnpj_prestador)}
                    </p>
                  )}
                  {stats.p.periodo_inicio && stats.p.periodo_fim && (
                    <p>
                      <span className="font-medium">Período:</span>{' '}
                      {formatDateBR(stats.p.periodo_inicio)} a{' '}
                      {formatDateBR(stats.p.periodo_fim)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={FileText}
                  label="NFS-e no PDF"
                  value={stats.p.total_normais}
                  color="bg-secondary-50 border-secondary-200 text-secondary-800"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Vinculações encontradas"
                  value={stats.r.total_matched}
                  color="bg-green-50 border-green-200 text-green-800"
                />
                <StatCard
                  icon={XCircle}
                  label="Sem correspondência"
                  value={stats.r.total_unmatched}
                  color="bg-red-50 border-red-200 text-red-800"
                />
                <StatCard
                  icon={Link2}
                  label="Já vinculados"
                  value={stats.r.total_already_linked}
                  color="bg-amber-50 border-amber-200 text-amber-800"
                />
              </div>

              {/* Canceladas */}
              {stats.p.total_canceladas > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {stats.p.total_canceladas} NFS-e com status cancelada/substituída foram ignoradas.
                </div>
              )}

              {/* Parse errors */}
              {stats.p.erros_parse.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <p className="font-medium mb-1">Avisos do parse:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {stats.p.erros_parse.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reconciliation errors */}
              {stats.r.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                  <p className="font-medium mb-1">Erros de reconciliação:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {stats.r.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Match tables */}
              <MatchTable
                title="Vinculações encontradas"
                items={stats.r.matched}
                icon={CheckCircle2}
                color="border-green-200 bg-green-50/50"
                defaultOpen={stats.r.matched.length <= 20}
              />

              <MatchTable
                title="Sem correspondência"
                items={stats.r.unmatched}
                icon={XCircle}
                color="border-red-200 bg-red-50/50"
                defaultOpen={stats.r.unmatched.length <= 10}
              />

              <MatchTable
                title="Já vinculados anteriormente"
                items={stats.r.already_linked}
                icon={Link2}
                color="border-amber-200 bg-amber-50/50"
              />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-secondary-100">
                <button
                  type="button"
                  onClick={reset}
                  className="btn-secondary"
                  disabled={loading}
                >
                  <RotateCcw className="h-4 w-4" />
                  Enviar outro PDF
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleApply}
                    className="btn-primary"
                    disabled={loading || stats.r.total_matched === 0}
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    Aplicar {stats.r.total_matched} vinculações
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========== STEP: Applying ========== */}
          {step === 'applying' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 text-primary-100 animate-spin" />
              <p className="text-lg font-semibold text-secondary-900">
                Aplicando vinculações...
              </p>
              <p className="text-sm text-secondary-500">
                Aguarde enquanto os pagamentos são atualizados no banco.
              </p>
            </div>
          )}

          {/* ========== STEP: Done ========== */}
          {step === 'done' && applyResult && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="p-6 rounded-xl bg-green-50 border border-green-200 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-xl font-bold text-green-900">
                  {applyResult.applied} vinculações aplicadas!
                </p>
                <p className="text-sm text-green-700 mt-2">
                  Os pagamentos foram atualizados com os números das notas fiscais.
                </p>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={CheckCircle2}
                  label="Aplicados"
                  value={applyResult.reconciliation.total_matched}
                  color="bg-green-50 border-green-200 text-green-800"
                />
                <StatCard
                  icon={XCircle}
                  label="Sem match"
                  value={applyResult.reconciliation.total_unmatched}
                  color="bg-red-50 border-red-200 text-red-800"
                />
                <StatCard
                  icon={Link2}
                  label="Já vinculados"
                  value={applyResult.reconciliation.total_already_linked}
                  color="bg-amber-50 border-amber-200 text-amber-800"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between gap-3 pt-4 border-t border-secondary-100">
                <button
                  type="button"
                  onClick={reset}
                  className="btn-secondary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Importar outro
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-primary"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}