import { BiomeType, CardDef, CardElement, CardTribe } from '../types/game';

export interface ElementMeta {
  id: CardElement;
  label: string;
  badgeClass: string;
  textClass: string;
}

export interface TribeMeta {
  id: CardTribe;
  label: string;
  badgeClass: string;
  textClass: string;
}

export interface BiomeRule {
  match: { element?: CardElement; tribe?: CardTribe };
  powerDelta: number;
  pDefDelta: number;
  mDefDelta: number;
  label: string; // e.g. "Fire -2 ATK"
}

export interface BiomeMeta {
  id: BiomeType;
  name: string;
  shortName: string;
  tagline: string;
  favorsSummary: string;
  hindersSummary: string;
  tileImage: string;
  tileImageFilter: string;
  tileBlendGlow: string;
  tileBgStyle: string;
  tileBorderClass: string;
  badgeClass: string;
  accentTextClass: string;
  rules: BiomeRule[];
}

export const NEUTRAL_TERRAIN_IMAGE = './src/assets/images/biomes/biome_neutral.jpg';

export const ALL_ELEMENTS: CardElement[] = [
  'fire',
  'water',
  'nature',
  'storm',
  'light',
  'shadow',
  'neutral',
];

export const ALL_TRIBES: CardTribe[] = [
  'mortal',
  'elf',
  'fey',
  'dragon',
  'undead',
  'construct',
  'beast',
];

export const ALL_BIOMES: BiomeType[] = [
  'water',
  'marsh',
  'volcanic',
  'hallowed',
  'shadow',
  'highland',
];

export const ELEMENT_META: Record<CardElement, ElementMeta> = {
  fire: {
    id: 'fire',
    label: 'Fire',
    badgeClass: 'bg-gradient-to-b from-[#4a1c0d] to-[#291008] text-orange-200',
    textClass: 'text-orange-300',
  },
  water: {
    id: 'water',
    label: 'Water',
    badgeClass: 'bg-gradient-to-b from-[#103047] to-[#091b29] text-sky-200',
    textClass: 'text-sky-300',
  },
  nature: {
    id: 'nature',
    label: 'Nature',
    badgeClass: 'bg-gradient-to-b from-[#183822] to-[#0d2013] text-emerald-200',
    textClass: 'text-emerald-300',
  },
  storm: {
    id: 'storm',
    label: 'Storm',
    badgeClass: 'bg-gradient-to-b from-[#123640] to-[#0a1f26] text-cyan-200',
    textClass: 'text-cyan-300',
  },
  light: {
    id: 'light',
    label: 'Light',
    badgeClass: 'bg-gradient-to-b from-[#473412] to-[#261b09] text-amber-200',
    textClass: 'text-amber-300',
  },
  shadow: {
    id: 'shadow',
    label: 'Shadow',
    badgeClass: 'bg-gradient-to-b from-[#2f1842] to-[#1a0d26] text-violet-200',
    textClass: 'text-violet-300',
  },
  neutral: {
    id: 'neutral',
    label: 'Steel',
    badgeClass: 'bg-gradient-to-b from-[#2f2b26] to-[#1a1714] text-stone-200',
    textClass: 'text-stone-300',
  },
};

export const TRIBE_META: Record<CardTribe, TribeMeta> = {
  mortal: {
    id: 'mortal',
    label: 'Mortal',
    badgeClass: 'bg-gradient-to-b from-[#3d2b18] to-[#21170d] text-amber-100',
    textClass: 'text-amber-200',
  },
  elf: {
    id: 'elf',
    label: 'Elf',
    badgeClass: 'bg-gradient-to-b from-[#1b3a2b] to-[#0e2118] text-lime-200',
    textClass: 'text-lime-300',
  },
  fey: {
    id: 'fey',
    label: 'Fey',
    badgeClass: 'bg-gradient-to-b from-[#133834] to-[#0b201e] text-teal-200',
    textClass: 'text-teal-300',
  },
  dragon: {
    id: 'dragon',
    label: 'Dragon',
    badgeClass: 'bg-gradient-to-b from-[#4d1e12] to-[#280e08] text-orange-200',
    textClass: 'text-orange-300',
  },
  undead: {
    id: 'undead',
    label: 'Undead',
    badgeClass: 'bg-gradient-to-b from-[#38173b] to-[#1f0c21] text-fuchsia-200',
    textClass: 'text-fuchsia-300',
  },
  construct: {
    id: 'construct',
    label: 'Construct',
    badgeClass: 'bg-gradient-to-b from-[#302c28] to-[#1b1815] text-zinc-200',
    textClass: 'text-zinc-300',
  },
  beast: {
    id: 'beast',
    label: 'Beast',
    badgeClass: 'bg-gradient-to-b from-[#45191f] to-[#260d11] text-rose-200',
    textClass: 'text-rose-300',
  },
};

export const BIOME_META: Record<BiomeType, BiomeMeta> = {
  water: {
    id: 'water',
    name: 'Flooded Basin',
    shortName: 'Water',
    tagline: 'Deep rushing waters douse flame and conduct lightning.',
    favorsSummary: 'Water +2 DEF · Storm +2 ATK',
    hindersSummary: 'Fire −2 ATK · Dragon −2 P.DEF · Construct −2 M.DEF',
    tileImage: './src/assets/images/biomes/biome_water.jpg',
    tileImageFilter: 'brightness(0.95) contrast(1.06) saturate(1.08)',
    tileBlendGlow: 'radial-gradient(ellipse 68% 68% at 50% 50%, rgba(14, 165, 233, 0.14), transparent 78%)',
    tileBgStyle:
      'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(14, 116, 144, 0.42) 0%, rgba(12, 42, 74, 0.72) 65%, rgba(8, 22, 42, 0.92) 100%)',
    tileBorderClass: 'border-sky-400/55',
    badgeClass: 'bg-sky-950/90 border-sky-400/55 text-sky-200',
    accentTextClass: 'text-sky-300',
    rules: [
      { match: { element: 'water' }, powerDelta: 0, pDefDelta: 2, mDefDelta: 2, label: 'Water +2 DEF' },
      { match: { element: 'storm' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Storm +2 ATK' },
      { match: { element: 'fire' }, powerDelta: -2, pDefDelta: 0, mDefDelta: 0, label: 'Fire −2 ATK' },
      { match: { tribe: 'dragon' }, powerDelta: 0, pDefDelta: -2, mDefDelta: 0, label: 'Dragon −2 P.DEF' },
      { match: { tribe: 'construct' }, powerDelta: 0, pDefDelta: 0, mDefDelta: -2, label: 'Construct −2 M.DEF' },
    ],
  },
  marsh: {
    id: 'marsh',
    name: 'Mire & Marsh',
    shortName: 'Marsh',
    tagline: 'Clinging mud bogs down heavy boots and gears while sheltering wild spirits and archers.',
    favorsSummary: 'Nature +2 DEF · Fey +2 DEF · Elf +2 ATK',
    hindersSummary: 'Mortal −2 ATK · Construct −2 ATK',
    tileImage: './src/assets/images/biomes/biome_marsh.jpg',
    tileImageFilter: 'brightness(0.94) contrast(1.08) saturate(1.06)',
    tileBlendGlow: 'radial-gradient(ellipse 68% 68% at 50% 50%, rgba(132, 204, 22, 0.12), transparent 78%)',
    tileBgStyle:
      'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(63, 98, 18, 0.42) 0%, rgba(28, 49, 26, 0.76) 65%, rgba(14, 24, 16, 0.94) 100%)',
    tileBorderClass: 'border-lime-400/50',
    badgeClass: 'bg-lime-950/90 border-lime-400/50 text-lime-200',
    accentTextClass: 'text-lime-300',
    rules: [
      { match: { element: 'nature' }, powerDelta: 0, pDefDelta: 2, mDefDelta: 2, label: 'Nature +2 DEF' },
      { match: { tribe: 'fey' }, powerDelta: 0, pDefDelta: 2, mDefDelta: 2, label: 'Fey +2 DEF' },
      { match: { tribe: 'elf' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Elf +2 ATK' },
      { match: { tribe: 'mortal' }, powerDelta: -2, pDefDelta: 0, mDefDelta: 0, label: 'Mortal −2 ATK' },
      { match: { tribe: 'construct' }, powerDelta: -2, pDefDelta: 0, mDefDelta: 0, label: 'Construct −2 ATK' },
    ],
  },
  volcanic: {
    id: 'volcanic',
    name: 'Scorched Rift',
    shortName: 'Volcanic',
    tagline: 'Seething ember vents empower flame, wyrms, and apex beasts while parching water and grove.',
    favorsSummary: 'Fire +2 ATK · Dragon +2 ATK · Beast +2 ATK',
    hindersSummary: 'Water −2 DEF · Nature −2 DEF',
    tileImage: './src/assets/images/biomes/biome_volcanic.jpg',
    tileImageFilter: 'brightness(0.94) contrast(1.12) saturate(1.12)',
    tileBlendGlow: 'radial-gradient(ellipse 68% 68% at 50% 50%, rgba(249, 115, 22, 0.16), transparent 78%)',
    tileBgStyle:
      'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(194, 65, 12, 0.42) 0%, rgba(76, 22, 16, 0.78) 65%, rgba(28, 11, 12, 0.94) 100%)',
    tileBorderClass: 'border-orange-400/55',
    badgeClass: 'bg-orange-950/90 border-orange-400/55 text-orange-200',
    accentTextClass: 'text-orange-300',
    rules: [
      { match: { element: 'fire' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Fire +2 ATK' },
      { match: { tribe: 'dragon' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Dragon +2 ATK' },
      { match: { tribe: 'beast' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Beast +2 ATK' },
      { match: { element: 'water' }, powerDelta: 0, pDefDelta: -2, mDefDelta: -2, label: 'Water −2 DEF' },
      { match: { element: 'nature' }, powerDelta: 0, pDefDelta: -2, mDefDelta: -2, label: 'Nature −2 DEF' },
    ],
  },
  hallowed: {
    id: 'hallowed',
    name: 'Hallowed Ground',
    shortName: 'Hallowed',
    tagline: 'Sunlit sanctuary wards fortify mortals, high elves, and light while searing the risen dead.',
    favorsSummary: 'Light +2 DEF · Mortal +2 DEF · Elf +2 M.DEF',
    hindersSummary: 'Undead −2 ATK · Shadow −2 ATK',
    tileImage: './src/assets/images/biomes/biome_hallowed.jpg',
    tileImageFilter: 'brightness(0.45) contrast(1.2) saturate(0.9) sepia(0.22)',
    tileBlendGlow: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(251, 191, 36, 0.18), transparent 80%)',
    tileBgStyle:
      'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(217, 119, 6, 0.34) 0%, rgba(69, 44, 15, 0.72) 65%, rgba(24, 18, 12, 0.94) 100%)',
    tileBorderClass: 'border-amber-300/55',
    badgeClass: 'bg-amber-950/90 border-amber-300/55 text-amber-200',
    accentTextClass: 'text-amber-300',
    rules: [
      { match: { element: 'light' }, powerDelta: 0, pDefDelta: 2, mDefDelta: 2, label: 'Light +2 DEF' },
      { match: { tribe: 'mortal' }, powerDelta: 0, pDefDelta: 2, mDefDelta: 2, label: 'Mortal +2 DEF' },
      { match: { tribe: 'elf' }, powerDelta: 0, pDefDelta: 0, mDefDelta: 2, label: 'Elf +2 M.DEF' },
      { match: { tribe: 'undead' }, powerDelta: -2, pDefDelta: 0, mDefDelta: 0, label: 'Undead −2 ATK' },
      { match: { element: 'shadow' }, powerDelta: -2, pDefDelta: 0, mDefDelta: 0, label: 'Shadow −2 ATK' },
    ],
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow Mire',
    shortName: 'Shadow',
    tagline: 'Grave-mist empowers dark magic and undead legions while dimming radiant and silvan foes.',
    favorsSummary: 'Shadow +2 ATK · Undead +2 ATK',
    hindersSummary: 'Light −2 DEF · Fey −2 DEF · Elf −2 P.DEF',
    tileImage: './src/assets/images/biomes/biome_shadow.jpg',
    tileImageFilter: 'brightness(0.84) contrast(1.14) saturate(1.12)',
    tileBlendGlow: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(168, 85, 247, 0.16), transparent 80%)',
    tileBgStyle:
      'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(126, 34, 206, 0.4) 0%, rgba(44, 16, 70, 0.78) 65%, rgba(16, 8, 28, 0.95) 100%)',
    tileBorderClass: 'border-violet-400/55',
    badgeClass: 'bg-violet-950/90 border-violet-400/55 text-violet-200',
    accentTextClass: 'text-violet-300',
    rules: [
      { match: { element: 'shadow' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Shadow +2 ATK' },
      { match: { tribe: 'undead' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Undead +2 ATK' },
      { match: { element: 'light' }, powerDelta: 0, pDefDelta: -2, mDefDelta: -2, label: 'Light −2 DEF' },
      { match: { tribe: 'fey' }, powerDelta: 0, pDefDelta: -2, mDefDelta: -2, label: 'Fey −2 DEF' },
      { match: { tribe: 'elf' }, powerDelta: 0, pDefDelta: -2, mDefDelta: 0, label: 'Elf −2 P.DEF' },
    ],
  },
  highland: {
    id: 'highland',
    name: 'Gale Highland',
    shortName: 'Highland',
    tagline: 'Sheer windswept ridges fuel storm, soaring dragons, and beasts while exposing rigid hulls.',
    favorsSummary: 'Storm +2 ATK · Dragon +2 DEF · Beast +2 ATK',
    hindersSummary: 'Construct −2 ATK · Undead −2 P.DEF',
    tileImage: './src/assets/images/biomes/biome_highland.jpg',
    tileImageFilter: 'brightness(0.54) contrast(1.18) saturate(0.84)',
    tileBlendGlow: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(56, 189, 248, 0.12), transparent 80%)',
    tileBgStyle:
      'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(8, 145, 178, 0.34) 0%, rgba(22, 48, 66, 0.75) 65%, rgba(11, 21, 32, 0.94) 100%)',
    tileBorderClass: 'border-cyan-300/50',
    badgeClass: 'bg-cyan-950/90 border-cyan-300/50 text-cyan-200',
    accentTextClass: 'text-cyan-300',
    rules: [
      { match: { element: 'storm' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Storm +2 ATK' },
      { match: { tribe: 'dragon' }, powerDelta: 0, pDefDelta: 2, mDefDelta: 2, label: 'Dragon +2 DEF' },
      { match: { tribe: 'beast' }, powerDelta: 2, pDefDelta: 0, mDefDelta: 0, label: 'Beast +2 ATK' },
      { match: { tribe: 'construct' }, powerDelta: -2, pDefDelta: 0, mDefDelta: 0, label: 'Construct −2 ATK' },
      { match: { tribe: 'undead' }, powerDelta: 0, pDefDelta: -2, mDefDelta: 0, label: 'Undead −2 P.DEF' },
    ],
  },
};

export interface TerrainEvaluation {
  biome: BiomeType;
  powerDelta: number;
  pDefDelta: number;
  mDefDelta: number;
  netScore: number;
  isPositive: boolean;
  isNegative: boolean;
  hasEffect: boolean;
  shortTag: string;
  reasons: string[];
}

function clampTerrainDelta(delta: number): number {
  return Math.max(-2, Math.min(2, delta));
}

function formatCompactTerrainDelta(p: number, pd: number, md: number): string {
  const parts: string[] = [];
  if (p !== 0) parts.push(`${p > 0 ? '+' : '−'}${Math.abs(p)} ATK`);
  if (pd !== 0 && pd === md) {
    parts.push(`${pd > 0 ? '+' : '−'}${Math.abs(pd)} DEF`);
  } else {
    if (pd !== 0) parts.push(`${pd > 0 ? '+' : '−'}${Math.abs(pd)} P.DEF`);
    if (md !== 0) parts.push(`${md > 0 ? '+' : '−'}${Math.abs(md)} M.DEF`);
  }
  return parts.join(' · ');
}

export function evaluateTerrainEffect(
  biome: BiomeType | null | undefined,
  card: Pick<CardDef, 'element' | 'tribe'> | undefined
): TerrainEvaluation | null {
  if (!biome || !card) return null;
  const meta = BIOME_META[biome];
  if (!meta) return null;

  let rawP = 0;
  let rawPd = 0;
  let rawMd = 0;
  const reasons: string[] = [];

  for (const rule of meta.rules) {
    const matched =
      (rule.match.element !== undefined && card.element === rule.match.element) ||
      (rule.match.tribe !== undefined && card.tribe === rule.match.tribe);
    if (matched) {
      rawP += rule.powerDelta;
      rawPd += rule.pDefDelta;
      rawMd += rule.mDefDelta;
      reasons.push(rule.label);
    }
  }

  // Cap per-stat terrain shift to [-2, +2] so dual-tag synergies stay balanced
  const powerDelta = clampTerrainDelta(rawP);
  const pDefDelta = clampTerrainDelta(rawPd);
  const mDefDelta = clampTerrainDelta(rawMd);
  const hasEffect = powerDelta !== 0 || pDefDelta !== 0 || mDefDelta !== 0;
  const netScore = powerDelta * 1.4 + pDefDelta + mDefDelta;

  return {
    biome,
    powerDelta,
    pDefDelta,
    mDefDelta,
    netScore,
    isPositive: hasEffect && netScore > 0,
    isNegative: hasEffect && netScore < 0,
    hasEffect,
    shortTag: hasEffect ? formatCompactTerrainDelta(powerDelta, pDefDelta, mDefDelta) : 'Neutral',
    reasons,
  };
}
