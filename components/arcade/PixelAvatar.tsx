"use client";

import { useMemo, type CSSProperties } from "react";

export type PixelAvatarKind =
  | "alex"
  | "mira"
  | "kenji"
  | "yuna"
  | "diego"
  | "iris"
  | "agent";

type Palette = {
  skin: string;
  skin2: string;
  hair: string;
  hair2: string;
  shirt: string;
  shirt2: string;
  pants: string;
  shoe: string;
  eye: string;
  mouth: string;
};

export type PixelAvatarPaletteOverride = Partial<Palette>;

export const PA_PALETTES: Record<PixelAvatarKind, Palette> = {
  alex:  { skin:"#f4c89a", skin2:"#c89968", hair:"#3a2a1a", hair2:"#1f1410", shirt:"#2a3a4a", shirt2:"#15202c", pants:"#1a1a1a", shoe:"#0a0a0a", eye:"#0a0a0a", mouth:"#7a4a3a" },
  mira:  { skin:"#e8b894", skin2:"#b88860", hair:"#a83a3a", hair2:"#6a1f1f", shirt:"#d8c89a", shirt2:"#a89868", pants:"#3a2a4a", shoe:"#1a1a1a", eye:"#0a0a0a", mouth:"#8a3a3a" },
  kenji: { skin:"#f0c098", skin2:"#c08868", hair:"#1a1a1a", hair2:"#0a0a0a", shirt:"#3a5a3a", shirt2:"#1a3a1a", pants:"#2a2a3a", shoe:"#0a0a0a", eye:"#0a0a0a", mouth:"#6a3a2a" },
  yuna:  { skin:"#f8d4b0", skin2:"#c8a47a", hair:"#d8a838", hair2:"#a87808", shirt:"#a83a6a", shirt2:"#681a3a", pants:"#1a1a2a", shoe:"#0a0a0a", eye:"#0a0a0a", mouth:"#8a3a4a" },
  diego: { skin:"#d8a878", skin2:"#a87848", hair:"#2a1a0a", hair2:"#1a0a00", shirt:"#5a3a8a", shirt2:"#2a1a4a", pants:"#1a1a1a", shoe:"#0a0a0a", eye:"#0a0a0a", mouth:"#7a3a2a" },
  iris:  { skin:"#f0c8a0", skin2:"#c0986a", hair:"#5a3a8a", hair2:"#2a1a4a", shirt:"#e8c8d8", shirt2:"#a888a0", pants:"#3a3a3a", shoe:"#1a1a1a", eye:"#0a0a0a", mouth:"#8a4a5a" },
  agent: { skin:"#d0d8e0", skin2:"#8090a0", hair:"#1a1a2a", hair2:"#0a0a1a", shirt:"#1a1a2a", shirt2:"#0a0a1a", pants:"#1a1a2a", shoe:"#0a0a0a", eye:"#7afff0", mouth:"#7afff0" },
};

export type PixelAvatarDirection = "S" | "N" | "E" | "W";

const HERO_FRAMES: Record<PixelAvatarDirection, string[]> = {
  S: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    ".HhhsssshhH.....",
    ".HsEss ssEsH....",
    "..SsssssssS.....",
    "..SsMMMssS......",
    ".TTTTTTTTTT.....",
    "TtTTTTTTTtT.....",
    "TtTTTTTTTtT.....",
    "TtTPPPPPTtT.....",
    ".TTPPPPPPTT.....",
    "..PP....PP......",
    "..PP....PP......",
    "..BB....BB......",
  ],
  N: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    ".HhhhhhhhhH.....",
    ".HhhhhhhhhH.....",
    "..HhhhhhhH......",
    "..ShhhhhhS......",
    ".TTTTTTTTTT.....",
    "TtTTTTTTTtT.....",
    "TtTTTTTTTtT.....",
    "TtTPPPPPTtT.....",
    ".TTPPPPPPTT.....",
    "..PP....PP......",
    "..PP....PP......",
    "..BB....BB......",
  ],
  E: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    "..HsshhhshH.....",
    "..HssssEsS......",
    "..SssssssS......",
    "..SsMMsssS......",
    ".TTTTTTTTT......",
    "TtTTTTTTTt......",
    "TtTTTTTTTt......",
    "TtTPPPPPPt......",
    ".TTPPPPPPP......",
    "..PP...PPP......",
    "..PP...PP.......",
    "..BB....B.......",
  ],
  W: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    ".HshhhssH.......",
    ".SsEssss H......",
    ".SsssssssS......",
    ".Ssss MMsS......",
    ".TTTTTTTTT......",
    ".tTTTTTTTtT.....",
    ".tTTTTTTTtT.....",
    ".tPPPPPPPTt.....",
    ".PPPPPPPPTT.....",
    ".PPP...PP.......",
    "..PP...PP.......",
    "..B....BB.......",
  ],
};

const HERO_WALK_FRAMES: Record<PixelAvatarDirection, string[]> = {
  S: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    ".HhhsssshhH.....",
    ".HsEss ssEsH....",
    "..SsssssssS.....",
    "..SsMMMssS......",
    ".TTTTTTTTTT.....",
    "TtTTTTTTTtT.....",
    "TtTTTTTTTtT.....",
    "TtTPPPPPTtT.....",
    ".TTPPPPPPTT.....",
    "..PPP..PP.......",
    "...PP.PP........",
    "...BB.BB........",
  ],
  N: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    ".HhhhhhhhhH.....",
    ".HhhhhhhhhH.....",
    "..HhhhhhhH......",
    "..ShhhhhhS......",
    ".TTTTTTTTTT.....",
    "TtTTTTTTTtT.....",
    "TtTTTTTTTtT.....",
    "TtTPPPPPTtT.....",
    ".TTPPPPPPTT.....",
    "..PPP..PP.......",
    "...PP.PP........",
    "...BB.BB........",
  ],
  E: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    "..HsshhhshH.....",
    "..HssssEsS......",
    "..SssssssS......",
    "..SsMMsssS......",
    ".TTTTTTTTT......",
    "TtTTTTTTTt......",
    "TtTTTTTTTt......",
    "TtTPPPPPPt......",
    ".TTPPPPPPP......",
    "...PP.PPP.......",
    "...PP..PP.......",
    "...BB..B........",
  ],
  W: [
    "...HHHHHH.......",
    "..HhhhhhhH......",
    ".HshhhssH.......",
    ".SsEssss H......",
    ".SsssssssS......",
    ".Ssss MMsS......",
    ".TTTTTTTTT......",
    ".tTTTTTTTtT.....",
    ".tTTTTTTTtT.....",
    ".tPPPPPPPTt.....",
    ".PPPPPPPPTT.....",
    ".PPP.PP.........",
    "..PP..PP........",
    "..B...BB........",
  ],
};

function paFrameToShadows(
  frame: string[],
  pal: Palette,
  scale: number,
): string {
  const map: Record<string, string> = {
    H: pal.hair, h: pal.hair2,
    S: pal.skin, s: pal.skin2,
    E: pal.eye, M: pal.mouth,
    T: pal.shirt, t: pal.shirt2,
    P: pal.pants, B: pal.shoe,
  };
  const parts: string[] = [];
  for (let y = 0; y < frame.length; y++) {
    for (let x = 0; x < frame[y].length; x++) {
      const ch = frame[y][x];
      if (ch === "." || ch === " " || !map[ch]) continue;
      parts.push(`${x * scale}px ${y * scale}px 0 0 ${map[ch]}`);
    }
  }
  return parts.join(",");
}

interface PixelAvatarProps {
  kind?: PixelAvatarKind;
  direction?: PixelAvatarDirection;
  size?: number;
  walking?: boolean;
  paletteOverride?: PixelAvatarPaletteOverride;
  style?: CSSProperties;
  className?: string;
}

export default function PixelAvatar({
  kind = "alex",
  direction = "S",
  size = 4,
  walking = false,
  paletteOverride,
  style,
  className,
}: PixelAvatarProps) {
  const basePal = PA_PALETTES[kind] || PA_PALETTES.alex;
  const pal = useMemo(
    () => ({ ...basePal, ...paletteOverride }),
    [basePal, paletteOverride],
  );
  const frame = walking
    ? HERO_WALK_FRAMES[direction] || HERO_WALK_FRAMES.S
    : HERO_FRAMES[direction] || HERO_FRAMES.S;
  const shadows = useMemo(
    () => paFrameToShadows(frame, pal, size),
    [frame, pal, size],
  );
  return (
    <div
      className={["pixel-avatar", walking ? "pixel-avatar--walking" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "relative",
        width: 16 * size,
        height: 14 * size,
        imageRendering: "pixelated",
        ...style,
      }}
    >
      <div
        className="pixel-avatar__frame"
        style={{
          position: "absolute",
          width: size,
          height: size,
          boxShadow: shadows,
        }}
      />
    </div>
  );
}

/* ---------- Pixel furniture sprites ---------- */

export type PixelSpriteKind =
  | "desk"
  | "monitor"
  | "chair"
  | "plant"
  | "rug"
  | "table"
  | "whiteboard"
  | "couch"
  | "coffee";

const PA_SPRITES: Record<PixelSpriteKind, string[]> = {
  desk: [
    "............",
    ".DDDDDDDDDD.",
    ".DddddddddD.",
    ".DDDDDDDDDD.",
    "..D......D..",
    "..D......D..",
  ],
  monitor: [
    "..MMMMMMMM..",
    "..MmmmmmmM..",
    "..MmSSSSmM..",
    "..MmSSSSmM..",
    "..MmmmmmmM..",
    "..MMMMMMMM..",
    "....MMMM....",
    "...MMMMMM...",
  ],
  chair: [
    "..CCCCCC..",
    "..CccccC..",
    "..CCCCCC..",
    "....CC....",
    "...CCCC...",
    "..CC..CC..",
  ],
  plant: [
    "..GG.GGG..",
    ".GGGGGGGG.",
    ".GGGGGGGG.",
    "..GGGGGG..",
    "...PPPP...",
    "...PPPP...",
  ],
  rug: [
    "RRRRRRRRRRRR",
    "RrrrrrrrrrR.",
    "RrRRRRRRRrR.",
    "RrRrrrrrRrR.",
    "RrRRRRRRRrR.",
    "RrrrrrrrrrR.",
    "RRRRRRRRRRR.",
  ],
  table: [
    "TTTTTTTTTTTT",
    "TttttttttttT",
    "TttttttttttT",
    "TTTTTTTTTTTT",
    ".T........T.",
    ".T........T.",
  ],
  whiteboard: [
    "WWWWWWWWWWWW",
    "WwwwwwwwwwwW",
    "WwLLLLLLLwW.",
    "WwLLLwwwLwW.",
    "WwLwwwwwLwW.",
    "WwwwwwwwwwwW",
    "WWWWWWWWWWWW",
    "..W......W..",
  ],
  couch: [
    "UUUUUUUUUUUU",
    "UuuuuuuuuuU.",
    "UuUUUUUUUuU.",
    "UuUuuuuuUuU.",
    "UUuUUUUUuUU.",
    ".UUuuuuuUU..",
  ],
  coffee: [
    "..QQQQQ..",
    "..QqqqQ..",
    "..QqqqQ..",
    "..QQQQQ..",
  ],
};

const PA_SPRITE_PALETTES: Record<PixelSpriteKind, Record<string, string>> = {
  desk: { D: "#6a4a2a", d: "#8a6a4a" },
  monitor: { M: "#1a1a1a", m: "#2a2a2a", S: "#3a8a8a" },
  chair: { C: "#2a2a2a", c: "#5a5a5a" },
  plant: { G: "#3a7a3a", P: "#6a4a2a" },
  rug: { R: "#8a3a3a", r: "#d8b878" },
  table: { T: "#4a3a2a", t: "#7a5a3a" },
  whiteboard: { W: "#1a1a1a", w: "#f8f8f8", L: "#3a6aaa" },
  couch: { U: "#3a3a4a", u: "#6a6a8a" },
  coffee: { Q: "#1a1a1a", q: "#a87858" },
};

interface PixelSpriteProps {
  kind?: PixelSpriteKind;
  size?: number;
  style?: CSSProperties;
  palette?: Record<string, string>;
  className?: string;
}

export function PixelSprite({
  kind = "desk",
  size = 4,
  style,
  palette,
  className,
}: PixelSpriteProps) {
  const sprite = PA_SPRITES[kind];
  const pal = palette || PA_SPRITE_PALETTES[kind];
  const shadows = useMemo(() => {
    if (!sprite || !pal) return "";
    const parts: string[] = [];
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        const ch = sprite[y][x];
        if (ch === "." || !pal[ch]) continue;
        parts.push(`${x * size}px ${y * size}px 0 0 ${pal[ch]}`);
      }
    }
    return parts.join(",");
  }, [sprite, pal, size]);
  if (!sprite || !pal) return null;
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: sprite[0].length * size,
        height: sprite.length * size,
        imageRendering: "pixelated",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: size,
          height: size,
          boxShadow: shadows,
        }}
      />
    </div>
  );
}
