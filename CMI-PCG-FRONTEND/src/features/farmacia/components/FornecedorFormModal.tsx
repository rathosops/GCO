/**
 * Modal para criar/editar fornecedor
 *
 * - Modal max-w-4xl para campos maiores
 * - Busca de CEP via endpoint /cep/:cep (mesma lógica do PacienteFormModal)
 * - Campos com dicas explicativas por seção
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, Loader2, LocateFixed, MapPin, Phone, Mail, User } from "lucide-react";
import { formatCnpj, onlyDigits } from "@/utils/formatters";
import { cepAPI } from "@/services/api";
import type { Fornecedor, FornecedorFormData } from "../types";

interface FornecedorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FornecedorFormData) => Promise<void>;
  initialData?: Fornecedor | null;
  saving: boolean;
}

const EMPTY: FornecedorFormData = {
  nome: "", cnpj: "", razao_social: "", telefone: "", email: "",
  contato_responsavel: "", cep: "", logradouro: "", numero: "",
  complemento: "", bairro: "", cidade: "", uf: "", ativo: true, observacoes: "",
};

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function formatCep(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function FornecedorFormModal({ isOpen, onClose, onSubmit, initialData, saving }: FornecedorFormModalProps) {
  const [form, setForm] = useState<FornecedorFormData>(EMPTY);
  const [cnpjDisplay, setCnpjDisplay] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({
        nome: initialData.nome, cnpj: initialData.cnpj,
        razao_social: initialData.razao_social ?? "", telefone: initialData.telefone ?? "",
        email: initialData.email ?? "", contato_responsavel: initialData.contato_responsavel ?? "",
        cep: initialData.cep ?? "", logradouro: initialData.logradouro ?? "",
        numero: initialData.numero ?? "", complemento: initialData.complemento ?? "",
        bairro: initialData.bairro ?? "", cidade: initialData.cidade ?? "",
        uf: initialData.uf ?? "", ativo: initialData.ativo, observacoes: initialData.observacoes ?? "",
      });
      setCnpjDisplay(formatCnpj(initialData.cnpj));
    } else { setForm(EMPTY); setCnpjDisplay(""); }
    setCepError(null);
  }, [initialData, isOpen]);

  const set = <K extends keyof FornecedorFormData>(k: K, v: FornecedorFormData[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleCnpjChange = (raw: string) => {
    const digits = onlyDigits(raw);
    setCnpjDisplay(formatCnpj(digits));
    set("cnpj", digits.slice(0, 14));
  };

  const buscarCep = async () => {
    const digits = onlyDigits(form.cep ?? "");
    setCepError(null);
    if (!digits) return;
    if (digits.length !== 8) { setCepError("CEP deve ter 8 dígitos."); return; }

    try {
      setCepLoading(true);
      // backend (brasilapi + viacep fallback)
      try {
        const data = await cepAPI.lookup(digits);
        setForm((prev) => ({
          ...prev, cep: digits,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.cidade || prev.cidade,
          uf: data.uf || prev.uf,
        }));
        return;
      } catch { /* fallback */ }

      // fallback direto
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (data?.erro) { setCepError("CEP não encontrado."); return; }
        setForm((prev) => ({
          ...prev, cep: digits,
          logradouro: (data.logradouro || "").trim(),
          bairro: (data.bairro || "").trim(),
          cidade: (data.localidade || "").trim(),
          uf: (data.uf || "").trim(),
        }));
      } else { setCepError("Erro ao consultar CEP."); }
    } catch { setCepError("Falha ao consultar CEP. Tente novamente."); }
    finally { setCepLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await onSubmit(form); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-8 px-4 overflow-y-auto"
        onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-100 rounded-2xl shadow-2xl w-full max-w-4xl mb-8 overflow-hidden flex flex-col max-h-[95vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-bg-300 bg-bg-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 rounded-xl"><Truck className="h-5 w-5 text-purple-600" /></div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-secondary-900">{isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
                <p className="text-xs text-secondary-500">Fornecedores abastecem o estoque de medicamentos da clínica</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost" type="button"><X className="h-5 w-5" /></button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="space-y-6">

              {/* Identificação */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Identificação</h4>
                <p className="text-xs text-secondary-400 mb-4">Dados cadastrais do fornecedor. O CNPJ é único e impede duplicatas no sistema.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nome fantasia *</label>
                    <input className="input" value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Distribuidora MedFarma" required />
                  </div>
                  <div>
                    <label className="label">CNPJ *</label>
                    <input className="input" value={cnpjDisplay} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" required />
                    <p className="text-[11px] text-secondary-400 mt-1">14 dígitos numéricos — será validado ao salvar</p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="label">Razão social</label>
                  <input className="input" value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} placeholder="Razão social conforme registro na Receita Federal (opcional)" />
                </div>
              </section>

              {/* Contato */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Contato</h4>
                <p className="text-xs text-secondary-400 mb-4">Informações para comunicação em caso de pedidos, devoluções ou recall de medicamentos.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label"><span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Telefone</span></label>
                    <input className="input" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                  <div>
                    <label className="label"><span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> E-mail</span></label>
                    <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@fornecedor.com" />
                  </div>
                  <div>
                    <label className="label"><span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Responsável</span></label>
                    <input className="input" value={form.contato_responsavel} onChange={(e) => set("contato_responsavel", e.target.value)} placeholder="Nome do contato principal" />
                  </div>
                </div>
              </section>

              {/* Endereço com CEP */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">
                  <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Endereço</span>
                </h4>
                <p className="text-xs text-secondary-400 mb-4">Digite o CEP e clique em "Buscar" para preencher automaticamente.</p>

                <div className="flex gap-3 mb-4">
                  <div className="w-48">
                    <label className="label">CEP</label>
                    <input className="input" value={formatCep(form.cep ?? "")}
                      onChange={(e) => { setCepError(null); set("cep", onlyDigits(e.target.value).slice(0, 8)); }}
                      onBlur={buscarCep} placeholder="00000-000" inputMode="numeric" />
                    {cepError && <p className="text-xs text-red-600 mt-1">{cepError}</p>}
                  </div>
                  <div className="flex items-end">
                    <button type="button" className="btn-secondary" onClick={buscarCep} disabled={cepLoading}>
                      {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                      <span className="ml-1">Buscar</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                  <div className="sm:col-span-4">
                    <label className="label">Logradouro</label>
                    <input className="input" value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} placeholder="Rua / Avenida" />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="label">Nº</label>
                    <input className="input" value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="123" />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="label">UF</label>
                    <select className="select" value={form.uf} onChange={(e) => set("uf", e.target.value)}>
                      <option value="">--</option>
                      {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div><label className="label">Bairro</label><input className="input" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} placeholder="Bairro" /></div>
                  <div><label className="label">Cidade</label><input className="input" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade" /></div>
                  <div><label className="label">Complemento</label><input className="input" value={form.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Sala, andar..." /></div>
                </div>
              </section>

              {/* Observações */}
              <section>
                <label className="label">Observações</label>
                <textarea className="textarea" rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)}
                  placeholder="Condições de pagamento, prazos de entrega, particularidades..." />
              </section>
            </div>
          </form>

          {/* Footer */}
          <div className="flex gap-3 p-5 sm:p-6 border-t border-bg-300 bg-bg-200/50">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button type="submit" onClick={handleSubmit} className="btn-primary flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Salvar alterações" : "Cadastrar fornecedor"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}