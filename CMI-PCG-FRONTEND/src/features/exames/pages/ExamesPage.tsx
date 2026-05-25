/**
 * Página de Exames - CMI-PCG
 *
 * Melhorias aplicadas:
 *   - 3 abas: Catálogo | Solicitações (NOVO) | Relatórios
 *   - Paginação real no catálogo
 *   - Layout responsivo (calculadora embaixo em mobile)
 *   - Filtros corrigidos (sem bugs de reset)
 *   - Import/Export CSV
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Loader2,
  FlaskConical,
  BarChart3,
  Download,
  Upload,
  X,
  AlertTriangle,
  ListFilter,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useExames, useExameSelection, useExameTipos, useExameStats } from '../hooks';
import {
  ExameFormModal,
  ExamesCalculator,
  ExameCard,
  ExameFiltersBar,
  ExamesDashboard,
  TipoDistribuicao,
  ExamesReport,
  SolicitacaoExameModal,
} from '../components';
import { SolicitacoesTab } from '../components/SolicitacoesTab';
import { examesAPI } from '../api';
import type { Exame, ExameFormData } from '../types';

type Tab = 'catalogo' | 'solicitacoes' | 'relatorios';

export default function ExamesPage() {
  const [tab, setTab] = useState<Tab>('catalogo');

  // Hooks
  const {
    filteredItems: exames,
    loading,
    error,
    filters,
    categoria,
    setCategoria,
    setFilter,
    resetFilters,
    reload,
    page,
    setPage,
    pageSize,
    hasMore,
    totalLoaded,
  } = useExames({ pageSize: 50 });

  const selection = useExameSelection();
  const { tipos } = useExameTipos();
  const { stats, loading: statsLoading, reload: reloadStats } = useExameStats();

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingExame, setEditingExame] = useState<Exame | null>(null);
  const [showSolicitacaoModal, setShowSolicitacaoModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Delete
  const [deletingExame, setDeletingExame] = useState<Exame | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    criados: number;
    atualizados: number;
    erros: string[];
  } | null>(null);

  // =========================================================================
  // Handlers
  // =========================================================================
  const handleCreate = useCallback(() => {
    setEditingExame(null);
    setShowFormModal(true);
  }, []);

  const handleEdit = useCallback((exame: Exame) => {
    setEditingExame(exame);
    setShowFormModal(true);
  }, []);

  const handleSave = useCallback(
    async (data: ExameFormData) => {
      setFormLoading(true);
      try {
        if (editingExame?.id) {
          await examesAPI.update(editingExame.id, data);
        } else {
          await examesAPI.create(data);
        }
        setShowFormModal(false);
        setEditingExame(null);
        reload();
        reloadStats();
      } catch (err: any) {
        alert(err?.response?.data?.error || 'Erro ao salvar exame');
      } finally {
        setFormLoading(false);
      }
    },
    [editingExame, reload, reloadStats]
  );

  const handleDelete = useCallback((exame: Exame) => setDeletingExame(exame), []);

  const confirmDelete = useCallback(async () => {
    if (!deletingExame) return;
    setDeleting(true);
    try {
      await examesAPI.delete(deletingExame.id);
      setDeletingExame(null);
      selection.clearSelection();
      reload();
      reloadStats();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir exame');
    } finally {
      setDeleting(false);
    }
  }, [deletingExame, reload, reloadStats, selection]);

  const handleExport = useCallback(async () => {
    try {
      const blob = await examesAPI.exportarCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exames_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar exames');
    }
  }, [filters]);

  const handleImport = useCallback(async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await examesAPI.importarCsv(importFile);
      setImportResult({
        criados: result.criados,
        atualizados: result.atualizados,
        erros: result.erros || [],
      });
      reload();
      reloadStats();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  }, [importFile, reload, reloadStats]);

  const handleGerarSolicitacao = useCallback(() => {
    if (selection.selected.length === 0) {
      alert('Selecione pelo menos um exame');
      return;
    }
    setShowSolicitacaoModal(true);
  }, [selection.selected.length]);

  // =========================================================================
  // Tab config
  // =========================================================================
  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'catalogo', label: 'Catálogo', icon: <FlaskConical className="h-4 w-4" /> },
    { key: 'solicitacoes', label: 'Solicitações', icon: <Receipt className="h-4 w-4" /> },
    { key: 'relatorios', label: 'Relatórios', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-100">Exames</h2>
          <p className="text-sm text-text-200">Catálogo, solicitações e relatórios</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === 'catalogo' && (
            <>
              <button onClick={() => setShowImportModal(true)} className="btn-secondary btn-sm">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Importar</span>
              </button>
              <button
                onClick={handleExport}
                className="btn-secondary btn-sm"
                disabled={loading || exames.length === 0}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreate}
                className="btn-primary"
              >
                <Plus className="h-4 w-4" />
                Novo Exame
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Dashboard KPIs */}
      <ExamesDashboard stats={stats} loading={statsLoading} />

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-200 rounded-xl w-full sm:w-fit overflow-x-auto">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              tab === key
                ? 'bg-primary-100 text-white shadow-sm'
                : 'text-text-200 hover:text-text-100 hover:bg-bg-100'
            }`}
            onClick={() => setTab(key)}
          >
            <span className="flex items-center justify-center gap-2">
              {icon}
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* TAB: Catálogo                                                     */}
      {/* ================================================================= */}
      {tab === 'catalogo' && (
        <>
          <ExameFiltersBar
            filters={filters}
            tipos={tipos}
            categoria={categoria}
            onCategoriaChange={setCategoria}
            onChange={setFilter}
            onReset={resetFilters}
            resultCount={exames.length}
          />

          {/* Layout: Lista + Calculadora */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Lista de exames */}
            <div className="flex-1 min-w-0 space-y-3">
              {error && (
                <div className="card bg-red-50 border-red-200 text-red-700 text-sm">
                  <p>{error}</p>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-primary-100 animate-spin" />
                </div>
              ) : exames.length > 0 ? (
                <div className="space-y-2">
                  {exames.map((exame, idx) => (
                    <ExameCard
                      key={exame.id}
                      exame={exame}
                      index={idx}
                      isSelected={selection.isSelected(exame.id)}
                      onToggle={() => selection.toggle(exame)}
                      onEdit={() => handleEdit(exame)}
                      onDelete={() => handleDelete(exame)}
                    />
                  ))}
                </div>
              ) : (
                <div className="card">
                  <div className="empty-state py-16">
                    <ListFilter className="empty-state-icon" />
                    <p className="empty-state-title">Nenhum exame encontrado</p>
                    <p className="empty-state-description">
                      Ajuste os filtros ou cadastre um novo exame.
                    </p>
                  </div>
                </div>
              )}

              {/* Paginação do catálogo */}
              {!loading && exames.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-text-200">
                    Página {page + 1}
                    <span className="ml-1">
                      • {totalLoaded} exame{totalLoaded !== 1 ? 's' : ''}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                      className="btn-ghost btn-sm disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={!hasMore}
                      className="btn-ghost btn-sm disabled:opacity-40"
                    >
                      <span className="hidden sm:inline">Próxima</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar: Calculadora (fixa em desktop, inline em mobile) */}
            <div className="w-full lg:w-[340px] shrink-0">
              <div className="lg:sticky lg:top-4 space-y-4">
                <ExamesCalculator
                  exames={selection.selected}
                  desconto={selection.desconto}
                  descontoPercentual={selection.descontoPercentual}
                  onDescontoChange={selection.setDesconto}
                  onDescontoPercentualChange={selection.setDescontoPercentual}
                  onRemove={(exame) => selection.toggle(exame)}
                  onClear={selection.clearSelection}
                  onGerarSolicitacao={handleGerarSolicitacao}
                />

                {selection.selected.length === 0 && (
                  <div className="card text-center py-10 text-text-200">
                    <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-sm">Selecione exames</p>
                    <p className="text-xs mt-1">Clique nos cards para montar o orçamento</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* TAB: Solicitações (NOVA)                                          */}
      {/* ================================================================= */}
      {tab === 'solicitacoes' && <SolicitacoesTab />}

      {/* ================================================================= */}
      {/* TAB: Relatórios                                                   */}
      {/* ================================================================= */}
      {tab === 'relatorios' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExamesReport />
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-text-100">Distribuição por Tipo</h3>
                <p className="text-sm text-text-200">Quantidade de exames cadastrados</p>
              </div>
            </div>
            <TipoDistribuicao data={stats?.por_tipo || []} />
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAIS                                                            */}
      {/* ================================================================= */}

      <AnimatePresence>
        {showFormModal && (
          <ExameFormModal
            exame={editingExame}
            onSave={handleSave}
            onClose={() => {
              setShowFormModal(false);
              setEditingExame(null);
            }}
            loading={formLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSolicitacaoModal && (
          <SolicitacaoExameModal
            onClose={() => setShowSolicitacaoModal(false)}
            onSuccess={() => selection.clearSelection()}
            examesSelecionados={selection.selected}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deletingExame && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleting && setDeletingExame(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-md"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-text-100">Confirmar Exclusão</h3>
                </div>
                <p className="text-text-200 mb-1 text-sm">Deseja excluir o exame:</p>
                <p className="font-semibold text-text-100 mb-4">{deletingExame.nome}</p>
                <p className="text-xs text-text-200 mb-6">
                  O exame será desativado e não aparecerá em novas solicitações.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setDeletingExame(null)} className="btn-secondary flex-1" disabled={deleting}>
                    Cancelar
                  </button>
                  <button onClick={confirmDelete} className="btn-danger flex-1" disabled={deleting}>
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !importing && setShowImportModal(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card w-full max-w-lg"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-text-100">Importar Exames</h3>
                  <button onClick={() => setShowImportModal(false)} className="btn-icon btn-ghost" disabled={importing}>
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-bg-200 rounded-xl text-sm text-text-200">
                    <p className="font-medium mb-2 text-text-100">Formato CSV:</p>
                    <code className="text-xs bg-bg-100 px-2 py-1 rounded block overflow-x-auto">
                      codigo;nome;tipo;valor_cmi;valor_venda;valor_parceiro
                    </code>
                  </div>

                  <div>
                    <label className="label">Arquivo CSV</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        setImportFile(e.target.files?.[0] || null);
                        setImportResult(null);
                      }}
                      className="input"
                      disabled={importing}
                    />
                  </div>

                  {importResult && (
                    <div className="p-4 bg-emerald-50 rounded-xl">
                      <p className="font-medium text-emerald-700 mb-2">Importação concluída!</p>
                      <ul className="text-sm text-emerald-600 space-y-1">
                        <li>✓ {importResult.criados} criados</li>
                        <li>✓ {importResult.atualizados} atualizados</li>
                        {importResult.erros.length > 0 && (
                          <li className="text-red-600">⚠ {importResult.erros.length} erros</li>
                        )}
                      </ul>
                      {importResult.erros.length > 0 && (
                        <div className="mt-2 p-2 bg-white rounded text-xs text-red-600 max-h-20 overflow-y-auto">
                          {importResult.erros.map((err, i) => (
                            <p key={i}>{err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportResult(null);
                    }}
                    className="btn-secondary flex-1"
                    disabled={importing}
                  >
                    {importResult ? 'Fechar' : 'Cancelar'}
                  </button>
                  {!importResult && (
                    <button onClick={handleImport} className="btn-primary flex-1" disabled={!importFile || importing}>
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Importar
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}