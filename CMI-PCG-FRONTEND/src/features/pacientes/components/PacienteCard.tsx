import { initialFrom } from "@/utils/initials";
/**
 * Card de Paciente — theme-aware, responsive, com tooltips
 */

import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Building2,
  Heart,
  Trash2,
  ClipboardList,
  FileText,
} from "lucide-react";
import type { Paciente, NivelFidelidade } from "../types";
import { getNivelFidelidadeConfig } from "../hooks";

// ── Badge de Fidelidade ──
interface FidelidadeBadgeProps {
  nivel: NivelFidelidade;
  pontos?: number;
  showPontos?: boolean;
}

export function FidelidadeBadge({
  nivel,
  pontos,
  showPontos = false,
}: FidelidadeBadgeProps) {
  const config = getNivelFidelidadeConfig(nivel);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      title={showPontos && pontos ? `${pontos} pontos` : config.label}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {showPontos && pontos !== undefined && (
        <span className="text-[10px] opacity-75">({pontos}pts)</span>
      )}
    </span>
  );
}

// ── Helpers ──
function renderEndereco(p: Paciente): string | null {
  if (p.endereco_compacto) return p.endereco_compacto;
  const parts: string[] = [];
  if (p.logradouro) {
    let line = p.logradouro;
    if (p.numero) line += `, ${p.numero}`;
    parts.push(line);
  }
  if (p.bairro) parts.push(p.bairro);
  if (p.cidade || p.uf)
    parts.push([p.cidade, p.uf].filter(Boolean).join(" - "));
  if (parts.length > 0) return parts.join(" | ");
  return p.endereco || null;
}

// ── Props ──
interface PacienteCardProps {
  paciente: Paciente;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onProntuario?: () => void;
  onFicha?: () => void;
  showFidelidade?: boolean;
  index?: number;
}

// ── Component ──
export function PacienteCard({
  paciente,
  onClick,
  onEdit,
  onDelete,
  onProntuario,
  onFicha,
  showFidelidade = true,
  index = 0,
}: PacienteCardProps) {
  const endereco = renderEndereco(paciente);
  const frequencia = paciente.frequencia;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="card-interactive flex flex-col"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="avatar-lg shrink-0">
          {initialFrom(paciente?.nome, "P")}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="text-base font-semibold text-text-100 truncate"
              title={paciente.nome}
            >
              {paciente.nome}
            </h3>
            {showFidelidade && frequencia && (
              <FidelidadeBadge
                nivel={frequencia.nivel_fidelidade}
                pontos={frequencia.pontos_fidelidade}
              />
            )}
          </div>

          <p className="text-sm text-text-200">{paciente.cpf}</p>

          {paciente.empresa?.nome && (
            <div className="flex items-center gap-1 mt-1">
              <Building2 className="h-3 w-3 text-primary-100 shrink-0" />
              <span
                className="text-xs text-text-200 truncate"
                title={paciente.empresa.nome}
              >
                {paciente.empresa.nome}
              </span>
            </div>
          )}

          {paciente.convenio?.nome && (
            <div className="flex items-center gap-1 mt-0.5">
              <Heart className="h-3 w-3 text-danger shrink-0" />
              <span
                className="text-xs text-text-200 truncate"
                title={paciente.convenio.nome}
              >
                {paciente.convenio.nome}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5 flex-1">
        {paciente.numero_de_contato && (
          <div className="flex items-center gap-2 text-sm text-text-200">
            <Phone className="h-3.5 w-3.5 text-primary-100 shrink-0" />
            <span>{paciente.numero_de_contato}</span>
          </div>
        )}

        {paciente.email && (
          <div className="flex items-center gap-2 text-sm text-text-200">
            <Mail className="h-3.5 w-3.5 text-primary-100 shrink-0" />
            <span className="truncate" title={paciente.email}>
              {paciente.email}
            </span>
          </div>
        )}

        {endereco && (
          <div className="flex items-center gap-2 text-sm text-text-200">
            <MapPin className="h-3.5 w-3.5 text-primary-100 shrink-0" />
            <span className="truncate" title={endereco}>
              {endereco}
            </span>
          </div>
        )}

        {frequencia && frequencia.total_consultas > 0 && (
          <div className="flex items-center gap-2 text-sm text-text-200 mt-2 pt-2 border-t border-bg-300">
            <ClipboardList className="h-3.5 w-3.5 text-text-200 shrink-0" />
            <span>
              {frequencia.total_consultas} consulta
              {frequencia.total_consultas !== 1 ? "s" : ""}
              {frequencia.ultima_consulta && (
                <span className="text-xs ml-1">
                  • última em{" "}
                  {new Date(frequencia.ultima_consulta).toLocaleDateString(
                    "pt-BR",
                  )}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 mt-3 pt-3 border-t border-bg-300"
        onClick={(e) => e.stopPropagation()}
      >
        {onProntuario && (
          <button
            className="btn-secondary flex-1 text-xs"
            onClick={onProntuario}
            title="Ver prontuário"
          >
            <ClipboardList className="h-3.5 w-3.5" /> Prontuário
          </button>
        )}
        {onFicha && (
          <button
            className="btn-outline flex-1 text-xs"
            onClick={onFicha}
            title="Ver ficha"
          >
            <FileText className="h-3.5 w-3.5" /> Ficha
          </button>
        )}
        {onEdit && (
          <button
            className="btn-outline flex-1 text-xs"
            onClick={onEdit}
            title="Editar paciente"
          >
            Editar
          </button>
        )}
        {onDelete && (
          <button
            className="btn-danger text-xs px-2.5"
            onClick={onDelete}
            title="Excluir paciente"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Versão compacta para listas ──
interface PacienteListItemProps {
  paciente: Paciente;
  onClick?: () => void;
  onEdit?: () => void;
  showFidelidade?: boolean;
}

export function PacienteListItem({
  paciente,
  onClick,
  onEdit,
  showFidelidade = true,
}: PacienteListItemProps) {
  const frequencia = paciente.frequencia;

  return (
    <div
      className="flex items-center gap-4 p-3 bg-bg-100 rounded-xl border border-bg-300 hover:border-primary-200 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="avatar-md shrink-0">
        {initialFrom(paciente?.nome, "P")}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-medium text-text-100 truncate"
            title={paciente.nome}
          >
            {paciente.nome}
          </span>
          {showFidelidade && frequencia && (
            <FidelidadeBadge nivel={frequencia.nivel_fidelidade} />
          )}
        </div>
        <span className="text-sm text-text-200">{paciente.cpf}</span>
      </div>

      {paciente.empresa?.nome && (
        <span
          className="hidden md:block text-sm text-text-200 truncate max-w-[150px]"
          title={paciente.empresa.nome}
        >
          {paciente.empresa.nome}
        </span>
      )}

      {onEdit && (
        <button
          className="btn-ghost text-sm shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Editar paciente"
        >
          Editar
        </button>
      )}
    </div>
  );
}

export default PacienteCard;
