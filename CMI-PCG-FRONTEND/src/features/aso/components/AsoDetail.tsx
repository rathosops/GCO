// src/features/aso/components/AsoDetail.tsx

import { useEffect, useRef } from 'react';
import {
  X,
  FileDown,
  User,
  Building2,
  Stethoscope,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  AlertTriangle,
  ClipboardList,
  Clock,
  Briefcase,
} from 'lucide-react';
import { asoAPI, downloadBlob, extractBlobError } from '../api/aso.api';
import { useToast } from '@/components/feedback/toast';
import { formatCpf, formatCnpj } from '@/utils/formatters';
import type { AsoRecord } from '../types/aso.types';
import { TIPOS_EXAME_MAP, CONCLUSAO_MAP, RISCOS_LABELS, NRS_LABELS } from '../types/aso.types';

// ============================================
// Section sub-component
// ============================================

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary-100" />
        <h4 className="text-sm font-semibold text-text-100 uppercase tracking-wide">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start py-1.5">
      <span className="text-sm text-text-200 w-32 shrink-0">{label}</span>
      <span className="text-sm text-text-100 font-medium">{value}</span>
    </div>
  );
}

// ============================================
// Main Component (Slide-over)
// ============================================

export default function AsoDetail({ aso, onClose }: {
  aso: AsoRecord;
  onClose: () => void;
}) {
  const toast = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const blob = await asoAPI.gerarPdfSalvo(aso.id);
      const nome = (aso.paciente_nome || 'aso').replace(/\s+/g, '_');
      downloadBlob(blob, `aso_${aso.id}_${nome}.pdf`);
      toast.success('PDF baixado!');
    } catch (error) {
      toast.error(await extractBlobError(error));
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const conclusaoStyle: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    APTO: { icon: ShieldCheck, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    INAPTO: { icon: ShieldX, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    APTO_COM_RESTRICOES: { icon: ShieldAlert, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  };
  const cs = conclusaoStyle[aso.conclusao] || conclusaoStyle.APTO;
  const ConcIcon = cs.icon;

  const riscos = aso.riscos_ocupacionais || {};
  const exames = aso.exames_complementares?.exames || [];
  const nrs = aso.normas_regulamentadoras || {};

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-bg-100 z-50 shadow-xl
                   overflow-y-auto border-l border-bg-300
                   animate-[slideIn_0.25s_ease-out]"
        style={{
          animationName: 'slideIn',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-100/95 backdrop-blur-sm border-b border-bg-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-bold text-text-100">ASO #{aso.id}</h3>
            <p className="text-sm text-text-200">{formatDate(aso.data)} às {aso.hora}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-primary btn-sm" onClick={handleDownload}>
              <FileDown className="h-4 w-4" /> PDF
            </button>
            <button className="btn-ghost btn-icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-2 divide-y divide-bg-200">
          {/* Conclusão destaque */}
          <div className="py-4">
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${cs.bg}`}>
              <ConcIcon className={`h-8 w-8 ${cs.color}`} />
              <div>
                <p className="text-xs text-text-200 uppercase tracking-wide">Conclusão Médica</p>
                <p className={`text-xl font-bold ${cs.color}`}>
                  {CONCLUSAO_MAP[aso.conclusao] || aso.conclusao}
                </p>
              </div>
            </div>
            {aso.restricoes && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase">Restrições</p>
                    <p className="text-sm text-amber-800 mt-0.5">{aso.restricoes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trabalhador */}
          <Section title="Trabalhador" icon={User}>
            <InfoRow label="Nome" value={aso.paciente_nome} />
            <InfoRow label="CPF" value={formatCpf(String(aso.cpf_paciente))} />
            <InfoRow label="Função" value={aso.funcao_paciente} />
            <InfoRow label="Setor" value={aso.setor} />
          </Section>

          {/* Empresa */}
          <Section title="Organização" icon={Building2}>
            <InfoRow label="Razão Social" value={aso.empresa_nome} />
            <InfoRow label="CNPJ" value={formatCnpj(String(aso.cnpj_empresa))} />
          </Section>

          {/* Exame */}
          <Section title="Exame" icon={Briefcase}>
            <InfoRow label="Tipo" value={TIPOS_EXAME_MAP[aso.tipo_exame] || aso.tipo_exame} />
            <InfoRow label="Data" value={formatDate(aso.data)} />
            <InfoRow label="Hora" value={aso.hora} />
          </Section>

          {/* Médico */}
          <Section title="Médico Examinador" icon={Stethoscope}>
            <InfoRow label="Nome" value={aso.medico_nome} />
            <InfoRow label="CRM" value={String(aso.crm_medico)} />
            <InfoRow label="Especialidade" value={aso.medico_especialidade} />
          </Section>

          {/* Riscos */}
          {Object.values(riscos).some(Boolean) && (
            <Section title="Riscos Ocupacionais" icon={AlertTriangle}>
              {Object.entries(riscos).map(([key, val]) =>
                val ? (
                  <InfoRow
                    key={key}
                    label={RISCOS_LABELS[key as keyof typeof RISCOS_LABELS] || key}
                    value={val}
                  />
                ) : null
              )}
            </Section>
          )}

          {/* Exames complementares */}
          {exames.length > 0 && (
            <Section title="Exames Complementares" icon={ClipboardList}>
              <div className="flex flex-wrap gap-2">
                {exames.map((ex, i) => (
                  <span key={i} className="badge-primary px-3 py-1 text-xs">
                    {ex}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* NRs */}
          {Object.values(nrs).some(Boolean) && (
            <Section title="Normas Regulamentadoras" icon={ShieldCheck}>
              {Object.entries(nrs).map(([key, val]) =>
                val ? (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-text-200">
                      {NRS_LABELS[key as keyof typeof NRS_LABELS] || key}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      val.toLowerCase().includes('conforme') && !val.toLowerCase().includes('não')
                        ? 'bg-green-50 text-green-700'
                        : val.toLowerCase().includes('não')
                        ? 'bg-red-50 text-red-700'
                        : 'bg-bg-200 text-text-200'
                    }`}>
                      {val}
                    </span>
                  </div>
                ) : null
              )}
            </Section>
          )}

          {/* Observações */}
          {aso.observacoes && (
            <Section title="Observações" icon={ClipboardList}>
              <p className="text-sm text-text-200 bg-bg-200 p-3 rounded-xl">
                {aso.observacoes}
              </p>
            </Section>
          )}

          {/* Audit */}
          <Section title="Registro" icon={Clock}>
            <InfoRow label="Criado em" value={aso.created_at ? new Date(aso.created_at).toLocaleString('pt-BR') : null} />
            <InfoRow label="Atualizado" value={aso.updated_at ? new Date(aso.updated_at).toLocaleString('pt-BR') : null} />
            <InfoRow label="Criado por" value={aso.created_by} />
          </Section>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}