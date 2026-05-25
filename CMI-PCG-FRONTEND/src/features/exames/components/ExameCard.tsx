/**
 * Card de exibição de exame
 */

import { motion } from 'framer-motion';
import { Edit2, Trash2, Check, AlertCircle } from 'lucide-react';
import type { Exame } from '../types';
import { n } from '../types';

interface ExameCardProps {
  exame: Exame;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showActions?: boolean;
}

export function ExameCard({
  exame,
  index,
  isSelected,
  onToggle,
  onEdit,
  onDelete,
  showActions = true,
}: ExameCardProps) {
  const margem = n(exame.valor_venda) - n(exame.valor_cmi);
  const margemPct =
    n(exame.valor_cmi) > 0
      ? ((margem / n(exame.valor_cmi)) * 100).toFixed(0)
      : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.3) }}
      className={`
        card p-4 cursor-pointer transition-all duration-150
        ${isSelected ? 'ring-2 ring-primary-100 bg-primary-100/5' : 'hover:shadow-md'}
        ${!exame.ativo ? 'opacity-50' : ''}
      `}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <div
          className={`
            shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
            ${isSelected ? 'bg-primary-100 border-primary-100' : 'border-bg-300'}
          `}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="font-semibold text-text-100 truncate text-sm">{exame.nome}</h4>
            {!exame.ativo && (
              <span className="shrink-0 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded flex items-center gap-0.5">
                <AlertCircle className="h-2.5 w-2.5" />
                Inativo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-text-200">
            {exame.codigo && (
              <span className="px-1.5 py-0.5 bg-bg-200 rounded font-mono">{exame.codigo}</span>
            )}
            <span className="px-1.5 py-0.5 bg-primary-100/10 text-primary-100 rounded font-medium">
              {exame.tipo}
            </span>
            {exame.codigo_parceiro && (
              <span className="hidden sm:inline text-text-200">
                Parceiro: {exame.codigo_parceiro}
              </span>
            )}
          </div>
        </div>

        {/* Valores */}
        <div className="text-right shrink-0 hidden sm:block">
          <p className="font-bold text-text-100 tabular-nums">
            R$ {n(exame.valor_venda).toFixed(2)}
          </p>
          <div className="flex items-center justify-end gap-2 text-[11px] text-text-200">
            <span>Custo: R$ {n(exame.valor_cmi).toFixed(2)}</span>
            <span className={`font-medium ${margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {margemPct}%
            </span>
          </div>
        </div>

        {/* Valor mobile */}
        <div className="text-right shrink-0 sm:hidden">
          <p className="font-bold text-sm text-text-100 tabular-nums">
            R$ {n(exame.valor_venda).toFixed(2)}
          </p>
        </div>

        {/* Ações */}
        {showActions && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onEdit}
              className="p-1.5 text-text-200 hover:text-primary-100 hover:bg-primary-100/10 rounded-lg transition"
              title="Editar"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-text-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Versão compacta para seleção
interface ExameListItemProps {
  exame: Exame;
  isSelected: boolean;
  onToggle: () => void;
}

export function ExameListItem({ exame, isSelected, onToggle }: ExameListItemProps) {
  return (
    <div
      onClick={onToggle}
      className={`
        flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition
        ${isSelected ? 'border-primary-100 bg-primary-100/5' : 'border-bg-300 hover:bg-bg-200'}
      `}
    >
      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-bg-300 text-primary-100 focus:ring-primary-200"
        />
        <div className="min-w-0">
          <p className="font-medium text-text-100 truncate text-sm">{exame.nome}</p>
          <div className="flex items-center gap-2 text-xs text-text-200">
            {exame.codigo && <span>{exame.codigo}</span>}
            <span>•</span>
            <span>{exame.tipo}</span>
          </div>
        </div>
      </label>
      <p className="font-semibold text-text-100 shrink-0 text-sm tabular-nums">
        R$ {n(exame.valor_venda).toFixed(2)}
      </p>
    </div>
  );
}