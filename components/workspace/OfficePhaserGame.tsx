"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  OfficeEventBus,
  type OfficeAgentContextEvent,
  type OfficeAgentState,
} from "@/game/office/EventBus";

interface OfficePhaserGameProps {
  agents: OfficeAgentState[];
  onAgentClick?: (agent: OfficeAgentState) => void;
  onAgentContextMenu?: (event: OfficeAgentContextEvent) => void;
}

export default function OfficePhaserGame({
  agents,
  onAgentClick,
  onAgentContextMenu,
}: OfficePhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const agentsRef = useRef(agents);

  useLayoutEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    const createWhenSized = () => {
      const container = containerRef.current;
      if (!container || gameRef.current) return;
      if (container.clientWidth <= 0 || container.clientHeight <= 0) return;

      import("@/game/office/main").then(({ createOfficeGame }) => {
        if (disposed || !containerRef.current || gameRef.current) return;
        gameRef.current = createOfficeGame(containerRef.current);
        requestAnimationFrame(() => OfficeEventBus.emit("agents:update", agentsRef.current));
        observer?.disconnect();
        observer = null;
      });
    };

    createWhenSized();
    if (!gameRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(createWhenSized);
      observer.observe(containerRef.current);
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    agentsRef.current = agents;
    OfficeEventBus.emit("agents:update", agents);
  }, [agents]);

  useEffect(() => {
    if (!onAgentClick) return;
    OfficeEventBus.on("agent:clicked", onAgentClick);
    return () => OfficeEventBus.off("agent:clicked", onAgentClick);
  }, [onAgentClick]);

  useEffect(() => {
    if (!onAgentContextMenu) return;
    OfficeEventBus.on("agent:context", onAgentContextMenu);
    return () => OfficeEventBus.off("agent:context", onAgentContextMenu);
  }, [onAgentContextMenu]);

  return <div ref={containerRef} className="h-full w-full" />;
}
