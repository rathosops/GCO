// src/features/aso/pages/AsoPage.tsx

import { useState, useCallback } from 'react';
import {
  Stethoscope,
  BarChart3,
  FilePlus2,
  List,
  History,
  Search,
  Loader2,
  User,
  FileX2,
  FileDown,
  Calendar,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import AsoStats from '../components/AsoStats';
import AsoForm from '../components/AsoForm';
import AsoList from '../components/AsoList';
import AsoDetail from '../components/AsoDetail';
import QuestionarioPanel from '../components/QuestionarioPanel';
import { asoAPI, downloadBlob, extractBlobError } from '../api/aso.api';
import { useToast } from '@/components/feedback/toast';
import { formatCpf, onlyDigits } from '@/utils/formatters';
import type { AsoRecord, AsoHistoryResponse } from '../types/aso.types';
import { TIPOS_EXAME_MAP, CONCLUSAO_MAP } from '../types/aso.types';

// ============================================
// Tab config
// ============================================

type TabKey = 'dashboard' | 'novo' | 'questionarios' | 'lista' | 'historico';

const TABS: { key: TabKey; label: string; icon: React.ElementType; description?: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'novo', label: 'Novo ASO', icon: FilePlus2 },
  { key: 'questionarios', label: 'Questionários', icon: ClipboardList, description: 'Google Forms' },
  { key: 'lista', label: 'Registros', icon: List },
  { key: 'historico', label: 'Histórico', icon: History },
];

// ============================================
// History sub-component (inline)
// ============================================

function AsoHistorico() {
  const toast = useToast();
  const [cpfInput, setCpfInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AsoHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAso, setSelectedAso] = useState<AsoRecord | null>(null);

  const handleSearch = async () => {
    const digits = onlyDigits(cpfInput);
    if (digits.length < 11) {
      toast.warning('Informe um CPF válido com 11 dígitos.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await asoAPI.historico(digits);
      setData(result);
      if (result.total === 0) {
        toast.info('Nenhum ASO encontrado para este paciente.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao buscar histórico.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (aso: AsoRecord) => {
    try {
      const blob = await asoAPI.gerarPdfSalvo(aso.id);
      downloadBlob(blob, `aso_${aso.id}.pdf`);
    } catch (error) {
      toast.error(await extractBlobError(error));
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const conclusaoColor: Record<string, string> = {
    APTO: 'border-semantic-success bg-success-light',
    INAPTO: 'border-semantic-danger bg-danger-light',
    APTO_COM_RESTRICOES: 'border-semantic-warning bg-warning-light',
  };

  const conclusaoTextColor: Record<string, string> = {
    APTO: 'text-success',
    INAPTO: 'text-danger',
    APTO_COM_RESTRICOES: 'text-warning',
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="card !p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-5 w-5 text-primary-100" />
          <h3 className="font-semibold text-text-100">Buscar Histórico por CPF</h3>
        </div>
        <p className="text-sm text-text-200 mb-3">
          Consulte todos os ASOs emitidos para um trabalhador. O histórico é mantido
          por 20 anos conforme exigido pela NR-7 (§7.6.1.1).
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
            <input
              className="input pl-10"
              placeholder="000.000.000-00"
              value={cpfInput}
              onChange={(e) => setCpfInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Patient header */}
          <div className="card !p-4 flex items-center gap-4">
            <div className="avatar-lg text-lg">
              {data.paciente.nome.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-100">{data.paciente.nome}</h3>
              <p className="text-sm text-text-200">{data.paciente.cpf_formatado}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-primary-100 tabular-nums">{data.total}</p>
              <p className="text-xs text-text-200">ASOs registrados</p>
            </div>
          </div>

          {/* Timeline */}
          {data.asos.length === 0 ? (
            <div className="card text-center py-12 border-2 border-dashed border-bg-300">
              <FileX2 className="h-12 w-12 mx-auto text-text-200 mb-3 opacity-50" />
              <p className="font-medium text-text-100">Nenhum ASO encontrado</p>
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-bg-300" />

              <div className="space-y-4">
                {data.asos.map((aso, idx) => (
                  <div key={aso.id} className="relative">
                    <div className={`absolute -left-6 top-4 w-3 h-3 rounded-full border-2 bg-bg-100
                      ${idx === 0 ? 'border-primary-100' : 'border-bg-300'}`}
                    />

                    <div
                      className="card !p-4 cursor-pointer hover:shadow-md transition-shadow group"
                      onClick={() => setSelectedAso(aso)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-xs font-medium text-text-200 bg-bg-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(aso.data)}
                            </span>
                            <span className="text-xs bg-bg-200 text-text-200 px-2 py-0.5 rounded-full">
                              {TIPOS_EXAME_MAP[aso.tipo_exame] || aso.tipo_exame}
                            </span>
                          </div>

                          <p className="text-sm text-text-100 font-medium">
                            {aso.empresa_nome || '—'}
                          </p>
                          <p className="text-xs text-text-200">
                            Função: {aso.funcao_paciente} · Dr(a). {aso.medico_nome}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-3 py-1 rounded-xl text-xs font-bold border-2
                            ${conclusaoColor[aso.conclusao] || 'bg-bg-200 border-bg-300'}
                            ${conclusaoTextColor[aso.conclusao] || 'text-text-200'}`}
                          >
                            {CONCLUSAO_MAP[aso.conclusao] || aso.conclusao}
                          </span>
                          <button
                            className="btn-ghost btn-icon btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Baixar PDF"
                            onClick={(e) => { e.stopPropagation(); handleDownloadPdf(aso); }}
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-text-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && !data && (
        <div className="card text-center py-8">
          <p className="text-text-200">{error}</p>
        </div>
      )}

      {selectedAso && (
        <AsoDetail aso={selectedAso} onClose={() => setSelectedAso(null)} />
      )}
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function AsoPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary-100/10">
            <Stethoscope className="h-7 w-7 text-primary-100" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-100">
              Saúde Ocupacional
            </h1>
            <p className="text-sm text-text-200">
              ASOs, questionários de anamnese e consultas ocupacionais — NR-7
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-bg-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon, description }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium
                border-b-2 transition-all whitespace-nowrap
                ${activeTab === key
                  ? 'border-primary-100 text-primary-100'
                  : 'border-transparent text-text-200 hover:text-text-100 hover:border-bg-300'
                }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {description && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full hidden sm:inline ${
                  activeTab === key ? 'bg-primary-100/10' : 'bg-bg-200'
                }`}>
                  {description}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div key={`${activeTab}-${refreshKey}`}>
        {activeTab === 'dashboard' && <AsoStats />}
        {activeTab === 'novo' && <AsoForm onSaved={handleSaved} />}
        {activeTab === 'questionarios' && <QuestionarioPanel />}
        {activeTab === 'lista' && <AsoList />}
        {activeTab === 'historico' && <AsoHistorico />}
      </div>
    </div>
  );
}