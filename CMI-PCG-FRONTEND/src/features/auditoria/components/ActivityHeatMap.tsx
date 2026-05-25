/**
 * Heatmap de atividade: dia da semana × hora.
 *
 * SVG custom (sem dependência externa) mostrando quando
 * o sistema é mais utilizado. Tooltip com detalhes.
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { HeatmapPoint } from '../types';
import { WEEKDAY_LABELS_PT } from '../types';

interface Props {
  data: HeatmapPoint[];
  loading?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_SIZE = 20;
const CELL_GAP = 3;
const LABEL_W = 36;
const LABEL_H = 20;

function interpolateColor(ratio: number): string {
  // De bg-200 (frio) → primary-100 (quente)
  // Usando tons de laranja (alinhado ao --primary-100: #FF6600)
  if (ratio === 0) return 'var(--bg-200)';
  const r = Math.round(255);
  const g = Math.round(230 - ratio * 128); // 230 → 102
  const b = Math.round(200 - ratio * 200); // 200 → 0
  const a = 0.3 + ratio * 0.7;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function ActivityHeatmap({ data, loading }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; weekday: number; hour: number; count: number;
  } | null>(null);

  const { grid, maxCount } = useMemo(() => {
    const g: Record<string, number> = {};
    let max = 0;
    data.forEach((p) => {
      const key = `${p.weekday}-${p.hour}`;
      g[key] = (g[key] || 0) + p.count;
      if (g[key] > max) max = g[key];
    });
    return { grid: g, maxCount: max };
  }, [data]);

  if (loading) {
    return <div className="card animate-pulse h-52" />;
  }

  if (!data.length) return null;

  const svgW = LABEL_W + HOURS.length * (CELL_SIZE + CELL_GAP);
  const svgH = LABEL_H + 7 * (CELL_SIZE + CELL_GAP) + 10;

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Clock className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h3 className="font-bold text-text-100">Mapa de Calor</h3>
          <p className="text-sm text-text-200">Quando o sistema é mais utilizado</p>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          width={svgW}
          height={svgH}
          className="select-none"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Labels de hora (topo) */}
          {HOURS.map((h) => (
            <text
              key={`h-${h}`}
              x={LABEL_W + h * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2}
              y={LABEL_H - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-200)"
            >
              {h % 3 === 0 ? `${h}h` : ''}
            </text>
          ))}

          {/* Linhas (dias da semana) */}
          {WEEKDAY_LABELS_PT.map((label, wd) => (
            <g key={`wd-${wd}`}>
              {/* Label do dia */}
              <text
                x={LABEL_W - 6}
                y={LABEL_H + wd * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 4}
                textAnchor="end"
                fontSize={10}
                fill="var(--text-200)"
                fontWeight={500}
              >
                {label}
              </text>

              {/* Células */}
              {HOURS.map((h) => {
                const count = grid[`${wd}-${h}`] || 0;
                const ratio = maxCount > 0 ? count / maxCount : 0;
                const cx = LABEL_W + h * (CELL_SIZE + CELL_GAP);
                const cy = LABEL_H + wd * (CELL_SIZE + CELL_GAP);

                return (
                  <rect
                    key={`${wd}-${h}`}
                    x={cx}
                    y={cy}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={4}
                    fill={interpolateColor(ratio)}
                    stroke={count > 0 ? 'rgba(255,102,0,0.15)' : 'transparent'}
                    strokeWidth={1}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const parent = e.currentTarget.closest('.relative')!.getBoundingClientRect();
                      setTooltip({
                        x: rect.left - parent.left + CELL_SIZE / 2,
                        y: rect.top - parent.top - 8,
                        weekday: wd,
                        hour: h,
                        count,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute pointer-events-none z-10 rounded-lg border border-bg-300
              bg-bg-100 px-3 py-1.5 shadow-md"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <p className="text-xs text-text-200">
              {WEEKDAY_LABELS_PT[tooltip.weekday]} {tooltip.hour}:00–{tooltip.hour}:59
            </p>
            <p className="text-sm font-bold text-text-100">
              {tooltip.count} {tooltip.count === 1 ? 'ação' : 'ações'}
            </p>
          </motion.div>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-2 mt-3 ml-9">
          <span className="text-[10px] text-text-200">Menos</span>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <div
              key={ratio}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: interpolateColor(ratio) }}
            />
          ))}
          <span className="text-[10px] text-text-200">Mais</span>
        </div>
      </div>
    </div>
  );
}