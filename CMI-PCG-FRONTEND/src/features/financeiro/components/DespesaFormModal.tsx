// src/features/financeiro/components/DespesaFormModal.tsx
import { AnimatePresence, motion } from 'framer-motion';
import { X, Receipt, PenLine } from 'lucide-react';
import type { Despesa } from '@/types/despesas.types';
import DespesaForm from './DespesaForm';

interface DespesaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  editingDespesa: Despesa | null;
  onSuccess: () => void;
}

export default function DespesaFormModal({
  isOpen,
  onClose,
  mode,
  editingDespesa,
  onSuccess,
}: DespesaFormModalProps) {
  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

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

          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="card w-full max-w-4xl my-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-secondary-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${mode === 'create' ? 'bg-primary-100' : 'bg-amber-100'}`}>
                    {mode === 'create'
                      ? <Receipt className="h-5 w-5 text-primary-600" />
                      : <PenLine className="h-5 w-5 text-amber-600" />
                    }
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary-900">
                      {mode === 'create' ? 'Cadastrar nova despesa' : 'Editar despesa'}
                    </h3>
                    <p className="text-sm text-secondary-500 mt-0.5">
                      {mode === 'create'
                        ? 'Preencha os campos abaixo para registrar um novo gasto da clínica.'
                        : `Editando despesa #${editingDespesa?.id ?? '—'}`
                      }
                    </p>
                  </div>
                </div>

                <button onClick={onClose} className="btn-icon btn-ghost" type="button">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <DespesaForm
                mode={mode}
                editingDespesa={editingDespesa}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}