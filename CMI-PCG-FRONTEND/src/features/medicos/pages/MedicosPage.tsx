/**
 * Página Principal de Médicos
 * 
 * Lista de médicos com filtros, modais e aba de relatórios.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Plus,
  BarChart3,
  Loader2,
  AlertCircle,
  RefreshCw,
  Grid3X3,
  List,
} from 'lucide-react';

// Types
import type { Medico, MedicoFormMode } from '../types';

// Hooks
import {
  useMedicos,
  useMedicosStats,
  useMedico,
  useMedicoPerformance,
  useMedicoMutations,
  useRelatorioResumoMedicos,
  useRankingConsultas,
  useRelatorioPorEspecialidade,
  useRelatorioProdutividade,
  useRelatorioOcupacao,
} from '../hooks';

// Components
import {
  MedicoCard,
  MedicoListItem,
  MedicoFiltersBar,
  MedicoFormModal,
  MedicoPerformanceModal,
  ResumoMedicosCard,
  RankingMedicos,
  EspecialidadeChart,
  ProdutividadeChart,
  OcupacaoChart,
} from '../components';


// ============================================
// Types
// ============================================
type TabType = 'lista' | 'relatorios';
type ViewMode = 'grid' | 'list';

// Toast simples
const toast = {
  success: (msg: string) => {
    console.log('✅', msg);
    alert(msg);
  },
  error: (msg: string) => {
    console.error('❌', msg);
    alert(msg);
  },
};


// ============================================
// Component Principal
// ============================================
export function MedicosPage() {
  // Estado de tabs e view
  const [activeTab, setActiveTab] = useState<TabType>('lista');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Estado de modais
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<MedicoFormMode>('create');
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [selectedMedicoId, setSelectedMedicoId] = useState<number | null>(null);
  const [performancePeriodo, setPerformancePeriodo] = useState('12meses');
  
  // Hooks de dados - Lista
  const {
    medicos,
    loading: loadingMedicos,
    error: errorMedicos,
    filters,
    hasMore,
    reload: reloadMedicos,
    updateFilters,
    clearFilters,
    nextPage,
    prevPage,
    page,
  } = useMedicos({ initialFilters: { limit: 12, include_stats: true } });
  
  const { stats } = useMedicosStats();
  const { medico: selectedMedico } = useMedico(selectedMedicoId);
  const { performance, loading: loadingPerformance, reload: reloadPerformance } = useMedicoPerformance(
    performanceModalOpen ? selectedMedicoId : null,
    performancePeriodo
  );
  const { create, update, remove, saving } = useMedicoMutations();
  
  // Hooks de relatórios
  const [periodoResumo, setPeriodoResumo] = useState('30dias');
  const { resumo, loading: loadingResumo, reload: reloadResumo } = useRelatorioResumoMedicos(periodoResumo);
  const { ranking, loading: loadingRanking } = useRankingConsultas(periodoResumo, 10);
  const { relatorio: especialidades, loading: loadingEspecialidades } = useRelatorioPorEspecialidade(periodoResumo);
  const { produtividade, loading: loadingProdutividade } = useRelatorioProdutividade(12);
  const { ocupacao, loading: loadingOcupacao } = useRelatorioOcupacao(periodoResumo);
  
  // Handlers
  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedMedicoId(null);
    setFormModalOpen(true);
  };
  
  const handleOpenEdit = (id: number) => {
    setSelectedMedicoId(id);
    setFormMode('edit');
    setFormModalOpen(true);
  };
  
  const handleOpenPerformance = (id: number) => {
    setSelectedMedicoId(id);
    setPerformanceModalOpen(true);
  };
  
  const handleCloseModals = () => {
    setFormModalOpen(false);
    setPerformanceModalOpen(false);
    setTimeout(() => setSelectedMedicoId(null), 300);
  };
  
  const handleSubmitForm = async (data: Partial<Medico>) => {
    try {
      if (formMode === 'create') {
        await create(data);
        toast.success('Médico cadastrado com sucesso!');
      } else if (selectedMedicoId) {
        await update(selectedMedicoId, data);
        toast.success('Médico atualizado com sucesso!');
      }
      handleCloseModals();
      reloadMedicos();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Erro ao salvar médico');
    }
  };
  
  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este médico?')) return;
    
    try {
      await remove(id);
      toast.success('Médico excluído com sucesso!');
      reloadMedicos();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Erro ao excluir médico');
    }
  };
  
  const handlePeriodoChange = (p: string) => {
    setPeriodoResumo(p);
    reloadResumo(p);
  };
  
  const handlePerformancePeriodoChange = useCallback((p: string) => {
    setPerformancePeriodo(p);
    reloadPerformance(p);
  }, [reloadPerformance]);
  
  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white border-b border-secondary-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <Stethoscope className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-secondary-900">Médicos</h1>
                <p className="text-xs text-secondary-500">
                  {stats?.total_medicos ?? 0} cadastrados
                </p>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('lista')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'lista'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-secondary-600 hover:text-secondary-900'
                }`}
              >
                <Stethoscope className="h-4 w-4 inline mr-1.5" />
                Lista
              </button>
              <button
                onClick={() => setActiveTab('relatorios')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'relatorios'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-secondary-600 hover:text-secondary-900'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-1.5" />
                Relatórios
              </button>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {activeTab === 'lista' && (
                <>
                  <div className="hidden md:flex items-center gap-1 bg-secondary-100 p-1 rounded-lg">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                      title="Visualização em grade"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                      title="Visualização em lista"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <button
                    onClick={reloadMedicos}
                    className="btn-ghost"
                    disabled={loadingMedicos}
                    title="Recarregar"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingMedicos ? 'animate-spin' : ''}`} />
                  </button>
                </>
              )}
              
              <button onClick={handleOpenCreate} className="btn-primary">
                <Plus className="h-4 w-4" />
                Novo Médico
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'lista' ? (
            <motion.div
              key="lista"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Filtros */}
              <MedicoFiltersBar
                filters={filters}
                onFiltersChange={updateFilters}
                onClear={clearFilters}
                resultCount={medicos.length}
                loading={loadingMedicos}
              />
              
              {/* Error */}
              {errorMedicos && (
                <div className="card bg-red-50 border-red-200 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="text-red-700">{errorMedicos}</p>
                  <button onClick={reloadMedicos} className="btn-secondary ml-auto">
                    Tentar novamente
                  </button>
                </div>
              )}
              
              {/* Lista */}
              {loadingMedicos && medicos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
                  <p className="text-secondary-500">Carregando médicos...</p>
                </div>
              ) : medicos.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-12">
                  <Stethoscope className="h-12 w-12 text-secondary-300 mb-3" />
                  <p className="text-secondary-500 mb-4">Nenhum médico encontrado</p>
                  <button onClick={handleOpenCreate} className="btn-primary">
                    <Plus className="h-4 w-4" />
                    Cadastrar Primeiro Médico
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {medicos.map((medico, index) => (
                    <MedicoCard
                      key={medico.id}
                      medico={medico}
                      index={index}
                      onClick={() => handleOpenPerformance(medico.id)}
                      onEdit={() => handleOpenEdit(medico.id)}
                      onDelete={() => handleDelete(medico.id)}
                      onPerformance={() => handleOpenPerformance(medico.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {medicos.map((medico) => (
                    <MedicoListItem
                      key={medico.id}
                      medico={medico}
                      onClick={() => handleOpenPerformance(medico.id)}
                      onEdit={() => handleOpenEdit(medico.id)}
                    />
                  ))}
                </div>
              )}
              
              {/* Pagination */}
              {medicos.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-secondary-500">Página {page}</p>
                  <div className="flex gap-2">
                    <button onClick={prevPage} disabled={page === 1} className="btn-secondary">
                      Anterior
                    </button>
                    <button onClick={nextPage} disabled={!hasMore} className="btn-secondary">
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="relatorios"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Resumo */}
              <ResumoMedicosCard
                resumo={resumo}
                loading={loadingResumo}
                periodo={periodoResumo}
                onPeriodoChange={handlePeriodoChange}
              />
              
              {/* Gráficos principais */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RankingMedicos
                  ranking={ranking?.ranking || []}
                  loading={loadingRanking}
                  onMedicoClick={handleOpenPerformance}
                />
                <EspecialidadeChart
                  relatorio={especialidades}
                  loading={loadingEspecialidades}
                />
              </div>
              
              {/* Produtividade */}
              <ProdutividadeChart
                produtividade={produtividade}
                loading={loadingProdutividade}
              />
              
              {/* Ocupação */}
              <OcupacaoChart
                ocupacao={ocupacao}
                loading={loadingOcupacao}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Modais */}
      <MedicoFormModal
        isOpen={formModalOpen}
        onClose={handleCloseModals}
        onSubmit={handleSubmitForm}
        mode={formMode}
        initialData={selectedMedico}
        saving={saving}
      />
      
      <MedicoPerformanceModal
        isOpen={performanceModalOpen}
        onClose={handleCloseModals}
        performance={performance}
        loading={loadingPerformance}
        periodo={performancePeriodo}
        onPeriodoChange={handlePerformancePeriodoChange}
      />
    </div>
  );
}


export default MedicosPage;