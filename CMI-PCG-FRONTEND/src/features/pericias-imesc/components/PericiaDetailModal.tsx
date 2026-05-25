import { initialFrom } from "@/utils/initials";
import {
  X,
  User,
  FileText,
  Stethoscope,
  UserCheck,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  Download,
  Edit,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PericiaIMESC } from "../types";
import { STATUS_LABELS, STATUS_COLORS } from "../types";

interface PericiaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pericia: PericiaIMESC | null;
  onEdit?: () => void;
  onParecerSocial?: () => void;
  onParecerMedico?: () => void;
  onDownloadPdf?: () => void;
}

type StepStatus = "completed" | "current" | "pending" | "cancelled";

interface TimelineStepProps {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  status: StepStatus;
  content?: React.ReactNode;
  isLast?: boolean;
}

function TimelineStep({
  title,
  subtitle,
  icon: Icon,
  status,
  content,
  isLast = false,
}: TimelineStepProps) {
  const styles: Record<StepStatus, { dot: string; line: string; icon: string; bg: string; border: string }> = {
    completed: {
      dot: "bg-green-500",
      line: "bg-green-300",
      icon: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    current: {
      dot: "bg-blue-500 animate-pulse",
      line: "bg-secondary-200",
      icon: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    pending: {
      dot: "bg-secondary-300",
      line: "bg-secondary-200",
      icon: "text-secondary-400",
      bg: "bg-secondary-50",
      border: "border-secondary-200",
    },
    cancelled: {
      dot: "bg-red-500",
      line: "bg-red-200",
      icon: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
  };

  const style = styles[status];

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-4 h-4 rounded-full ${style.dot} ring-4 ring-white shadow-sm flex-shrink-0`} />
        {!isLast && <div className={`w-0.5 flex-1 min-h-[40px] ${style.line}`} />}
      </div>
      <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
        <div className={`p-4 rounded-xl border ${style.bg} ${style.border}`}>
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`h-4 w-4 ${style.icon}`} />
            <span className="font-semibold text-secondary-900">{title}</span>
          </div>
          {subtitle && <p className="text-xs text-secondary-500 mb-2">{subtitle}</p>}
          {content && <div className="mt-3">{content}</div>}
        </div>
      </div>
    </div>
  );
}

function ParecerBox({ title, text, author, date, color = "secondary" }: {
  title: string;
  text: string;
  author?: string;
  date?: string;
  color?: "green" | "blue" | "secondary";
}) {
  const colors = {
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    secondary: "bg-secondary-50 border-secondary-200",
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[color]}`}>
      <p className="text-xs font-medium text-secondary-500 uppercase mb-1">{title}</p>
      <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{text}</p>
      {(author || date) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-secondary-200/50 text-xs text-secondary-500">
          {author && <span>{author}</span>}
          {author && date && <span>·</span>}
          {date && <span>{date}</span>}
        </div>
      )}
    </div>
  );
}

export function PericiaDetailModal({
  isOpen,
  onClose,
  pericia,
  onEdit,
  onParecerSocial,
  onParecerMedico,
  onDownloadPdf,
}: PericiaDetailModalProps) {
  if (!isOpen || !pericia) return null;

  const statusStyle = STATUS_COLORS[pericia.status];

  const getStepStatus = (step: "triagem" | "medico" | "concluido"): StepStatus => {
    if (pericia.status === "cancelado") return "cancelled";
    
    switch (step) {
      case "triagem":
        return pericia.parecer_social ? "completed" : pericia.status === "aguardando_triagem" ? "current" : "pending";
      case "medico":
        if (pericia.parecer_medico) return "completed";
        if (pericia.status === "aguardando_medico") return "current";
        return "pending";
      case "concluido":
        return pericia.status === "concluido" ? "completed" : "pending";
      default:
        return "pending";
    }
  };

  const formatDateBr = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-secondary-200 bg-gradient-to-r from-teal-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 rounded-xl">
                <ClipboardList className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary-900">
                  Detalhes da Perícia
                </h2>
                <p className="text-xs text-secondary-500">
                  Protocolo: {pericia.protocolo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                {STATUS_LABELS[pericia.status]}
              </span>
              <button onClick={onClose} className="btn-ghost p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna Esquerda - Info + Timeline */}
              <div className="space-y-6">
                {/* Paciente Card */}
                <div className="p-4 bg-secondary-50 rounded-xl border border-secondary-200">
                  <p className="text-xs font-medium text-secondary-500 uppercase mb-3">Paciente</p>
                  <div className="flex items-center gap-3">
                    <div className="avatar-lg bg-teal-100 text-teal-700">
                      {initialFrom(pericia.nome_paciente, "P")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-secondary-900 truncate">
                        {pericia.nome_paciente || "Paciente"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          CPF: {pericia.cpf_paciente}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info da Perícia */}
                <div className="p-4 bg-secondary-50 rounded-xl border border-secondary-200">
                  <p className="text-xs font-medium text-secondary-500 uppercase mb-3">Informações</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-secondary-400" />
                      <div>
                        <p className="text-secondary-500 text-xs">Data</p>
                        <p className="font-medium text-secondary-900">
                          {pericia.data_pericia_br || pericia.data_pericia}
                        </p>
                      </div>
                    </div>
                    {pericia.hora_pericia && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-secondary-400" />
                        <div>
                          <p className="text-secondary-500 text-xs">Hora</p>
                          <p className="font-medium text-secondary-900">{pericia.hora_pericia}</p>
                        </div>
                      </div>
                    )}
                    {pericia.nome_medico && (
                      <div className="flex items-center gap-2 col-span-2">
                        <Stethoscope className="h-4 w-4 text-secondary-400" />
                        <div>
                          <p className="text-secondary-500 text-xs">Médico</p>
                          <p className="font-medium text-secondary-900">Dr(a). {pericia.nome_medico}</p>
                        </div>
                      </div>
                    )}
                    {pericia.cid && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-secondary-400" />
                        <div>
                          <p className="text-secondary-500 text-xs">CID</p>
                          <p className="font-medium text-secondary-900">{pericia.cid}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {pericia.observacoes && (
                    <div className="mt-4 pt-3 border-t border-secondary-200">
                      <p className="text-xs text-secondary-500 mb-1">Observações</p>
                      <p className="text-sm text-secondary-700">{pericia.observacoes}</p>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-xs font-medium text-secondary-500 uppercase mb-4">Fluxo da Perícia</p>
                  <TimelineStep
                    title="Cadastro"
                    subtitle="Perícia registrada no sistema"
                    icon={FileText}
                    status="completed"
                    content={
                      <p className="text-xs text-secondary-500">
                        Criado em: {formatDateBr(pericia.created_at) || "—"}
                      </p>
                    }
                  />
                  <TimelineStep
                    title="Triagem Social"
                    subtitle={pericia.nome_assistente ? `Por: ${pericia.nome_assistente}` : "Aguardando assistente social"}
                    icon={UserCheck}
                    status={getStepStatus("triagem")}
                    content={
                      pericia.parecer_social ? (
                        <p className="text-xs text-secondary-500">
                          Realizada em: {formatDateBr(pericia.data_parecer_social) || "—"}
                        </p>
                      ) : null
                    }
                  />
                  <TimelineStep
                    title="Avaliação Médica"
                    subtitle={pericia.nome_medico ? `Por: Dr(a). ${pericia.nome_medico}` : "Aguardando médico"}
                    icon={Stethoscope}
                    status={getStepStatus("medico")}
                    content={
                      pericia.parecer_medico ? (
                        <p className="text-xs text-secondary-500">
                          Realizada em: {formatDateBr(pericia.data_parecer_medico) || "—"}
                        </p>
                      ) : null
                    }
                  />
                  <TimelineStep
                    title="Conclusão"
                    subtitle={pericia.status === "concluido" ? "Perícia finalizada" : "Pendente"}
                    icon={pericia.status === "concluido" ? CheckCircle : pericia.status === "cancelado" ? XCircle : AlertCircle}
                    status={getStepStatus("concluido")}
                    isLast
                  />
                </div>
              </div>

              {/* Coluna Direita - Pareceres */}
              <div className="space-y-4">
                <p className="text-xs font-medium text-secondary-500 uppercase">Pareceres</p>

                {/* Parecer Social */}
                {pericia.parecer_social ? (
                  <ParecerBox
                    title="Parecer Social"
                    text={pericia.parecer_social}
                    author={pericia.nome_assistente ? `${pericia.nome_assistente} (CRESS: ${pericia.cress_assistente})` : undefined}
                    date={formatDateBr(pericia.data_parecer_social) || undefined}
                    color="green"
                  />
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-secondary-300 bg-secondary-50/50 text-center">
                    <UserCheck className="h-8 w-8 text-secondary-300 mx-auto mb-2" />
                    <p className="text-sm text-secondary-500">Parecer social não registrado</p>
                    {pericia.status === "aguardando_triagem" && onParecerSocial && (
                      <button onClick={onParecerSocial} className="btn-primary btn-sm mt-3">
                        <UserCheck className="h-3.5 w-3.5" />
                        Registrar Triagem
                      </button>
                    )}
                  </div>
                )}

                {/* Parecer Médico */}
                {pericia.parecer_medico ? (
                  <div className="space-y-3">
                    <ParecerBox
                      title="Parecer Médico"
                      text={pericia.parecer_medico}
                      author={pericia.nome_medico ? `Dr(a). ${pericia.nome_medico}` : undefined}
                      date={formatDateBr(pericia.data_parecer_medico) || undefined}
                      color="blue"
                    />
                    {pericia.conclusao_medica && (
                      <ParecerBox
                        title="Conclusão Médica"
                        text={pericia.conclusao_medica}
                        color="blue"
                      />
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-secondary-300 bg-secondary-50/50 text-center">
                    <Stethoscope className="h-8 w-8 text-secondary-300 mx-auto mb-2" />
                    <p className="text-sm text-secondary-500">Parecer médico não registrado</p>
                    {pericia.status === "aguardando_medico" && onParecerMedico && (
                      <button onClick={onParecerMedico} className="btn-primary btn-sm mt-3">
                        <Stethoscope className="h-3.5 w-3.5" />
                        Registrar Parecer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-5 border-t border-secondary-200 bg-secondary-50">
            <div className="flex items-center gap-2">
              {onEdit && (
                <button onClick={onEdit} className="btn-secondary">
                  <Edit className="h-4 w-4" />
                  Editar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pericia.status === "aguardando_triagem" && onParecerSocial && (
                <button onClick={onParecerSocial} className="btn-primary bg-green-600 hover:bg-green-700">
                  <UserCheck className="h-4 w-4" />
                  Triagem Social
                </button>
              )}
              {pericia.status === "aguardando_medico" && onParecerMedico && (
                <button onClick={onParecerMedico} className="btn-primary">
                  <Stethoscope className="h-4 w-4" />
                  Parecer Médico
                </button>
              )}
              {pericia.status === "concluido" && onDownloadPdf && (
                <button onClick={onDownloadPdf} className="btn-primary">
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </button>
              )}
              <button onClick={onClose} className="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PericiaDetailModal;
