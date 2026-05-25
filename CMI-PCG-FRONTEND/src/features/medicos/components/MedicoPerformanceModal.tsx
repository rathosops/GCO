/**
 * Modal de Performance do Médico
 * 
 * Exibe estatísticas detalhadas e gráficos de desempenho.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  BarChart3,
  Calendar,
  Users,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { MedicoPerformance } from '../types';


// ============================================
// Props
// ============================================
interface MedicoPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  performance: MedicoPerformance | null;
  loading?: boolean;
  onPeriodoChange?: (periodo: string) => void;
  periodo?: string;
}


// Cores para gráficos
const COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];


// ============================================
// Component
// ============================================
export function MedicoPerformanceModal({
  isOpen,
  onClose,
  performance,
  loading = false,
  onPeriodoChange,
  periodo = '12meses',
}: MedicoPerformanceModalProps) {
  if (!isOpen) return null;
  
  const medico = performance?.medico;
  const metricas = performance?.metricas;
  
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
              className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-xl">
                    <BarChart3 className="h-5 w-5 text-purple-700" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary-900">
                      Performance
                    </h3>
                    {medico && (
                      <p className="text-sm text-secondary-500">
                        {medico.nome} • {medico.crm_formatado}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {onPeriodoChange && (
                    <select
                      value={periodo}
                      onChange={(e) => onPeriodoChange(e.target.value)}
                      className="select text-sm w-auto"
                    >
                      <option value="30dias">Últimos 30 dias</option>
                      <option value="90dias">Últimos 90 dias</option>
                      <option value="12meses">Últimos 12 meses</option>
                      <option value="todos">Todo período</option>
                    </select>
                  )}
                  
                  <button onClick={onClose} className="btn-icon btn-ghost">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-500 mb-3" />
                  <p className="text-secondary-500">Carregando performance...</p>
                </div>
              ) : !performance ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="h-12 w-12 text-secondary-300 mb-3" />
                  <p className="text-secondary-500">Dados não disponíveis</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card bg-primary-50">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-primary-600" />
                        <span className="text-xs text-primary-600">Consultas</span>
                      </div>
                      <p className="text-2xl font-bold text-primary-700">
                        {metricas?.total_consultas ?? 0}
                      </p>
                    </div>
                    
                    <div className="card bg-green-50">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600">Pacientes</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        {metricas?.pacientes_unicos ?? 0}
                      </p>
                    </div>
                    
                    <div className="card bg-purple-50">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="text-xs text-purple-600">Média/Dia</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">
                        {metricas?.media_consultas_dia ?? '-'}
                      </p>
                    </div>
                    
                    <div className="card bg-amber-50">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span className="text-xs text-amber-600">Período</span>
                      </div>
                      <p className="text-lg font-bold text-amber-700 capitalize">
                        {periodo.replace('dias', ' dias').replace('meses', ' meses')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Gráficos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Histórico Mensal */}
                    {performance.historico_mensal && performance.historico_mensal.length > 0 && (
                      <div className="card">
                        <h4 className="text-md font-semibold text-secondary-900 mb-4">
                          Consultas por Mês
                        </h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performance.historico_mensal}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                              <XAxis
                                dataKey="mes_nome"
                                tick={{ fontSize: 11 }}
                                stroke="#6B7280"
                                tickFormatter={(v) => v?.slice(0, 3)}
                              />
                              <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '8px',
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="total"
                                stroke="#2563EB"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name="Consultas"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    
                    {/* Por Tipo */}
                    {performance.por_tipo && performance.por_tipo.length > 0 && (
                      <div className="card">
                        <h4 className="text-md font-semibold text-secondary-900 mb-4">
                          Por Tipo de Consulta
                        </h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={performance.por_tipo}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="total"
                                nameKey="tipo"
                              >
                                {performance.por_tipo.map((_, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 justify-center">
                          {performance.por_tipo.map((item, index) => (
                            <div key={item.tipo} className="flex items-center gap-1 text-xs">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-secondary-600">
                                {item.tipo}: {item.total}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Distribuição por dia da semana */}
                  {performance.distribuicao_semana && performance.distribuicao_semana.length > 0 && (
                    <div className="card">
                      <h4 className="text-md font-semibold text-secondary-900 mb-4">
                        Atendimentos por Dia da Semana
                      </h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={performance.distribuicao_semana}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="#6B7280" />
                            <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                            <Tooltip />
                            <Bar dataKey="total" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Consultas" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {/* Pacientes frequentes */}
                  {performance.pacientes_frequentes && performance.pacientes_frequentes.length > 0 && (
                    <div className="card">
                      <h4 className="text-md font-semibold text-secondary-900 mb-4">
                        Pacientes Mais Atendidos
                      </h4>
                      <div className="space-y-2">
                        {performance.pacientes_frequentes.slice(0, 5).map((p, index) => (
                          <div
                            key={p.cpf}
                            className="flex items-center gap-3 p-2 bg-secondary-50 rounded-lg"
                          >
                            <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-secondary-500">
                              {index + 1}º
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-secondary-900">
                                {p.nome}
                              </p>
                              <p className="text-xs text-secondary-500">{p.cpf}</p>
                            </div>
                            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">
                              {p.total_consultas} consultas
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Footer */}
              <div className="flex justify-end pt-4 mt-4 border-t">
                <button onClick={onClose} className="btn-secondary">
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}


export default MedicoPerformanceModal;