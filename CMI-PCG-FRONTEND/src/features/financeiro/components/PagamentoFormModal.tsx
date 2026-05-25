// src/features/financeiro/components/PagamentoFormModal.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Pagamento } from '@/types';
import PagamentoForm from './PagamentoForm';

interface PagamentoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  editingPagamento?: Pagamento | null;
  onSuccess: () => void;
}

export default function PagamentoFormModal({
  isOpen,
  onClose,
  mode,
  editingPagamento,
  onSuccess,
}: PagamentoFormModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-secondary-200 bg-secondary-50">
                <h3 className="text-xl sm:text-2xl font-bold text-secondary-900">
                  {mode === 'create' ? 'Novo Pagamento' : 'Editar Pagamento'}
                </h3>
                <button onClick={onClose} className="btn-icon btn-ghost">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <PagamentoForm
                  mode={mode}
                  editingPagamento={editingPagamento}
                  onSuccess={() => {
                    onSuccess();
                    onClose();
                  }}
                  onCancel={onClose}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}