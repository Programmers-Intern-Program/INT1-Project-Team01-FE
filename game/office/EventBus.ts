type EventMap = {
  "agents:update": [OfficeAgentState[]];
  "agent:clicked": [OfficeAgentState];
  "agent:context": [OfficeAgentContextEvent];
  "controllable:set": [string | number | null];
};

export interface OfficeAgentState {
  id: number | string;
  name: string;
  role: string;
  status: "working" | "idle" | "review" | "blocked";
  desk: number;
  kind: "member" | "agent";
}

export interface OfficeAgentContextEvent {
  agent: OfficeAgentState;
  x: number;
  y: number;
}

type Handler<K extends keyof EventMap> = (...args: EventMap[K]) => void;

class TypedEventBus {
  private handlers = new Map<keyof EventMap, Set<(...args: unknown[]) => void>>();
  private currentAgents: OfficeAgentState[] = [];
  private currentControllable: string | number | null = null;

  on<K extends keyof EventMap>(event: K, handler: Handler<K>) {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler as (...args: unknown[]) => void);
    this.handlers.set(event, handlers);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<K>) {
    this.handlers.get(event)?.delete(handler as (...args: unknown[]) => void);
  }

  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]) {
    if (event === "agents:update") {
      this.currentAgents = args[0] as OfficeAgentState[];
    } else if (event === "controllable:set") {
      this.currentControllable = args[0] as string | number | null;
    }
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }

  getAgents() {
    return this.currentAgents;
  }

  getControllable() {
    return this.currentControllable;
  }
}

export const OfficeEventBus = new TypedEventBus();
