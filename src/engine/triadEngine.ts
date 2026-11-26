import { ALL_BIOMES, evaluateTerrainEffect } from '../data/biomes';
import {
  CARD_MAP,
  CARDS,
  CRAFTABLE_AUGMENTS,
  CardRollOptions,
  getCardPower,
  getStatsPowerScore,
  resolveCardAugment,
  rollCardArrows,
  rollCardStats,
} from '../data/cards';
import { ALL_FIGHTERS, FIGHTER_MAP } from '../data/ladder';
import {
  POWER_CARDS,
  POWER_CARD_MAP,
  getPowerCardsForTier,
  getPowerRelicAffectedCells,
  getUnlockedPowerCardIdSet,
  isPowerCardId,
} from '../data/powerCards';
import {
  ArrowDir,
  AugmentEvent,
  AugmentTier,
  BiomeType,
  BoardCell,
  BoardScale,
  CardDef,
  ClashDetail,
  FlipEvent,
  HandCard,
  LadderFighter,
  MoveResolution,
  Owner,
  PlacedCard,
  PowerCardDef,
  RolledCardInstance,
  TetraStats,
} from '../types/game';

export interface BoardScaleSpec {
  id: BoardScale;
  name: string;
  shortLabel: string;
  subtitle: string;
  rows: number;
  cols: number;
  unitSlots: number;
  biomeCount: number;
}

export const BOARD_SCALES: Record<BoardScale, BoardScaleSpec> = {
  '6x3': {
    id: '6x3',
    name: '6×3 Skirmish',
    shortLabel: '6×3',
    subtitle: '18 Tiles · 8 Units + 1 Relic Slot',
    rows: 3,
    cols: 6,
    unitSlots: 8,
    biomeCount: 5,
  },
  '7x3': {
    id: '7x3',
    name: '7×3 Vanguard',
    shortLabel: '7×3',
    subtitle: '21 Tiles · 9 Units + 1 Relic Slot',
    rows: 3,
    cols: 7,
    unitSlots: 9,
    biomeCount: 6,
  },
};

export const ALL_BOARD_SCALES: BoardScale[] = ['6x3', '7x3'];
export const DEFAULT_BOARD_SCALE: BoardScale = '6x3';

export function getBoardScaleSpec(scale?: BoardScale): BoardScaleSpec {
  return BOARD_SCALES[scale ?? DEFAULT_BOARD_SCALE] ?? BOARD_SCALES['6x3'];
}

export const BOARD_ROWS = BOARD_SCALES['6x3'].rows;
export const BOARD_COLS = BOARD_SCALES['6x3'].cols;
export const HAND_SIZE = BOARD_SCALES['6x3'].unitSlots;
export const BLOCKED_TILE_COUNT = 0;
export const BIOME_TILE_COUNT = BOARD_SCALES['6x3'].biomeCount;

export const EIGHT_DIRS: {
  dr: number;
  dc: number;
  myArrow: ArrowDir;
  oppArrow: ArrowDir;
}[] = [
  { dr: -1, dc: 0, myArrow: 'n', oppArrow: 's' },
  { dr: -1, dc: 1, myArrow: 'ne', oppArrow: 'sw' },
  { dr: 0, dc: 1, myArrow: 'e', oppArrow: 'w' },
  { dr: 1, dc: 1, myArrow: 'se', oppArrow: 'nw' },
  { dr: 1, dc: 0, myArrow: 's', oppArrow: 'n' },
  { dr: 1, dc: -1, myArrow: 'sw', oppArrow: 'ne' },
  { dr: 0, dc: -1, myArrow: 'w', oppArrow: 'e' },
  { dr: -1, dc: -1, myArrow: 'nw', oppArrow: 'se' },
];

export function cloneBoard(board: BoardCell[][]): BoardCell[][] {
  return board.map((row) =>
    row.map((cell) => ({
      ...cell,
      card: cell.card
        ? {
            ...cell.card,
            stats: { ...cell.card.stats },
            baseStats: { ...cell.card.baseStats },
            arrows: [...cell.card.arrows],
            augmentDelta: cell.card.augmentDelta
              ? { ...cell.card.augmentDelta }
              : undefined,
            terrainMod: cell.card.terrainMod
              ? { ...cell.card.terrainMod }
              : undefined,
            relicAuraMod: cell.card.relicAuraMod
              ? { ...cell.card.relicAuraMod }
              : undefined,
            lastAugmented: cell.card.lastAugmented
              ? { ...cell.card.lastAugmented }
              : undefined,
          }
        : null,
    }))
  );
}

/**
 * Creates a wide tactical battlefield (`6×3`, `7×3`, or `6×4`) with evenly spaced Biome tiles
 * so terrain zones never clump into a single corner.
 */
export function createBoard(
  allowedBiomes?: BiomeType[],
  scale: BoardScale = DEFAULT_BOARD_SCALE
): BoardCell[][] {
  const spec = getBoardScaleSpec(scale);
  const { rows, cols, biomeCount } = spec;

  const board: BoardCell[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      blocked: false,
      terrain: null,
      card: null,
    }))
  );

  const biomePool =
    allowedBiomes && allowedBiomes.length > 0 ? [...allowedBiomes] : [...ALL_BIOMES];
  for (let i = biomePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [biomePool[i], biomePool[j]] = [biomePool[j], biomePool[i]];
  }

  // Partition columns into `biomeCount` horizontal bands and avoid orthogonal adjacency when possible
  const chosenCoords: [number, number][] = [];
  for (let i = 0; i < biomeCount; i++) {
    const cStart = Math.floor((i * cols) / biomeCount);
    const cEnd = Math.max(cStart, Math.floor(((i + 1) * cols) / biomeCount) - 1);
    const candidates: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = cStart; c <= cEnd; c++) {
        if (!board[r][c].terrain) {
          candidates.push([r, c]);
        }
      }
    }
    const nonAdjacent = candidates.filter(([r, c]) =>
      chosenCoords.every(([pr, pc]) => Math.abs(pr - r) + Math.abs(pc - c) > 1)
    );
    const pool = nonAdjacent.length > 0 ? nonAdjacent : candidates;
    if (pool.length > 0) {
      const [pickedR, pickedC] = pool[Math.floor(Math.random() * pool.length)];
      board[pickedR][pickedC].terrain = biomePool[i % biomePool.length];
      chosenCoords.push([pickedR, pickedC]);
    }
  }

  return board;
}

export function chooseMatchStarter(tierNumber: number): Owner {
  const playerFirstChance =
    tierNumber <= 1 ? 0.3 : tierNumber === 2 ? 0.4 : 0.5;
  return Math.random() < playerFirstChance ? 'player' : 'rival';
}

function getOpponentRollOptions(
  tierNumber: number,
  orderInTier: number
): CardRollOptions {
  if (tierNumber <= 1) {
    if (orderInTier <= 3) {
      return {
        minStatDelta: -1,
        maxStatDelta: 0,
        minArrowDelta: -1,
        maxArrowDelta: 0,
        typeUpgradeMultiplier: 0,
      };
    }
    return {
      minStatDelta: -1,
      maxStatDelta: 1,
      minArrowDelta: -1,
      maxArrowDelta: 0,
      typeUpgradeMultiplier: 0.25,
    };
  }
  if (tierNumber === 2) {
    return {
      minStatDelta: -2,
      maxStatDelta: 1,
      minArrowDelta: -1,
      maxArrowDelta: 1,
      typeUpgradeMultiplier: 0.4,
    };
  }
  return {
    minStatDelta: -2,
    maxStatDelta: 2,
    minArrowDelta: -1,
    maxArrowDelta: 1,
    typeUpgradeMultiplier: 1,
  };
}

function pickBossRuneForCard(
  fighter: LadderFighter,
  cardDef: CardDef,
  slotIndex: number
): string | undefined {
  if (cardDef.augment) return undefined;

  let targetTier: AugmentTier | null = null;
  let maxAugmentedSlots = 0;

  if (fighter.isBoss) {
    if (fighter.tierNumber >= 8) {
      targetTier = 'sovereign';
      maxAugmentedSlots = 2;
    } else if (fighter.tierNumber >= 6) {
      targetTier = 'major';
      maxAugmentedSlots = 2;
    } else if (fighter.tierNumber >= 4) {
      targetTier = 'minor';
      maxAugmentedSlots = 1;
    }
  } else if (fighter.tierNumber >= 8 && slotIndex === 0 && Math.random() < 0.35) {
    targetTier = 'major';
    maxAugmentedSlots = 1;
  }

  if (!targetTier || slotIndex >= maxAugmentedSlots) return undefined;

  const tierRunes = CRAFTABLE_AUGMENTS.filter((r) => r.tier === targetTier);
  if (tierRunes.length === 0) return undefined;

  const matching = tierRunes.filter((r) => {
    if (
      r.scope === 'all_allies' ||
      r.scope === 'adjacent_allies' ||
      r.scope === 'adjacent_rivals'
    ) {
      return true;
    }
    if (r.scope === 'type_P_allies') return cardDef.stats.type === 'P';
    if (r.scope === 'type_M_allies') return cardDef.stats.type === 'M';
    if (r.scope === 'type_X_allies') return cardDef.stats.type === 'X';
    if (r.scope === 'type_A_allies') return cardDef.stats.type === 'A';
    return false;
  });

  const pool = matching.length > 0 ? matching : tierRunes;
  return pool[Math.floor(Math.random() * pool.length)]?.id;
}

function pickOpponentPowerRelic(fighter: LadderFighter): PowerCardDef | null {
  // Tier 1 non-bosses use pure Unit decks so newcomers learn arrows & biomes first;
  // Tier Bosses showcase their Tier's signature Power Relic, and Tier 2+ fighters wield earlier Relics!
  if (fighter.isBoss) {
    const tierRelics = getPowerCardsForTier(fighter.tierNumber);
    if (tierRelics.length > 0) {
      return tierRelics[Math.floor(Math.random() * tierRelics.length)];
    }
  }
  if (fighter.tierNumber <= 1) return null;

  const eligible = POWER_CARDS.filter((p) => p.unlockTier < fighter.tierNumber);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function makePowerHandCard(powerDef: PowerCardDef, uidPrefix = 'pwr'): HandCard {
  return {
    uid: `${uidPrefix}-${powerDef.id}-${Math.random().toString(36).slice(2, 6)}`,
    cardId: powerDef.id,
    stats: { power: 0, type: 'P', pDef: 0, mDef: 0 },
    arrows: [...powerDef.dirs],
    isPowerCard: true,
  };
}

/**
 * Builds a tier-bounded hand for the selected Ladder Fighter:
 * - `spec.unitSlots` Unit cards (`8` on `6×3`, `9` on `7×3`, `10` on `6×4`)
 * - Plus 1 thematic Power Relic for Tier Bosses and Tier 2+ challengers!
 */
export function buildOpponentHand(
  fighterId: string,
  scale: BoardScale = DEFAULT_BOARD_SCALE
): HandCard[] {
  const spec = getBoardScaleSpec(scale);
  const unitCount = spec.unitSlots;
  const fighter = FIGHTER_MAP[fighterId] ?? ALL_FIGHTERS[0];
  const baseEligible = CARDS.filter(
    (c) => c.number >= fighter.minCardNumber && c.number <= fighter.maxCardNumber
  );
  const maxBasePower = baseEligible.reduce(
    (max, c) => Math.max(max, getCardPower(c)),
    0
  );

  const allowedRarities = new Set(baseEligible.map((c) => c.rarity));
  let expansionEligible: CardDef[] = [];
  let maxExpansionInHand = unitCount;

  if (fighter.tierNumber === 1) {
    if (fighter.orderInTier >= 4) {
      expansionEligible = CARDS.filter(
        (c) =>
          c.number > 90 &&
          allowedRarities.has(c.rarity) &&
          getCardPower(c) <= maxBasePower + 1
      );
      maxExpansionInHand = 1;
    }
  } else {
    const powerAllowance = fighter.tierNumber === 2 ? 1.5 : 3;
    expansionEligible = CARDS.filter(
      (c) =>
        c.number > 90 &&
        allowedRarities.has(c.rarity) &&
        (fighter.maxCardNumber >= 30 || getCardPower(c) <= maxBasePower + powerAllowance)
    );
    maxExpansionInHand = fighter.tierNumber === 2 ? 2 : unitCount;
  }

  const eligible = [...baseEligible, ...expansionEligible];
  const chosenIds: string[] = [];

  for (const sigId of fighter.signatureCardIds) {
    if (CARD_MAP[sigId] && !chosenIds.includes(sigId) && chosenIds.length < 2) {
      chosenIds.push(sigId);
    }
  }

  const pool = [...eligible];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let expansionPicked = chosenIds.filter((id) => (CARD_MAP[id]?.number ?? 0) > 90).length;
  for (const card of pool) {
    if (chosenIds.length >= unitCount) break;
    if (card.number > 90 && expansionPicked >= maxExpansionInHand) continue;
    if (!chosenIds.includes(card.id)) {
      chosenIds.push(card.id);
      if (card.number > 90) expansionPicked++;
    }
  }

  const fallbackPool = baseEligible.length > 0 ? baseEligible : eligible;
  while (chosenIds.length < unitCount && fallbackPool.length > 0) {
    const pick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    chosenIds.push(pick.id);
  }

  const rollOpts = getOpponentRollOptions(fighter.tierNumber, fighter.orderInTier);

  const unitCards: HandCard[] = chosenIds.slice(0, unitCount).map((cardId, i) => {
    const def = CARD_MAP[cardId] ?? CARDS[0];
    const augmentId = pickBossRuneForCard(fighter, def, i);
    return {
      uid: `rival-${i}-${cardId}-${Math.random().toString(36).slice(2, 6)}`,
      cardId,
      stats: rollCardStats(def, rollOpts),
      arrows: rollCardArrows(def, rollOpts),
      ...(augmentId ? { augmentId } : {}),
    };
  });

  const rivalRelic = pickOpponentPowerRelic(fighter);
  if (rivalRelic) {
    unitCards.push(makePowerHandCard(rivalRelic, 'rival-pwr'));
  }

  return unitCards;
}

export function buildPlayerHand(
  deckRefs: string[],
  inventory: Record<string, RolledCardInstance[]>,
  scale: BoardScale = DEFAULT_BOARD_SCALE,
  powerCardId?: string | null,
  fighterWins?: Record<string, number>
): HandCard[] {
  const spec = getBoardScaleSpec(scale);
  const unitCount = spec.unitSlots;
  const allInstances: RolledCardInstance[] = Object.values(inventory).flat();
  const byUid = new Map<string, RolledCardInstance>();
  for (const inst of allInstances) {
    byUid.set(inst.uid, inst);
  }

  const chosen: RolledCardInstance[] = [];
  const usedUids = new Set<string>();

  for (const ref of deckRefs) {
    if (chosen.length >= unitCount) break;
    if (!ref || isPowerCardId(ref)) continue;
    const direct = byUid.get(ref);
    if (direct && !usedUids.has(direct.uid)) {
      chosen.push(direct);
      usedUids.add(direct.uid);
      continue;
    }
    const copies = (inventory[ref] ?? []).filter((c) => !usedUids.has(c.uid));
    if (copies.length > 0) {
      const best = [...copies].sort(
        (a, b) =>
          getStatsPowerScore(b.stats, b.arrows.length) -
          getStatsPowerScore(a.stats, a.arrows.length)
      )[0];
      chosen.push(best);
      usedUids.add(best.uid);
    }
  }

  if (chosen.length < unitCount) {
    const remaining = allInstances
      .filter((c) => !usedUids.has(c.uid))
      .sort(
        (a, b) =>
          getStatsPowerScore(b.stats, b.arrows.length) -
          getStatsPowerScore(a.stats, a.arrows.length)
      );
    for (const inst of remaining) {
      if (chosen.length >= unitCount) break;
      chosen.push(inst);
      usedUids.add(inst.uid);
    }
  }

  const hand: HandCard[] = chosen.map((inst) => ({
    uid: inst.uid,
    cardId: inst.cardId,
    stats: { ...inst.stats },
    arrows: [...inst.arrows],
    augmentId: inst.augmentId,
  }));

  // Safety loaner backfill if the player sold down below `unitCount` owned cards
  let loanerIdx = 0;
  while (hand.length < unitCount) {
    const fallbackDef = CARDS[loanerIdx % Math.min(12, CARDS.length)];
    loanerIdx += 1;
    hand.push({
      uid: `loaner-${fallbackDef.id}-${loanerIdx}`,
      cardId: fallbackDef.id,
      stats: { ...fallbackDef.stats },
      arrows: [...fallbackDef.arrows],
    });
  }

  if (powerCardId && POWER_CARD_MAP[powerCardId]) {
    const unlockedSet = fighterWins ? getUnlockedPowerCardIdSet(fighterWins) : null;
    if (!unlockedSet || unlockedSet.has(powerCardId)) {
      hand.push(makePowerHandCard(POWER_CARD_MAP[powerCardId], 'player-pwr'));
    }
  }

  return hand;
}

export function getCombatValues(
  attackerStats: TetraStats,
  defenderStats: TetraStats
): { atkVal: number; defVal: number } {
  const a = attackerStats;
  const d = defenderStats;

  switch (a.type) {
    case 'P':
      return { atkVal: a.power, defVal: d.pDef };
    case 'M':
      return { atkVal: a.power, defVal: d.mDef };
    case 'X':
      return { atkVal: a.power, defVal: Math.min(d.pDef, d.mDef) };
    case 'A':
      return {
        atkVal: Math.max(a.power, a.pDef, a.mDef),
        defVal: Math.min(d.power, d.pDef, d.mDef),
      };
  }
}

function resolveArrowClash(
  attackerDef: CardDef,
  attackerStats: TetraStats,
  defenderDef: CardDef,
  defenderStats: TetraStats,
  targetRow: number,
  targetCol: number,
  deterministic = false
): ClashDetail {
  const { atkVal, defVal } = getCombatValues(attackerStats, defenderStats);

  const baseAtk = (atkVal + 1) * 16;
  const baseDef = (defVal + 1) * 16;

  const atkRoll = deterministic ? baseAtk + 9 : baseAtk + Math.floor(Math.random() * 19);
  const defRoll = deterministic ? baseDef + 9 : baseDef + Math.floor(Math.random() * 19);

  const attackerWon =
    atkRoll > defRoll || (atkRoll === defRoll && atkVal >= defVal);

  return {
    attackerId: attackerDef.id,
    defenderId: defenderDef.id,
    attackerName: attackerDef.name,
    defenderName: defenderDef.name,
    attackType: attackerStats.type,
    attackerVal: atkVal,
    defenderVal: defVal,
    attackerRoll: atkRoll,
    defenderRoll: defRoll,
    attackerWon,
    targetRow,
    targetCol,
  };
}

function clampHexStat(val: number): number {
  return Math.max(0, Math.min(15, Math.round(val)));
}

function formatSignedCompact(p: number, pd: number, md: number): string {
  const parts: string[] = [];
  if (p !== 0) parts.push(`${p > 0 ? '+' : '−'}${Math.abs(p)}P`);
  if (pd !== 0 && pd === md) {
    parts.push(`${pd > 0 ? '+' : '−'}${Math.abs(pd)}D`);
  } else {
    if (pd !== 0) parts.push(`${pd > 0 ? '+' : '−'}${Math.abs(pd)}PD`);
    if (md !== 0) parts.push(`${md > 0 ? '+' : '−'}${Math.abs(md)}MD`);
  }
  return parts.join(' ');
}

/**
 * Recomputes every placed Unit card's effective `stats` and `relicAuraMod` from:
 * `baseStats` + `terrainMod` + `augmentDelta` + all active placed Power Relics projecting onto `(r, c)`.
 * Guarantees persistent directional Relic buffs/debuffs apply both to already-placed cards AND
 * cards deployed or flipped onto those tiles later in the match!
 */
export function recalculateBoardStats(board: BoardCell[][]): void {
  const rows = board.length;
  const cols = board[0]?.length ?? BOARD_COLS;

  // Gather all active Power Relics on the board
  const activeRelics: {
    row: number;
    col: number;
    owner: Owner;
    def: PowerCardDef;
    affectedSet: Set<string>;
  }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const card = board[r][c].card;
      if (card?.isRelic) {
        const def = POWER_CARD_MAP[card.cardId];
        if (def) {
          const cells = getPowerRelicAffectedCells(rows, cols, r, c, def);
          activeRelics.push({
            row: r,
            col: c,
            owner: card.owner,
            def,
            affectedSet: new Set(cells.map((pt) => `${pt.row},${pt.col}`)),
          });
        }
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const unit = board[r][c].card;
      if (!unit || unit.isRelic) continue;

      const tP = unit.terrainMod?.powerDelta ?? 0;
      const tPd = unit.terrainMod?.pDefDelta ?? 0;
      const tMd = unit.terrainMod?.mDefDelta ?? 0;

      const aP = unit.augmentDelta?.power ?? 0;
      const aPd = unit.augmentDelta?.pDef ?? 0;
      const aMd = unit.augmentDelta?.mDef ?? 0;

      let rP = 0;
      let rPd = 0;
      let rMd = 0;
      const relicNames: string[] = [];

      const coordKey = `${r},${c}`;
      for (const relic of activeRelics) {
        if (!relic.affectedSet.has(coordKey)) continue;
        const delta =
          unit.owner === relic.owner ? relic.def.allyDelta : relic.def.rivalDelta;
        if (delta.power !== 0 || delta.pDef !== 0 || delta.mDef !== 0) {
          rP += delta.power;
          rPd += delta.pDef;
          rMd += delta.mDef;
          relicNames.push(relic.def.name);
        }
      }

      if (rP !== 0 || rPd !== 0 || rMd !== 0) {
        const net = rP + rPd + rMd;
        unit.relicAuraMod = {
          powerDelta: rP,
          pDefDelta: rPd,
          mDefDelta: rMd,
          label: `${relicNames.join(' + ')}: ${formatSignedCompact(rP, rPd, rMd)}`,
          isPositive: net >= 0,
        };
      } else {
        delete unit.relicAuraMod;
      }

      unit.stats = {
        ...unit.baseStats,
        power: clampHexStat(unit.baseStats.power + tP + aP + rP),
        pDef: clampHexStat(unit.baseStats.pDef + tPd + aPd + rPd),
        mDef: clampHexStat(unit.baseStats.mDef + tMd + aMd + rMd),
      };
    }
  }
}

export function resolvePlacement(
  board: BoardCell[][],
  row: number,
  col: number,
  handCard: HandCard,
  owner: Owner,
  deterministic = false
): MoveResolution {
  const rows = board.length;
  const cols = board[0]?.length ?? BOARD_COLS;
  const nextBoard = cloneBoard(board);
  const cell = nextBoard[row][col];
  const opponent: Owner = owner === 'player' ? 'rival' : 'player';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const existing = nextBoard[r][c].card;
      if (existing) {
        existing.justPlaced = false;
      }
    }
  }

  const flips: FlipEvent[] = [];
  const clashes: ClashDetail[] = [];
  const augments: AugmentEvent[] = [];

  // =========================================================================
  // A. POWER RELIC / TOTEM PLACEMENT (Un-flippable Persistent Aura Structure)
  // =========================================================================
  const powerDef =
    handCard.isPowerCard || isPowerCardId(handCard.cardId)
      ? POWER_CARD_MAP[handCard.cardId]
      : undefined;

  if (powerDef) {
    const relicPlaced: PlacedCard = {
      uid: handCard.uid,
      cardId: powerDef.id,
      owner,
      stats: { power: 0, type: 'P', pDef: 0, mDef: 0 },
      baseStats: { power: 0, type: 'P', pDef: 0, mDef: 0 },
      arrows: [...powerDef.dirs],
      isRelic: true,
      justPlaced: true,
    };
    cell.card = relicPlaced;

    recalculateBoardStats(nextBoard);

    const affected = getPowerRelicAffectedCells(rows, cols, row, col, powerDef);
    for (const pt of affected) {
      const target = nextBoard[pt.row][pt.col].card;
      if (!target || target.isRelic) continue;
      const d = target.owner === owner ? powerDef.allyDelta : powerDef.rivalDelta;
      if (d.power === 0 && d.pDef === 0 && d.mDef === 0) continue;
      const isBuff = d.power + d.pDef + d.mDef >= 0;
      const label = formatSignedCompact(d.power, d.pDef, d.mDef);
      target.lastAugmented = {
        label,
        isBuff,
        timestamp: Date.now(),
      };
      augments.push({
        row: pt.row,
        col: pt.col,
        targetCardName: CARD_MAP[target.cardId]?.name ?? 'Unit',
        label,
        isBuff,
      });
    }

    return {
      nextBoard,
      flips,
      clashes,
      augments,
    };
  }

  // =========================================================================
  // B. STANDARD UNIT CARD PLACEMENT
  // =========================================================================
  const def = CARD_MAP[handCard.cardId] ?? CARDS[0];
  const terrainEval = evaluateTerrainEffect(cell.terrain, def);

  const placed: PlacedCard = {
    uid: handCard.uid,
    cardId: handCard.cardId,
    owner,
    stats: { ...handCard.stats },
    baseStats: { ...handCard.stats },
    arrows: [...handCard.arrows],
    augmentId: handCard.augmentId,
    justPlaced: true,
    augmentDelta: { power: 0, pDef: 0, mDef: 0 },
    ...(terrainEval && terrainEval.hasEffect
      ? {
          terrainMod: {
            biome: terrainEval.biome,
            powerDelta: terrainEval.powerDelta,
            pDefDelta: terrainEval.pDefDelta,
            mDefDelta: terrainEval.mDefDelta,
            label: terrainEval.shortTag,
            isPositive: terrainEval.isPositive,
          },
        }
      : {}),
  };
  cell.card = placed;

  // 0. Trigger On-Play Battlefield Augment (crafted per-copy Rune or innate Mythic Legendary trait)
  const activeAugment = resolveCardAugment(handCard.cardId, handCard.augmentId);
  if (activeAugment) {
    const aug = activeAugment;
    const isBuff =
      aug.powerDelta >= 0 && aug.pDefDelta >= 0 && aug.mDefDelta >= 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === row && c === col) continue;
        const target = nextBoard[r][c].card;
        if (!target || target.isRelic) continue;

        const isAdjacent = Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;
        let matches = false;

        switch (aug.scope) {
          case 'all_allies':
            matches = target.owner === owner;
            break;
          case 'adjacent_allies':
            matches = target.owner === owner && isAdjacent;
            break;
          case 'type_P_allies':
            matches = target.owner === owner && target.stats.type === 'P';
            break;
          case 'type_M_allies':
            matches = target.owner === owner && target.stats.type === 'M';
            break;
          case 'type_X_allies':
            matches = target.owner === owner && target.stats.type === 'X';
            break;
          case 'type_A_allies':
            matches = target.owner === owner && target.stats.type === 'A';
            break;
          case 'adjacent_rivals':
            matches = target.owner !== owner && isAdjacent;
            break;
        }

        if (matches) {
          const prevDelta = target.augmentDelta ?? { power: 0, pDef: 0, mDef: 0 };
          target.augmentDelta = {
            power: prevDelta.power + aug.powerDelta,
            pDef: prevDelta.pDef + aug.pDefDelta,
            mDef: prevDelta.mDef + aug.mDefDelta,
          };
          target.lastAugmented = {
            label: aug.shortTag,
            isBuff,
            timestamp: Date.now(),
          };
          augments.push({
            row: r,
            col: c,
            targetCardName: CARD_MAP[target.cardId]?.name ?? 'Card',
            label: aug.shortTag,
            isBuff,
          });
        }
      }
    }
  }

  // Compute effective stats (including any persistent Power Relic auras covering `(row, col)`!) BEFORE clashes!
  recalculateBoardStats(nextBoard);

  const flipCard = (
    r: number,
    c: number,
    newOwner: Owner,
    reason: FlipEvent['reason'],
    wave: number
  ) => {
    const target = nextBoard[r][c].card;
    if (!target || target.isRelic || target.owner === newOwner) return false;
    target.owner = newOwner;
    target.lastFlippedAt = Date.now() + wave * 160;
    flips.push({ row: r, col: c, reason, wave });
    return true;
  };

  const triggerComboFrom = (cr: number, cc: number, winner: Owner, wave: number) => {
    const sourceCard = nextBoard[cr][cc].card;
    if (!sourceCard || sourceCard.isRelic) return;
    for (const dir of EIGHT_DIRS) {
      if (!sourceCard.arrows.includes(dir.myArrow)) continue;
      const nr = cr + dir.dr;
      const nc = cc + dir.dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const neighbor = nextBoard[nr][nc].card;
      if (neighbor && !neighbor.isRelic && neighbor.owner !== winner) {
        flipCard(nr, nc, winner, 'combo', wave);
      }
    }
  };

  const clashTargets: { r: number; c: number; card: PlacedCard; def: CardDef }[] = [];
  const unopposedTargets: { r: number; c: number; card: PlacedCard }[] = [];

  for (const dir of EIGHT_DIRS) {
    if (!placed.arrows.includes(dir.myArrow)) continue;
    const nr = row + dir.dr;
    const nc = col + dir.dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    const nCard = nextBoard[nr][nc].card;
    if (!nCard || nCard.isRelic || nCard.owner === owner) continue;
    const nDef = CARD_MAP[nCard.cardId];
    if (!nDef) continue;

    if (nCard.arrows.includes(dir.oppArrow)) {
      clashTargets.push({ r: nr, c: nc, card: nCard, def: nDef });
    } else {
      unopposedTargets.push({ r: nr, c: nc, card: nCard });
    }
  }

  clashTargets.sort((a, b) => {
    const aAdv =
      getCombatValues(placed.stats, a.card.stats).atkVal -
      getCombatValues(placed.stats, a.card.stats).defVal;
    const bAdv =
      getCombatValues(placed.stats, b.card.stats).atkVal -
      getCombatValues(placed.stats, b.card.stats).defVal;
    return bAdv - aAdv;
  });

  let placedWasLost = false;
  for (const target of clashTargets) {
    if (nextBoard[target.r][target.c].card?.owner === owner) continue;

    const outcome = resolveArrowClash(
      def,
      placed.stats,
      target.def,
      target.card.stats,
      target.r,
      target.c,
      deterministic
    );
    clashes.push(outcome);

    if (outcome.attackerWon) {
      const changed = flipCard(target.r, target.c, owner, 'clash', 0);
      if (changed) {
        triggerComboFrom(target.r, target.c, owner, 1);
      }
    } else {
      placedWasLost = true;
      flipCard(row, col, opponent, 'clash', 0);
      triggerComboFrom(row, col, opponent, 1);
      break;
    }
  }

  if (!placedWasLost) {
    for (const target of unopposedTargets) {
      if (nextBoard[target.r][target.c].card?.owner !== owner) {
        flipCard(target.r, target.c, owner, 'unopposed', 0);
      }
    }
  }

  // Re-evaluate persistent Relic auras in case flipped cards switched between Ally/Rival polarity!
  if (flips.length > 0) {
    recalculateBoardStats(nextBoard);
  }

  return {
    nextBoard,
    flips,
    clashes,
    augments,
  };
}

/**
 * Counts controlled Unit cards on the battlefield (un-flippable Power Relics are tactical
 * structures rather than score points, keeping scoring 100% fair regardless of Relic usage).
 */
export function getScores(board: BoardCell[][]): { player: number; rival: number } {
  let player = 0;
  let rival = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.card && !cell.card.isRelic) {
        if (cell.card.owner === 'player') player++;
        else rival++;
      }
    }
  }
  return { player, rival };
}

export function isBoardFull(board: BoardCell[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.blocked && !cell.card) return false;
    }
  }
  return true;
}

function shuffleCopy<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function chooseAiMove(
  board: BoardCell[][],
  rivalHand: HandCard[],
  fighterId: string
): { handIndex: number; row: number; col: number } | null {
  const fighter = FIGHTER_MAP[fighterId] ?? ALL_FIGHTERS[0];
  const skill = Math.max(0, Math.min(1, fighter.aiSkill));
  const rows = board.length;
  const cols = board[0]?.length ?? BOARD_COLS;
  const emptyCells: [number, number][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].blocked && !board[r][c].card) {
        emptyCells.push([r, c]);
      }
    }
  }
  if (emptyCells.length === 0 || rivalHand.length === 0) return null;

  const allHandIndices = rivalHand.map((_, idx) => idx);
  const cardsToInspect =
    skill >= 0.72
      ? rivalHand.length
      : Math.max(
          2,
          Math.min(rivalHand.length, Math.round(1.6 + skill * (rivalHand.length - 1.2)))
        );
  const candidateHandIndices =
    cardsToInspect >= rivalHand.length
      ? allHandIndices
      : shuffleCopy(allHandIndices).slice(0, cardsToInspect);

  const cellShare = skill >= 0.65 ? 1 : Math.min(1, 0.4 + skill * 0.9);
  const cellsToInspect = Math.max(1, Math.ceil(emptyCells.length * cellShare));
  const candidateCells =
    cellsToInspect >= emptyCells.length
      ? emptyCells
      : shuffleCopy(emptyCells).slice(0, cellsToInspect);

  const comboWeight = Math.min(1, Math.max(0.1, (skill - 0.12) / 0.55));
  const noiseAmp = Math.pow(1 - skill, 1.35) * 44;
  const remainingUnitsInHand = rivalHand.filter((c) => !c.isPowerCard).length;

  interface ScoredMove {
    handIndex: number;
    row: number;
    col: number;
    score: number;
  }

  const before = getScores(board);
  const moves: ScoredMove[] = [];

  for (const handIndex of candidateHandIndices) {
    const hCard = rivalHand[handIndex];
    const powerDef =
      hCard.isPowerCard || isPowerCardId(hCard.cardId)
        ? POWER_CARD_MAP[hCard.cardId]
        : undefined;

    for (const [r, c] of candidateCells) {
      const sim = resolvePlacement(board, r, c, hCard, 'rival', true);
      const after = getScores(sim.nextBoard);

      let score = 0;

      if (powerDef) {
        // Evaluate Power Relic Totem placement: immediate aura value + future open-tile setup
        const affected = getPowerRelicAffectedCells(rows, cols, r, c, powerDef);
        const allyPotency =
          powerDef.allyDelta.power * 1.35 +
          powerDef.allyDelta.pDef +
          powerDef.allyDelta.mDef;
        const rivalHexPotency = Math.abs(
          powerDef.rivalDelta.power * 1.35 +
            powerDef.rivalDelta.pDef +
            powerDef.rivalDelta.mDef
        );

        let immediateImpact = 0;
        let openCoverage = 0;
        let blocksExposedFriendlyBack = 0;

        for (const pt of affected) {
          const occupant = board[pt.row][pt.col].card;
          if (!occupant) {
            openCoverage += allyPotency * 0.6 + rivalHexPotency * 0.35;
          } else if (!occupant.isRelic) {
            if (occupant.owner === 'rival') {
              immediateImpact += allyPotency * 2.4;
            } else {
              immediateImpact += rivalHexPotency * 2.5;
            }
          }
        }

        // Blocking an open flank of a friendly unit that has no arrow in this direction
        for (const dir of EIGHT_DIRS) {
          const nr = r + dir.dr;
          const nc = c + dir.dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const nCard = board[nr][nc].card;
          if (nCard && !nCard.isRelic && nCard.owner === 'rival') {
            if (!nCard.arrows.includes(dir.oppArrow)) {
              blocksExposedFriendlyBack += 3.5;
            }
          }
        }

        const tempoFactor = remainingUnitsInHand >= 2 ? 1.0 : 0.45;
        score =
          (immediateImpact + openCoverage * tempoFactor + blocksExposedFriendlyBack) *
            (0.65 + 0.55 * skill) -
          (board[r][c].terrain ? 1.5 : 0);
      } else {
        const netGain = after.rival - before.rival;
        const lostOwnCard = sim.clashes.some((cl) => !cl.attackerWon);
        const comboFlips = sim.flips.filter((f) => f.reason === 'combo').length;

        if (lostOwnCard) {
          const closestDefGap = sim.clashes.reduce(
            (minGap, cl) => Math.min(minGap, cl.defenderVal - cl.attackerVal),
            99
          );
          const noviceMisread =
            skill < 0.4 && closestDefGap <= 2 && Math.random() < (0.4 - skill) * 0.45;
          score = noviceMisread ? 16 : netGain * 14 - 16 * skill;
        } else {
          const effectiveGain = Math.max(
            1,
            netGain - comboFlips * (1 - comboWeight)
          );
          score = effectiveGain * 14;
        }

        if (sim.augments.length > 0) {
          score += sim.augments.length * 4.5 * skill;
        }

        const hDef = CARD_MAP[hCard.cardId];
        const tEval = evaluateTerrainEffect(board[r][c].terrain, hDef);
        if (tEval && tEval.hasEffect) {
          score += tEval.netScore * 1.8 * skill;
        }

        // Reward landing in a friendly Power Relic aura (and avoiding enemy Relic hexes!)
        const placedUnit = sim.nextBoard[r][c].card;
        if (placedUnit?.relicAuraMod) {
          const auraSum =
            placedUnit.relicAuraMod.powerDelta * 1.4 +
            placedUnit.relicAuraMod.pDefDelta +
            placedUnit.relicAuraMod.mDefDelta;
          score += auraSum * 2.2 * skill;
        }

        for (const dir of EIGHT_DIRS) {
          const nr = r + dir.dr;
          const nc = c + dir.dc;
          const inBounds = nr >= 0 && nr < rows && nc >= 0 && nc < cols;
          const hasArrow = hCard.arrows.includes(dir.myArrow);

          if (inBounds && !board[nr][nc].blocked && !board[nr][nc].card) {
            if (hasArrow) {
              score += 1.4 * skill;
            } else {
              score -= 1.2 * skill;
            }
          }
        }

        if (skill >= 0.82 && emptyCells.length >= 2 && emptyCells.length <= 4) {
          const probeCard: HandCard = {
            uid: 'probe-player',
            cardId: hCard.cardId,
            stats: {
              power: Math.min(14, Math.round(6 + skill * 6)),
              type: 'X',
              pDef: Math.min(13, Math.round(5 + skill * 6)),
              mDef: Math.min(13, Math.round(5 + skill * 6)),
            },
            arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
          };
          let worstSwingAgainstRival = 0;
          for (const [or, oc] of emptyCells) {
            if (or === r && oc === c) continue;
            const replySim = resolvePlacement(
              sim.nextBoard,
              or,
              oc,
              probeCard,
              'player',
              true
            );
            const replyScores = getScores(replySim.nextBoard);
            const rivalLostCards = after.rival - replyScores.rival;
            if (rivalLostCards > worstSwingAgainstRival) {
              worstSwingAgainstRival = rivalLostCards;
            }
          }
          score -= worstSwingAgainstRival * 7.5 * skill;
        }
      }

      const jitter = (Math.random() - 0.5) * 2 * noiseAmp;
      moves.push({ handIndex, row: r, col: c, score: score + jitter });
    }
  }

  moves.sort((a, b) => b.score - a.score);

  if (skill < 0.5 && moves.length > 1) {
    const slipChance = (0.5 - skill) * 0.55;
    if (Math.random() < slipChance) {
      const k = Math.min(moves.length, skill < 0.28 ? 4 : 3);
      const picked = moves[1 + Math.floor(Math.random() * (k - 1))];
      return { handIndex: picked.handIndex, row: picked.row, col: picked.col };
    }
  }

  const top = moves[0];
  return { handIndex: top.handIndex, row: top.row, col: top.col };
}
