/**
 * @module features/pacientes/hooks
 */

export {
  usePacientes,
  usePaciente,
  usePacientesStats,
  usePacienteFrequencia,
  useProntuario,
  usePacienteAutocomplete,
  usePacientesFrequentes,
  useRelatorioResumo,
  useRelatorioFidelidade,
  useAniversariantes,
  usePacientesInativos,
  usePacienteMutations,
  usePacientePdfDownload,
  getNivelFidelidadeConfig,
} from './usePacientes';

export type { UsePacientesOptions } from './usePacientes';