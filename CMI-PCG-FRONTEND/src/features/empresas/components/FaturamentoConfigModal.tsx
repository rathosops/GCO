/**
 * Modal para configurar faturamento posterior de uma empresa.
 *
 * Permite definir: flag ativo, dia de corte, valores por consulta/ASO,
 * e observações do acordo de faturamento.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, X, Loader2, DollarSign, Calendar, FileText } from "lucide-react";
import type { Empresa, FaturamentoConfig } from "../types";
import { INITIAL_FATURAMENTO_CONFIG } from "../types";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (config: Partial<FaturamentoConfig>) => Promise<void>;
    empresa: Empresa | null;
    saving: boolean;
}

export function FaturamentoConfigModal({ isOpen, onClose, onSubmit, empresa, saving }: Props) {
    const [form, setForm] = useState<FaturamentoConfig>(INITIAL_FATURAMENTO_CONFIG);

    useEffect(() => {
        if (!isOpen || !empresa) return;
        setForm({
            faturamento_posterior: empresa.faturamento_posterior ?? false,
            dia_faturamento: empresa.dia_faturamento ?? null,
            valor_por_consulta: empresa.valor_por_consulta ?? null,
            valor_por_aso: empresa.valor_por_aso ?? null,
            observacoes_faturamento: empresa.observacoes_faturamento ?? "",
        });
    }, [isOpen, empresa]);

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        await onSubmit(form);
    };

    if (!isOpen || !empresa) return null;

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/50 z-40"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-xl">
                                <Settings className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    Configurar Faturamento
                                </h3>
                                <p className="text-xs text-slate-500">{empresa.nome}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-icon btn-ghost">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Toggle ativo */}
                        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-slate-300 text-emerald-600"
                                checked={form.faturamento_posterior}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, faturamento_posterior: e.target.checked }))
                                }
                            />
                            <div>
                                <span className="text-sm font-semibold text-slate-800">
                                    Faturamento posterior ativo
                                </span>
                                <p className="text-xs text-slate-500">
                                    Pacientes são atendidos gratuitamente e a empresa recebe cobrança consolidada mensal.
                                </p>
                            </div>
                        </label>

                        {/* Dia de corte */}
                        <div>
                            <label className="label flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                Dia de faturamento (corte mensal)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                className="input"
                                value={form.dia_faturamento ?? ""}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        dia_faturamento: e.target.value ? Number(e.target.value) : null,
                                    }))
                                }
                                placeholder="Ex: 30 (dia do mês)"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Deixe vazio para usar período personalizado ao gerar relatórios.
                            </p>
                        </div>

                        {/* Valores */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                                    Valor por Consulta (R$)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="input"
                                    value={form.valor_por_consulta ?? ""}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            valor_por_consulta: e.target.value ? Number(e.target.value) : null,
                                        }))
                                    }
                                    placeholder="0,00"
                                />
                            </div>
                            <div>
                                <label className="label flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                                    Valor por ASO (R$)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="input"
                                    value={form.valor_por_aso ?? ""}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            valor_por_aso: e.target.value ? Number(e.target.value) : null,
                                        }))
                                    }
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        {/* Observações */}
                        <div>
                            <label className="label flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-slate-400" />
                                Observações do acordo
                            </label>
                            <textarea
                                className="input min-h-[80px]"
                                value={form.observacoes_faturamento}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, observacoes_faturamento: e.target.value }))
                                }
                                placeholder="Ex: Pagamento via boleto até o 5º dia útil do mês seguinte..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-secondary flex-1"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primary flex-1" disabled={saving}>
                                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </>
    );
}