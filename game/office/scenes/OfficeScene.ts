import Phaser from "phaser";
import { OfficeEventBus, type OfficeAgentState } from "../EventBus";

const CHARACTER_KEY = "office-character";
const CHARACTER_URL = "/assets/spritesheets/little-man-1.gif";

const STATUS_COLOR: Record<OfficeAgentState["status"], number> = {
  working: 0x0284c7,
  idle: 0x8a98a8,
  review: 0x2563eb,
  blocked: 0xd97706,
};

const STATUS_LABEL: Record<OfficeAgentState["status"], string> = {
  working: "작업 중",
  idle: "대기",
  review: "리뷰",
  blocked: "확인 필요",
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RoomSpec {
  key: "engineering" | "huddle" | "lounge" | "library";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

interface AgentSprite {
  agent: OfficeAgentState;
  container: Phaser.GameObjects.Container;
  ratioX: number;
  ratioY: number;
  charScale: number;
  bubble: Phaser.GameObjects.Container | null;
  labelY: number;
}

const DESK_RATIOS: Array<{ x: number; y: number }> = [
  { x: 0.16, y: 0.27 },
  { x: 0.29, y: 0.27 },
  { x: 0.42, y: 0.27 },
  { x: 0.18, y: 0.48 },
  { x: 0.55, y: 0.38 },
  { x: 0.76, y: 0.38 },
  { x: 0.20, y: 0.76 },
  { x: 0.48, y: 0.72 },
  { x: 0.70, y: 0.72 },
];

const CONTROL_SPEED = 0.18;
const WALK_BOUNDS = { minX: 0.10, maxX: 0.90, minY: 0.25, maxY: 0.85 };
const OFFICE_BG_COLOR = 0x090b16;
const OFFICE_PANEL_COLOR = 0x11172a;
const OFFICE_LINE_COLOR = 0x2a3358;

const OFFICE_ROOMS: RoomSpec[] = [
  { key: "engineering", label: "ENGINEERING", x: 0.05, y: 0.08, width: 0.48, height: 0.45, color: 0xff7adc },
  { key: "huddle", label: "HUDDLE", x: 0.59, y: 0.08, width: 0.33, height: 0.35, color: 0x5aa8ff },
  { key: "lounge", label: "LOUNGE", x: 0.05, y: 0.61, width: 0.31, height: 0.28, color: 0x5fe39a },
  { key: "library", label: "LIBRARY", x: 0.43, y: 0.52, width: 0.49, height: 0.37, color: 0xffd84a },
];

export class OfficeScene extends Phaser.Scene {
  private agents: OfficeAgentState[] = [];
  private agentSprites = new Map<string, AgentSprite>();
  private controllableId: string | null = null;
  private floorRect: Rect | null = null;
  private gridLayer?: Phaser.GameObjects.Graphics;
  private roomLayer?: Phaser.GameObjects.Graphics;
  private decorLayer?: Phaser.GameObjects.Graphics;
  private roomLabelLayer?: Phaser.GameObjects.Container;
  private emptyState?: Phaser.GameObjects.Container;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private unsubscribers: Array<() => void> = [];
  private ready = false;

  constructor() {
    super("OfficeScene");
  }

  preload() {
    this.load.image(CHARACTER_KEY, CHARACTER_URL);
  }

  create() {
    this.scale.on("resize", this.handleResize, this);
    this.agents = OfficeEventBus.getAgents();
    const stored = OfficeEventBus.getControllable();
    this.controllableId = stored == null ? null : String(stored);

    const onAgentsUpdate = (agents: OfficeAgentState[]) => {
      this.agents = agents;
      this.syncAgents();
    };
    const onControllableSet = (id: string | number | null) => {
      this.controllableId = id == null ? null : String(id);
    };
    OfficeEventBus.on("agents:update", onAgentsUpdate);
    OfficeEventBus.on("controllable:set", onControllableSet);
    this.unsubscribers.push(
      () => OfficeEventBus.off("agents:update", onAgentsUpdate),
      () => OfficeEventBus.off("controllable:set", onControllableSet),
    );

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = this.input.keyboard.addKeys("W,A,S,D") as Record<
        "W" | "A" | "S" | "D",
        Phaser.Input.Keyboard.Key
      >;
    }

    const teardown = () => {
      if (!this.ready && this.unsubscribers.length === 0) return;
      this.ready = false;
      this.unsubscribers.forEach((u) => u());
      this.unsubscribers = [];
      this.scale.off("resize", this.handleResize, this);
      this.agentSprites.forEach((s) => s.container.destroy(true));
      this.agentSprites.clear();
      this.gridLayer?.destroy();
      this.roomLayer?.destroy();
      this.decorLayer?.destroy();
      this.roomLabelLayer?.destroy(true);
      this.emptyState?.destroy(true);
      this.gridLayer = undefined;
      this.roomLayer = undefined;
      this.decorLayer = undefined;
      this.roomLabelLayer = undefined;
      this.emptyState = undefined;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, teardown);
    this.events.once(Phaser.Scenes.Events.DESTROY, teardown);
    this.ready = true;
    this.handleResize();
  }

  update(_time: number, delta: number) {
    if (!this.ready || !this.floorRect || !this.controllableId) return;
    const sprite = this.agentSprites.get(this.controllableId);
    if (!sprite) return;
    const floor = this.floorRect;
    const dt = delta / 1000;

    let dx = 0;
    let dy = 0;
    if (this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown) dx -= 1;
    if (this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown) dx += 1;
    if (this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown) dy -= 1;
    if (this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown) dy += 1;
    if (dx === 0 && dy === 0) return;

    const len = Math.hypot(dx, dy) || 1;
    const step = CONTROL_SPEED * dt;
    sprite.ratioX = Phaser.Math.Clamp(
      sprite.ratioX + (dx / len) * step,
      WALK_BOUNDS.minX,
      WALK_BOUNDS.maxX,
    );
    sprite.ratioY = Phaser.Math.Clamp(
      sprite.ratioY + (dy / len) * step,
      WALK_BOUNDS.minY,
      WALK_BOUNDS.maxY,
    );
    sprite.container.x = floor.x + floor.width * sprite.ratioX;
    sprite.container.y = floor.y + floor.height * sprite.ratioY;

    if (dx !== 0) {
      const character = sprite.container.list[0] as Phaser.GameObjects.Image | undefined;
      if (character && typeof character.setFlipX === "function") {
        character.setFlipX(dx < 0);
      }
    }
  }

  private handleResize = () => {
    if (!this.ready || !this.cameras?.main) return;
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#090b16");
    const floor = this.computeFloorRect(width, height);
    this.floorRect = floor;
    this.drawFloor(floor);
    this.syncAgents();
  };

  private computeFloorRect(width: number, height: number): Rect {
    const margin = 16;
    const targetW = width - margin * 2;
    const targetH = height - margin * 2;
    const aspect = 1380 / 752;
    let w = targetW;
    let h = w / aspect;
    if (h > targetH) {
      h = targetH;
      w = h * aspect;
    }
    return {
      x: (width - w) / 2,
      y: (height - h) / 2,
      width: w,
      height: h,
    };
  }

  private drawFloor(rect: Rect) {
    this.drawGrid(rect);

    if (!this.roomLayer) {
      this.roomLayer = this.add.graphics().setDepth(1);
    }
    if (!this.decorLayer) {
      this.decorLayer = this.add.graphics().setDepth(2);
    }
    this.roomLayer.clear();
    this.decorLayer.clear();
    this.roomLabelLayer?.destroy(true);
    this.roomLabelLayer = this.add.container(0, 0).setDepth(3);

    this.roomLayer.fillStyle(OFFICE_PANEL_COLOR, 0.88);
    this.roomLayer.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.roomLayer.lineStyle(2, OFFICE_LINE_COLOR, 0.9);
    this.roomLayer.strokeRect(rect.x, rect.y, rect.width, rect.height);

    OFFICE_ROOMS.forEach((room) => {
      const roomRect = this.roomToRect(rect, room);
      this.roomLayer?.fillStyle(room.color, 0.08);
      this.roomLayer?.fillRect(roomRect.x, roomRect.y, roomRect.width, roomRect.height);
      this.roomLayer?.lineStyle(2, room.color, 0.92);
      this.roomLayer?.strokeRect(roomRect.x, roomRect.y, roomRect.width, roomRect.height);

      this.drawRoomDecor(this.decorLayer!, room, roomRect);

      const label = this.add
        .text(roomRect.x + 12, roomRect.y + 10, room.label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: `#${room.color.toString(16).padStart(6, "0")}`,
          letterSpacing: 2,
        })
        .setShadow(0, 0, `#${room.color.toString(16).padStart(6, "0")}`, 8)
        .setOrigin(0, 0);
      this.roomLabelLayer?.add(label);
    });
  }

  private drawGrid(rect: Rect) {
    if (!this.gridLayer) {
      this.gridLayer = this.add.graphics().setDepth(0);
    }
    const { width, height } = this.scale;
    const grid = this.gridLayer;
    grid.clear();
    grid.fillStyle(OFFICE_BG_COLOR, 1);
    grid.fillRect(0, 0, width, height);

    grid.lineStyle(1, 0x9a7aff, 0.08);
    for (let x = 0; x <= width; x += 24) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 24) {
      grid.lineBetween(0, y, width, y);
    }

    grid.lineStyle(1, 0x5aa8ff, 0.16);
    grid.strokeRect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16);
  }

  private roomToRect(floor: Rect, room: RoomSpec): Rect {
    return {
      x: floor.x + floor.width * room.x,
      y: floor.y + floor.height * room.y,
      width: floor.width * room.width,
      height: floor.height * room.height,
    };
  }

  private drawRoomDecor(g: Phaser.GameObjects.Graphics, room: RoomSpec, rect: Rect) {
    g.lineStyle(1, room.color, 0.34);
    g.fillStyle(room.color, 0.1);

    if (room.key === "engineering") {
      const deskW = rect.width * 0.22;
      const deskH = rect.height * 0.12;
      const xs = [0.1, 0.39, 0.68];
      const ys = [0.34, 0.62];
      xs.forEach((rx) => {
        ys.forEach((ry) => {
          const x = rect.x + rect.width * rx;
          const y = rect.y + rect.height * ry;
          g.strokeRect(x, y, deskW, deskH);
          g.lineBetween(x + 8, y + deskH + 10, x + deskW - 8, y + deskH + 10);
        });
      });
      return;
    }

    if (room.key === "huddle") {
      const tableX = rect.x + rect.width * 0.25;
      const tableY = rect.y + rect.height * 0.36;
      const tableW = rect.width * 0.5;
      const tableH = rect.height * 0.22;
      g.strokeRoundedRect(tableX, tableY, tableW, tableH, 10);
      g.strokeCircle(tableX - 18, tableY + tableH / 2, 8);
      g.strokeCircle(tableX + tableW + 18, tableY + tableH / 2, 8);
      g.strokeCircle(tableX + tableW / 2, tableY - 18, 8);
      return;
    }

    if (room.key === "lounge") {
      const sofaX = rect.x + rect.width * 0.12;
      const sofaY = rect.y + rect.height * 0.48;
      const sofaW = rect.width * 0.44;
      const sofaH = rect.height * 0.18;
      g.strokeRect(sofaX, sofaY, sofaW, sofaH);
      g.strokeRect(sofaX + sofaW + 24, sofaY - 10, rect.width * 0.18, rect.height * 0.18);
      g.strokeCircle(rect.x + rect.width * 0.78, rect.y + rect.height * 0.34, 13);
      g.lineBetween(rect.x + rect.width * 0.78, rect.y + rect.height * 0.38, rect.x + rect.width * 0.78, rect.y + rect.height * 0.56);
      return;
    }

    const shelfW = rect.width * 0.2;
    [0.12, 0.39, 0.66].forEach((rx) => {
      const x = rect.x + rect.width * rx;
      const y = rect.y + rect.height * 0.22;
      g.strokeRect(x, y, shelfW, rect.height * 0.5);
      for (let i = 1; i < 4; i++) {
        g.lineBetween(x + 6, y + (rect.height * 0.5 * i) / 4, x + shelfW - 6, y + (rect.height * 0.5 * i) / 4);
      }
    });
  }

  private syncAgents() {
    if (!this.floorRect) return;
    const floor = this.floorRect;
    const seenIds = new Set<string>();

    this.agents.forEach((agent, index) => {
      const id = String(agent.id);
      seenIds.add(id);
      let sprite = this.agentSprites.get(id);
      if (!sprite) {
        const startRatio = DESK_RATIOS[index % DESK_RATIOS.length];
        sprite = this.createAgentSprite(agent, startRatio.x, startRatio.y);
        this.agentSprites.set(id, sprite);
      } else {
        sprite.agent = agent;
        this.updateAgentLabel(sprite);
      }
      sprite.container.x = floor.x + floor.width * sprite.ratioX;
      sprite.container.y = floor.y + floor.height * sprite.ratioY;
    });

    this.agentSprites.forEach((sprite, id) => {
      if (!seenIds.has(id)) {
        sprite.container.destroy(true);
        this.agentSprites.delete(id);
      }
    });

    this.hideEmptyState();
    if (this.agents.length === 0) this.showEmptyState();
  }

  private createAgentSprite(agent: OfficeAgentState, ratioX: number, ratioY: number): AgentSprite {
    const container = this.add.container(0, 0).setDepth(10);
    const charScale = Math.max(1, (this.floorRect?.width ?? 460) / 460);

    if (this.textures.exists(CHARACTER_KEY)) {
      const character = this.add.image(0, 0, CHARACTER_KEY).setScale(charScale);
      container.add(character);
    } else {
      const fallback = this.add.graphics();
      fallback.fillStyle(0xf59e0b, 1);
      fallback.fillCircle(0, 0, 14);
      container.add(fallback);
    }

    const dot = this.add.graphics();
    this.drawStatusDot(dot, agent.status, charScale);
    container.add(dot);

    const labelW = 116;
    const labelH = 30;
    const labelY = -28 * charScale - labelH;
    const labelBg = this.add.graphics();
    labelBg.fillStyle(0x0f172a, 0.86);
    labelBg.lineStyle(1, 0x94a3b8, 1);
    labelBg.fillRoundedRect(-labelW / 2, labelY, labelW, labelH, 5);
    labelBg.strokeRoundedRect(-labelW / 2, labelY, labelW, labelH, 5);
    container.add(labelBg);

    const nameText = this.add
      .text(0, labelY + 4, agent.name, {
        fontSize: "11px",
        color: "#ffffff",
        fontStyle: "bold",
        fixedWidth: labelW - 12,
        align: "center",
      })
      .setOrigin(0.5, 0);
    container.add(nameText);

    const subText = this.add
      .text(0, labelY + 17, this.formatSubLabel(agent), {
        fontSize: "9px",
        color: "#cbd5e1",
        fixedWidth: labelW - 12,
        align: "center",
      })
      .setOrigin(0.5, 0);
    container.add(subText);

    container.setSize(120, 80);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-60, -40, 120, 80),
      Phaser.Geom.Rectangle.Contains,
    );
    const id = String(agent.id);
    container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const current = this.agentSprites.get(id)?.agent ?? agent;
      if (pointer.rightButtonDown()) {
        const event = pointer.event;
        OfficeEventBus.emit("agent:context", {
          agent: current,
          x: "clientX" in event ? event.clientX : pointer.x,
          y: "clientY" in event ? event.clientY : pointer.y,
        });
      } else {
        OfficeEventBus.emit("agent:clicked", current);
      }
    });
    container.on("pointerover", () => this.input.setDefaultCursor("pointer"));
    container.on("pointerout", () => this.input.setDefaultCursor("default"));

    container.setData("nameText", nameText);
    container.setData("subText", subText);
    container.setData("dot", dot);

    const sprite: AgentSprite = {
      agent,
      container,
      ratioX,
      ratioY,
      charScale,
      bubble: null,
      labelY,
    };
    this.refreshBubble(sprite);
    return sprite;
  }

  private drawStatusDot(g: Phaser.GameObjects.Graphics, status: OfficeAgentState["status"], charScale: number) {
    g.clear();
    g.fillStyle(STATUS_COLOR[status], 1);
    g.lineStyle(2, 0xffffff, 1);
    g.fillCircle(14 * charScale, -14 * charScale, 5);
    g.strokeCircle(14 * charScale, -14 * charScale, 5);
  }

  private refreshBubble(sprite: AgentSprite) {
    if (sprite.bubble) {
      sprite.bubble.destroy(true);
      sprite.bubble = null;
    }
    if (sprite.agent.status !== "working") return;

    const bubbleY = sprite.labelY - 26;
    const bubble = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.96);
    bg.lineStyle(1, 0x22d3ee, 1);
    bg.fillRoundedRect(-32, bubbleY, 64, 22, 8);
    bg.strokeRoundedRect(-32, bubbleY, 64, 22, 8);
    bubble.add(bg);
    bubble.add(
      this.add
        .text(0, bubbleY + 5, "작업 중", {
          fontSize: "10px",
          color: "#0284c7",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0),
    );
    sprite.container.add(bubble);
    sprite.bubble = bubble;
  }

  private updateAgentLabel(sprite: AgentSprite) {
    const nameText = sprite.container.getData("nameText") as Phaser.GameObjects.Text | undefined;
    const subText = sprite.container.getData("subText") as Phaser.GameObjects.Text | undefined;
    const dot = sprite.container.getData("dot") as Phaser.GameObjects.Graphics | undefined;
    nameText?.setText(sprite.agent.name);
    subText?.setText(this.formatSubLabel(sprite.agent));
    if (dot) this.drawStatusDot(dot, sprite.agent.status, sprite.charScale);
    this.refreshBubble(sprite);
  }

  private formatSubLabel(agent: OfficeAgentState) {
    return agent.kind === "agent"
      ? `AGENT · ${agent.role}`
      : `${agent.role} · ${STATUS_LABEL[agent.status]}`;
  }

  private showEmptyState() {
    this.hideEmptyState();
    const { width, height } = this.scale;
    const x = width / 2 - 130;
    const y = height / 2 - 50;
    const container = this.add.container(0, 0).setDepth(20);
    const g = this.add.graphics();
    g.fillStyle(0x141c37, 0.94);
    g.lineStyle(1, 0x9a7aff, 0.95);
    g.fillRect(x, y, 260, 100);
    g.strokeRect(x, y, 260, 100);
    container.add(g);
    container.add(
      this.add
        .text(width / 2, y + 28, "아직 배치된 Agent가 없습니다.", {
          fontSize: "13px",
          color: "#f5f7ff",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(width / 2, y + 54, "상단바의 Agent 출근에서 고용하세요.", {
          fontSize: "11px",
          color: "#9aa7c7",
        })
        .setOrigin(0.5),
    );
    this.emptyState = container;
  }

  private hideEmptyState() {
    this.emptyState?.destroy(true);
    this.emptyState = undefined;
  }
}
