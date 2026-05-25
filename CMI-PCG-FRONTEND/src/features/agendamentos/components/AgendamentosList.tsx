import { Calendar, ClipboardList, Loader2 } from 'lucide-react';
import type { Agendamento } from '@/types';
import { normalizeHora } from '../utils/agendamentos.helpers';
import { AgendamentoItem } from './AgendamentoItem';

type Props = {
  loading: boolean;
  items: Agendamento[];
  updatingId: number | null;

  onEdit: (ag: Agendamento) => void;
  onDelete: (ag: Agendamento) => void;

  onCompareceu: (ag: Agendamento) => void;
  onFaltou: (ag: Agendamento) => void;
  onLimpar: (ag: Agendamento) => void;
};

export function AgendamentosList({
  loading,
  items,
  updatingId,
  onEdit,
  onDelete,
  onCompareceu,
  onFaltou,
  onLimpar,
}: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-900">
          {items.length} agendamento{items.length !== 1 ? 's' : ''}
        </h3>

        <div className="hidden md:flex items-center gap-2 text-sm text-secondary-500">
          <ClipboardList className="h-4 w-4" />
          Dica: marque compareceu/faltou direto na lista
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items
            .slice()
            .sort((a, b) => normalizeHora(a.hora).localeCompare(normalizeHora(b.hora)))
            .map((ag, index) => (
              <AgendamentoItem
                key={ag.id}
                ag={ag}
                index={index}
                updatingId={updatingId}
                onEdit={onEdit}
                onDelete={onDelete}
                onCompareceu={onCompareceu}
                onFaltou={onFaltou}
                onLimpar={onLimpar}
              />
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <Calendar className="empty-state-icon" />
          <p className="empty-state-title">Nenhum agendamento</p>
          <p className="empty-state-description">
            Não há agendamentos para esta data. Clique no botão acima para criar um novo.
          </p>
        </div>
      )}
    </div>
  );
}
