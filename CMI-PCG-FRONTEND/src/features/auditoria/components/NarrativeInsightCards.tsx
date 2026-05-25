/**
 * Cards narrativos com insights contextuais do sistema.
 *
 * Substitui KPIs genéricos por frases acionáveis que contam
 * a "história" da atividade no sistema (Data Storytelling).
 */

import { motion } from 'framer-motion';
import type { NarrativeCard } from '../types';
import { CARD_TYPE_STYLES } from '../types';

interface Props {
  cards: NarrativeCard[];
  loading?: boolean;
}

export function NarrativeInsightCards({ cards, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (!cards.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card, idx) => {
        const style = CARD_TYPE_STYLES[card.type] || CARD_TYPE_STYLES.info;

        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className={`rounded-xl border p-4 ${style.border} ${style.bg}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none shrink-0">{card.icon}</span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${style.text}`}>{card.title}</p>
                <p className="text-xs text-text-200 mt-1 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}