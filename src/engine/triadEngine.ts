import {
  CARD_MAP,
  CARDS,
  CardRollOptions,
  getCardPower,
  getStatsPowerScore,
  resolveCardAugment,
  rollCardArrows,
  rollCardStats,
} from '../data/cards';
import { ALL_FIGHTERS, FIGHTER_MAP } from '../data/ladder';
import {
  ArrowDir,
  AugmentEvent,
  BoardCell,
  CardDef,
  ClashDetail,
  FlipEvent,
  HandCard,
  MoveResolution,
  Owner,
  PlacedCard,
  RolledCardInstance,
  TetraStats,
} from '../types/game';

export const BOARD_SIZE = 4;
export const HAND_SIZE = 7;
export const BLOCKED_TILE_COUNT = BOARD_SIZE * BOARD_SIZE - HAND_SIZE * 2; // 2 sealed tiles + 14 cards = full 16-tile 4x4 board

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
            lastAugmented: cell.card.lastAugmented
              ? { ...cell.card.lastAugmented }
              : undefined,
          }
        : null,
    }))
  );
}

/**
 * Creates a tactical 4x4 Sanctuary Board (16 tiles)
 * with 2 randomly placed sealed obsidian monoliths so 7 player cards + 7 rival cards (14 total)
 * fill every open socket on the board by the final turn.
 */
export function createBoard(): BoardCell[][] {
  const size = BOARD_SIZE;
  const board: BoardCell[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      blocked: false,
      card: null,
    }))
  );

  const blockCount = BLOCKED_TILE_COUNT;

  const coords: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      coords.push([r, c]);
    }
  }

  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [coords[i], coords[j]] = [coords[j], coords[i]];
  }

  for (let i = 0; i < blockCount; i++) {
    const [r, c] = coords[i];
    board[r][c].blocked = true;
  }

  return board;
}

/**
 * Determines who places the first card on the 14-open-tile board.
 * Because going SECOND grants the decisive Turn-14 final placement,
 * early tiers let the rival lead more often (giving newcomers Turn 14),
 * ramping smoothly to an unbiased 50/50 coin flip from Tier 3 onward.
 */
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

/**
 * Builds a fair, tier-bounded 7-card hand for the selected Ladder Fighter:
 * - Includes 1-2 of the fighter's signature cards
 * - Draws remaining cards from their [minCardNumber, maxCardNumber] range
 * - Gates expansion cards (#91+) out of early Tier 1 fights and power-caps them in early tiers
 * - Scales stat/arrow roll variance and X/A upgrade chances by tier
 */
export function buildOpponentHand(fighterId: string): HandCard[] {
  const fighter = FIGHTER_MAP[fighterId] ?? ALL_FIGHTERS[0];
  const baseEligible = CARDS.filter(
    (c) => c.number >= fighter.minCardNumber && c.number <= fighter.maxCardNumber
  );
  const maxBasePower = baseEligible.reduce(
    (max, c) => Math.max(max, getCardPower(c)),
    0
  );

  // Gate expansion cards (#91+) so Tier 1 Fights #1-#3 strictly use starter Commons (#01-#08)
  const allowedRarities = new Set(baseEligible.map((c) => c.rarity));
  let expansionEligible: CardDef[] = [];
  let maxExpansionInHand = HAND_SIZE;

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
    maxExpansionInHand = fighter.tierNumber === 2 ? 2 : HAND_SIZE;
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

  let expansionPicked = 0;
  for (const card of pool) {
    if (chosenIds.length >= HAND_SIZE) break;
    if (card.number > 90 && expansionPicked >= maxExpansionInHand) continue;
    if (!chosenIds.includes(card.id)) {
      chosenIds.push(card.id);
      if (card.number > 90) expansionPicked++;
    }
  }

  const fallbackPool = baseEligible.length > 0 ? baseEligible : eligible;
  while (chosenIds.length < HAND_SIZE && fallbackPool.length > 0) {
    const pick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    chosenIds.push(pick.id);
  }

  const rollOpts = getOpponentRollOptions(fighter.tierNumber, fighter.orderInTier);

  return chosenIds.slice(0, HAND_SIZE).map((cardId, i) => {
    const def = CARD_MAP[cardId] ?? CARDS[0];
    return {
      uid: `rival-${i}-${cardId}-${Math.random().toString(36).slice(2, 6)}`,
      cardId,
      stats: rollCardStats(def, rollOpts),
      arrows: rollCardArrows(def, rollOpts),
    };
  });
}

export function buildPlayerHand(
  deckRefs: string[],
  inventory: Record<string, RolledCardInstance[]>
): HandCard[] {
  const allInstances: RolledCardInstance[] = Object.values(inventory).flat();
  const byUid = new Map<string, RolledCardInstance>();
  for (const inst of allInstances) {
    byUid.set(inst.uid, inst);
  }

  const chosen: RolledCardInstance[] = [];
  const usedUids = new Set<string>();

  for (const ref of deckRefs) {
    if (chosen.length >= HAND_SIZE) break;
    const direct = byUid.get(ref);
    if (direct && !usedUids.has(direct.uid)) {
      chosen.push(direct);
      usedUids.add(direct.uid);
      continue;
    }
    // Fallback if ref is a cardId: pick highest-stat available instance of that cardId
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

  if (chosen.length < HAND_SIZE) {
    const remaining = allInstances
      .filter((c) => !usedUids.has(c.uid))
      .sort(
        (a, b) =>
          getStatsPowerScore(b.stats, b.arrows.length) -
          getStatsPowerScore(a.stats, a.arrows.length)
      );
    for (const inst of remaining) {
      if (chosen.length >= HAND_SIZE) break;
      chosen.push(inst);
      usedUids.add(inst.uid);
    }
  }

  return chosen.map((inst) => ({
    uid: inst.uid,
    cardId: inst.cardId,
    stats: { ...inst.stats },
    arrows: [...inst.arrows],
    augmentId: inst.augmentId,
  }));
}

/**
 * Computes the attacker's effective stat vs defender's targeted stat per FF9 rules:
 * - P (Physical): Attacker Power vs Defender Physical Defense (3rd stat)
 * - M (Magical): Attacker Power vs Defender Magical Defense (4th stat)
 * - X (Flexible): Attacker Power vs lowest of Defender's P.Def or M.Def
 * - A (Assault): Highest of all 3 Attacker stats vs lowest of all 3 Defender stats
 */
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

/**
 * Resolves an FF9 Arrow Clash between Attacker and Defender using their current (rolled + augmented) stats.
 */
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

export function resolvePlacement(
  board: BoardCell[][],
  row: number,
  col: number,
  handCard: HandCard,
  owner: Owner,
  deterministic = false
): MoveResolution {
  const size = board.length;
  const nextBoard = cloneBoard(board);
  const cell = nextBoard[row][col];
  const def = CARD_MAP[handCard.cardId];
  const opponent: Owner = owner === 'player' ? 'rival' : 'player';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const existing = nextBoard[r][c].card;
      if (existing) {
        existing.justPlaced = false;
      }
    }
  }

  const placed: PlacedCard = {
    uid: handCard.uid,
    cardId: handCard.cardId,
    owner,
    stats: { ...handCard.stats },
    baseStats: { ...handCard.stats },
    arrows: [...handCard.arrows],
    augmentId: handCard.augmentId,
    justPlaced: true,
  };
  cell.card = placed;

  const flips: FlipEvent[] = [];
  const clashes: ClashDetail[] = [];
  const augments: AugmentEvent[] = [];

  // 0. Trigger On-Play Battlefield Augment (crafted per-copy Rune or innate Mythic Legendary trait)
  const activeAugment = resolveCardAugment(handCard.cardId, handCard.augmentId);
  if (activeAugment) {
    const aug = activeAugment;
    const isBuff =
      aug.powerDelta >= 0 && aug.pDefDelta >= 0 && aug.mDefDelta >= 0;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r === row && c === col) continue;
        const target = nextBoard[r][c].card;
        if (!target) continue;

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
          target.stats = {
            ...target.stats,
            power: clampHexStat(target.stats.power + aug.powerDelta),
            pDef: clampHexStat(target.stats.pDef + aug.pDefDelta),
            mDef: clampHexStat(target.stats.mDef + aug.mDefDelta),
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

  const flipCard = (r: number, c: number, newOwner: Owner, reason: FlipEvent['reason'], wave: number) => {
    const target = nextBoard[r][c].card;
    if (!target || target.owner === newOwner) return false;
    target.owner = newOwner;
    target.lastFlippedAt = Date.now() + wave * 160;
    flips.push({ row: r, col: c, reason, wave });
    return true;
  };

  const triggerComboFrom = (cr: number, cc: number, winner: Owner, wave: number) => {
    const sourceCard = nextBoard[cr][cc].card;
    if (!sourceCard) return;
    for (const dir of EIGHT_DIRS) {
      if (!sourceCard.arrows.includes(dir.myArrow)) continue;
      const nr = cr + dir.dr;
      const nc = cc + dir.dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const neighbor = nextBoard[nr][nc].card;
      if (neighbor && neighbor.owner !== winner) {
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
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
    const nCard = nextBoard[nr][nc].card;
    if (!nCard || nCard.owner === owner) continue;
    const nDef = CARD_MAP[nCard.cardId];

    if (nCard.arrows.includes(dir.oppArrow)) {
      clashTargets.push({ r: nr, c: nc, card: nCard, def: nDef });
    } else {
      unopposedTargets.push({ r: nr, c: nc, card: nCard });
    }
  }

  // 1. Resolve Arrow Clashes
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

  // 2. If our placed card wasn't lost in a clash, capture all Unopposed arrow targets
  if (!placedWasLost) {
    for (const target of unopposedTargets) {
      if (nextBoard[target.r][target.c].card?.owner !== owner) {
        flipCard(target.r, target.c, owner, 'unopposed', 0);
      }
    }
  }

  return {
    nextBoard,
    flips,
    clashes,
    augments,
  };
}

export function getScores(board: BoardCell[][]): { player: number; rival: number } {
  let player = 0;
  let rival = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.card) {
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
  const size = board.length;
  const emptyCells: [number, number][] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!board[r][c].blocked && !board[r][c].card) {
        emptyCells.push([r, c]);
      }
    }
  }
  if (emptyCells.length === 0 || rivalHand.length === 0) return null;

  // Low-skill novices inspect only a subset of their hand and board squares
  // instead of exhaustively brute-forcing all 98 card x cell permutations.
  const allHandIndices = rivalHand.map((_, idx) => idx);
  const cardsToInspect =
    skill >= 0.72
      ? rivalHand.length
      : Math.max(2, Math.min(rivalHand.length, Math.round(1.6 + skill * (rivalHand.length - 1.2))));
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

  // Skill-scaled tactical weights:
  // - Novices barely read multi-step combos and occasionally misread close clashes.
  // - Veterans (skill >= 0.65) value combos, augments, and arrow defense at full strength.
  const comboWeight = Math.min(1, Math.max(0.1, (skill - 0.12) / 0.55));
  const noiseAmp = Math.pow(1 - skill, 1.35) * 44;

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

    for (const [r, c] of candidateCells) {
      const sim = resolvePlacement(board, r, c, hCard, 'rival', true);
      const after = getScores(sim.nextBoard);

      const netGain = after.rival - before.rival;
      const lostOwnCard = sim.clashes.some((cl) => !cl.attackerWon);
      const comboFlips = sim.flips.filter((f) => f.reason === 'combo').length;

      let score: number;
      if (lostOwnCard) {
        // High-skill AI avoids losing clashes strongly; low-skill novices occasionally
        // misjudge P/M/X defenses on close stat matchups.
        const closestDefGap = sim.clashes.reduce(
          (minGap, cl) => Math.min(minGap, cl.defenderVal - cl.attackerVal),
          99
        );
        const noviceMisread =
          skill < 0.4 && closestDefGap <= 2 && Math.random() < (0.4 - skill) * 0.45;
        score = noviceMisread ? 16 : netGain * 14 - 16 * skill;
      } else {
        // Discount combo flips for low-skill AI so novices don't always spot chain setups
        const effectiveGain = Math.max(
          1,
          netGain - comboFlips * (1 - comboWeight)
        );
        score = effectiveGain * 14;
      }

      // Value triggering Battlefield Augments on already-placed cards
      if (sim.augments.length > 0) {
        score += sim.augments.length * 4.5 * skill;
      }

      // Edge/open-arrow positioning scales with skill
      for (const dir of EIGHT_DIRS) {
        const nr = r + dir.dr;
        const nc = c + dir.dc;
        const inBounds = nr >= 0 && nr < size && nc >= 0 && nc < size;
        const hasArrow = hCard.arrows.includes(dir.myArrow);

        if (inBounds && !board[nr][nc].blocked && !board[nr][nc].card) {
          if (hasArrow) {
            score += 1.4 * skill;
          } else {
            score -= 1.2 * skill;
          }
        }
      }

      const jitter = (Math.random() - 0.5) * 2 * noiseAmp;
      moves.push({ handIndex, row: r, col: c, score: score + jitter });
    }
  }

  moves.sort((a, b) => b.score - a.score);

  // Soft top-K selection for early tiers so novices don't always lock onto the strict #1 line
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
