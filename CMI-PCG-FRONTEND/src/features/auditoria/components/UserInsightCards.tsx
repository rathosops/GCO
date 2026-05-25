/**
 * Perfis de usuário com insights comportamentais narrativos.
 *
 * Melhorias v2:
 * - Usa labels vindos do backend (favorite_resource_label, top_resources[].label)
 * - Animação de staggered reveal melhorada
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import type { UserProfile } from "../types";
import { ACTION_CONFIG } from "../types";

interface Props {
  profiles: UserProfile[];
  loading?: boolean;
}

function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 bg-bg-200 rounded-full overflow-hidden flex-1">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5 }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

function UserCard({
  profile,
  maxActions,
  rank,
}: {
  profile: UserProfile;
  maxActions: number;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const initial = (profile.user_nome || "?")[0].toUpperCase();

  const avatarColors = [
    "from-yellow-400 to-amber-500",
    "from-gray-300 to-gray-400",
    "from-amber-600 to-amber-700",
    "from-primary-100 to-primary-200",
  ];
  const avatarGrad = avatarColors[Math.min(rank, 3)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={`rounded-xl border transition-all overflow-hidden ${
        expanded
          ? "border-primary-200/40 shadow-sm bg-bg-100"
          : "border-bg-300 hover:border-primary-200/30 bg-bg-100"
      }`}
    >
      {/* Header compacto */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs font-bold text-text-200 w-5 text-center tabular-nums">
            {rank + 1}
          </span>
          <div
            className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGrad}
            flex items-center justify-center text-white font-bold text-sm shadow-sm`}
          >
            {initial}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-100 truncate">
              {profile.user_nome || `Usuário #${profile.user_id}`}
            </span>
            {profile.user_type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-200 text-text-200 capitalize shrink-0">
                {profile.user_type}
              </span>
            )}
          </div>
          <p className="text-xs text-text-200 mt-0.5 line-clamp-1">
            {profile.phrases[0]?.replace(/\*\*/g, "")}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-text-100 tabular-nums">
              {profile.total_actions}
            </p>
            <p className="text-[10px] text-text-200">ações</p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-text-200" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-200" />
          )}
        </div>
      </div>

      {/* Detalhes expandidos */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-4 border-t border-bg-200">
              {/* Frases narrativas */}
              <div className="pt-3 space-y-2">
                {profile.phrases.map((phrase, i) => (
                  <p
                    key={i}
                    className="text-xs text-text-200 leading-relaxed flex items-start gap-2"
                  >
                    <span className="text-text-200/50 mt-0.5">•</span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: phrase.replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong class="text-text-100">$1</strong>',
                        ),
                      }}
                    />
                  </p>
                ))}
              </div>

              {/* Breakdown por ação */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-text-200 uppercase tracking-wider">
                  Distribuição de ações
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(profile.action_breakdown).map(
                    ([action, count]) => {
                      const cfg = ACTION_CONFIG[action] || {
                        label: action,
                        color: "text-text-200",
                        bg: "bg-bg-200",
                      };
                      return (
                        <div key={action} className="flex items-center gap-1.5">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium`}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-xs text-text-200 tabular-nums">
                            {count}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Top recursos com labels do backend */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-text-200 uppercase tracking-wider">
                  Módulos mais acessados
                </p>
                <div className="space-y-1">
                  {profile.top_resources.slice(0, 4).map((r) => (
                    <div key={r.resource} className="flex items-center gap-2">
                      <span className="text-xs text-text-200 w-24 truncate">
                        {r.label || r.resource}
                      </span>
                      <MiniBar
                        value={r.count}
                        max={profile.top_resources[0]?.count || 1}
                        color="bg-gradient-to-r from-primary-100 to-primary-200"
                      />
                      <span className="text-[10px] text-text-200 tabular-nums w-6 text-right">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-3 text-[10px] text-text-200">
                <span>{profile.active_days} dias ativos</span>
                <span>•</span>
                <span>{profile.resources_count} módulos</span>
                {profile.peak_hour !== null && (
                  <>
                    <span>•</span>
                    <span>Pico às {profile.peak_hour}h</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function UserInsightCards({ profiles, loading }: Props) {
  if (loading) {
    return (
      <div className="card space-y-3">
        <div className="h-6 bg-bg-200 rounded w-48 animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-bg-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!profiles.length) {
    return (
      <div className="card text-center py-10 text-text-200">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-sm">Nenhuma atividade de usuário</p>
      </div>
    );
  }

  const maxActions = profiles[0]?.total_actions || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 rounded-lg">
          <Users className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="font-bold text-text-100">Perfis de Atividade</h3>
          <p className="text-sm text-text-200">
            Comportamento individual dos colaboradores
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {profiles.map((profile, idx) => (
          <UserCard
            key={profile.user_id}
            profile={profile}
            maxActions={maxActions}
            rank={idx}
          />
        ))}
      </div>
    </div>
  );
}
