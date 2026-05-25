// src/features/financeiro/components/RelatoriosPdf.tsx
import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { relatoriosAPI } from '@/services/api';
import { RelatorioFiltros } from '@/types';

type RelatorioTipo = 'all' | 'company' | 'insurance' | 'patient' | 'others' | 'exams';

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPdf() {
  const hoje = new Date();
  const defaultInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const defaultFim = hoje.toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(defaultInicio);
  const [dataFim, setDataFim] = useState(defaultFim);
  const [tipo, setTipo] = useState<RelatorioTipo>('all');
  const [filtroId, setFiltroId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);

    try {
      const filtros: RelatorioFiltros = {
        data_inicio: dataInicio,
        data_fim: dataFim,
        tipo,
        filtro_id: filtroId || undefined,
      };

      const blobData = await relatoriosAPI.financeiro(filtros);
      const blob = new Blob([blobData], { type: 'application/pdf' });

      const suffix = `${tipo}_${dataInicio}_ate_${dataFim}`;
      downloadBlob(`relatorio_financeiro_${suffix}.pdf`, blob);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao gerar PDF');
    } finally {
      setLoading(false);
    }
  };

  const needsFilterId = tipo === 'patient' || tipo === 'company' || tipo === 'insurance';

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-secondary-900">Relatórios financeiros (PDF)</h3>
          <p className="text-sm text-secondary-500">
            Gere relatórios completos com filtro por período e tipo.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger-light border border-danger/20 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Data início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Data fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Tipo de relatório</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as RelatorioTipo)}
            className="select"
          >
            <option value="all">Todos</option>
            <option value="company">Por empresa</option>
            <option value="insurance">Por convênio</option>
            <option value="patient">Por paciente</option>
            <option value="others">Outros (sem vínculo)</option>
            <option value="exams">Exames faturados</option>
          </select>
        </div>

        <div>
          <label className="label">
            Filtro ID {needsFilterId ? '*' : '(opcional)'}
          </label>
          <input
            value={filtroId}
            onChange={(e) => setFiltroId(e.target.value)}
            className="input"
            placeholder={
              tipo === 'patient'
                ? 'CPF (somente números)'
                : tipo === 'company' || tipo === 'insurance'
                ? 'ID empresa/convênio'
                : '—'
            }
            disabled={!needsFilterId}
          />
          <p className="text-xs text-secondary-500 mt-1">
            {tipo === 'patient' && 'Para paciente, informe o CPF (só números).'}
            {(tipo === 'company' || tipo === 'insurance') && 'Informe o ID numérico.'}
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          className="btn-primary"
          onClick={handleGenerate}
          disabled={loading || (needsFilterId && !filtroId)}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
          Gerar PDF
        </button>
      </div>
    </div>
  );
}