/**
 * Card de exibição de consulta na listagem
 */

import { motion } from 'framer-motion';
import {
  Stethoscope,
  User,
  Calendar,
  Clock,
  FileText,
  Pill,
  FlaskConical,
  Edit2,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import type { Consulta, ConsultaResumo } from '@/features/consultas/types/consultas.types';

interface ConsultaCardProps {
  consulta: Consulta | ConsultaResumo;
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
}

function fmtCpf(cpf: number | string | null) {
  if (!cpf) return '-';
  const d = String(cpf).replace(/\D/g, '').slice(0, 11);
  if (d.length !== 11) return String(cpf);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function ConsultaCard({
  consulta,
  index,
  onEdit,
  onDelete,
  onView,
}: ConsultaCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Detecta se é resumo ou completo
  const isResumo = !('paciente' in consulta);
  const anamnese = 'anamnese' in consulta ? consulta.anamnese : null;
  const anamneseResumo = 'anamnese_resumo' in consulta ? consulta.anamnese_resumo : null;
  const textoAnamnese = anamnese || anamneseResumo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="card hover:shadow-md transition-shadow"
    >
      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-purple-100 rounded-xl flex-shrink-0">
          <Stethoscope className="h-6 w-6 text-purple-700" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Tipo e data */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
              {consulta.tipo || 'Consulta'}
            </span>
            <div className="flex items-center gap-1 text-sm text-secondary-500">
              <Calendar className="h-3.5 w-3.5" />
              {consulta.data_br || consulta.data || '-'}
            </div>
            {consulta.hora && (
              <div className="flex items-center gap-1 text-sm text-secondary-500">
                <Clock className="h-3.5 w-3.5" />
                {consulta.hora}
              </div>
            )}
          </div>

          {/* Paciente */}
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-secondary-400" />
            <span className="font-semibold text-secondary-900">
              {consulta.nome_paciente || 'Paciente não informado'}
            </span>
            <span className="text-sm text-secondary-500">
              CPF: {fmtCpf(consulta.cpf_paciente)}
            </span>
          </div>

          {/* Médico */}
          <div className="flex items-center gap-2 text-sm text-secondary-600">
            <Stethoscope className="h-3.5 w-3.5" />
            <span>
              Dr(a). {consulta.nome_medico || '-'}
              {consulta.crm_medico && ` (CRM ${consulta.crm_medico})`}
            </span>
          </div>

          {/* Diagnóstico se tiver */}
          {'diagnostico' in consulta && consulta.diagnostico && (
            <div className="mt-2 text-sm">
              <span className="font-medium text-secondary-700">Diagnóstico: </span>
              <span className="text-secondary-600">{consulta.diagnostico}</span>
            </div>
          )}

          {/* Flags */}
          <div className="flex items-center gap-3 mt-2">
            {'houve_solicitacao_de_exame' in consulta && consulta.houve_solicitacao_de_exame && (
              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                <FlaskConical className="h-3 w-3" />
                Exames solicitados
              </span>
            )}
            {'houve_prescricao_medicamentos' in consulta && consulta.houve_prescricao_medicamentos && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                <Pill className="h-3 w-3" />
                Medicamentos prescritos
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onView && (
            <button
              onClick={onView}
              className="p-2 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
              title="Visualizar"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
              title="Editar"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Anamnese (expansível) */}
      {textoAnamnese && (
        <div className="mt-3 pt-3 border-t">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 transition"
          >
            <FileText className="h-4 w-4" />
            <span className="font-medium">Anamnese</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <motion.div
            initial={false}
            animate={{ height: expanded ? 'auto' : '3rem', overflow: 'hidden' }}
            className="mt-2"
          >
            <p className={`text-sm text-secondary-700 whitespace-pre-wrap ${
              !expanded ? 'line-clamp-2' : ''
            }`}>
              {textoAnamnese}
            </p>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// Versão compacta para listagem densa
export function ConsultaListItem({
  consulta,
  onEdit,
  onDelete,
}: {
  consulta: Consulta | ConsultaResumo;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-secondary-200 hover:bg-secondary-50 transition">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Stethoscope className="h-4 w-4 text-purple-700" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-secondary-900 truncate">
            {consulta.nome_paciente || 'Paciente'}
          </p>
          <div className="flex items-center gap-2 text-xs text-secondary-500">
            <span>{consulta.tipo || 'Consulta'}</span>
            <span>•</span>
            <span>{consulta.data_br || consulta.data}</span>
            <span>•</span>
            <span>Dr(a). {consulta.nome_medico || '-'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onEdit && (
          <button onClick={onEdit} className="btn-ghost btn-sm">
            <Edit2 className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="btn-ghost btn-sm text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}