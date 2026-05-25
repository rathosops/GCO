"use client";

import { useEffect, useMemo, useState } from "react";

import { getPanelState } from "@/lib/api";
import { playCallTone } from "@/lib/sound";
import { tenantConfig } from "@/lib/tenant";
import { connectPanelSocket } from "@/lib/ws";
import type { PanelCall, PanelEvent } from "@/types/api";

function displayTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mergeCall(list: PanelCall[], call: PanelCall): PanelCall[] {
  const withoutCurrent = list.filter((item) => item.id !== call.id);
  return [call, ...withoutCurrent].slice(0, 8);
}

export default function PainelPage() {
  const [activeCalls, setActiveCalls] = useState<PanelCall[]>([]);
  const [recentCalls, setRecentCalls] = useState<PanelCall[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const mainCall = useMemo(() => activeCalls[0] ?? recentCalls[0], [
    activeCalls,
    recentCalls,
  ]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | null = null;
    let isClosed = false;

    function applyEvent(event: PanelEvent) {
      const call = event.payload;

      if (event.type === "call.created") {
        playCallTone();
        setActiveCalls((current) => mergeCall(current, call));
        return;
      }

      if (event.type === "call.started") {
        setActiveCalls((current) => mergeCall(current, call));
        return;
      }

      setActiveCalls((current) => current.filter((item) => item.id !== call.id));
      setRecentCalls((current) => mergeCall(current, call));
    }

    function connect() {
      socket = connectPanelSocket(applyEvent);
      socket.addEventListener("open", () => setIsConnected(true));
      socket.addEventListener("close", () => {
        setIsConnected(false);

        if (!isClosed) {
          retry = window.setTimeout(connect, 2500);
        }
      });
    }

    getPanelState().then((state) => {
      setActiveCalls(state.active_calls);
      setRecentCalls(state.recent_calls);
    });
    connect();

    return () => {
      isClosed = true;
      socket?.close();

      if (retry) {
        window.clearTimeout(retry);
      }
    };
  }, []);

  return (
    <main className="tv-shell">
      <header className="tv-header">
        <div>
          <p className="eyebrow">{tenantConfig.appName}</p>
          <h1>Chamadas</h1>
        </div>
        <span className={isConnected ? "status online" : "status"}>
          {isConnected ? "Online" : "Reconectando"}
        </span>
      </header>

      <section className="tv-current" aria-live="polite">
        {mainCall ? (
          <>
            <span className="tv-sequence">#{mainCall.sequence_number}</span>
            <strong>{mainCall.message ?? "Paciente"}</strong>
            <span>{mainCall.kind}</span>
          </>
        ) : (
          <strong>Sem chamadas</strong>
        )}
      </section>

      <section className="tv-list" aria-label="Chamadas recentes">
        {[...activeCalls.slice(1), ...recentCalls].slice(0, 6).map((call) => (
          <article className="tv-row" key={`${call.status}-${call.id}`}>
            <strong>{call.message ?? `Chamada ${call.sequence_number}`}</strong>
            <span>
              #{call.sequence_number} / {displayTime(call.called_at)}
            </span>
          </article>
        ))}
      </section>
    </main>
  );
}
