/**
 * Modal para selecionar paciente existente (usado em Agendamentos)
 */
import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, User, X } from "lucide-react";
import {
  autocompleteAPI,
  type AutocompletePaciente,
} from "@/services/autocomplete.api";
import { debounce } from "@/utils/debounce";
import { initialFrom } from "@/utils/initials";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (paciente: AutocompletePaciente) => void;
}

export function PacientePickerModal({ isOpen, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AutocompletePaciente[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (q.trim().length < 2) {
          setResults([]);
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const data = await autocompleteAPI.pacientes(q, { limit: 15 });
          setResults(data);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300),
    [],
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  const handleSelect = (p: AutocompletePaciente) => {
    onSelect(p);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          onClick={(e) => e.stopPropagation()}
          className="card w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-bold text-secondary-900">
                Selecionar Paciente
              </h3>
            </div>
            <button
              onClick={onClose}
              className="btn-icon btn-ghost"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="input pl-10"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="w-full text-left p-3 rounded-xl border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="avatar-md">
                        {initialFrom(p?.nome, "P")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-secondary-900 truncate">
                          {p.nome}
                        </p>
                        <p className="text-sm text-secondary-500">
                          CPF: {p.cpf}
                        </p>
                        {p.empresa_nome && (
                          <p className="text-xs text-secondary-400 truncate">
                            {p.empresa_nome}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="text-center py-8 text-secondary-500">
                Nenhum paciente encontrado
              </div>
            ) : (
              <div className="text-center py-8 text-secondary-400">
                Digite pelo menos 2 caracteres para buscar
              </div>
            )}
          </div>

          <div className="pt-4 border-t mt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary w-full"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
