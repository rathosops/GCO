/**
 * Card de Médico
 * 
 * Exibe informações resumidas do médico com ações rápidas.
 */

import { motion } from 'framer-motion';
import {
  Stethoscope,
  Award,
  Trash2,
  BarChart3,
  Calendar,
  Users,
} from 'lucide-react';
import type { Medico } from '../types';
import { initialsFromFullName } from "@/utils/initials";


// ============================================
// Props
// ============================================
interface MedicoCardProps {
  medico: Medico;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPerformance?: () => void;
  index?: number;
}


// ============================================
// Component
// ============================================
export function MedicoCard({
  medico,
  onClick,
  onEdit,
  onDelete,
  onPerformance,
  index = 0,
}: MedicoCardProps) {
  const stats = medico.estatisticas;
  const inicial = initialsFromFullName(medico?.nome, "M");
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="card-interactive"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="avatar-xl bg-gradient-to-br from-amber-500 to-amber-600">
          {inicial}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-secondary-900 truncate">
            {medico.nome}
          </h3>
          <p className="text-sm text-secondary-500">{medico.crm_formatado}</p>
          
          {medico.especialidade && (
            <div className="flex items-center gap-1 mt-1">
              <Stethoscope className="h-3 w-3 text-primary-500" />
              <span className="text-xs text-secondary-600">
                {medico.especialidade}
              </span>
            </div>
          )}
          
          {medico.rqe && (
            <div className="flex items-center gap-1 mt-0.5">
              <Award className="h-3 w-3 text-amber-500" />
              <span className="text-xs text-secondary-500">
                RQE: {medico.rqe}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Stats (se disponível) */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-secondary-50 rounded-lg">
          <div className="text-center">
            <p className="text-lg font-bold text-primary-600">
              {stats.total_consultas}
            </p>
            <p className="text-[10px] text-secondary-500 uppercase">Consultas</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">
              {stats.consultas_mes}
            </p>
            <p className="text-[10px] text-secondary-500 uppercase">Este mês</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-purple-600">
              {stats.pacientes_unicos}
            </p>
            <p className="text-[10px] text-secondary-500 uppercase">Pacientes</p>
          </div>
        </div>
      )}
      
      {/* Info adicional */}
      {stats?.ultima_consulta && (
        <div className="flex items-center gap-2 text-sm text-secondary-500 mb-4">
          <Calendar className="h-4 w-4 text-secondary-400" />
          <span>
            Última consulta: {new Date(stats.ultima_consulta).toLocaleDateString('pt-BR')}
          </span>
        </div>
      )}
      
      {/* Actions */}
      <div
        className="flex gap-2 pt-4 border-t border-secondary-100"
        onClick={(e) => e.stopPropagation()}
      >
        {onPerformance && (
          <button
            className="btn-secondary flex-1 text-sm"
            onClick={onPerformance}
            title="Ver performance"
          >
            <BarChart3 className="h-4 w-4" />
            Performance
          </button>
        )}
        
        {onEdit && (
          <button
            className="btn-outline flex-1 text-sm"
            onClick={onEdit}
          >
            Editar
          </button>
        )}
        
        {onDelete && (
          <button
            className="btn-danger text-sm px-3"
            onClick={onDelete}
            title="Excluir médico"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}


// ============================================
// Versão compacta para listas
// ============================================
interface MedicoListItemProps {
  medico: Medico;
  onClick?: () => void;
  onEdit?: () => void;
}

export function MedicoListItem({
  medico,
  onClick,
  onEdit,
}: MedicoListItemProps) {
  const stats = medico.estatisticas;
  const inicial = initialsFromFullName(medico?.nome, "M");
  
  return (
    <div
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-secondary-200 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="avatar-md bg-gradient-to-br from-amber-500 to-amber-600">
        {inicial}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-secondary-900 truncate">
            {medico.nome}
          </span>
        </div>
        <span className="text-sm text-secondary-500">{medico.crm_formatado}</span>
      </div>
      
      {medico.especialidade && (
        <span className="hidden md:block text-sm text-secondary-500 truncate max-w-[150px]">
          {medico.especialidade}
        </span>
      )}
      
      {stats && (
        <div className="hidden lg:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-primary-600">
            <Calendar className="h-4 w-4" />
            <span>{stats.total_consultas}</span>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <Users className="h-4 w-4" />
            <span>{stats.pacientes_unicos}</span>
          </div>
        </div>
      )}
      
      {onEdit && (
        <button
          className="btn-ghost text-sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Editar
        </button>
      )}
    </div>
  );
}


export default MedicoCard;