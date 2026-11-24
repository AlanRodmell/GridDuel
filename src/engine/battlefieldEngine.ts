import { evaluateTerrainEffect } from '../data/biomes';
import {
  CARD_MAP,
  CARDS,
  getStatsPowerScore,
  resolveCardAugment,
  rollCardArrows,
  rollCardStats,
} from '../data/cards';
import { ALL_FIGHTERS, FIGHTER_MAP } from '../data/ladder';
import {
  ArrowDir,
  BiomeType,
  CardDef,
  ClashDetail,
  HandCard,
  Owner,
  RolledCardInstance,
  TetraStats,
} from '../types/game';
import { EIGHT_DIRS, getCombatValues } from './triadEngine';

export const BF_ROWS = 5;
export const BF_COLS = 7;
export const BF_ROSTER_SIZE = 10;
export const BF_HAND_LIMIT = 5;
export const BF_AP_PER_TURN = 2;
export const BF_VP_TO_WIN = 8;

export interface BattlefieldMapPreset {
  id: string;
  name: string;
  subtitle: string;
  biomes: BiomeType[];
  // Row-major 5x7 biome layout
  terrainGrid: (BiomeType | null)[][];
  shrines: [number, number][];
}

export const BATTLEFIELD_MAPS: BattlefieldMapPreset[] = [
  {
    id: 'river-crossing',
    name: 'Weeping Ford',
    subtitle: 'A rushing river splits the valley around a central stone crossing, flanked by muddy banks.',
    biomes: ['water', 'marsh', 'highland'],
    terrainGrid: [
      [null, null, 'marsh', 'water', 'marsh', null, null],
      [null, null, null, 'water', null, null, null],
      [null, 'highland', null, null, null, 'highland', null],
      [null, null, null, 'water', null, null, null],
      [null, null, 'marsh', 'water', 'marsh', null, null],
    ],
    shrines: [
      [0, 3],
      [2, 3],
      [4, 3],
    ],
  },
  {
    id: 'scorched-pass',
    name: 'Cinderfall Pass',
    subtitle: 'Volcanic fissures cleave the center ridge while gale highlands overlook both flanks.',
    biomes: ['volcanic', 'highland', 'shadow'],
    terrainGrid: [
      [null, null, 'highland', null, 'highland', null, null],
      [null, null, null, 'volcanic', null, null, null],
      [null, 'shadow', 'volcanic', 'volcanic', 'volcanic', 'shadow', null],
      [null, null, null, 'volcanic', null, null, null],
      [null, null, 'highland', null, 'highland', null, null],
    ],
    shrines: [
      [0, 3],
      [2, 3],
      [4, 3],
    ],
  },
  {
    id: 'twilight-ruins',
    name: 'Sunward Crypts',
    subtitle: 'Hallowed temple flagstones in the north confront creeping shadow mires to the south.',
    biomes: ['hallowed', 'shadow', 'water'],
    terrainGrid: [
      [null, null, 'hallowed', 'hallowed', 'hallowed', null, null],
      [null, 'hallowed', null, null, null, 'hallowed', null],
      [null, null, null, 'water', null, null, null],
      [null, 'shadow', null, null, null, 'shadow', null],
      [null, null, 'shadow', 'shadow', 'shadow', null, null],
    ],
    shrines: [
      [0, 3],
      [2, 3],
      [4, 3],
    ],
  },
  {
    id: 'wildwood-basin',
    name: 'Briarwind Basin',
    subtitle: 'Soggy marshlands and flooded pools encircle a commanding highland outcrop.',
    biomes: ['marsh', 'water', 'highland', 'hallowed'],
    terrainGrid: [
      [null, 'marsh', 'marsh', null, 'marsh', 'marsh', null],
      [null, null, 'water', 'highland', 'water', null, null],
      [null, 'hallowed', null, 'highland', null, 'hallowed', null],
      [null, null, 'water', 'highland', 'water', null, null],
      [null, 'marsh', 'marsh', null, 'marsh', 'marsh', null],
    ],
    shrines: [
      [1, 3],
      [2, 3],
      [3, 3],
    ],
  },
];

export interface BattlefieldUnit {
  uid: string;
  cardId: string;
  owner: Owner;
  baseStats: TetraStats;
  augmentDelta: { power: number; pDef: number; mDef: number };
  stats: TetraStats; // Effective: baseStats + augmentDelta + current tile terrain
  arrows: ArrowDir[];
  augmentId?: string;
  hasActed: boolean;
  justMovedAt?: number;
  terrainMod?: {
    biome: BiomeType;
    powerDelta: number;
    pDefDelta: number;
    mDefDelta: number;
    label: string;
    isPositive: boolean;
  };
  lastAugmented?: {
    label: string;
    isBuff: boolean;
    timestamp: number;
  };
}

export interface BattlefieldCell {
  row: number;
  col: number;
  terrain: BiomeType | null;
  keepOwner: Owner | null; // Player Keep at (2,0), Rival Keep at (2,6)
  isShrine: boolean;
  shrineController: Owner | null;
  unit: BattlefieldUnit | null;
}

export interface UnitMoveOption {
  row: number;
  col: number;
  kind: 'move' | 'flank' | 'clash';
  dir: ArrowDir;
  isRiverGlide?: boolean;
  highGroundBonus?: number;
}

export interface BattlefieldActionResult {
  nextBoard: BattlefieldCell[][];
  outcome: 'deployed' | 'moved' | 'flank_ko' | 'clash_won' | 'clash_lost';
  clash?: ClashDetail;
  attackerName: string;
  defenderName?: string;
  capturedKeepWinner?: Owner | null;
  shrineCaptured?: boolean;
  augmentSummary?: string;
  terrainSummary?: string;
}

function clampStat(v: number): number {
  return Math.max(0, Math.min(15, Math.round(v)));
}

export function applyUnitTerrainAndAugments(
  unit: BattlefieldUnit,
  terrain: BiomeType | null
): BattlefieldUnit {
  const def = CARD_MAP[unit.cardId];
  const tEval = evaluateTerrainEffect(terrain, def);
  const tP = tEval?.powerDelta ?? 0;
  const tPd = tEval?.pDefDelta ?? 0;
  const tMd = tEval?.mDefDelta ?? 0;

  return {
    ...unit,
    stats: {
      type: unit.baseStats.type,
      power: clampStat(unit.baseStats.power + unit.augmentDelta.power + tP),
      pDef: clampStat(unit.baseStats.pDef + unit.augmentDelta.pDef + tPd),
      mDef: clampStat(unit.baseStats.mDef + unit.augmentDelta.mDef + tMd),
    },
    terrainMod:
      tEval && tEval.hasEffect
        ? {
            biome: tEval.biome,
            powerDelta: tP,
            pDefDelta: tPd,
            mDefDelta: tMd,
            label: tEval.shortTag,
            isPositive: tEval.isPositive,
          }
        : undefined,
  };
}

export function cloneBattlefieldBoard(board: BattlefieldCell[][]): BattlefieldCell[][] {
  return board.map((row) =>
    row.map((cell) => ({
      ...cell,
      unit: cell.unit
        ? {
            ...cell.unit,
            baseStats: { ...cell.unit.baseStats },
            augmentDelta: { ...cell.unit.augmentDelta },
            stats: { ...cell.unit.stats },
            arrows: [...cell.unit.arrows],
            terrainMod: cell.unit.terrainMod ? { ...cell.unit.terrainMod } : undefined,
            lastAugmented: cell.unit.lastAugmented ? { ...cell.unit.lastAugmented } : undefined,
          }
        : null,
    }))
  );
}

export function createBattlefieldBoard(mapPreset: BattlefieldMapPreset): BattlefieldCell[][] {
  const shrineSet = new Set(mapPreset.shrines.map(([r, c]) => `${r}-${c}`));
  return Array.from({ length: BF_ROWS }, (_, row) =>
    Array.from({ length: BF_COLS }, (_, col) => ({
      row,
      col,
      terrain: mapPreset.terrainGrid[row]?.[col] ?? null,
      keepOwner: row === 2 && col === 0 ? 'player' : row === 2 && col === BF_COLS - 1 ? 'rival' : null,
      isShrine: shrineSet.has(`${row}-${col}`),
      shrineController: null,
      unit: null,
    }))
  );
}

/**
 * Builds a 10-card player battlefield army starting from active deck cards
 * and drafting the strongest remaining owned cards so you have tactical depth.
 */
export function buildBattlefieldPlayerRoster(
  deckRefs: string[],
  inventory: Record<string, RolledCardInstance[]>
): HandCard[] {
  const allInstances = Object.values(inventory).flat();
  const byUid = new Map<string, RolledCardInstance>();
  for (const inst of allInstances) byUid.set(inst.uid, inst);

  const chosen: RolledCardInstance[] = [];
  const usedUids = new Set<string>();

  for (const ref of deckRefs) {
    if (chosen.length >= BF_ROSTER_SIZE) break;
    const direct = byUid.get(ref);
    if (direct && !usedUids.has(direct.uid)) {
      chosen.push(direct);
      usedUids.add(direct.uid);
    }
  }

  if (chosen.length < BF_ROSTER_SIZE) {
    const remaining = allInstances
      .filter((c) => !usedUids.has(c.uid))
      .sort(
        (a, b) =>
          getStatsPowerScore(b.stats, b.arrows.length) -
          getStatsPowerScore(a.stats, a.arrows.length)
      );
    for (const inst of remaining) {
      if (chosen.length >= BF_ROSTER_SIZE) break;
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

export function buildBattlefieldOpponentRoster(fighterId: string): HandCard[] {
  const fighter = FIGHTER_MAP[fighterId] ?? ALL_FIGHTERS[0];
  const baseEligible = CARDS.filter(
    (c) => c.number >= fighter.minCardNumber && c.number <= fighter.maxCardNumber
  );
  const allowedRarities = new Set(baseEligible.map((c) => c.rarity));
  const expansionEligible = CARDS.filter((c) => c.number > 90 && allowedRarities.has(c.rarity));
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

  for (const card of pool) {
    if (chosenIds.length >= BF_ROSTER_SIZE) break;
    if (!chosenIds.includes(card.id)) chosenIds.push(card.id);
  }
  while (chosenIds.length < BF_ROSTER_SIZE && eligible.length > 0) {
    chosenIds.push(eligible[Math.floor(Math.random() * eligible.length)].id);
  }

  return chosenIds.slice(0, BF_ROSTER_SIZE).map((cardId, i) => {
    const def = CARD_MAP[cardId] ?? CARDS[0];
    return {
      uid: `bf-rival-${i}-${cardId}-${Math.random().toString(36).slice(2, 6)}`,
      cardId,
      stats: rollCardStats(def),
      arrows: rollCardArrows(def),
    };
  });
}

export function refreshUnitsForTurn(
  board: BattlefieldCell[][],
  activeOwner: Owner
): { nextBoard: BattlefieldCell[][]; shrinePointsScored: number } {
  const nextBoard = cloneBattlefieldBoard(board);
  let shrinePointsScored = 0;

  for (const row of nextBoard) {
    for (const cell of row) {
      if (cell.unit && cell.unit.owner === activeOwner) {
        cell.unit.hasActed = false;
      }
      if (cell.isShrine && cell.shrineController === activeOwner) {
        shrinePointsScored += 1;
      }
    }
  }

  return { nextBoard, shrinePointsScored };
}

/**
 * Valid deployment tiles:
 * - Any empty tile in your home column (Col 0 for player, Col 6 for rival)
 * - Plus any empty tile orthogonally adjacent to a Shrine you currently control!
 */
export function getValidDeployTiles(
  board: BattlefieldCell[][],
  owner: Owner
): [number, number][] {
  const homeCol = owner === 'player' ? 0 : BF_COLS - 1;
  const coords = new Set<string>();

  for (let r = 0; r < BF_ROWS; r++) {
    if (!board[r][homeCol].unit) {
      coords.add(`${r}-${homeCol}`);
    }
  }

  // Forward reinforcement adjacent to controlled shrines
  const ortho = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (let r = 0; r < BF_ROWS; r++) {
    for (let c = 0; c < BF_COLS; c++) {
      const cell = board[r][c];
      if (cell.isShrine && cell.shrineController === owner) {
        if (!cell.unit) coords.add(`${r}-${c}`);
        for (const [dr, dc] of ortho) {
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < BF_ROWS &&
            nc >= 0 &&
            nc < BF_COLS &&
            !board[nr][nc].unit &&
            board[nr][nc].keepOwner !== (owner === 'player' ? 'rival' : 'player')
          ) {
            coords.add(`${nr}-${nc}`);
          }
        }
      }
    }
  }

  return Array.from(coords).map((k) => {
    const [r, c] = k.split('-').map(Number);
    return [r, c];
  });
}

/**
 * Legal moves & strikes for a unit at (row, col):
 * - Can step 1 tile in any direction where it has an active orange arrow
 * - Water/Storm units standing on or stepping into Water can glide 1 extra tile across consecutive Water!
 * - Stepping onto an enemy unit triggers Flank Ambush (if enemy lacks opposing arrow) or Arrow Clash (if enemy points back)
 */
export function getValidUnitActions(
  board: BattlefieldCell[][],
  row: number,
  col: number
): UnitMoveOption[] {
  const cell = board[row]?.[col];
  const unit = cell?.unit;
  if (!unit || unit.hasActed) return [];

  const def = CARD_MAP[unit.cardId];
  const canRiverGlide = def?.element === 'water' || def?.element === 'storm';
  const options: UnitMoveOption[] = [];
  const seen = new Set<string>();

  for (const dir of EIGHT_DIRS) {
    if (!unit.arrows.includes(dir.myArrow)) continue;
    const nr = row + dir.dr;
    const nc = col + dir.dc;
    if (nr < 0 || nr >= BF_ROWS || nc < 0 || nc >= BF_COLS) continue;

    const targetCell = board[nr][nc];
    const highGroundBonus =
      cell.terrain === 'highland' && targetCell.terrain !== 'highland' ? 1 : 0;

    if (!targetCell.unit) {
      seen.add(`${nr}-${nc}`);
      options.push({ row: nr, col: nc, kind: 'move', dir: dir.myArrow });

      // Water/Storm River Glide: 2nd step across consecutive Water tiles
      if (canRiverGlide && targetCell.terrain === 'water') {
        const nr2 = nr + dir.dr;
        const nc2 = nc + dir.dc;
        if (
          nr2 >= 0 &&
          nr2 < BF_ROWS &&
          nc2 >= 0 &&
          nc2 < BF_COLS &&
          board[nr2][nc2].terrain === 'water' &&
          !board[nr2][nc2].unit &&
          !seen.has(`${nr2}-${nc2}`)
        ) {
          seen.add(`${nr2}-${nc2}`);
          options.push({
            row: nr2,
            col: nc2,
            kind: 'move',
            dir: dir.myArrow,
            isRiverGlide: true,
          });
        }
      }
    } else if (targetCell.unit.owner !== unit.owner) {
      const pointsBack = targetCell.unit.arrows.includes(dir.oppArrow);
      seen.add(`${nr}-${nc}`);
      options.push({
        row: nr,
        col: nc,
        kind: pointsBack ? 'clash' : 'flank',
        dir: dir.myArrow,
        highGroundBonus,
      });
    }
  }

  return options;
}

export function deployBattlefieldCard(
  board: BattlefieldCell[][],
  row: number,
  col: number,
  handCard: HandCard,
  owner: Owner,
  startsReady = false
): BattlefieldActionResult {
  const nextBoard = cloneBattlefieldBoard(board);
  const cell = nextBoard[row][col];
  const def = CARD_MAP[handCard.cardId];

  const baseUnit: BattlefieldUnit = {
    uid: handCard.uid,
    cardId: handCard.cardId,
    owner,
    baseStats: { ...handCard.stats },
    augmentDelta: { power: 0, pDef: 0, mDef: 0 },
    stats: { ...handCard.stats },
    arrows: [...handCard.arrows],
    augmentId: handCard.augmentId,
    hasActed: !startsReady,
    justMovedAt: Date.now(),
  };

  const deployedUnit = applyUnitTerrainAndAugments(baseUnit, cell.terrain);
  cell.unit = deployedUnit;

  let shrineCaptured = false;
  if (cell.isShrine && cell.shrineController !== owner) {
    cell.shrineController = owner;
    shrineCaptured = true;
  }

  // Trigger On-Play Battlefield Augment on existing units
  const activeAug = resolveCardAugment(handCard.cardId, handCard.augmentId);
  let augTargets = 0;
  if (activeAug) {
    const isBuff =
      activeAug.powerDelta >= 0 && activeAug.pDefDelta >= 0 && activeAug.mDefDelta >= 0;

    for (let r = 0; r < BF_ROWS; r++) {
      for (let c = 0; c < BF_COLS; c++) {
        if (r === row && c === col) continue;
        const target = nextBoard[r][c].unit;
        if (!target) continue;

        const isAdjacent = Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;
        let matches = false;
        switch (activeAug.scope) {
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
          target.augmentDelta = {
            power: target.augmentDelta.power + activeAug.powerDelta,
            pDef: target.augmentDelta.pDef + activeAug.pDefDelta,
            mDef: target.augmentDelta.mDef + activeAug.mDefDelta,
          };
          target.lastAugmented = {
            label: activeAug.shortTag,
            isBuff,
            timestamp: Date.now(),
          };
          nextBoard[r][c].unit = applyUnitTerrainAndAugments(target, nextBoard[r][c].terrain);
          augTargets++;
        }
      }
    }
  }

  return {
    nextBoard,
    outcome: 'deployed',
    attackerName: def?.name ?? 'Troop',
    shrineCaptured,
    augmentSummary:
      augTargets > 0 && activeAug ? `${activeAug.name} (${activeAug.shortTag} ×${augTargets})` : undefined,
    terrainSummary: deployedUnit.terrainMod?.label,
  };
}

function resolveBattlefieldClash(
  attackerDef: CardDef,
  attackerStats: TetraStats,
  defenderDef: CardDef,
  defenderStats: TetraStats,
  targetRow: number,
  targetCol: number,
  highGroundBonus = 0,
  deterministic = false
): ClashDetail {
  const boostedAttacker: TetraStats =
    highGroundBonus > 0
      ? { ...attackerStats, power: clampStat(attackerStats.power + highGroundBonus) }
      : attackerStats;

  const { atkVal, defVal } = getCombatValues(boostedAttacker, defenderStats);
  const baseAtk = (atkVal + 1) * 16;
  const baseDef = (defVal + 1) * 16;
  const atkRoll = deterministic ? baseAtk + 9 : baseAtk + Math.floor(Math.random() * 19);
  const defRoll = deterministic ? baseDef + 9 : baseDef + Math.floor(Math.random() * 19);
  const attackerWon = atkRoll > defRoll || (atkRoll === defRoll && atkVal >= defVal);

  return {
    attackerId: attackerDef.id,
    defenderId: defenderDef.id,
    attackerName: attackerDef.name,
    defenderName: defenderDef.name,
    attackType: boostedAttacker.type,
    attackerVal: atkVal,
    defenderVal: defVal,
    attackerRoll: atkRoll,
    defenderRoll: defRoll,
    attackerWon,
    targetRow,
    targetCol,
  };
}

export function executeUnitMoveOrStrike(
  board: BattlefieldCell[][],
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  deterministic = false
): BattlefieldActionResult {
  const nextBoard = cloneBattlefieldBoard(board);
  const srcCell = nextBoard[fromRow][fromCol];
  const dstCell = nextBoard[toRow][toCol];
  const mover = srcCell.unit;
  if (!mover) {
    return { nextBoard, outcome: 'moved', attackerName: 'Troop' };
  }

  const attackerDef = CARD_MAP[mover.cardId] ?? CARDS[0];
  const highGroundBonus =
    srcCell.terrain === 'highland' && dstCell.terrain !== 'highland' ? 1 : 0;

  // Empty destination → clean tactical march
  if (!dstCell.unit) {
    srcCell.unit = null;
    const movedUnit = applyUnitTerrainAndAugments(
      { ...mover, hasActed: true, justMovedAt: Date.now() },
      dstCell.terrain
    );
    dstCell.unit = movedUnit;

    let shrineCaptured = false;
    if (dstCell.isShrine && dstCell.shrineController !== mover.owner) {
      dstCell.shrineController = mover.owner;
      shrineCaptured = true;
    }

    const enemyKeep = mover.owner === 'player' ? 'rival' : 'player';
    const capturedKeepWinner = dstCell.keepOwner === enemyKeep ? mover.owner : null;

    return {
      nextBoard,
      outcome: 'moved',
      attackerName: attackerDef.name,
      capturedKeepWinner,
      shrineCaptured,
      terrainSummary: movedUnit.terrainMod?.label,
    };
  }

  // Occupied by enemy → check Flank Ambush vs Head-On Arrow Clash
  const defender = dstCell.unit;
  const defenderDef = CARD_MAP[defender.cardId] ?? CARDS[0];
  const dr = Math.sign(toRow - fromRow);
  const dc = Math.sign(toCol - fromCol);
  const matchedDir = EIGHT_DIRS.find((d) => d.dr === dr && d.dc === dc);
  const pointsBack = matchedDir ? defender.arrows.includes(matchedDir.oppArrow) : true;

  if (!pointsBack) {
    // Unopposed Flank Ambush — instant knockout & advance!
    srcCell.unit = null;
    const victor = applyUnitTerrainAndAugments(
      { ...mover, hasActed: true, justMovedAt: Date.now() },
      dstCell.terrain
    );
    dstCell.unit = victor;

    let shrineCaptured = false;
    if (dstCell.isShrine && dstCell.shrineController !== mover.owner) {
      dstCell.shrineController = mover.owner;
      shrineCaptured = true;
    }
    const enemyKeep = mover.owner === 'player' ? 'rival' : 'player';
    const capturedKeepWinner = dstCell.keepOwner === enemyKeep ? mover.owner : null;

    return {
      nextBoard,
      outcome: 'flank_ko',
      attackerName: attackerDef.name,
      defenderName: defenderDef.name,
      capturedKeepWinner,
      shrineCaptured,
      terrainSummary: victor.terrainMod?.label,
    };
  }

  // Head-On Arrow Clash
  const clash = resolveBattlefieldClash(
    attackerDef,
    mover.stats,
    defenderDef,
    defender.stats,
    toRow,
    toCol,
    highGroundBonus,
    deterministic
  );

  if (clash.attackerWon) {
    srcCell.unit = null;
    const victor = applyUnitTerrainAndAugments(
      { ...mover, hasActed: true, justMovedAt: Date.now() },
      dstCell.terrain
    );
    dstCell.unit = victor;

    let shrineCaptured = false;
    if (dstCell.isShrine && dstCell.shrineController !== mover.owner) {
      dstCell.shrineController = mover.owner;
      shrineCaptured = true;
    }
    const enemyKeep = mover.owner === 'player' ? 'rival' : 'player';
    const capturedKeepWinner = dstCell.keepOwner === enemyKeep ? mover.owner : null;

    return {
      nextBoard,
      outcome: 'clash_won',
      clash,
      attackerName: attackerDef.name,
      defenderName: defenderDef.name,
      capturedKeepWinner,
      shrineCaptured,
      terrainSummary: victor.terrainMod?.label,
    };
  }

  // Attacker defeated in clash — eliminated on the field
  srcCell.unit = null;
  return {
    nextBoard,
    outcome: 'clash_lost',
    clash,
    attackerName: attackerDef.name,
    defenderName: defenderDef.name,
  };
}

export function countUnitsOnBoard(
  board: BattlefieldCell[][]
): { player: number; rival: number; playerShrines: number; rivalShrines: number } {
  let player = 0;
  let rival = 0;
  let playerShrines = 0;
  let rivalShrines = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.unit) {
        if (cell.unit.owner === 'player') player++;
        else rival++;
      }
      if (cell.isShrine) {
        if (cell.shrineController === 'player') playerShrines++;
        else if (cell.shrineController === 'rival') rivalShrines++;
      }
    }
  }
  return { player, rival, playerShrines, rivalShrines };
}

export type BattlefieldAiAction =
  | { type: 'deploy'; handIndex: number; row: number; col: number }
  | { type: 'move'; fromRow: number; fromCol: number; toRow: number; toCol: number };

export function chooseBattlefieldAiAction(
  board: BattlefieldCell[][],
  rivalHand: HandCard[],
  fighterId: string
): BattlefieldAiAction | null {
  const fighter = FIGHTER_MAP[fighterId] ?? ALL_FIGHTERS[0];
  const skill = fighter.aiSkill;

  const candidates: { action: BattlefieldAiAction; score: number }[] = [];
  const counts = countUnitsOnBoard(board);

  // 1. Evaluate all ready rival unit moves & strikes
  for (let r = 0; r < BF_ROWS; r++) {
    for (let c = 0; c < BF_COLS; c++) {
      const unit = board[r][c].unit;
      if (!unit || unit.owner !== 'rival' || unit.hasActed) continue;

      const options = getValidUnitActions(board, r, c);
      for (const opt of options) {
        const sim = executeUnitMoveOrStrike(board, r, c, opt.row, opt.col, true);
        let score = 0;

        if (sim.capturedKeepWinner === 'rival') {
          score += 1000;
        } else if (sim.outcome === 'flank_ko') {
          score += 52;
        } else if (sim.outcome === 'clash_won') {
          const margin = (sim.clash?.attackerVal ?? 0) - (sim.clash?.defenderVal ?? 0);
          score += 36 + margin * 3.5;
        } else if (sim.outcome === 'clash_lost') {
          score -= 40 * (0.4 + skill);
        }

        if (sim.shrineCaptured) {
          score += 34;
        }

        // Advance toward Player Keep (2, 0) or uncaptured Shrines
        const distBefore = Math.abs(r - 2) + Math.abs(c - 0);
        const distAfter = Math.abs(opt.row - 2) + Math.abs(opt.col - 0);
        score += (distBefore - distAfter) * 6.5;

        // Move toward nearest non-rival shrine
        let nearestShrineGain = 0;
        for (let sr = 0; sr < BF_ROWS; sr++) {
          for (let sc = 0; sc < BF_COLS; sc++) {
            if (board[sr][sc].isShrine && board[sr][sc].shrineController !== 'rival') {
              const d1 = Math.abs(r - sr) + Math.abs(c - sc);
              const d2 = Math.abs(opt.row - sr) + Math.abs(opt.col - sc);
              nearestShrineGain = Math.max(nearestShrineGain, (d1 - d2) * 8);
            }
          }
        }
        score += nearestShrineGain;

        // Terrain evaluation
        const def = CARD_MAP[unit.cardId];
        const tEval = evaluateTerrainEffect(board[opt.row][opt.col].terrain, def);
        if (tEval && tEval.hasEffect) {
          score += tEval.netScore * 2.2 * skill;
        }

        // Don't abandon a controlled shrine if an enemy is adjacent unless winning a KO
        if (board[r][c].isShrine && sim.outcome === 'moved') {
          score -= 10;
        }

        const jitter = (1 - skill) * 14 * (Math.random() - 0.5);
        candidates.push({
          action: { type: 'move', fromRow: r, fromCol: c, toRow: opt.row, toCol: opt.col },
          score: score + jitter,
        });
      }
    }
  }

  // 2. Evaluate deployments from hand
  const deployTiles = getValidDeployTiles(board, 'rival');
  if (rivalHand.length > 0 && deployTiles.length > 0) {
    const wantMoreTroops = counts.rival < 4 ? 22 : counts.rival < 6 ? 12 : 3;

    for (let i = 0; i < rivalHand.length; i++) {
      const hCard = rivalHand[i];
      const def = CARD_MAP[hCard.cardId];
      // Prefer cards with westward arrows (w, nw, sw) so they can advance toward the player!
      const westArrows = (['w', 'nw', 'sw'] as ArrowDir[]).filter((a) =>
        hCard.arrows.includes(a)
      ).length;
      const cardVal = getStatsPowerScore(hCard.stats, hCard.arrows.length) * 0.35 + westArrows * 5;

      for (const [dr, dc] of deployTiles) {
        let score = wantMoreTroops + cardVal;
        if (board[dr][dc].isShrine && board[dr][dc].shrineController !== 'rival') {
          score += 26;
        }
        // Forward deployment near controlled shrine is super valuable
        if (dc < BF_COLS - 1) score += (BF_COLS - 1 - dc) * 5;
        // Center rows (1, 2, 3) have stronger map access
        if (dr >= 1 && dr <= 3) score += 3;

        const tEval = evaluateTerrainEffect(board[dr][dc].terrain, def);
        if (tEval && tEval.hasEffect) {
          score += tEval.netScore * 1.8 * skill;
        }

        const jitter = (1 - skill) * 14 * (Math.random() - 0.5);
        candidates.push({
          action: { type: 'deploy', handIndex: i, row: dr, col: dc },
          score: score + jitter,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].action;
}
