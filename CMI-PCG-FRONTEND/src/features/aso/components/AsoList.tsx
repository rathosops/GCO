// src/features/aso/components/AsoList.tsx

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Eye,
  Trash2,
  Loader2,
  FileX2,
  X,
  Calendar,
  SlidersHorizontal,
} from 'lucide-react';
import { asoAPI, downloadBlob, extractBlobError } from '../api/aso.api';
import { useToast } from '@/components/feedback/toast';
import { formatCpf, formatCnpj } from '@/utils/formatters';
import type { AsoRecord, AsoFilterParams } from '../types/aso.types';
import { TIPOS_EXAME_MAP, CONCLUSAO_MAP } from '../types/aso.types';
import AsoDetail from './AsoDetail';

// ============================================
// Conclusão Badge
// ============================================

function ConclusaoBadge({ value }: { value: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    APTO: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Apto' },
    INAPTO: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Inapto' },
    APTO_COM_RESTRICOES: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Com Restrições' },
  };
  const style = map[value] || { bg: 'bg-bg-200', text: 'text-text-200', label: value };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function TipoBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-bg-200 text-text-200 border border-bg-300">
      {TIPOS_EXAME_MAP[value] || value}
    </span>
  );
}

// ============================================
// Main Component
// ============================================

export default function AsoList() {
  const toast = useToast();

  const [records, setRecords] = useState<AsoRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAso, setSelectedAso] = useState<AsoRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filters, setFilters] = useState<AsoFilterParams>({
    limit: 20,
    offset: 0,
    order: 'data_desc',
  });
  const [searchInput, setSearchInput] = useState('');

  const page = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1;
  const totalPages = Math.ceil(total / (filters.limit || 20));

  // Fetch
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await asoAPI.listar(filters);
      setRecords(data.asos);
      setTotal(data.total);
    } catch {
      toast.error('Erro ao carregar ASOs.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Actions
  const handleSearch = () => {
    setFilters((p) => ({ ...p, search: searchInput || undefined, offset: 0 }));
  };

  const handleFilterChange = (key: keyof AsoFilterParams, value: string) => {
    setFilters((p) => ({ ...p, [key]: value || undefined, offset: 0 }));
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setFilters({ limit: 20, offset: 0, order: 'data_desc' });
    setShowFilters(false);
  };

  const goToPage = (newPage: number) => {
    const limit = filters.limit || 20;
    setFilters((p) => ({ ...p, offset: (newPage - 1) * limit }));
  };

  const handleDownloadPdf = async (aso: AsoRecord) => {
    try {
      const blob = await asoAPI.gerarPdfSalvo(aso.id);
      const nome = (aso.paciente_nome || 'aso').replace(/\s+/g, '_');
      downloadBlob(blob, `aso_${aso.id}_${nome}.pdf`);
      toast.success('PDF baixado com sucesso!');
    } catch (error) {
      const msg = await extractBlobError(error);
      toast.error(msg);
    }
  };

  const handleDelete = async (aso: AsoRecord) => {
    if (!window.confirm(`Excluir ASO #${aso.id} de ${aso.paciente_nome}?`)) return;
    try {
      await asoAPI.excluir(aso.id);
      toast.success('ASO excluído.');
      fetchList();
    } catch {
      toast.error('Erro ao excluir ASO.');
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const hasActiveFilters = !!(
    filters.tipo_exame || filters.conclusao || filters.data_inicio ||
    filters.data_fim || filters.search
  );

  return (
    <>
      <div className="space-y-4">
        {/* Search + Filters bar */}
        <div className="card !p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
              <input
                className="input pl-10 !py-2"
                placeholder="Buscar por nome do paciente..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              <button
                className={`btn-ghost !py-2 relative ${hasActiveFilters ? 'text-primary-100' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary-100 rounded-full" />
                )}
              </button>
              {hasActiveFilters && (
                <button className="btn-ghost !py-2 text-text-200" onClick={handleClearFilters}>
                  <X className="h-4 w-4" /> Limpar
                </button>
              )}
              <button className="btn-secondary !py-2" onClick={handleSearch}>
                <Search className="h-4 w-4" /> Buscar
              </button>
            </div>
          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-bg-200">
              <div>
                <label className="text-xs font-medium text-text-200 mb-1 block">Tipo de Exame</label>
                <select
                  className="select !py-1.5 text-sm"
                  value={filters.tipo_exame || ''}
                  onChange={(e) => handleFilterChange('tipo_exame', e.target.value)}
                >
                  <option value="">Todos</option>
                  {Object.entries(TIPOS_EXAME_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-200 mb-1 block">Conclusão</label>
                <select
                  className="select !py-1.5 text-sm"
                  value={filters.conclusao || ''}
                  onChange={(e) => handleFilterChange('conclusao', e.target.value)}
                >
                  <option value="">Todas</option>
                  {Object.entries(CONCLUSAO_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-200 mb-1 block">Data Início</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
                  <input
                    type="date"
                    className="input pl-10 !py-1.5 text-sm"
                    value={filters.data_inicio || ''}
                    onChange={(e) => handleFilterChange('data_inicio', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-200 mb-1 block">Data Fim</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
                  <input
                    type="date"
                    className="input pl-10 !py-1.5 text-sm"
                    value={filters.data_fim || ''}
                    onChange={(e) => handleFilterChange('data_fim', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary-100" />
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <FileX2 className="empty-state-icon" />
            <p className="empty-state-title">Nenhum ASO encontrado</p>
            <p className="empty-state-description">
              {hasActiveFilters
                ? 'Tente ajustar os filtros de busca.'
                : 'Os ASOs gerados aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Paciente</th>
                  <th>Empresa</th>
                  <th>Tipo</th>
                  <th>Conclusão</th>
                  <th>Data</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {records.map((aso) => (
                  <tr key={aso.id}>
                    <td className="font-medium text-text-100 tabular-nums">
                      {aso.id}
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-text-100 text-sm">
                          {aso.paciente_nome || '—'}
                        </p>
                        <p className="text-xs text-text-200">
                          {formatCpf(String(aso.cpf_paciente))}
                        </p>
                      </div>
                    </td>
                    <td>
                      <p className="text-sm text-text-200 truncate max-w-[180px]">
                        {aso.empresa_nome || '—'}
                      </p>
                    </td>
                    <td><TipoBadge value={aso.tipo_exame} /></td>
                    <td><ConclusaoBadge value={aso.conclusao} /></td>
                    <td className="text-sm tabular-nums">
                      {formatDate(aso.data)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          title="Ver detalhes"
                          onClick={() => setSelectedAso(aso)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          title="Baixar PDF"
                          onClick={() => handleDownloadPdf(aso)}
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-ghost btn-icon btn-sm text-danger hover:bg-red-50"
                          title="Excluir"
                          onClick={() => handleDelete(aso)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-200">
              Mostrando {(filters.offset || 0) + 1}–
              {Math.min((filters.offset || 0) + (filters.limit || 20), total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                className="btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <button
                    key={p}
                    className={`btn-ghost btn-sm min-w-[36px] tabular-nums ${
                      p === page ? 'bg-primary-100 text-white hover:bg-primary-200' : ''
                    }`}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedAso && (
        <AsoDetail aso={selectedAso} onClose={() => setSelectedAso(null)} />
      )}
    </>
  );
}