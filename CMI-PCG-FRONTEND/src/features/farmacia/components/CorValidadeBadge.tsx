/**
 * Badge visual do semáforo de validade de lotes
 *
 * 🟢 VERDE   — Validade > 180 dias (seguro)
 * 🟠 LARANJA — Validade entre 90–180 dias (atenção)
 * 🔴 VERMELHO — Validade < 90 dias (urgente, priorizar uso)
 * ⛔ VENCIDO  — Já expirou, não pode ser dispensado
 */

import type { CorValidade } from "../types";
import { COR_VALIDADE_CONFIG } from "../types";

interface CorValidadeBadgeProps {
  cor: CorValidade;
  diasParaVencer?: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function CorValidadeBadge({ cor, diasParaVencer, size = "sm", showLabel = true }: CorValidadeBadgeProps) {
  const cfg = COR_VALIDADE_CONFIG[cor];
  if (!cfg) return null;

  const sizeClasses = size === "sm"
    ? "text-xs px-2 py-0.5 gap-1"
    : "text-sm px-3 py-1 gap-1.5";

  const tooltipText = cor === "VENCIDO"
    ? "Este lote está vencido e não pode ser dispensado."
    : cor === "VERMELHO"
      ? `Atenção: vence em ${diasParaVencer ?? "< 90"} dias. Priorize o uso deste lote.`
      : cor === "LARANJA"
        ? `Vence em ${diasParaVencer ?? "90–180"} dias. Fique atento à validade.`
        : `Validade segura (${diasParaVencer ? `${diasParaVencer} dias` : "> 180 dias"}).`;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${cfg.bg} ${cfg.text} ${cfg.border} border`}
      title={tooltipText}
    >
      <span>{cfg.icon}</span>
      {showLabel && <span>{cfg.label}</span>}
      {diasParaVencer !== undefined && cor !== "VENCIDO" && (
        <span className="opacity-70">({diasParaVencer}d)</span>
      )}
    </span>
  );
}