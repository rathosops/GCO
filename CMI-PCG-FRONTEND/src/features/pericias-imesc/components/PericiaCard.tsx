import { initialFrom } from "@/utils/initials";
import { motion } from "framer-motion";
import {
  Clock,
  FileText,
  Stethoscope,
  Download,
  Edit,
  Trash2,
  UserCheck,
  Eye,
  Calendar,
  MessageSquare,
} from "lucide-react";
import type { PericiaIMESC } from "../types";
import { STATUS_LABELS, STATUS_COLORS } from "../types";

interface PericiaCardProps {
  pericia: PericiaIMESC;
  index?: number;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onParecerSocial?: () => void;
  onParecerMedico?: () => void;
  onDownloadPdf?: () => void;
}

export function PericiaCard({
  pericia,
  index = 0,
  onView,
  onEdit,
  onDelete,
  onParecerSocial,
  onParecerMedico,
  onDownloadPdf,
}: PericiaCardProps) {
  const statusStyle = STATUS_COLORS[pericia.status];

  const getProgressPercent = () => {
    switch (pericia.status) {
      case "aguardando_triagem": return 33;
      case "aguardando_medico": return 66;
      case "concluido": return 100;
      case "cancelado": return 0;
      default: return 0;
    }
  };

  const getProgressColor = () => {
    switch (pericia.status) {
      case "aguardando_triagem": return "bg-yellow-500";
      case "aguardando_medico": return "bg-blue-500";
      case "concluido": return "bg-green-500";
      case "cancelado": return "bg-red-500";
      default: return "bg-secondary-300";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card card-hover flex flex-col h-full group"
    >
      {/* Progress bar sutil no topo */}
      <div className="h-1 -mx-4 -mt-4 mb-4 bg-secondary-100 rounded-t-xl overflow-hidden">
        <div 
          className={`h-full ${getProgressColor()} transition-all duration-500`}
          style={{ width: `${getProgressPercent()}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div 
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          onClick={onView}
        >
          <div className="avatar-md bg-teal-100 text-teal-700 flex-shrink-0">
            {initialFrom(pericia?.nome_paciente, "P")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-secondary-900 truncate group-hover:text-primary-100 transition-colors">
              {pericia.nome_paciente || "Paciente"}
            </p>
            <p className="text-xs text-secondary-500 truncate flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {pericia.protocolo}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle.bg} ${statusStyle.text}`}>
          {STATUS_LABELS[pericia.status]}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-2 text-sm text-secondary-600 mb-4 flex-1">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-secondary-400 flex-shrink-0" />
          <span className="truncate">
            {pericia.data_pericia_br || pericia.data_pericia}
            {pericia.hora_pericia && (
              <span className="text-secondary-400"> às {pericia.hora_pericia}</span>
            )}
          </span>
        </div>

        {/* Triagem Social */}
        <div className="flex items-start gap-2">
          <UserCheck className={`h-4 w-4 flex-shrink-0 mt-0.5 ${pericia.parecer_social ? "text-green-500" : "text-secondary-300"}`} />
          <div className="min-w-0 flex-1">
            {pericia.parecer_social ? (
              <>
                <span className="text-green-600 block text-xs font-medium">Triagem realizada</span>
                {pericia.nome_assistente && (
                  <span className="text-xs text-secondary-500 truncate block">
                    {pericia.nome_assistente}
                    {pericia.cress_assistente && ` · CRESS: ${pericia.cress_assistente}`}
                  </span>
                )}
              </>
            ) : (
              <span className="text-secondary-400 text-xs">Aguardando triagem</span>
            )}
          </div>
        </div>

        {/* Parecer Médico */}
        <div className="flex items-start gap-2">
          <Stethoscope className={`h-4 w-4 flex-shrink-0 mt-0.5 ${pericia.parecer_medico ? "text-blue-500" : "text-secondary-300"}`} />
          <div className="min-w-0 flex-1">
            {pericia.parecer_medico ? (
              <>
                <span className="text-blue-600 block text-xs font-medium">Parecer médico concluído</span>
                {pericia.nome_medico && (
                  <span className="text-xs text-secondary-500 truncate block">
                    Dr(a). {pericia.nome_medico}
                  </span>
                )}
                {pericia.cid && (
                  <span className="text-xs text-secondary-400 block">CID: {pericia.cid}</span>
                )}
              </>
            ) : (
              <span className="text-secondary-400 text-xs">
                {pericia.parecer_social ? "Aguardando parecer" : "Pendente"}
              </span>
            )}
          </div>
        </div>

        {/* Preview do parecer social */}
        {pericia.parecer_social && (
          <div className="mt-2 p-2 bg-green-50/50 rounded-lg border border-green-100">
            <p className="text-xs text-green-700 line-clamp-2">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              {pericia.parecer_social.slice(0, 100)}
              {pericia.parecer_social.length > 100 && "..."}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-secondary-100 mt-auto">
        {onView && (
          <button
            onClick={onView}
            className="btn-secondary text-xs py-1.5 px-2"
            title="Ver detalhes"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Detalhes</span>
          </button>
        )}

        {pericia.status === "aguardando_triagem" && onParecerSocial && (
          <button
            onClick={onParecerSocial}
            className="btn-primary text-xs py-1.5 px-2 bg-green-600 hover:bg-green-700"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Triagem</span>
          </button>
        )}

        {pericia.status === "aguardando_medico" && onParecerMedico && (
          <button
            onClick={onParecerMedico}
            className="btn-primary text-xs py-1.5 px-2"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Parecer</span>
          </button>
        )}

        {pericia.status === "concluido" && onDownloadPdf && (
          <button
            onClick={onDownloadPdf}
            className="btn-secondary text-xs py-1.5 px-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">PDF</span>
          </button>
        )}

        <div className="flex-1" />

        {onEdit && (
          <button
            onClick={onEdit}
            className="btn-ghost text-xs py-1.5 px-2"
            title="Editar"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
        )}

        {onDelete && (
          <button
            onClick={onDelete}
            className="btn-ghost text-xs py-1.5 px-2 text-red-600 hover:bg-red-50"
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default PericiaCard;
