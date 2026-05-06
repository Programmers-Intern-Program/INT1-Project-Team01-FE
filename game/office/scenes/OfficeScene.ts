import Phaser from "phaser";
import { OfficeEventBus, type OfficeAgentState } from "../EventBus";

const FLOOR = 0xf7e8c7;
const WALL = 0xbfe7d8;
const LINE = 0xcfae76;
const DESK = 0xd49a5c;
const DESK_EDGE = 0x8f6f46;
const CHAIR = 0x6d8b8f;
const MONITOR = 0xe8f7ff;
const PRIMARY = 0x0f766e;
const AGENT = 0xf59e0b;
const INFO = 0x2563eb;

const STATUS_COLOR: Record<OfficeAgentState["status"], number> = {
  working: 0x0284c7,
  idle: 0x8a98a8,
  review: 0x2563eb,
  blocked: 0xd97706,
};

export class OfficeScene extends Phaser.Scene {
  private agents: OfficeAgentState[] = [];
  private unsubscribe?: () => void;
  private ready = false;

  constructor() {
    super("OfficeScene");
  }

  create() {
    this.scale.on("resize", this.render, this);
    this.agents = OfficeEventBus.getAgents();
    const onAgentsUpdate = (agents: OfficeAgentState[]) => {
      this.agents = agents;
      this.render();
    };
    OfficeEventBus.on("agents:update", onAgentsUpdate);
    this.unsubscribe = () => OfficeEventBus.off("agents:update", onAgentsUpdate);
    const teardown = () => {
      this.ready = false;
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.scale.off("resize", this.render, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, teardown);
    this.events.once(Phaser.Scenes.Events.DESTROY, teardown);
    this.ready = true;
    this.render();
  }

  private render() {
    if (!this.ready || !this.cameras?.main) return;
    this.children.removeAll(true);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#dff1f6");

    this.drawSkyline(width);
    const floor = this.getFloorRect(width, height);
    this.drawFloor(floor);
    this.drawConferenceTable(floor);
    this.agents.forEach((agent, index) => this.drawAgent(agent, index, floor));

    if (this.agents.length === 0) {
      this.drawEmptyState(width, height);
    }
  }

  private getFloorRect(width: number, height: number) {
    return {
      x: Math.max(16, width * 0.05),
      y: 34,
      width: Math.max(320, width * 0.9),
      height: Math.max(360, height - 106),
    };
  }

  private drawSkyline(width: number) {
    const g = this.add.graphics();
    g.fillStyle(0xbfe7ff, 0.55);
    g.fillRect(0, 0, width, 130);
    [[0.08, 34, 88, 58], [0.28, 52, 74, 44], [0.66, 30, 92, 52], [0.84, 48, 74, 44]].forEach(
      ([xRatio, y, w, h]) => {
        g.lineStyle(1, 0xffffff, 0.75);
        g.fillStyle(0xffffff, 0.35);
        g.fillRoundedRect(width * xRatio, y, w, h, 6);
        g.strokeRoundedRect(width * xRatio, y, w, h, 6);
      },
    );
  }

  private drawFloor(rect: { x: number; y: number; width: number; height: number }) {
    const g = this.add.graphics();
    g.fillStyle(FLOOR, 1);
    g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    g.lineStyle(4, 0x9fc3bd, 1);
    g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    g.fillStyle(WALL, 1);
    g.fillRect(rect.x + 4, rect.y + 4, rect.width - 8, 72);
    g.lineStyle(1, LINE, 0.45);
    for (let x = rect.x; x <= rect.x + rect.width; x += 44) {
      g.lineBetween(x, rect.y, x, rect.y + rect.height);
    }
    for (let y = rect.y; y <= rect.y + rect.height; y += 44) {
      g.lineBetween(rect.x, y, rect.x + rect.width, y);
    }
    g.fillStyle(0xd6ba83, 1);
    g.fillRect(rect.x + 4, rect.y + rect.height - 34, rect.width - 8, 30);
  }

  private drawBoard(x: number, y: number, title: string, label: string, value: string) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.72);
    g.lineStyle(2, 0x8fb3aa, 1);
    g.fillRoundedRect(x, y, 230, 86, 8);
    g.strokeRoundedRect(x, y, 230, 86, 8);
    this.add.text(x + 12, y + 10, title.toUpperCase(), { fontSize: "10px", color: "#627386", fontFamily: "monospace" });
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x + 12, y + 30, 206, 42, 6);
    g.fillStyle(PRIMARY, 0.16);
    g.fillRoundedRect(x + 22, y + 38, 28, 26, 4);
    this.add.text(x + 60, y + 38, label, { fontSize: "12px", color: "#17212b", fontStyle: "bold" });
    this.add.text(x + 60, y + 54, value, { fontSize: "10px", color: "#627386" });
  }

  private drawConferenceTable(rect: { x: number; y: number; width: number; height: number }) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height * 0.43;
    const g = this.add.graphics();
    g.fillStyle(CHAIR, 1);
    [[-116, -6], [92, -6], [-34, -72], [-34, 58]].forEach(([dx, dy]) => g.fillRoundedRect(cx + dx, cy + dy, 30, 42, 6));
    g.fillStyle(0xc69255, 1);
    g.lineStyle(4, DESK_EDGE, 1);
    g.fillRoundedRect(cx - 96, cy - 44, 192, 108, 30);
    g.strokeRoundedRect(cx - 96, cy - 44, 192, 108, 30);
    g.fillStyle(0xf8dd97, 1);
    g.fillRoundedRect(cx - 46, cy - 10, 92, 34, 6);
  }

  private drawAgent(agent: OfficeAgentState, index: number, rect: { x: number; y: number; width: number; height: number }) {
    const positions = this.getDeskPositions(rect);
    const pos = positions[index % positions.length];
    const container = this.add.container(pos.x, pos.y);
    const g = this.add.graphics();
    container.add(g);

    g.fillStyle(DESK, 1);
    g.lineStyle(2, DESK_EDGE, 1);
    g.fillRoundedRect(-58, 0, 116, 56, 7);
    g.strokeRoundedRect(-58, 0, 116, 56, 7);
    g.fillStyle(MONITOR, 1);
    g.lineStyle(2, 0x445f66, 1);
    g.fillRoundedRect(-32, -28, 64, 38, 4);
    g.strokeRoundedRect(-32, -28, 64, 38, 4);
    g.fillStyle(0x74c9d3, 1);
    g.fillRoundedRect(-18, -16, 36, 12, 4);
    g.fillStyle(CHAIR, 1);
    g.fillRoundedRect(-24, 38, 48, 36, 6);

    const bodyColor = agent.kind === "agent" ? AGENT : agent.role === "ADMIN" ? INFO : PRIMARY;
    g.fillStyle(bodyColor, 1);
    g.lineStyle(2, 0xffffff, 1);
    g.fillCircle(0, 34, 22);
    g.strokeCircle(0, 34, 22);
    this.add
      .text(pos.x, pos.y + 29, agent.name.slice(0, 2).toUpperCase(), {
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    g.fillStyle(STATUS_COLOR[agent.status], 1);
    g.fillCircle(56, -2, 6);

    const label = this.add.container(pos.x - 58, pos.y - 46);
    const labelBg = this.add.graphics();
    labelBg.fillStyle(0xffffff, 0.92);
    labelBg.lineStyle(1, 0x92c5d3, 1);
    labelBg.fillRoundedRect(0, 0, 122, 32, 5);
    labelBg.strokeRoundedRect(0, 0, 122, 32, 5);
    label.add(labelBg);
    label.add(this.add.text(7, 5, agent.name, { fontSize: "10px", color: "#17212b", fontStyle: "bold", fixedWidth: 108 }).setCrop(0, 0, 108, 12));
    label.add(this.add.text(7, 18, agent.kind === "agent" ? `AGENT · ${agent.role}` : agent.role, { fontSize: "9px", color: "#627386" }));

    if (agent.status === "working") {
      const bubble = this.add.container(pos.x + 42, pos.y - 54);
      const bubbleBg = this.add.graphics();
      bubbleBg.fillStyle(0xffffff, 0.96);
      bubbleBg.lineStyle(1, 0x22d3ee, 1);
      bubbleBg.fillRoundedRect(0, 0, 66, 24, 8);
      bubbleBg.strokeRoundedRect(0, 0, 66, 24, 8);
      bubble.add(bubbleBg);
      bubble.add(this.add.text(10, 7, "작업 중", { fontSize: "10px", color: "#0284c7", fontStyle: "bold" }));
    }

    container.setSize(132, 104);
    container.setInteractive(new Phaser.Geom.Rectangle(-66, -36, 132, 112), Phaser.Geom.Rectangle.Contains);
    container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const event = pointer.event;
        OfficeEventBus.emit("agent:context", {
          agent,
          x: "clientX" in event ? event.clientX : pointer.x,
          y: "clientY" in event ? event.clientY : pointer.y,
        });
        return;
      }
      OfficeEventBus.emit("agent:clicked", agent);
    });
    container.on("pointerover", () => this.input.setDefaultCursor("pointer"));
    container.on("pointerout", () => this.input.setDefaultCursor("default"));
  }

  private getDeskPositions(rect: { x: number; y: number; width: number; height: number }) {
    return [
      { x: rect.x + rect.width * 0.14, y: rect.y + rect.height * 0.52 },
      { x: rect.x + rect.width * 0.31, y: rect.y + rect.height * 0.64 },
      { x: rect.x + rect.width * 0.15, y: rect.y + rect.height * 0.77 },
      { x: rect.x + rect.width * 0.86, y: rect.y + rect.height * 0.52 },
      { x: rect.x + rect.width * 0.69, y: rect.y + rect.height * 0.64 },
      { x: rect.x + rect.width * 0.85, y: rect.y + rect.height * 0.77 },
    ];
  }

  private drawEmptyState(width: number, height: number) {
    const x = width / 2 - 130;
    const y = height / 2 - 50;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.96);
    g.lineStyle(1, 0x92c5d3, 1);
    g.fillRoundedRect(x, y, 260, 100, 8);
    g.strokeRoundedRect(x, y, 260, 100, 8);
    this.add.text(width / 2, y + 28, "아직 배치된 Agent가 없습니다.", { fontSize: "13px", color: "#17212b", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(width / 2, y + 54, "상단바의 Agent 출근에서 고용하세요.", { fontSize: "11px", color: "#627386" }).setOrigin(0.5);
  }
}
