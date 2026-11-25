import {
  ArrowDir,
  CardElement,
  PowerCardDef,
  PowerTargetOffset,
} from '../types/game';
import { LADDER_TIERS } from './ladder';

const RELIC_IMG = {
  lantern: './src/assets/images/card_lantern_wisp_1795362407904.jpg',
  briar: './src/assets/images/card_briar_sprite_1795363117548.jpg',
  tide: './src/assets/images/card_aether_leviathan_1795362407681.jpg',
  cinder: './src/assets/images/card_crimson_phoenix_1795362407139.jpg',
  gale: './src/assets/images/card_tempest_djinn_1795363117056.jpg',
  aegis: './src/assets/images/card_stone_behemoth_1795362407794.jpg',
  gloom: './src/assets/images/card_wailing_banshee.jpg',
  glacial: './src/assets/images/card_glacial_empress_1795363118839.jpg',
  sunspire: './src/assets/images/card_radiant_bishop.jpg',
  voidrift: './src/assets/images/card_void_behemoth_1795419233239.jpg',
  worldtree: './src/assets/images/card_worldtree_sovereign.jpg',
  crown: './src/assets/images/card_eternal_overlord.jpg',
};

const ORTHO_1: PowerTargetOffset[] = [
  { dr: -1, dc: 0 },
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
];

const DIAG_1: PowerTargetOffset[] = [
  { dr: -1, dc: 1 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
  { dr: -1, dc: -1 },
];

const RING_8: PowerTargetOffset[] = [...ORTHO_1, ...DIAG_1];

const ALL_DIRS: ArrowDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/**
 * 12 Unique Tactical Power Relics (P01–P12).
 * - 0 Starter Power Cards: unlocked strictly by conquering all 5 challengers in Campaign Tiers 1–10
 *   (1 per Tier, with milestone double-unlocks at Tier 5 and Tier 10 = 12 total).
 * - Placed onto any open battlefield socket as an un-flippable Relic Totem that blocks space
 *   and projects persistent directional buffs/debuffs onto surrounding tiles (affecting units
 *   already there AND units deployed or flipped onto those tiles later in the match).
 */
export const POWER_CARDS: PowerCardDef[] = [
  {
    id: 'power-lantern-totem',
    number: 1,
    code: 'P01',
    name: 'Lantern Bastion Totem',
    unlockTier: 1,
    rarity: 'rare',
    element: 'light',
    dirs: ['n', 's'],
    offsets: [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
    ],
    patternLabel: 'Front & Behind (1 Tile N · S)',
    badgeLabel: 'N·S +1P/+1D',
    shortTag: '+1 ATK & +1 DEF (N, S Allies)',
    description:
      'Persistent Aura: Allied units 1 tile in front (N) and behind (S) gain +1 ATK, +1 P.DEF & +1 M.DEF.',
    allyDelta: { power: 1, pDef: 1, mDef: 1 },
    rivalDelta: { power: 0, pDef: 0, mDef: 0 },
    image: RELIC_IMG.lantern,
    artFilter: 'hue-rotate(18deg) saturate(1.28) contrast(1.08)',
    accentGradient: 'from-amber-950 via-yellow-950 to-slate-950',
  },
  {
    id: 'power-briar-horn',
    number: 2,
    code: 'P02',
    name: 'Briarwind Warhorn',
    unlockTier: 2,
    rarity: 'rare',
    element: 'nature',
    dirs: ['e', 'w'],
    offsets: [
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ],
    patternLabel: 'Left & Right Flanks (1 Tile E · W)',
    badgeLabel: 'E·W +2P/+1PD',
    shortTag: '+2 ATK & +1 P.DEF (E, W Allies)',
    description:
      'Persistent Aura: Allied units 1 tile Left (W) and Right (E) gain +2 ATK & +1 P.DEF.',
    allyDelta: { power: 2, pDef: 1, mDef: 0 },
    rivalDelta: { power: 0, pDef: 0, mDef: 0 },
    image: RELIC_IMG.briar,
    artFilter: 'hue-rotate(-14deg) saturate(1.22) contrast(1.08)',
    accentGradient: 'from-emerald-950 via-green-950 to-slate-950',
  },
  {
    id: 'power-tide-obelisk',
    number: 3,
    code: 'P03',
    name: 'Tidecaller Obelisk',
    unlockTier: 3,
    rarity: 'rare',
    element: 'water',
    dirs: ['ne', 'se', 'sw', 'nw'],
    offsets: DIAG_1,
    patternLabel: '4 Diagonal Corners (1 Tile)',
    badgeLabel: 'DIAG +2MD/-1P',
    shortTag: '+2 M.DEF/+1 P.DEF Allies · −1 ATK Rivals (Diags)',
    description:
      'Persistent Aura: Diagonal allies gain +1 P.DEF & +2 M.DEF; diagonal rivals suffer −1 ATK.',
    allyDelta: { power: 0, pDef: 1, mDef: 2 },
    rivalDelta: { power: -1, pDef: 0, mDef: 0 },
    image: RELIC_IMG.tide,
    artFilter: 'hue-rotate(12deg) saturate(1.25) contrast(1.1)',
    accentGradient: 'from-cyan-950 via-sky-950 to-slate-950',
  },
  {
    id: 'power-cinder-brazier',
    number: 4,
    code: 'P04',
    name: 'Cinderforge Brazier',
    unlockTier: 4,
    rarity: 'epic',
    element: 'fire',
    dirs: ['n', 'e', 's', 'w'],
    offsets: ORTHO_1,
    patternLabel: 'Orthogonal Cross (1 Tile N · E · S · W)',
    badgeLabel: 'CROSS +2P/-1D',
    shortTag: '+2 ATK Allies · −1 DEF Rivals (N, E, S, W)',
    description:
      'Persistent Aura: Orthogonal allies (N, E, S, W) gain +2 ATK; orthogonal rivals lose −1 P.DEF & −1 M.DEF.',
    allyDelta: { power: 2, pDef: 0, mDef: 0 },
    rivalDelta: { power: 0, pDef: -1, mDef: -1 },
    image: RELIC_IMG.cinder,
    artFilter: 'hue-rotate(-10deg) saturate(1.32) contrast(1.1)',
    accentGradient: 'from-orange-950 via-rose-950 to-slate-950',
  },
  {
    id: 'power-gale-lance',
    number: 5,
    code: 'P05',
    name: 'Galecrest Spearstone',
    unlockTier: 5,
    rarity: 'epic',
    element: 'storm',
    dirs: ['e', 'w'],
    offsets: [
      { dr: 0, dc: -2 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: 2 },
    ],
    patternLabel: 'Wide Row Line (1–2 Tiles E & W)',
    badgeLabel: 'ROW2 +2P/+1MD',
    shortTag: '+2 ATK & +1 M.DEF (2 Tiles E & W)',
    description:
      'Persistent Aura: Allied units up to 2 tiles Left & Right along this row gain +2 ATK & +1 M.DEF.',
    allyDelta: { power: 2, pDef: 0, mDef: 1 },
    rivalDelta: { power: 0, pDef: 0, mDef: 0 },
    image: RELIC_IMG.gale,
    artFilter: 'hue-rotate(24deg) saturate(1.25) contrast(1.08)',
    accentGradient: 'from-indigo-950 via-sky-950 to-slate-950',
  },
  {
    id: 'power-iron-citadel',
    number: 6,
    code: 'P06',
    name: 'Runestone Aegis Pillar',
    unlockTier: 5,
    rarity: 'epic',
    element: 'neutral',
    dirs: ['n', 's'],
    offsets: [
      { dr: -3, dc: 0 },
      { dr: -2, dc: 0 },
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 2, dc: 0 },
      { dr: 3, dc: 0 },
    ],
    patternLabel: 'Full Column Bastion (All Tiles N & S)',
    badgeLabel: 'COL +2 DEF',
    shortTag: '+2 P.DEF & +2 M.DEF (Entire Column)',
    description:
      'Persistent Aura: Allied units anywhere in the same vertical column gain +2 P.DEF & +2 M.DEF.',
    allyDelta: { power: 0, pDef: 2, mDef: 2 },
    rivalDelta: { power: 0, pDef: 0, mDef: 0 },
    image: RELIC_IMG.aegis,
    artFilter: 'saturate(0.9) contrast(1.16) brightness(1.04)',
    accentGradient: 'from-stone-800 via-slate-900 to-slate-950',
  },
  {
    id: 'power-gloom-effigy',
    number: 7,
    code: 'P07',
    name: 'Gloomveil Hex Totem',
    unlockTier: 6,
    rarity: 'epic',
    element: 'shadow',
    dirs: ALL_DIRS,
    offsets: RING_8,
    patternLabel: 'All 8 Surrounding Tiles',
    badgeLabel: 'FOE -2 DEF',
    shortTag: '−2 P.DEF & −2 M.DEF (All Adj. Rivals)',
    description:
      'Persistent Aura: Rival units in all 8 surrounding tiles suffer −2 P.DEF & −2 M.DEF.',
    allyDelta: { power: 0, pDef: 0, mDef: 0 },
    rivalDelta: { power: 0, pDef: -2, mDef: -2 },
    image: RELIC_IMG.gloom,
    artFilter: 'hue-rotate(-22deg) saturate(1.28) contrast(1.1)',
    accentGradient: 'from-purple-950 via-violet-950 to-slate-950',
  },
  {
    id: 'power-glacial-spire',
    number: 8,
    code: 'P08',
    name: 'Glacial Lock Spire',
    unlockTier: 7,
    rarity: 'epic',
    element: 'water',
    dirs: ['n', 'e', 's', 'w'],
    offsets: ORTHO_1,
    patternLabel: 'Orthogonal Cross (1 Tile N · E · S · W)',
    badgeLabel: '+2D / FOE -2P',
    shortTag: '+2 DEF Allies · −2 ATK/−1 P.DEF Rivals (Cross)',
    description:
      'Persistent Aura: Orthogonal allies gain +2 P.DEF & +2 M.DEF; orthogonal rivals suffer −2 ATK & −1 P.DEF.',
    allyDelta: { power: 0, pDef: 2, mDef: 2 },
    rivalDelta: { power: -2, pDef: -1, mDef: 0 },
    image: RELIC_IMG.glacial,
    artFilter: 'hue-rotate(8deg) saturate(1.2) contrast(1.12)',
    accentGradient: 'from-sky-950 via-blue-950 to-slate-950',
  },
  {
    id: 'power-sunspire-shrine',
    number: 9,
    code: 'P09',
    name: 'Sunspire Sanctum Banner',
    unlockTier: 8,
    rarity: 'mythic',
    element: 'light',
    dirs: ALL_DIRS,
    offsets: RING_8,
    patternLabel: 'All 8 Surrounding Tiles',
    badgeLabel: 'ADJ +2 ALL',
    shortTag: '+2 ATK, +2 P.DEF & +2 M.DEF (8 Adj. Allies)',
    description:
      'Persistent Aura: Allied units in all 8 surrounding tiles gain +2 ATK, +2 P.DEF & +2 M.DEF.',
    allyDelta: { power: 2, pDef: 2, mDef: 2 },
    rivalDelta: { power: 0, pDef: 0, mDef: 0 },
    image: RELIC_IMG.sunspire,
    artFilter: 'saturate(1.26) contrast(1.08)',
    accentGradient: 'from-amber-900 via-yellow-950 to-slate-950',
  },
  {
    id: 'power-void-pylon',
    number: 10,
    code: 'P10',
    name: 'Voidrift Siphon Pylon',
    unlockTier: 9,
    rarity: 'mythic',
    element: 'shadow',
    dirs: ['ne', 'se', 'sw', 'nw'],
    offsets: [
      ...DIAG_1,
      { dr: -2, dc: 2 },
      { dr: 2, dc: 2 },
      { dr: 2, dc: -2 },
      { dr: -2, dc: -2 },
    ],
    patternLabel: 'X-Rift Diagonals (1–2 Tiles)',
    badgeLabel: 'DIAG ±2 ALL',
    shortTag: '+2P/+1D Allies · −2 ALL Rivals (1–2 Diags)',
    description:
      'Persistent Aura: Diagonal allies (1–2 tiles) gain +2 ATK & +1 DEF; diagonal rivals lose −2 ATK, −2 P.DEF & −2 M.DEF.',
    allyDelta: { power: 2, pDef: 1, mDef: 1 },
    rivalDelta: { power: -2, pDef: -2, mDef: -2 },
    image: RELIC_IMG.voidrift,
    artFilter: 'hue-rotate(18deg) saturate(1.3) contrast(1.12)',
    accentGradient: 'from-fuchsia-950 via-purple-950 to-slate-950',
  },
  {
    id: 'power-worldtree-heart',
    number: 11,
    code: 'P11',
    name: 'Worldtree Heartstone',
    unlockTier: 10,
    rarity: 'mythic',
    element: 'nature',
    dirs: ['n', 'e', 's', 'w'],
    offsets: [
      { dr: -3, dc: 0 },
      { dr: -2, dc: 0 },
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 2, dc: 0 },
      { dr: 3, dc: 0 },
      { dr: 0, dc: -3 },
      { dr: 0, dc: -2 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: 2 },
      { dr: 0, dc: 3 },
    ],
    patternLabel: 'Sovereign Cross (1–3 Tiles Row & Col)',
    badgeLabel: 'LINE +2P/+3D',
    shortTag: '+2 ATK & +3 DEF (Row & Col up to 3 Tiles)',
    description:
      'Persistent Aura: Allied units up to 3 tiles along this Row or Column gain +2 ATK, +3 P.DEF & +3 M.DEF.',
    allyDelta: { power: 2, pDef: 3, mDef: 3 },
    rivalDelta: { power: 0, pDef: 0, mDef: 0 },
    image: RELIC_IMG.worldtree,
    artFilter: 'hue-rotate(-8deg) saturate(1.25) contrast(1.08)',
    accentGradient: 'from-emerald-900 via-teal-950 to-slate-950',
  },
  {
    id: 'power-sovereign-crown',
    number: 12,
    code: 'P12',
    name: 'Crown of Eternal Dominion',
    unlockTier: 10,
    rarity: 'mythic',
    element: 'fire',
    dirs: ALL_DIRS,
    offsets: RING_8,
    patternLabel: 'All 8 Surrounding Tiles',
    badgeLabel: '+3P/+2D · -2 FOE',
    shortTag: '+3P/+2D Allies · −2 ALL Rivals (8 Adj. Tiles)',
    description:
      'Persistent Aura: Surrounding allies gain +3 ATK, +2 P.DEF & +2 M.DEF; surrounding rivals lose −2 ATK, −2 P.DEF & −2 M.DEF.',
    allyDelta: { power: 3, pDef: 2, mDef: 2 },
    rivalDelta: { power: -2, pDef: -2, mDef: -2 },
    image: RELIC_IMG.crown,
    artFilter: 'hue-rotate(-6deg) saturate(1.3) contrast(1.1)',
    accentGradient: 'from-amber-900 via-red-950 to-slate-950',
  },
];

export const POWER_CARD_MAP: Record<string, PowerCardDef> = Object.fromEntries(
  POWER_CARDS.map((p) => [p.id, p])
);

export function isPowerCardId(cardId: string | null | undefined): boolean {
  return Boolean(cardId && POWER_CARD_MAP[cardId]);
}

/**
 * A Campaign Tier is fully cleared when every challenger in that tier has >= 1 victory.
 */
export function isCampaignTierCleared(
  tierNumber: number,
  fighterWins: Record<string, number> | undefined
): boolean {
  const tier = LADDER_TIERS.find((t) => t.tierNumber === tierNumber);
  if (!tier || tier.fighters.length === 0) return false;
  const wins = fighterWins ?? {};
  return tier.fighters.every((f) => (wins[f.id] ?? 0) > 0);
}

export function getClearedTierNumbers(
  fighterWins: Record<string, number> | undefined
): Set<number> {
  const cleared = new Set<number>();
  for (const tier of LADDER_TIERS) {
    if (isCampaignTierCleared(tier.tierNumber, fighterWins)) {
      cleared.add(tier.tierNumber);
    }
  }
  return cleared;
}

export function getUnlockedPowerCards(
  fighterWins: Record<string, number> | undefined
): PowerCardDef[] {
  const cleared = getClearedTierNumbers(fighterWins);
  return POWER_CARDS.filter((p) => cleared.has(p.unlockTier));
}

export function getUnlockedPowerCardIdSet(
  fighterWins: Record<string, number> | undefined
): Set<string> {
  return new Set(getUnlockedPowerCards(fighterWins).map((p) => p.id));
}

export function getPowerCardsForTier(tierNumber: number): PowerCardDef[] {
  return POWER_CARDS.filter((p) => p.unlockTier === tierNumber);
}

/**
 * Returns valid (row, col) board coordinates affected by a Power Relic placed at (originRow, originCol).
 */
export function getPowerRelicAffectedCells(
  rows: number,
  cols: number,
  originRow: number,
  originCol: number,
  powerDef: PowerCardDef
): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (const { dr, dc } of powerDef.offsets) {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}
