/**
 * Modal de formulário para criar/editar exames
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save, FlaskConical } from 'lucide-react';
import type { Exame, ExameFormData } from '../types';
import { n } from '../types';
import { useExameTipos } from '../hooks';

interface ExameFormModalProps {
  exame?: Exame | null;
  onSave: (data: ExameFormData) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

const INITIAL_FORM: ExameFormData = {
  nome: '',
  tipo: '',
  codigo: '',
  codigo_parceiro: '',
  valor_cmi: 0,
  valor_venda: 0,
  valor_parceiro: 0,
  ativo: true,
};

export function ExameFormModal({ exame, onSave, onClose, loading = false }: ExameFormModalProps) {
  const [form, setForm] = useState<ExameFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { tipos } = useExameTipos();

  const isEdit = Boolean(exame?.id);

  useEffect(() => {
    if (exame) {
      setForm({
        nome: exame.nome || '',
        tipo: exame.tipo || '',
        codigo: exame.codigo || '',
        codigo_parceiro: exame.codigo_parceiro || '',
        valor_cmi: n(exame.valor_cmi),
        valor_venda: n(exame.valor_venda),
        valor_parceiro: n(exame.valor_parceiro),
        ativo: exame.ativo ?? true,
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [exame]);

  const handleChange = (field: keyof ExameFormData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!form.tipo.trim()) newErrors.tipo = 'Tipo é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave(form);
  };

  const margem = n(form.valor_venda) - n(form.valor_cmi);
  const margemPct =
    n(form.valor_venda) > 0
      ? ((margem / n(form.valor_venda)) * 100).toFixed(1)
      : '0.0';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <FlaskConical className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-text-100">
                {isEdit ? 'Editar Exame' : 'Novo Exame'}
              </h3>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost" type="button" disabled={loading}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome e Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nome do Exame *</label>
                <input
                  type="text"
                  className={`input ${errors.nome ? 'border-red-500' : ''}`}
                  value={form.nome}
                  onChange={(e) => handleChange('nome', e.target.value)}
                  placeholder="Ex: Hemograma Completo"
                  disabled={loading}
                />
                {errors.nome && <p className="text-sm text-red-500 mt-1">{errors.nome}</p>}
              </div>
              <div>
                <label className="label">Tipo *</label>
                <input
                  type="text"
                  list="tipos-exame"
                  className={`input ${errors.tipo ? 'border-red-500' : ''}`}
                  value={form.tipo}
                  onChange={(e) => handleChange('tipo', e.target.value.toUpperCase())}
                  placeholder="Ex: LABORATORIAL"
                  disabled={loading}
                />
                <datalist id="tipos-exame">
                  {tipos.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {errors.tipo && <p className="text-sm text-red-500 mt-1">{errors.tipo}</p>}
              </div>
            </div>

            {/* Códigos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Código Interno</label>
                <input
                  type="text"
                  className="input"
                  value={form.codigo}
                  onChange={(e) => handleChange('codigo', e.target.value.toUpperCase())}
                  placeholder="Auto-gerado se vazio"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label">Código do Parceiro</label>
                <input
                  type="text"
                  className="input"
                  value={form.codigo_parceiro}
                  onChange={(e) => handleChange('codigo_parceiro', e.target.value)}
                  placeholder="Código no laboratório"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Valores */}
            <div className="bg-bg-200 rounded-xl p-4 space-y-4">
              <h4 className="font-semibold text-text-100 text-sm">Valores</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['valor_cmi', 'valor_venda', 'valor_parceiro'] as const).map((campo) => (
                  <div key={campo}>
                    <label className="label">
                      {campo === 'valor_cmi' ? 'Custo CMI' : campo === 'valor_venda' ? 'Valor Venda' : 'Valor Parceiro'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-200 text-sm">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input pl-10"
                        value={form[campo] || ''}
                        onChange={(e) => handleChange(campo, parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                        disabled={loading}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-bg-300">
                <span className="text-sm text-text-200">Margem Bruta:</span>
                <span className={`font-semibold ${margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  R$ {margem.toFixed(2)} ({margemPct}%)
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="ativo"
                checked={form.ativo}
                onChange={(e) => handleChange('ativo', e.target.checked)}
                className="h-4 w-4 rounded border-bg-300 text-primary-100 focus:ring-primary-200"
                disabled={loading}
              />
              <label htmlFor="ativo" className="text-sm text-text-200">
                Exame ativo (disponível para solicitações)
              </label>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4 border-t border-bg-300">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEdit ? 'Salvar' : 'Criar Exame'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}