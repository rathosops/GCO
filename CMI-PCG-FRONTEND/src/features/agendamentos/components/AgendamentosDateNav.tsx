import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';

type DateAvailabilityInfo = {
  loading: boolean;
  disponivel: boolean;
  motivo: string | null;
  isFeriado: boolean;
  isFimDeSemana: boolean;
  feriadoNome: string | null;
};

type Props = {
  dateLabel: string;
  formattedDate: string;
  isTodaySelected: boolean;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;

  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;

  /** Informações de disponibilidade da data (feriados) */
  dateAvailability?: DateAvailabilityInfo;
};

export function AgendamentosDateNav({
  dateLabel,
  formattedDate,
  isTodaySelected,

  searchTerm,
  onSearchTermChange,

  onPrevDay,
  onNextDay,
  onToday,

  dateAvailability,
}: Props) {
  const showWarning = dateAvailability && !dateAvailability.disponivel && !dateAvailability.loading;

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onPrevDay} className="btn-icon btn-secondary" type="button">
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="text-center min-w-[200px]">
            <p className="text-sm text-secondary-500 capitalize">{dateLabel}</p>
            <p className="text-xl font-bold text-secondary-900">{formattedDate}</p>

            {/* Indicador de carregamento */}
            {dateAvailability?.loading && (
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-secondary-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Verificando...</span>
              </div>
            )}
          </div>

          <button onClick={onNextDay} className="btn-icon btn-secondary" type="button">
            <ChevronRight className="h-5 w-5" />
          </button>

          {!isTodaySelected && (
            <button onClick={onToday} className="btn-secondary text-sm" type="button">
              Ir para Hoje
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Buscar por paciente/procedimento/hora..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      {/* Aviso de data bloqueada */}
      {showWarning && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning-light/30 p-3 text-sm text-secondary-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-warning flex-shrink-0" />
          <div>
            <p className="font-semibold">
              {dateAvailability.isFeriado && (
                <>
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Feriado: {dateAvailability.feriadoNome}
                </>
              )}
              {dateAvailability.isFimDeSemana && 'Fim de semana'}
              {!dateAvailability.isFeriado && !dateAvailability.isFimDeSemana && 'Data bloqueada'}
            </p>
            <p className="text-secondary-700">
              {dateAvailability.motivo || 'Esta data não está disponível para novos agendamentos.'}
            </p>
            <p className="text-xs text-secondary-500 mt-1">
              Agendamentos existentes ainda podem ser visualizados e editados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
