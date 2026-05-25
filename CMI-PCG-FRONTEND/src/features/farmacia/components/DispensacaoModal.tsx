// src/features/farmacia/components/DispensacaoModal.tsx
/**
 * Modal de dispensação de medicamento a paciente
 *
 * FEFO (First Expired, First Out): o sistema seleciona automaticamente
 * os lotes com validade mais próxima, evitando desperdício.
 * Exige CRM prescritor para medicamentos controlados (ANVISA).
 *
 * Usa EntityPicker para buscar paciente (nome/CPF) e médico (nome/CRM).
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Loader2,
  ShieldAlert,
  Search,
  Pill,
  Info,
  AlertTriangle,
} from "lucide-react";
import { debounce } from "@/utils/debounce";
import { onlyDigits } from "@/utils/formatters";
import EntityPicker from "@/components/common/EntityPicker";
import { autocompleteAPI } from "@/services/autocomplete.api";
import { medicosAPI } from "@/services/api";
import type { AutocompletePaciente } from "@/services/autocomplete.api";
import type { Medico } from "@/types";
import type { DispensacaoFormData, MedicamentoAutocomplete } from "../types";
import { medicamentosAPI } from "../api";

interface DispensacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DispensacaoFormData) => Promise<void>;
  saving: boolean;
  preselectedMed?: MedicamentoAutocomplete | null;
}

export function DispensacaoModal({
  isOpen,
  onClose,
  onSubmit,
  saving,
  preselectedMed,
}: DispensacaoModalProps) {
  // Medicamento
  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState<MedicamentoAutocomplete[]>([]);
  const [selectedMed, setSelectedMed] =
    useState<MedicamentoAutocomplete | null>(null);
  const [searching, setSearching] = useState(false);

  // Paciente (via EntityPicker)
  const [selectedPaciente, setSelectedPaciente] =
    useState<AutocompletePaciente | null>(null);

  // Médico (via EntityPicker)
  const [selectedMedico, setSelectedMedico] = useState<Medico | null>(null);

  // Outros campos
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setQuantidade(1);
      setObservacoes("");
      setMedSearch("");
      setMedResults([]);
      setSelectedMed(preselectedMed ?? null);
      setSelectedPaciente(null);
      setSelectedMedico(null);
    }
  }, [isOpen, preselectedMed]);

  // ── Busca medicamento (mantém lógica original) ──────────
  const searchMeds = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setMedResults([]);
        return;
      }
      try {
        setSearching(true);
        const data = await medicamentosAPI.autocomplete(q);
        setMedResults(Array.isArray(data) ? data : []);
      } catch {
        setMedResults([]);
      } finally {
        setSearching(false);
      }
    }, 350),
    [],
  );

  useEffect(() => {
    searchMeds(medSearch);
  }, [medSearch]); // eslint-disable-line

  // ── Loaders para EntityPicker ───────────────────────────
  const loadPacientes = useCallback(
    (q: string) => autocompleteAPI.pacientes(q, { limit: 20 }),
    [],
  );

  const loadMedicos = useCallback(async (q: string): Promise<Medico[]> => {
    const isDigits = /^\d+$/.test(q.trim());
    const params = isDigits ? { crm: q.trim() } : { nome: q.trim() };
    return medicosAPI.getAll(params);
  }, []);

  // ── Derived ─────────────────────────────────────────────
  const isControlado = selectedMed?.classificacao_anvisa
    ? !["LIVRE", "SOB_PRESCRICAO"].includes(selectedMed.classificacao_anvisa)
    : false;

  const cpfClean = selectedPaciente
    ? onlyDigits(String(selectedPaciente.cpf_raw ?? selectedPaciente.cpf))
    : "";
  const cpfValid = cpfClean.length === 11;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed || !cpfValid) return;

    await onSubmit({
      medicamento_id: selectedMed.id,
      quantidade,
      cpf_paciente: cpfClean,
      crm_medico_prescritor: selectedMedico
        ? Number(onlyDigits(String((selectedMedico as any).crm ?? "")))
        : undefined,
      observacoes: observacoes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-8 px-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-100 rounded-2xl shadow-2xl w-full max-w-lg mb-8 overflow-hidden flex flex-col max-h-[95vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-bg-300 bg-bg-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary-900">
                  Dispensar Medicamento
                </h2>
                <p className="text-xs text-secondary-500">
                  Entregar medicamento do estoque ao paciente
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon btn-ghost"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-5 sm:p-6"
          >
            <div className="space-y-5">
              {/* Explainer FEFO */}
              <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>FEFO automático:</strong> o sistema seleciona
                  automaticamente os lotes com validade mais próxima (First
                  Expired, First Out), evitando desperdício.
                </div>
              </div>

              {/* ── Busca medicamento ─────────────────────── */}
              {!selectedMed ? (
                <div>
                  <label className="label">Medicamento *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                    <input
                      className="input pl-10"
                      value={medSearch}
                      onChange={(e) => setMedSearch(e.target.value)}
                      placeholder="Buscar por nome ou princípio ativo..."
                      autoFocus
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-secondary-400" />
                    )}
                  </div>

                  {medSearch.length >= 2 &&
                    !searching &&
                    medResults.length === 0 && (
                      <div className="mt-2 p-3 text-center text-sm text-secondary-500 border border-bg-300 rounded-xl">
                        <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-secondary-400" />
                        Nenhum medicamento encontrado para "{medSearch}"
                      </div>
                    )}

                  {medResults.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-bg-300 rounded-xl">
                      {medResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedMed(m);
                            setMedResults([]);
                            setMedSearch("");
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-bg-200 transition-colors border-b border-bg-200 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-secondary-900">
                            {m.nome_comercial}
                          </p>
                          <p className="text-xs text-secondary-500">
                            {m.principio_ativo}
                            {m.concentracao ? ` · ${m.concentracao}` : ""} ·
                            Estoque: {m.estoque_total} un
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pill className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-secondary-900 truncate">
                        {selectedMed.nome_comercial}
                      </p>
                      <p className="text-xs text-secondary-500">
                        Estoque disponível: {selectedMed.estoque_total} un
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => setSelectedMed(null)}
                  >
                    Trocar
                  </button>
                </div>
              )}

              {selectedMed && selectedMed.estoque_total === 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Este medicamento está com estoque zerado. Não é possível
                  dispensar.
                </div>
              )}

              {/* ── Paciente (EntityPicker) ───────────────── */}
              <EntityPicker<AutocompletePaciente>
                title="Paciente *"
                placeholder="Buscar por nome ou CPF..."
                selected={selectedPaciente}
                onSelect={setSelectedPaciente}
                onClear={() => setSelectedPaciente(null)}
                load={loadPacientes}
                minChars={2}
                renderItem={(p) => ({
                  title: p.nome,
                  subtitle: `CPF: ${p.cpf}`,
                  right: p.empresa_nome || p.convenio_nome || undefined,
                })}
              />

              {/* ── Quantidade ────────────────────────────── */}
              <div>
                <label className="label">Quantidade *</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={selectedMed?.estoque_total ?? 9999}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  required
                />
                <p className="text-[11px] text-secondary-400 mt-1">
                  Unidades a serem dispensadas
                </p>
              </div>

              {/* ── Médico prescritor (EntityPicker) ──────── */}
              {isControlado ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <span className="text-xs font-semibold text-red-700">
                      Medicamento controlado (ANVISA) — Médico obrigatório
                    </span>
                  </div>
                  <EntityPicker<Medico>
                    title="Médico prescritor *"
                    placeholder="Buscar por nome ou CRM..."
                    selected={selectedMedico}
                    onSelect={setSelectedMedico}
                    onClear={() => setSelectedMedico(null)}
                    load={loadMedicos}
                    minChars={2}
                    renderItem={(m) => ({
                      title: m.nome,
                      subtitle: `CRM: ${(m as any).crm ?? "—"}`,
                      right: (m as any).especialidade || undefined,
                    })}
                  />
                  <p className="text-[11px] text-red-600/70">
                    Exigência da Portaria 344/1998 — dispensação de controlados
                    exige receita médica
                  </p>
                </div>
              ) : (
                <EntityPicker<Medico>
                  title="Médico prescritor (opcional)"
                  placeholder="Buscar por nome ou CRM..."
                  selected={selectedMedico}
                  onSelect={setSelectedMedico}
                  onClear={() => setSelectedMedico(null)}
                  load={loadMedicos}
                  minChars={2}
                  renderItem={(m) => ({
                    title: m.nome,
                    subtitle: `CRM: ${(m as any).crm ?? "—"}`,
                    right: (m as any).especialidade || undefined,
                  })}
                />
              )}

              {/* ── Observações ───────────────────────────── */}
              <div>
                <label className="label">Observações</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações adicionais sobre esta dispensação..."
                />
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="flex gap-3 p-5 sm:p-6 border-t border-bg-300 bg-bg-200/50">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="btn-primary flex-1"
              disabled={
                saving ||
                !selectedMed ||
                !cpfValid ||
                (selectedMed?.estoque_total ?? 0) === 0 ||
                (isControlado && !selectedMedico)
              }
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Dispensar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
