import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { procedimentosDisponiveis } from '../utils/agendamentos.helpers';

type FormState = {
  nome_paciente: string;
  cpf_paciente: string;
  numero_de_contato: string;
  numero_de_protocolo: string;
  procedimento: string;
  hora: string;
  observacoes: string;
};

type Props = {
  isOpen: boolean;
  title: string;

  hasConflict: boolean;
  horaNormalizada: string;

  saving: boolean;

  formData: FormState;
  fieldErrors: { nome_paciente?: string; hora?: string };
  formError: string;

  onClose: () => void;

  onChange: (next: FormState) => void;
  onTouched: (patch: { nome_paciente?: boolean; hora?: boolean }) => void;

  onSubmit: (e: React.FormEvent) => void;
};

export function AgendamentoModal({
  isOpen,
  title,

  hasConflict,
  horaNormalizada,

  saving,

  formData,
  fieldErrors,
  formError,

  onClose,
  onChange,
  onTouched,
  onSubmit,
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
                <h3 className="text-xl font-bold text-secondary-900">{title}</h3>
                <button onClick={onClose} className="btn-icon btn-ghost" type="button">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {hasConflict ? (
                <div className="mb-4 rounded-lg border border-warning/30 bg-warning-light/30 p-3 text-sm text-secondary-900 flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                  <div>
                    <p className="font-semibold">Atenção: horário já utilizado</p>
                    <p className="text-secondary-700">
                      Já existe pelo menos um agendamento às <b>{horaNormalizada}</b> neste dia. Você ainda pode salvar
                      normalmente.
                    </p>
                  </div>
                </div>
              ) : null}

              {formError ? (
                <div className="mb-4 rounded-lg bg-danger-light/30 border border-danger/20 p-3 text-sm text-danger-dark">
                  {formError}
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="label">Nome do Paciente *</label>
                  <input
                    type="text"
                    value={formData.nome_paciente}
                    onChange={(e) => onChange({ ...formData, nome_paciente: e.target.value })}
                    onBlur={() => onTouched({ nome_paciente: true })}
                    className="input"
                    placeholder="Nome completo"
                    required
                  />
                  {fieldErrors.nome_paciente ? (
                    <p className="mt-1 text-xs text-danger-dark">{fieldErrors.nome_paciente}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">CPF</label>
                    <input
                      type="text"
                      value={formData.cpf_paciente}
                      onChange={(e) => onChange({ ...formData, cpf_paciente: e.target.value })}
                      className="input"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input
                      type="text"
                      value={formData.numero_de_contato}
                      onChange={(e) => onChange({ ...formData, numero_de_contato: e.target.value })}
                      className="input"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Horário *</label>
                    <input
                      type="time"
                      value={formData.hora}
                      onChange={(e) => onChange({ ...formData, hora: e.target.value })}
                      onBlur={() => onTouched({ hora: true })}
                      className="input"
                      required
                    />
                    {fieldErrors.hora ? (
                      <p className="mt-1 text-xs text-danger-dark">{fieldErrors.hora}</p>
                    ) : (
                      <p className="mt-1 text-xs text-secondary-500">Escolha qualquer horário (HH:MM)</p>
                    )}
                  </div>

                  <div>
                    <label className="label">Procedimento</label>
                    <select
                      value={formData.procedimento}
                      onChange={(e) => onChange({ ...formData, procedimento: e.target.value })}
                      className="select"
                    >
                      {procedimentosDisponiveis.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Protocolo</label>
                  <input
                    type="text"
                    value={formData.numero_de_protocolo}
                    onChange={(e) => onChange({ ...formData, numero_de_protocolo: e.target.value })}
                    className="input"
                    placeholder="Número do protocolo (opcional)"
                  />
                </div>

                <div>
                  <label className="label">Observações</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => onChange({ ...formData, observacoes: e.target.value })}
                    className="input min-h-[80px]"
                    placeholder="Observações adicionais..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={onClose} className="btn-secondary flex-1">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1">
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
