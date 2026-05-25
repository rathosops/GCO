"use client";

import type { PanelEvent } from "@/types/api";

export function getPanelWebSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_BASE_URL;

  if (configured?.startsWith("ws://") || configured?.startsWith("wss://")) {
    return configured;
  }

  const path = configured ?? "/ws/panel";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.host}${path}`;
}

export function connectPanelSocket(onEvent: (event: PanelEvent) => void): WebSocket {
  const socket = new WebSocket(getPanelWebSocketUrl());

  socket.addEventListener("message", (message) => {
    const event = JSON.parse(message.data as string) as PanelEvent;
    onEvent(event);
  });

  return socket;
}
