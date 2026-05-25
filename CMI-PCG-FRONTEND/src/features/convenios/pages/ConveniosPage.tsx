import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Search,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  Users,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import api from '@/services/api';

// ============================================
// Tipos
// ============================================
interface Convenio {
  id: number;
  cnpj: string;
  cnpj_raw?: number;
  nome: string;
  numero_para_contato?: string | number;
  email?: string;
  emite_guia: boolean;
  total_pacientes?: number;
}

interface ConvenioForm {
  cnpj: string;
  nome: string;
  numero_para_contato: string;
  email: string;
  emite_guia: boolean;
}

const INITIAL_FORM: ConvenioForm = {
  cnpj: '',
  nome: '',
  numero_para_contato: '',
  email: '',
  emite_guia: false,
};

// ============================================
// Helpers
// ============================================
const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

// ============================================
// Componente de Toast/Notificação
// ============================================
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: -20, x: '-50%' }}
      className={`fixed top-4 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

// ============================================
// Modal de Confirmação de Exclusão
// ============================================
interface DeleteModalProps {
  convenio: Convenio;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

const DeleteModal = ({ convenio, onConfirm, onCancel, loading }: DeleteModalProps) => (
  <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      className="fixed inset-0 bg-black/50 z-40"
    />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card w-full max-w-md"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Excluir Convênio</h3>
            <p className="text-sm text-slate-500">Esta ação não pode ser desfeita</p>
          </div>
        </div>
        
        <p className="text-slate-700 mb-6">
          Tem certeza que deseja excluir o convênio <strong>{convenio.nome}</strong>?
        </p>
        
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
            Cancelar
          </button>
          <button onClick={onConfirm} className="btn-danger flex-1" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Excluir'}
          </button>
        </div>
      </motion.div>
    </div>
  </>
);

// ============================================
// Modal de Criar/Editar
// ============================================
interface FormModalProps {
  convenio?: Convenio | null;
  onSave: (data: ConvenioForm) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const FormModal = ({ convenio, onSave, onCancel, loading }: FormModalProps) => {
  const [form, setForm] = useState<ConvenioForm>(
    convenio
      ? {
          cnpj: convenio.cnpj,
          nome: convenio.nome,
          numero_para_contato: convenio.numero_para_contato?.toString() || '',
          email: convenio.email || '',
          emite_guia: convenio.emite_guia,
        }
      : INITIAL_FORM
  );
  const [errors, setErrors] = useState<Partial<ConvenioForm>>({});

  const validate = (): boolean => {
    const newErrors: Partial<ConvenioForm> = {};
    
    if (!form.cnpj || form.cnpj.replace(/\D/g, '').length !== 14) {
      newErrors.cnpj = 'CNPJ inválido (14 dígitos)';
    }
    if (!form.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email inválido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await onSave(form);
    }
  };

  const updateField = <K extends keyof ConvenioForm>(field: K, value: ConvenioForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Shield className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {convenio ? 'Editar Convênio' : 'Novo Convênio'}
              </h3>
            </div>
            <button onClick={onCancel} className="btn-icon btn-ghost">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* CNPJ */}
            <div>
              <label className="label">CNPJ *</label>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => updateField('cnpj', formatCNPJ(e.target.value))}
                className={`input ${errors.cnpj ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="00.000.000/0000-00"
              />
              {errors.cnpj && <p className="text-sm text-red-500 mt-1">{errors.cnpj}</p>}
            </div>

            {/* Nome */}
            <div>
              <label className="label">Nome do Convênio *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => updateField('nome', e.target.value)}
                className={`input ${errors.nome ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Nome do convênio"
              />
              {errors.nome && <p className="text-sm text-red-500 mt-1">{errors.nome}</p>}
            </div>

            {/* Telefone */}
            <div>
              <label className="label">Telefone</label>
              <input
                type="text"
                value={form.numero_para_contato}
                onChange={(e) => updateField('numero_para_contato', formatPhone(e.target.value))}
                className="input"
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={`input ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="contato@convenio.com.br"
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Exige Guia */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.emite_guia}
                    onChange={(e) => updateField('emite_guia', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-indigo-600 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Exige guia de autorização</p>
                  <p className="text-sm text-slate-500">Marque se o convênio exige guia para atendimento</p>
                </div>
              </label>
              <FileText className={`h-5 w-5 ${form.emite_guia ? 'text-indigo-600' : 'text-slate-400'}`} />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : convenio ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
};

// ============================================
// Componente Principal
// ============================================
export default function ConveniosPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingConvenio, setEditingConvenio] = useState<Convenio | null>(null);
  const [deletingConvenio, setDeletingConvenio] = useState<Convenio | null>(null);
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Carregar convênios
  const loadConvenios = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/convenios');
      setConvenios(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar convênios:', error);
      setToast({ message: 'Erro ao carregar convênios', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConvenios();
  }, [loadConvenios]);

  // Criar convênio
  const handleCreate = async (data: ConvenioForm) => {
    try {
      setSaving(true);
      await api.post('/convenios', data);
      setShowFormModal(false);
      setToast({ message: 'Convênio cadastrado com sucesso!', type: 'success' });
      loadConvenios();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erro ao cadastrar convênio';
      setToast({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Atualizar convênio
  const handleUpdate = async (data: ConvenioForm) => {
    if (!editingConvenio) return;
    
    try {
      setSaving(true);
      await api.put(`/convenios/${editingConvenio.id}`, data);
      setEditingConvenio(null);
      setToast({ message: 'Convênio atualizado com sucesso!', type: 'success' });
      loadConvenios();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erro ao atualizar convênio';
      setToast({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Excluir convênio
  const handleDelete = async () => {
    if (!deletingConvenio) return;
    
    try {
      setSaving(true);
      await api.delete(`/convenios/${deletingConvenio.id}`);
      setDeletingConvenio(null);
      setToast({ message: 'Convênio excluído com sucesso!', type: 'success' });
      loadConvenios();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erro ao excluir convênio';
      setToast({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Filtrar convênios
  const filteredConvenios = convenios.filter(c =>
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cnpj?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalExigeGuia = convenios.filter(c => c.emite_guia).length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Convênios</h2>
          <p className="text-slate-500">
            {convenios.length} convênio{convenios.length !== 1 ? 's' : ''} cadastrado{convenios.length !== 1 ? 's' : ''}
            {totalExigeGuia > 0 && (
              <span className="text-indigo-600"> • {totalExigeGuia} exige{totalExigeGuia !== 1 ? 'm' : ''} guia</span>
            )}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowFormModal(true)}
          className="btn-primary"
        >
          <Plus className="h-5 w-5" />
          Novo Convênio
        </motion.button>
      </div>

      {/* Busca */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Lista de Convênios */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
      ) : filteredConvenios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConvenios.map((convenio, index) => (
            <motion.div
              key={convenio.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                    <Shield className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{convenio.nome}</h3>
                    <p className="text-sm text-slate-500">{convenio.cnpj}</p>
                  </div>
                </div>
                
                {/* Ações */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingConvenio(convenio)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingConvenio(convenio)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600">
                {convenio.numero_para_contato && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{formatPhone(String(convenio.numero_para_contato))}</span>
                  </div>
                )}
                {convenio.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{convenio.email}</span>
                  </div>
                )}
                {convenio.total_pacientes !== undefined && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>{convenio.total_pacientes} paciente{convenio.total_pacientes !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Badge Exige Guia */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  convenio.emite_guia 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {convenio.emite_guia ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Exige guia
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Não exige guia
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <Shield className="empty-state-icon" />
            <p className="empty-state-title">Nenhum convênio encontrado</p>
            <p className="empty-state-description">
              {searchTerm
                ? 'Tente buscar com outros termos.'
                : 'Clique no botão acima para cadastrar um novo convênio.'}
            </p>
          </div>
        </div>
      )}

      {/* Modal de Criar */}
      <AnimatePresence>
        {showFormModal && (
          <FormModal
            onSave={handleCreate}
            onCancel={() => setShowFormModal(false)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      {/* Modal de Editar */}
      <AnimatePresence>
        {editingConvenio && (
          <FormModal
            convenio={editingConvenio}
            onSave={handleUpdate}
            onCancel={() => setEditingConvenio(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      {/* Modal de Excluir */}
      <AnimatePresence>
        {deletingConvenio && (
          <DeleteModal
            convenio={deletingConvenio}
            onConfirm={handleDelete}
            onCancel={() => setDeletingConvenio(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
