/**
 * Modal de Formulário de Médico
 * 
 * Criação e edição de médicos.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Stethoscope } from 'lucide-react';
import type { Medico, MedicoFormData, MedicoFormMode } from '../types';
import { INITIAL_MEDICO_FORM, ESPECIALIDADES_COMUNS } from '../types';


// ============================================
// Helpers
// ============================================
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatCPF(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}


// ============================================
// Props
// ============================================
interface MedicoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Medico>) => Promise<void>;
  mode: MedicoFormMode;
  initialData?: Medico | null;
  saving?: boolean;
}


// ============================================
// Component
// ============================================
export function MedicoFormModal({
  isOpen,
  onClose,
  onSubmit,
  mode,
  initialData,
  saving = false,
}: MedicoFormModalProps) {
  const [form, setForm] = useState<MedicoFormData>(INITIAL_MEDICO_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof MedicoFormData, string>>>({});
  
  // Preencher form ao editar
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setForm({
        nome: initialData.nome || '',
        cpf: initialData.cpf || '',
        crm: String(initialData.crm) || '',
        data_de_nascimento: initialData.data_de_nascimento || '',
        sexo: initialData.sexo || '',
        especialidade: initialData.especialidade || '',
        rqe: initialData.rqe ? String(initialData.rqe) : '',
      });
    } else {
      setForm(INITIAL_MEDICO_FORM);
    }
    setErrors({});
  }, [mode, initialData, isOpen]);
  
  const handleChange = (field: keyof MedicoFormData, value: string) => {
    let processedValue = value;
    
    if (field === 'cpf') {
      processedValue = formatCPF(value);
    } else if (field === 'crm' || field === 'rqe') {
      processedValue = onlyDigits(value);
    }
    
    setForm((prev) => ({ ...prev, [field]: processedValue }));
    
    // Limpar erro ao digitar
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };
  
  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!form.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }
    
    if (!form.cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (onlyDigits(form.cpf).length !== 11) {
      newErrors.cpf = 'CPF deve ter 11 dígitos';
    }
    
    if (!form.crm.trim()) {
      newErrors.crm = 'CRM é obrigatório';
    }
    
    if (!form.data_de_nascimento) {
      newErrors.data_de_nascimento = 'Data de nascimento é obrigatória';
    }
    
    if (!form.sexo) {
      newErrors.sexo = 'Sexo é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    const payload: Partial<Medico> = {
      nome: form.nome.trim(),
      cpf: onlyDigits(form.cpf),
      crm: parseInt(form.crm, 10),
      data_de_nascimento: form.data_de_nascimento,
      sexo: form.sexo as 'M' | 'F',
      especialidade: form.especialidade.trim() || undefined,
      rqe: form.rqe ? parseInt(form.rqe, 10) : undefined,
    };
    
    await onSubmit(payload);
  };
  
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <Stethoscope className="h-5 w-5 text-amber-700" />
                  </div>
                  <h3 className="text-xl font-bold text-secondary-900">
                    {mode === 'create' ? 'Novo Médico' : 'Editar Médico'}
                  </h3>
                </div>
                <button onClick={onClose} className="btn-icon btn-ghost">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="label">Nome Completo *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => handleChange('nome', e.target.value)}
                    className={`input ${errors.nome ? 'border-red-500' : ''}`}
                    placeholder="Dr. João da Silva"
                  />
                  {errors.nome && (
                    <p className="text-xs text-red-500 mt-1">{errors.nome}</p>
                  )}
                </div>
                
                {/* CPF e CRM */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">CPF *</label>
                    <input
                      type="text"
                      value={form.cpf}
                      onChange={(e) => handleChange('cpf', e.target.value)}
                      className={`input ${errors.cpf ? 'border-red-500' : ''}`}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {errors.cpf && (
                      <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="label">CRM *</label>
                    <input
                      type="text"
                      value={form.crm}
                      onChange={(e) => handleChange('crm', e.target.value)}
                      className={`input ${errors.crm ? 'border-red-500' : ''}`}
                      placeholder="123456"
                      maxLength={6}
                    />
                    {errors.crm && (
                      <p className="text-xs text-red-500 mt-1">{errors.crm}</p>
                    )}
                  </div>
                </div>
                
                {/* Data Nascimento e Sexo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Data de Nascimento *</label>
                    <input
                      type="date"
                      value={form.data_de_nascimento}
                      onChange={(e) => handleChange('data_de_nascimento', e.target.value)}
                      className={`input ${errors.data_de_nascimento ? 'border-red-500' : ''}`}
                    />
                    {errors.data_de_nascimento && (
                      <p className="text-xs text-red-500 mt-1">{errors.data_de_nascimento}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="label">Sexo *</label>
                    <select
                      value={form.sexo}
                      onChange={(e) => handleChange('sexo', e.target.value)}
                      className={`select ${errors.sexo ? 'border-red-500' : ''}`}
                    >
                      <option value="">Selecione</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                    {errors.sexo && (
                      <p className="text-xs text-red-500 mt-1">{errors.sexo}</p>
                    )}
                  </div>
                </div>
                
                {/* Especialidade */}
                <div>
                  <label className="label">Especialidade</label>
                  <select
                    value={form.especialidade}
                    onChange={(e) => handleChange('especialidade', e.target.value)}
                    className="select"
                  >
                    <option value="">Selecione ou digite abaixo</option>
                    {ESPECIALIDADES_COMUNS.map((esp) => (
                      <option key={esp} value={esp}>
                        {esp}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={form.especialidade}
                    onChange={(e) => handleChange('especialidade', e.target.value)}
                    className="input mt-2"
                    placeholder="Ou digite outra especialidade..."
                  />
                </div>
                
                {/* RQE */}
                <div>
                  <label className="label">RQE (opcional)</label>
                  <input
                    type="text"
                    value={form.rqe}
                    onChange={(e) => handleChange('rqe', e.target.value)}
                    className="input"
                    placeholder="Registro de Qualificação de Especialista"
                    maxLength={10}
                  />
                </div>
                
                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={onClose} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : mode === 'create' ? (
                      'Cadastrar'
                    ) : (
                      'Salvar Alterações'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}


export default MedicoFormModal;