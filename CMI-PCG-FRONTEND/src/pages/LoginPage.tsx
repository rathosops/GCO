import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, AlertCircle, Loader2, Stethoscope, Heart } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const loginWithCredentials = useAuthStore((state) => state.loginWithCredentials);

  const [formData, setFormData] = useState({ usuario: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginWithCredentials(formData);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg-100">
      {/* Lado Esquerdo - Branding */}
      <div className="hidden lg:flex relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100 via-primary-200 to-bg-300 opacity-95" />
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />

        <div className="relative z-10 w-full p-12 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center border border-white/10">
              <Stethoscope className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white leading-none">CMI-PCG</h1>
              <p className="text-white/80 text-sm">Sistema de Gestão</p>
            </div>
          </div>

          <div className="space-y-6 max-w-lg">
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-4xl font-bold text-white leading-tight"
            >
              Gestão completa para sua clínica médica ocupacional
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-white/85 text-lg"
            >
              Simplifique o gerenciamento de pacientes, agendamentos, consultas e financeiro em uma única plataforma.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex items-center gap-8 pt-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center border border-white/10">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white leading-none">1000+</p>
                  <p className="text-white/80 text-sm">Pacientes</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center border border-white/10">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white leading-none">5000+</p>
                  <p className="text-white/80 text-sm">Consultas</p>
                </div>
              </div>
            </motion.div>
          </div>

          <p className="text-white/70 text-sm">© 2026 CMI-PCG. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="flex items-center justify-center p-6 sm:p-8 bg-secondary-50">
        <motion.div
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4 shadow-soft">
              <Stethoscope className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-secondary-900">CMI-PCG</h1>
            <p className="text-secondary-500">Sistema de Gestão</p>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-secondary-900 mb-2">Bem-vindo de volta!</h2>
            <p className="text-secondary-500">Entre com suas credenciais para acessar o sistema</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Usuário ou Email</label>
                <div className="relative">
                  <User className="input-icon" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                    className="input-with-icon"
                    placeholder="Digite seu usuário ou email"
                    required
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <Lock className="input-icon" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    className="input-with-icon"
                    placeholder="Digite sua senha"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="alert-danger">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </motion.button>
            </form>
          </motion.div>

          <p className="text-center text-sm text-secondary-500 mt-6 lg:hidden">© 2026 CMI-PCG. Todos os direitos reservados.</p>
        </motion.div>
      </div>
    </div>
  );
}
