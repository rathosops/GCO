/**
 * Modal de Prontuário do Paciente — theme-aware
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Loader2,
  Stethoscope,
  Calendar,
  Clock,
  Pill,
  FileSearch,
  AlertCircle,
} from "lucide-react";
import type {
  Paciente,
  ProntuarioResponse,
  ProntuarioConsulta,
} from "../types";

// ── Item de Consulta ──
function ConsultaItem({
  consulta,
  index,
}: {
  consulta: ProntuarioConsulta;
  index: number;
}) {
  const dataConsulta = consulta.data_consulta || consulta.data;
  const data = dataConsulta
    ? new Date(dataConsulta).toLocaleDateString("pt-BR")
    : "-";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pl-8 pb-6 border-l-2 border-primary-200 last:border-l-transparent"
    >
      <div className="absolute left-[-9px] top-0 w-4 h-4 bg-primary-100 rounded-full border-2 border-bg-100" />
      <div className="card bg-bg-200">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-300 text-primary-100 rounded-lg text-sm font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {data}
          </span>
          {consulta.tipo && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-bg-300 text-text-100 rounded-lg text-sm">
              {consulta.tipo}
            </span>
          )}
          {consulta.profissional && (
            <span className="text-sm text-text-200">
              Dr(a). {consulta.profissional}
            </span>
          )}
        </div>

        {consulta.queixa_principal && (
          <div className="mb-3">
            <p className="text-xs font-medium text-text-200 uppercase mb-1">
              Queixa Principal
            </p>
            <p className="text-sm text-text-100">{consulta.queixa_principal}</p>
          </div>
        )}
        {consulta.hipotese_diagnostica && (
          <div className="mb-3">
            <p className="text-xs font-medium text-text-200 uppercase mb-1">
              Hipótese Diagnóstica
            </p>
            <p className="text-sm text-text-100">
              {consulta.hipotese_diagnostica}
            </p>
          </div>
        )}
        {consulta.conduta && (
          <div className="mb-3">
            <p className="text-xs font-medium text-text-200 uppercase mb-1">
              Conduta
            </p>
            <p className="text-sm text-text-100">{consulta.conduta}</p>
          </div>
        )}
        {consulta.prescricao && (
          <div className="flex items-start gap-2 p-2 bg-warning-light rounded-lg">
            <Pill className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-warning uppercase mb-0.5">
                Prescrição
              </p>
              <p className="text-sm text-text-100">{consulta.prescricao}</p>
            </div>
          </div>
        )}
        {consulta.exames_solicitados &&
          consulta.exames_solicitados.length > 0 && (
            <div className="mt-3 flex items-start gap-2">
              <FileSearch className="h-4 w-4 text-primary-100 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-primary-100 uppercase mb-1">
                  Exames Solicitados
                </p>
                <ul className="text-sm text-text-200 list-disc list-inside">
                  {consulta.exames_solicitados.map((ex: string, i: number) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
      </div>
    </motion.div>
  );
}

// ── Props ──
interface PacienteProntuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  paciente: Paciente | null;
  prontuario: ProntuarioResponse | null;
  loading?: boolean;
  onDownload?: () => void;
  downloading?: boolean;
}

// ── Component ──
export function PacienteProntuarioModal({
  isOpen,
  onClose,
  paciente,
  prontuario,
  loading = false,
  onDownload,
  downloading = false,
}: PacienteProntuarioModalProps) {
  if (!isOpen || !paciente) return null;
  const consultas = prontuario?.consultas || [];
  const getConsultaData = (c: ProntuarioConsulta): string | null =>
    c.data_consulta || c.data || null;

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
              className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-300 rounded-xl">
                    <Stethoscope className="h-5 w-5 text-primary-100" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-100">
                      Prontuário
                    </h3>
                    <p className="text-sm text-text-200">
                      {paciente.nome} • {paciente.cpf}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onDownload && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={onDownload}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}{" "}
                      PDF
                    </button>
                  )}
                  <button onClick={onClose} className="btn-icon btn-ghost">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Resumo */}
              {prontuario && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-primary-300 text-center">
                    <p className="text-2xl font-bold text-primary-100">
                      {consultas.length}
                    </p>
                    <p className="text-xs text-text-200">Consultas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-bg-200 text-center">
                    <p className="text-sm font-semibold text-text-100">
                      {consultas.length > 0 && getConsultaData(consultas[0])
                        ? new Date(
                            getConsultaData(consultas[0])!,
                          ).toLocaleDateString("pt-BR")
                        : "-"}
                    </p>
                    <p className="text-xs text-text-200">Última</p>
                  </div>
                  <div className="p-3 rounded-xl bg-bg-200 text-center">
                    <p className="text-sm font-semibold text-text-100">
                      {consultas.length > 0 &&
                      getConsultaData(consultas[consultas.length - 1])
                        ? new Date(
                            getConsultaData(consultas[consultas.length - 1])!,
                          ).toLocaleDateString("pt-BR")
                        : "-"}
                    </p>
                    <p className="text-xs text-text-200">Primeira</p>
                  </div>
                  <div className="p-3 rounded-xl bg-bg-200 text-center">
                    <p className="text-sm font-semibold text-text-100">
                      {prontuario.paciente?.idade || paciente.idade || "-"}
                    </p>
                    <p className="text-xs text-text-200">Idade</p>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h4 className="flex items-center gap-2 text-base font-semibold text-text-100 mb-4">
                  <Clock className="h-5 w-5 text-primary-100" /> Histórico de
                  Consultas
                </h4>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-100 mb-3" />
                    <p className="text-text-200">Carregando...</p>
                  </div>
                ) : consultas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-bg-300 mb-3" />
                    <p className="text-text-200">
                      Nenhuma consulta registrada.
                    </p>
                  </div>
                ) : (
                  <div className="relative ml-2">
                    {consultas.map((c, i) => (
                      <ConsultaItem key={c.id || i} consulta={c} index={i} />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-bg-300 mt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PacienteProntuarioModal;
