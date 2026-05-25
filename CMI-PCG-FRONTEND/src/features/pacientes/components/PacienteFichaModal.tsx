/**
 * Modal de Ficha do Paciente — theme-aware
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  ClipboardList,
  Loader2,
  FileText,
  Award,
} from "lucide-react";
import type { Paciente } from "../types";
import { FidelidadeBadge } from "./PacienteCard";

function renderEndereco(p: Paciente): string {
  if (p.endereco_compacto) return p.endereco_compacto;
  const parts: string[] = [];
  if (p.logradouro) {
    let line = p.logradouro;
    if (p.numero) line += `, ${p.numero}`;
    if (p.complemento) line += ` (${p.complemento})`;
    parts.push(line);
  }
  if (p.bairro) parts.push(p.bairro);
  if (p.cidade || p.uf)
    parts.push([p.cidade, p.uf].filter(Boolean).join(" - "));
  if (p.cep) parts.push(`CEP ${p.cep}`);
  if (parts.length > 0) return parts.join(" | ");
  return p.endereco || "-";
}

function getProtocoloImesc(p: Paciente): string | null {
  const raw = (p.protocolo_imesc || "").trim();
  return raw.length > 0 ? raw : null;
}

interface PacienteFichaModalProps {
  isOpen: boolean;
  onClose: () => void;
  paciente: Paciente | null;
  onDownloadFicha?: () => void;
  onProntuario?: () => void;
  downloadingFicha?: boolean;
}

export function PacienteFichaModal({
  isOpen,
  onClose,
  paciente,
  onDownloadFicha,
  onProntuario,
  downloadingFicha = false,
}: PacienteFichaModalProps) {
  if (!isOpen || !paciente) return null;

  const frequencia = paciente.frequencia;
  const protocoloImesc = getProtocoloImesc(paciente);

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
              className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-300 rounded-xl">
                    <FileText className="h-5 w-5 text-primary-100" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-100">
                      Ficha do Paciente
                    </h3>
                    <p className="text-sm text-text-200">{paciente.nome}</p>
                  </div>
                </div>
                <button onClick={onClose} className="btn-icon btn-ghost">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Dados básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: "CPF", value: paciente.cpf },
                    {
                      label: "Nascimento",
                      value: `${paciente.data_de_nascimento_br || paciente.data_de_nascimento || "-"}${paciente.idade !== undefined ? ` (${paciente.idade} anos)` : ""}`,
                    },
                    {
                      label: "Sexo",
                      value:
                        paciente.sexo === "M"
                          ? "Masculino"
                          : paciente.sexo === "F"
                            ? "Feminino"
                            : "-",
                    },
                    {
                      label: "Telefone",
                      value: paciente.numero_de_contato || "-",
                    },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-xl bg-bg-200">
                      <p className="text-xs text-text-200">{item.label}</p>
                      <p className="font-semibold text-text-100 text-sm">
                        {item.value}
                      </p>
                    </div>
                  ))}
                  <div className="p-3 rounded-xl bg-bg-200 md:col-span-2">
                    <p className="text-xs text-text-200">Email</p>
                    <p
                      className="font-semibold text-text-100 text-sm truncate"
                      title={paciente.email || "-"}
                    >
                      {paciente.email || "-"}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-bg-200 md:col-span-2">
                    <p className="text-xs text-text-200">Endereço</p>
                    <p
                      className="font-semibold text-text-100 text-sm"
                      title={renderEndereco(paciente)}
                    >
                      {renderEndereco(paciente)}
                    </p>
                  </div>
                </div>

                {/* Vínculos */}
                {(paciente.empresa || paciente.convenio) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {paciente.empresa && (
                      <div className="p-3 rounded-xl bg-primary-300 border border-primary-200/30">
                        <p className="text-xs text-primary-100 font-medium">
                          Empresa
                        </p>
                        <p className="font-semibold text-text-100 text-sm">
                          {paciente.empresa.nome}
                        </p>
                        <p className="text-xs text-text-200">
                          CNPJ: {paciente.empresa.cnpj}
                        </p>
                      </div>
                    )}
                    {paciente.convenio && (
                      <div className="p-3 rounded-xl bg-danger-light border-semantic-danger">
                        <p className="text-xs text-danger font-medium">
                          Convênio
                        </p>
                        <p className="font-semibold text-text-100 text-sm">
                          {paciente.convenio.nome}
                        </p>
                        <p className="text-xs text-text-200">
                          CNPJ: {paciente.convenio.cnpj}
                        </p>
                        {protocoloImesc && (
                          <p className="text-xs text-text-200 mt-1">
                            Protocolo IMESC:{" "}
                            <span className="font-medium">
                              {protocoloImesc}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Fidelidade */}
                {frequencia && (
                  <div className="card bg-warning-light border-semantic-warning">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-warning" />
                        <span className="font-medium text-text-100">
                          Programa de Fidelidade
                        </span>
                      </div>
                      <FidelidadeBadge
                        nivel={frequencia.nivel_fidelidade}
                        pontos={frequencia.pontos_fidelidade}
                        showPontos
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div>
                        <p className="text-2xl font-bold text-text-100">
                          {frequencia.total_consultas}
                        </p>
                        <p className="text-xs text-text-200">Total</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-text-100">
                          {frequencia.consultas_ultimo_ano}
                        </p>
                        <p className="text-xs text-text-200">Último ano</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-text-100">
                          {frequencia.pontos_fidelidade}
                        </p>
                        <p className="text-xs text-text-200">Pontos</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-100">
                          {frequencia.ultima_consulta
                            ? new Date(
                                frequencia.ultima_consulta,
                              ).toLocaleDateString("pt-BR")
                            : "-"}
                        </p>
                        <p className="text-xs text-text-200">Última visita</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-3 pt-2">
                  {onProntuario && (
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={onProntuario}
                    >
                      <ClipboardList className="h-4 w-4" /> Ver Prontuário
                    </button>
                  )}
                  {onDownloadFicha && (
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      onClick={onDownloadFicha}
                      disabled={downloadingFicha}
                    >
                      {downloadingFicha ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}{" "}
                      Baixar Ficha (PDF)
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PacienteFichaModal;
