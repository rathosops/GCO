import { motion } from "framer-motion";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  UserPlus,
} from "lucide-react";

type Props = {
  duplicatesInfo: { groups: number; extras: number };
  loading: boolean;

  cleaningDupes: boolean;
  onCleanDuplicates: () => void;

  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenPacientePicker: () => void;
};

export function AgendamentosHeader({
  duplicatesInfo,
  loading,
  cleaningDupes,
  onCleanDuplicates,
  onOpenImport,
  onOpenCreate,
  onOpenPacientePicker,
}: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-secondary-900">Agendamentos</h2>
        <p className="text-secondary-500">
          Controle de agenda e comparecimento
        </p>

        {duplicatesInfo.extras > 0 ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-light/30 px-3 py-1 text-sm text-secondary-900">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span>
              Duplicados detectados: <b>{duplicatesInfo.groups}</b> grupo(s),{" "}
              <b>{duplicatesInfo.extras}</b> registro(s) a remover.
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-3">
        <motion.button
          whileHover={{ scale: duplicatesInfo.extras > 0 ? 1.02 : 1 }}
          whileTap={{ scale: duplicatesInfo.extras > 0 ? 0.98 : 1 }}
          onClick={onCleanDuplicates}
          className={`btn-outline ${duplicatesInfo.extras > 0 ? "" : "opacity-50 cursor-not-allowed"}`}
          type="button"
          disabled={duplicatesInfo.extras === 0 || cleaningDupes || loading}
          title={
            duplicatesInfo.extras > 0
              ? "Remove registros duplicados do dia selecionado"
              : "Nenhum duplicado encontrado"
          }
        >
          {cleaningDupes ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          <span className="hidden sm:inline">Limpar duplicados</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenImport}
          className="btn-secondary"
          type="button"
        >
          <Upload className="h-5 w-5" />
          <span className="hidden sm:inline">Importar CSV</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenPacientePicker}
          className="btn-secondary"
          type="button"
          title="Agendar para paciente já cadastrado"
        >
          <UserPlus className="h-5 w-5" />
          <span className="hidden sm:inline">Paciente Existente</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenCreate}
          className="btn-primary"
          type="button"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Novo Agendamento</span>
        </motion.button>
      </div>
    </div>
  );
}
