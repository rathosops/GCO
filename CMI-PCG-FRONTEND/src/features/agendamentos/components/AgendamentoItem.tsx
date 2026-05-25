import { useState } from "react";
import { initialFrom } from "@/utils/initials";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Agendamento } from "@/types";
import {
  normalizeHora,
  statusFromAgendamento,
  statusOptions,
} from "../utils/agendamentos.helpers";
import { comprovanteAPI } from "@/services/feriados.api";

type Props = {
  ag: Agendamento;
  index: number;
  updatingId: number | null;

  onEdit: (ag: Agendamento) => void;
  onDelete: (ag: Agendamento) => void;

  onCompareceu: (ag: Agendamento) => void;
  onFaltou: (ag: Agendamento) => void;
  onLimpar: (ag: Agendamento) => void;
};

function getStatusConfig(status?: string) {
  return statusOptions.find((s) => s.value === status) || statusOptions[0];
}

export function AgendamentoItem({
  ag,
  index,
  updatingId,
  onEdit,
  onDelete,
  onCompareceu,
  onFaltou,
  onLimpar,
}: Props) {
  const st = statusFromAgendamento(ag);
  const status = getStatusConfig(st);
  const isUpdating = updatingId === ag.id;

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadComprovante = async () => {
    if (!ag.id || downloadingPdf) return;

    try {
      setDownloadingPdf(true);
      const blob = await comprovanteAPI.downloadPdf(ag.id);

      // Cria link para download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Nome do arquivo: comprovante_NOME_DATA_HORA.pdf
      const nomeArquivo = `comprovante_${(ag.nome_paciente || "paciente")
        .replace(/\s+/g, "_")
        .substring(
          0,
          20,
        )}_${ag.dia}_${normalizeHora(ag.hora).replace(":", "h")}.pdf`;

      link.setAttribute("download", nomeArquivo);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar comprovante:", error);
      alert("Erro ao baixar comprovante. Tente novamente.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <motion.div
      key={ag.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-secondary-50 rounded-xl hover:bg-secondary-100 transition-colors"
    >
      <div className="flex items-center justify-between md:justify-start gap-4">
        <div className="flex items-center gap-2 min-w-[90px]">
          <Clock className="h-4 w-4 text-primary-500" />
          <span className="text-lg font-bold text-secondary-900">
            {normalizeHora(ag.hora)}
          </span>
        </div>

        <div className="md:hidden">
          <div className={`badge ${status.color}`}>{status.label}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="avatar-md">{initialFrom(ag?.nome_paciente, "P")}</div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-secondary-900 truncate">
            {ag.nome_paciente || "Paciente não informado"}
          </p>
          <p className="text-sm text-secondary-500 truncate">
            {ag.procedimento || "—"}
          </p>

          {ag.numero_de_contato ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-secondary-500">
              <Phone className="h-3 w-3" />
              <span>{String(ag.numero_de_contato)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden md:block">
        <div className={`badge ${status.color}`}>{status.label}</div>
      </div>

      <div className="flex items-center gap-2 justify-end flex-wrap">
        {/* Botão Comprovante PDF */}
        <button
          className="btn-outline text-sm"
          onClick={handleDownloadComprovante}
          disabled={downloadingPdf || !ag.id}
          type="button"
          title="Baixar comprovante PDF"
        >
          {downloadingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden lg:inline">PDF</span>
        </button>

        <button
          className="btn-secondary text-sm"
          onClick={() => onEdit(ag)}
          type="button"
          title="Editar agendamento"
        >
          <Pencil className="h-4 w-4" />
          <span className="hidden sm:inline">Editar</span>
        </button>

        <button
          className="btn-outline text-sm"
          onClick={() => onDelete(ag)}
          type="button"
          title="Excluir agendamento"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          className={`btn-secondary text-sm ${ag.paciente_compareceu === true ? "ring-2 ring-success/30" : ""}`}
          onClick={() => onCompareceu(ag)}
          disabled={isUpdating}
          title="Marcar como compareceu"
          type="button"
        >
          {isUpdating && ag.paciente_compareceu !== true ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success" />
          )}
          <span className="hidden sm:inline">Compareceu</span>
        </button>

        <button
          className={`btn-secondary text-sm ${ag.paciente_compareceu === false ? "ring-2 ring-warning/30" : ""}`}
          onClick={() => onFaltou(ag)}
          disabled={isUpdating}
          title="Marcar como faltou"
          type="button"
        >
          {isUpdating && ag.paciente_compareceu !== false ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4 text-warning" />
          )}
          <span className="hidden sm:inline">Faltou</span>
        </button>

        <button
          className="btn-outline text-sm"
          onClick={() => onLimpar(ag)}
          disabled={isUpdating}
          title="Limpar marcação"
          type="button"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
