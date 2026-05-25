/**
 * Badges visuais para tipo de receita e status
 * @module features/receituarios/components/Badges
 */

import { TIPO_RECEITA_CONFIG, STATUS_CONFIG } from "../types";
import type { TipoReceita, StatusReceituario } from "../types";

// =============================================================================
// TipoReceitaBadge
// =============================================================================

interface TipoReceitaBadgeProps {
  tipo: TipoReceita;
  compact?: boolean;
}

export function TipoReceitaBadge({ tipo, compact = false }: TipoReceitaBadgeProps) {
  const cfg = TIPO_RECEITA_CONFIG[tipo];
  if (!cfg) return <span className="text-xs text-secondary-500">{tipo}</span>;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.cor} ${cfg.border}`}
      title={cfg.descricao}
    >
      <span>{cfg.icon}</span>
      {!compact && <span>{cfg.label}</span>}
    </span>
  );
}

// =============================================================================
// StatusBadge
// =============================================================================

interface StatusBadgeProps {
  status: StatusReceituario;
  statusEfetivo?: StatusReceituario;
}

export function StatusBadge({ status, statusEfetivo }: StatusBadgeProps) {
  const resolvedStatus = statusEfetivo ?? status;
  const cfg = STATUS_CONFIG[resolvedStatus];
  if (!cfg) return <span className="text-xs text-secondary-500">{status}</span>;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.cor} ${cfg.border}`}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}