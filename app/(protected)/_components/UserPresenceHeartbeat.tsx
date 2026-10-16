"use client";

import { useEffect } from "react";

import { startUserPresenceHeartbeat } from "@/lib/authorization/presence-heartbeat";

export function UserPresenceHeartbeat() {
  useEffect(
    () =>
      startUserPresenceHeartbeat({
        visibility: document,
        onlineEvents: window,
        fetch,
      }),
    [],
  );

  return null;
}
