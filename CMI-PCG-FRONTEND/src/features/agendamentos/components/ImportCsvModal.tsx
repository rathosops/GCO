import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';

type ImportResult = {
  message: string;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; error: string }[];
};

type Props = {
  isOpen: boolean;

  importing: boolean;
  dragActive: boolean;

  importFile: File | null;
  importResult: ImportResult | null;

  duplicatesInfo: { groups: number; extras: number };
  cleaningDupes: boolean;

  fileInputRef: React.RefObject<HTMLInputElement>;

  onClose: () => void;

  onPickFile: () => void;
  onAcceptFile: (file: File | null) => void;

  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;

  onRunImport: () => void;
  onClearFile: () => void;

  onCleanDupesNow: () => void;
};

export function ImportCsvModal({
  isOpen,
  importing,
  dragActive,

  importFile,
  importResult,

  duplicatesInfo,
  cleaningDupes,

  fileInputRef,

  onClose,

  onPickFile,
  onAcceptFile,

  onDragOver,
  onDragLeave,
  onDrop,

  onRunImport,
  onClearFile,

  onCleanDupesNow,
}: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
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
              className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-secondary-900">Importar agendamentos (CSV)</h3>
                <button onClick={onClose} className="btn-icon btn-ghost" type="button" disabled={importing}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onAcceptFile(e.target.files?.[0] ?? null)}
              />

              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`rounded-xl border p-4 transition-colors ${
                  dragActive ? 'border-primary-400 bg-primary-50/30' : 'border-secondary-200 bg-secondary-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <FileText className="h-5 w-5 text-secondary-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-secondary-900">Arraste seu CSV aqui</p>
                    <p className="text-sm text-secondary-600">
                      ou{' '}
                      <button type="button" onClick={onPickFile} className="text-primary-700 underline">
                        selecione do computador
                      </button>
                      .
                    </p>

                    {importFile ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white p-3 border border-secondary-200">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-secondary-900 truncate">{importFile.name}</p>
                          <p className="text-xs text-secondary-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          className="btn-outline text-sm"
                          onClick={onClearFile}
                          disabled={importing}
                        >
                          Trocar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {importResult ? (
                <div className="mt-4 rounded-lg border border-secondary-200 bg-white p-3 text-sm">
                  <p className="font-semibold text-secondary-900">{importResult.message}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-secondary-50 p-2">
                      <p className="text-xs text-secondary-600">Criados</p>
                      <p className="text-lg font-bold text-secondary-900">{importResult.created}</p>
                    </div>
                    <div className="rounded-lg bg-secondary-50 p-2">
                      <p className="text-xs text-secondary-600">Atualizados</p>
                      <p className="text-lg font-bold text-secondary-900">{importResult.updated}</p>
                    </div>
                    <div className="rounded-lg bg-secondary-50 p-2">
                      <p className="text-xs text-secondary-600">Ignorados</p>
                      <p className="text-lg font-bold text-secondary-900">{importResult.skipped}</p>
                    </div>
                  </div>

                  {/* Aviso inline se o dia atual tem duplicados */}
                  {duplicatesInfo.extras > 0 ? (
                    <div className="mt-3 rounded-lg border border-warning/30 bg-warning-light/30 p-3 text-sm text-secondary-900 flex gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                      <div className="flex-1">
                        <p className="font-semibold">Duplicados detectados no dia selecionado</p>
                        <p className="text-secondary-700">
                          Encontramos <b>{duplicatesInfo.groups}</b> grupo(s) com duplicidade e{' '}
                          <b>{duplicatesInfo.extras}</b> registro(s) a remover.
                        </p>
                        <button
                          type="button"
                          className="mt-2 btn-outline text-sm"
                          onClick={onCleanDupesNow}
                          disabled={cleaningDupes}
                        >
                          {cleaningDupes ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          Limpar duplicados agora
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {importResult.errors?.length ? (
                    <div className="mt-3">
                      <p className="font-semibold text-secondary-900">Erros (até 50):</p>
                      <ul className="mt-2 max-h-40 overflow-auto list-disc pl-5 text-xs text-secondary-700">
                        {importResult.errors.map((e, i) => (
                          <li key={`${e.line}-${i}`}>
                            Linha {e.line}: {e.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={importing}>
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={onRunImport}
                  disabled={importing || !importFile}
                  className="btn-primary flex-1"
                >
                  {importing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  Importar
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
