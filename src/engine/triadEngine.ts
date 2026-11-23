import {
  CARD_MAP,
  CARDS,
  getStatsPowerScore,
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

export const BOARD_SIZE = 5;
export const HAND_SIZE = 7;

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
 * Creates a tactical 5x5 Sanctuary Board (25 tiles)
 * with 2 to 6 randomly placed stone monoliths (always leaving 19-23 open tiles for 14 played cards).
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

  // Randomly roll 2 to 6 blocked monoliths across the 5x5 grid
  const blockCounts = [2, 3, 3, 4, 4, 4, 5, 5, 6];
  const blockCount = blockCounts[Math.floor(Math.random() * blockCounts.length)];

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
 * Builds a fair, tier-bounded 7-card hand for the selected Ladder Fighter:
 * - Includes 1-2 of the fighter's signature cards
 * - Draws the remaining cards strictly from their [minCardNumber, maxCardNumber] range
 * - Rolls each card's stats AND arrow configuration within its rarity tier range!
 */
export function buildOpponentHand(fighterId: string): HandCard[] {
  const fighter = FIGHTER_MAP[fighterId] ?? ALL_FIGHTERS[0];
  const eligible = CARDS.filter(
    (c) => c.number >= fighter.minCardNumber && c.number <= fighter.maxCardNumber
  );

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

  for (const card of pool) {
    if (chosenIds.length >= HAND_SIZE) break;
    if (!chosenIds.includes(card.id)) {
      chosenIds.push(card.id);
    }
  }

  while (chosenIds.length < HAND_SIZE && eligible.length > 0) {
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    chosenIds.push(pick.id);
  }

  return chosenIds.slice(0, HAND_SIZE).map((cardId, i) => {
    const def = CARD_MAP[cardId] ?? CARDS[0];
    return {
      uid: `rival-${i}-${cardId}-${Math.random().toString(36).slice(2, 6)}`,
      cardId,
      stats: rollCardStats(def),
      arrows: rollCardArrows(def),
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
    justPlaced: true,
  };
  cell.card = placed;

  const flips: FlipEvent[] = [];
  const clashes: ClashDetail[] = [];
  const augments: AugmentEvent[] = [];

  // 0. Trigger On-Play Battlefield Augment (buffing already-placed allies or sundering adjacent rivals)
  if (def?.augment) {
    const aug = def.augment;
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

export function chooseAiMove(
  board: BoardCell[][],
  rivalHand: HandCard[],
  fighterId: string
): { handIndex: number; row: number; col: number } | null {
  const fighter = FIGHTER_MAP[fighterId] ?? ALL_FIGHTERS[0];
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

  interface ScoredMove {
    handIndex: number;
    row: number;
    col: number;
    score: number;
  }

  const moves: ScoredMove[] = [];

  for (let i = 0; i < rivalHand.length; i++) {
    const hCard = rivalHand[i];

    for (const [r, c] of emptyCells) {
      const sim = resolvePlacement(board, r, c, hCard, 'rival', true);
      const before = getScores(board);
      const after = getScores(sim.nextBoard);

      const netGain = after.rival - before.rival;
      let score = netGain * 14;

      // Value triggering Battlefield Augments on already-placed cards
      if (sim.augments.length > 0) {
        score += sim.augments.length * 4.5 * fighter.aiSkill;
      }

      for (const dir of EIGHT_DIRS) {
        const nr = r + dir.dr;
        const nc = c + dir.dc;
        const inBounds = nr >= 0 && nr < size && nc >= 0 && nc < size;
        const hasArrow = hCard.arrows.includes(dir.myArrow);

        if (inBounds && !board[nr][nc].blocked && !board[nr][nc].card) {
          if (hasArrow) {
            score += 1.4 * fighter.aiSkill;
          } else {
            score -= 1.2 * fighter.aiSkill;
          }
        }
      }

      const jitter = (1 - fighter.aiSkill) * 20 * (Math.random() - 0.45);
      moves.push({ handIndex: i, row: r, col: c, score: score + jitter });
    }
  }

  moves.sort((a, b) => b.score - a.score);
  const top = moves[0];
  return { handIndex: top.handIndex, row: top.row, col: top.col };
}
