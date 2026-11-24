import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Castle,
  ChevronRight,
  Coins,
  Crown,
  Eye,
  Flag,
  Map as MapIcon,
  Play,
  RefreshCw,
  Shield,
  SkipForward,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { useCardPreview } from '../context/cardPreviewContext';
import {
  BIOME_META,
  NEUTRAL_TERRAIN_IMAGE,
  TerrainEvaluation,
  evaluateTerrainEffect,
} from '../data/biomes';
import {
  CARD_MAP,
  MAX_COPIES_PER_CARD,
  formatTetraCode,
  getCardThumbUrl,
  toHexDigit,
} from '../data/cards';
import { ALL_FIGHTERS, FIGHTER_MAP, LADDER_TIERS, isTierUnlocked } from '../data/ladder';
import {
  BATTLEFIELD_MAPS,
  BF_AP_PER_TURN,
  BF_COLS,
  BF_HAND_LIMIT,
  BF_ROWS,
  BF_VP_TO_WIN,
  BattlefieldCell,
  BattlefieldMapPreset,
  BattlefieldUnit,
  buildBattlefieldOpponentRoster,
  buildBattlefieldPlayerRoster,
  chooseBattlefieldAiAction,
  countUnitsOnBoard,
  createBattlefieldBoard,
  deployBattlefieldCard,
  executeUnitMoveOrStrike,
  getValidDeployTiles,
  getValidUnitActions,
  refreshUnitsForTurn,
} from '../engine/battlefieldEngine';
import {
  ArrowDir,
  BiomeType,
  ClashDetail,
  DeckSlot,
  HandCard,
  Owner,
  PlayerProfile,
} from '../types/game';
import { sound } from '../utils/sound';
import { BiomeIcon, BiomePill, CardTraitPills } from './BiomeBadge';
import { GameCard } from './GameCard';

interface BattlefieldViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  onSelectDeckSlot: (index: number) => void;
  onRecordMatch: (params: {
    fighterId: string;
    winner: Owner | 'draw';
    goldEarned: number;
    flipsMade: number;
    usedCardIds: string[];
  }) => void;
  onClaimSpoil: (
    spoilCard: HandCard
  ) => { isNew: boolean; wasOverflow: boolean; bonusGold: number; copyCount: number };
  onExitToArena: () => void;
  onMatchActiveChange?: (active: boolean) => void;
  onMatchThemeChange?: (theme: 'tavern' | 'duel' | 'boss') => void;
}

const TOKEN_ARROW_POLYGONS: Record<ArrowDir, string> = {
  n: '50,1 43,10 57,10',
  ne: '98,2 86,2 98,14',
  e: '99,50 90,43 90,57',
  se: '98,98 98,86 86,98',
  s: '50,99 57,90 43,90',
  sw: '2,98 14,98 2,86',
  w: '1,50 10,57 10,43',
  nw: '2,2 2,14 14,2',
};

const ALL_DIRS: ArrowDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

interface MatchOutcomeSummary {
  winner: Owner;
  reason: string;
  goldEarned: number;
  rivalRoster: HandCard[];
  spoilClaimedUid: string | null;
  spoilWasOverflow: boolean;
  spoilBonusGold: number;
}

export const BattlefieldView: React.FC<BattlefieldViewProps> = ({
  profile,
  activeDeck,
  onSelectDeckSlot,
  onRecordMatch,
  onClaimSpoil,
  onExitToArena,
  onMatchActiveChange,
  onMatchThemeChange,
}) => {
  const { openPreview } = useCardPreview();

  const unlockedFighters = useMemo(() => {
    const list = ALL_FIGHTERS.filter((f) =>
      isTierUnlocked(f.tierNumber, profile.fighterWins ?? {})
    );
    return list.length > 0 ? list : LADDER_TIERS[0].fighters;
  }, [profile.fighterWins]);

  const [phase, setPhase] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [selectedMapId, setSelectedMapId] = useState<string>(BATTLEFIELD_MAPS[0].id);
  const [selectedFighterId, setSelectedFighterId] = useState<string>(
    unlockedFighters[unlockedFighters.length - 1]?.id ?? 't1-f1'
  );

  // Active Match State
  const [board, setBoard] = useState<BattlefieldCell[][]>([]);
  const [turn, setTurn] = useState<Owner>('player');
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [apLeft, setApLeft] = useState<number>(BF_AP_PER_TURN);
  const [playerVp, setPlayerVp] = useState<number>(0);
  const [rivalVp, setRivalVp] = useState<number>(0);
  const [playerHand, setPlayerHand] = useState<HandCard[]>([]);
  const [playerDeck, setPlayerDeck] = useState<HandCard[]>([]);
  const [rivalHand, setRivalHand] = useState<HandCard[]>([]);
  const [rivalDeck, setRivalDeck] = useState<HandCard[]>([]);
  const [rivalFullRoster, setRivalFullRoster] = useState<HandCard[]>([]);
  const [playerUsedIds, setPlayerUsedIds] = useState<string[]>([]);
  const [playerKnockouts, setPlayerKnockouts] = useState<number>(0);

  // Selection state (either a board unit or a hand card)
  const [selectedUnitPos, setSelectedUnitPos] = useState<{ row: number; col: number } | null>(null);
  const [selectedHandUid, setSelectedHandUid] = useState<string | null>(null);
  const [battleLog, setBattleLog] = useState<string>('');
  const [activeClash, setActiveClash] = useState<ClashDetail | null>(null);
  const [summary, setSummary] = useState<MatchOutcomeSummary | null>(null);
  const [isAiBusy, setIsAiBusy] = useState<boolean>(false);
  const [hoveredBiomeTile, setHoveredBiomeTile] = useState<{
    biome: BiomeType;
    x: number;
    y: number;
    preview: TerrainEvaluation | null;
  } | null>(null);

  const timersRef = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const currentMap: BattlefieldMapPreset = useMemo(
    () => BATTLEFIELD_MAPS.find((m) => m.id === selectedMapId) ?? BATTLEFIELD_MAPS[0],
    [selectedMapId]
  );

  const currentFighter = useMemo(
    () => FIGHTER_MAP[selectedFighterId] ?? unlockedFighters[0] ?? ALL_FIGHTERS[0],
    [selectedFighterId, unlockedFighters]
  );

  useEffect(() => {
    onMatchActiveChange?.(phase !== 'setup');
    return () => onMatchActiveChange?.(false);
  }, [phase, onMatchActiveChange]);

  useEffect(() => {
    if (!onMatchThemeChange) return;
    if (phase === 'setup') onMatchThemeChange('tavern');
    else if (currentFighter.isBoss || currentFighter.tierNumber >= 9) onMatchThemeChange('boss');
    else onMatchThemeChange('duel');
  }, [phase, currentFighter.isBoss, currentFighter.tierNumber, onMatchThemeChange]);

  // Ref snapshot so AI turn loop reads fresh state cleanly
  const stateRef = useRef({
    board,
    playerVp,
    rivalVp,
    playerHand,
    playerDeck,
    rivalHand,
    rivalDeck,
    rivalFullRoster,
    playerUsedIds,
    playerKnockouts,
    phase,
  });
  stateRef.current = {
    board,
    playerVp,
    rivalVp,
    playerHand,
    playerDeck,
    rivalHand,
    rivalDeck,
    rivalFullRoster,
    playerUsedIds,
    playerKnockouts,
    phase,
  };

  const concludeMatch = useCallback(
    (winner: Owner, reason: string) => {
      clearTimers();
      setIsAiBusy(false);
      setSelectedUnitPos(null);
      setSelectedHandUid(null);
      setHoveredBiomeTile(null);

      const fighter = FIGHTER_MAP[selectedFighterId] ?? ALL_FIGHTERS[0];
      const goldEarned =
        winner === 'player'
          ? Math.round(fighter.winGold * 1.25) + stateRef.current.playerKnockouts * 4
          : fighter.lossGold;

      if (winner === 'player') sound.victory();
      else sound.defeat();

      onRecordMatch({
        fighterId: fighter.id,
        winner,
        goldEarned,
        flipsMade: stateRef.current.playerKnockouts,
        usedCardIds: stateRef.current.playerUsedIds,
      });

      setSummary({
        winner,
        reason,
        goldEarned,
        rivalRoster: stateRef.current.rivalFullRoster,
        spoilClaimedUid: null,
        spoilWasOverflow: false,
        spoilBonusGold: 0,
      });
      setPhase('finished');
    },
    [clearTimers, onRecordMatch, selectedFighterId]
  );

  const startBattlefieldMatch = useCallback(() => {
    clearTimers();
    const pRoster = buildBattlefieldPlayerRoster(activeDeck.cards, profile.inventory);
    const rRoster = buildBattlefieldOpponentRoster(currentFighter.id);

    // Shuffle rosters slightly while keeping first card as starting vanguard
    let freshBoard = createBattlefieldBoard(currentMap);
    const pVanguard = pRoster[0];
    const rVanguard = rRoster[0];

    if (pVanguard) {
      freshBoard = deployBattlefieldCard(freshBoard, 2, 1, pVanguard, 'player', true).nextBoard;
    }
    if (rVanguard) {
      freshBoard = deployBattlefieldCard(freshBoard, 2, BF_COLS - 2, rVanguard, 'rival', false)
        .nextBoard;
    }

    const pRemaining = pRoster.slice(1);
    const rRemaining = rRoster.slice(1);

    setBoard(freshBoard);
    setPlayerHand(pRemaining.slice(0, BF_HAND_LIMIT));
    setPlayerDeck(pRemaining.slice(BF_HAND_LIMIT));
    setRivalHand(rRemaining.slice(0, BF_HAND_LIMIT));
    setRivalDeck(rRemaining.slice(BF_HAND_LIMIT));
    setRivalFullRoster(rRoster);
    setPlayerUsedIds(pRoster.map((c) => c.cardId));
    setPlayerKnockouts(0);
    setPlayerVp(0);
    setRivalVp(0);
    setTurn('player');
    setTurnNumber(1);
    setApLeft(BF_AP_PER_TURN);
    setSelectedUnitPos({ row: 2, col: 1 });
    setSelectedHandUid(null);
    setActiveClash(null);
    setSummary(null);
    setIsAiBusy(false);
    setBattleLog(
      `Battle at ${currentMap.name} vs ${currentFighter.name}! Spend 2 AP per turn to deploy or march along arrows. First to ${BF_VP_TO_WIN} Shrine VP or capture the enemy Keep wins.`
    );
    setPhase('playing');
    sound.place();
  }, [activeDeck.cards, clearTimers, currentFighter, currentMap, profile.inventory]);

  // Refill hand up to BF_HAND_LIMIT at turn start
  const drawUpHand = (hand: HandCard[], deck: HandCard[]): { hand: HandCard[]; deck: HandCard[] } => {
    if (hand.length >= BF_HAND_LIMIT || deck.length === 0) return { hand, deck };
    const need = Math.min(BF_HAND_LIMIT - hand.length, deck.length);
    return {
      hand: [...hand, ...deck.slice(0, need)],
      deck: deck.slice(need),
    };
  };

  const checkEliminationWinner = useCallback(
    (
      nextBoard: BattlefieldCell[][],
      pHandLen: number,
      pDeckLen: number,
      rHandLen: number,
      rDeckLen: number
    ): { winner: Owner; reason: string } | null => {
      const counts = countUnitsOnBoard(nextBoard);
      if (counts.rival === 0 && rHandLen === 0 && rDeckLen === 0) {
        return { winner: 'player', reason: 'Enemy army annihilated!' };
      }
      if (counts.player === 0 && pHandLen === 0 && pDeckLen === 0) {
        return { winner: 'rival', reason: 'Your army was wiped out.' };
      }
      return null;
    },
    []
  );

  // Switch to Rival AI Turn and play out its 2 AP sequentially
  const beginRivalTurn = useCallback(
    (currentBoard: BattlefieldCell[][]) => {
      setTurn('rival');
      setSelectedUnitPos(null);
      setSelectedHandUid(null);
      setHoveredBiomeTile(null);
      setIsAiBusy(true);

      const { nextBoard: refreshedBoard, shrinePointsScored } = refreshUnitsForTurn(
        currentBoard,
        'rival'
      );
      const nextRivalVp = stateRef.current.rivalVp + shrinePointsScored;
      setBoard(refreshedBoard);
      setRivalVp(nextRivalVp);

      if (nextRivalVp >= BF_VP_TO_WIN) {
        concludeMatch('rival', `${currentFighter.name} reached ${BF_VP_TO_WIN} Shrine VP.`);
        return;
      }

      const drawn = drawUpHand(stateRef.current.rivalHand, stateRef.current.rivalDeck);
      let workingHand = drawn.hand;
      const workingDeck = drawn.deck;
      setRivalHand(workingHand);
      setRivalDeck(workingDeck);

      let workingBoard = refreshedBoard;
      let actionsRemaining = BF_AP_PER_TURN;

      const stepAi = () => {
        if (actionsRemaining <= 0) {
          // Hand back to Player Turn
          const { nextBoard: playerBoard, shrinePointsScored: pScored } = refreshUnitsForTurn(
            workingBoard,
            'player'
          );
          const nextPlayerVp = stateRef.current.playerVp + pScored;
          setBoard(playerBoard);
          setPlayerVp(nextPlayerVp);

          if (nextPlayerVp >= BF_VP_TO_WIN) {
            concludeMatch('player', `Victory by Shrine Control (${nextPlayerVp} VP)!`);
            return;
          }

          const pDrawn = drawUpHand(stateRef.current.playerHand, stateRef.current.playerDeck);
          setPlayerHand(pDrawn.hand);
          setPlayerDeck(pDrawn.deck);
          setTurn('player');
          setTurnNumber((n) => n + 1);
          setApLeft(BF_AP_PER_TURN);
          setIsAiBusy(false);
          if (pScored > 0) {
            setBattleLog(`Your turn! Scored +${pScored} Shrine VP (${nextPlayerVp}/${BF_VP_TO_WIN}).`);
          }
          return;
        }

        const aiAct = chooseBattlefieldAiAction(workingBoard, workingHand, currentFighter.id);
        if (!aiAct) {
          actionsRemaining = 0;
          const t = window.setTimeout(stepAi, 240);
          timersRef.current.push(t);
          return;
        }

        actionsRemaining -= 1;
        setApLeft(actionsRemaining);

        if (aiAct.type === 'deploy') {
          const chosen = workingHand[aiAct.handIndex];
          if (!chosen) {
            const t = window.setTimeout(stepAi, 200);
            timersRef.current.push(t);
            return;
          }
          workingHand = workingHand.filter((_, i) => i !== aiAct.handIndex);
          const res = deployBattlefieldCard(workingBoard, aiAct.row, aiAct.col, chosen, 'rival');
          workingBoard = res.nextBoard;
          setBoard(workingBoard);
          setRivalHand(workingHand);
          sound.place();
          setBattleLog(
            `${currentFighter.name} deployed ${res.attackerName}${
              res.shrineCaptured ? ' onto a Shrine!' : '.'
            }`
          );
        } else {
          const res = executeUnitMoveOrStrike(
            workingBoard,
            aiAct.fromRow,
            aiAct.fromCol,
            aiAct.toRow,
            aiAct.toCol
          );
          workingBoard = res.nextBoard;
          setBoard(workingBoard);

          if (res.clash) {
            setActiveClash(res.clash);
            const clearT = window.setTimeout(() => setActiveClash(null), 1350);
            timersRef.current.push(clearT);
            sound.clash(res.clash.attackerWon);
            setBattleLog(
              res.outcome === 'clash_won'
                ? `${currentFighter.name}'s ${res.attackerName} defeated ${res.defenderName} in a Clash!`
                : `${res.defenderName} repelled and eliminated ${currentFighter.name}'s ${res.attackerName}!`
            );
            if (res.outcome === 'clash_lost') {
              setPlayerKnockouts((k) => k + 1);
            }
          } else if (res.outcome === 'flank_ko') {
            sound.flip(1);
            setBattleLog(
              `${currentFighter.name}'s ${res.attackerName} ambushed ${res.defenderName} on an unguarded flank!`
            );
          } else {
            sound.place();
            setBattleLog(
              `${currentFighter.name}'s ${res.attackerName} advanced${
                res.shrineCaptured ? ' and seized a Shrine!' : '.'
              }`
            );
          }

          if (res.capturedKeepWinner) {
            concludeMatch(
              res.capturedKeepWinner,
              `${currentFighter.name} breached your Keep!`
            );
            return;
          }

          const elim = checkEliminationWinner(
            workingBoard,
            stateRef.current.playerHand.length,
            stateRef.current.playerDeck.length,
            workingHand.length,
            workingDeck.length
          );
          if (elim) {
            concludeMatch(elim.winner, elim.reason);
            return;
          }
        }

        const nextT = window.setTimeout(stepAi, 560);
        timersRef.current.push(nextT);
      };

      const startT = window.setTimeout(stepAi, 480);
      timersRef.current.push(startT);
    },
    [checkEliminationWinner, concludeMatch, currentFighter]
  );

  // Derived legal move/deploy highlights for player
  const validDeploySet = useMemo(() => {
    if (phase !== 'playing' || turn !== 'player' || isAiBusy || !selectedHandUid || apLeft <= 0) {
      return new Set<string>();
    }
    return new Set(getValidDeployTiles(board, 'player').map(([r, c]) => `${r}-${c}`));
  }, [apLeft, board, isAiBusy, phase, selectedHandUid, turn]);

  const validUnitMoveMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getValidUnitActions>[number]>();
    if (phase !== 'playing' || turn !== 'player' || isAiBusy || !selectedUnitPos || apLeft <= 0) {
      return map;
    }
    const actions = getValidUnitActions(board, selectedUnitPos.row, selectedUnitPos.col);
    for (const a of actions) map.set(`${a.row}-${a.col}`, a);
    return map;
  }, [apLeft, board, isAiBusy, phase, selectedUnitPos, turn]);

  const selectedHandCard = useMemo(
    () => playerHand.find((c) => c.uid === selectedHandUid) ?? null,
    [playerHand, selectedHandUid]
  );

  const selectedBoardUnit: BattlefieldUnit | null = useMemo(() => {
    if (!selectedUnitPos) return null;
    return board[selectedUnitPos.row]?.[selectedUnitPos.col]?.unit ?? null;
  }, [board, selectedUnitPos]);

  const activePreviewCardDef = useMemo(() => {
    if (selectedHandCard) return CARD_MAP[selectedHandCard.cardId];
    if (selectedBoardUnit) return CARD_MAP[selectedBoardUnit.cardId];
    return undefined;
  }, [selectedBoardUnit, selectedHandCard]);

  const openUnitPreview = (cell: BattlefieldCell) => {
    if (!cell.unit) return;
    sound.select();
    openPreview({
      cardId: cell.unit.cardId,
      stats: cell.unit.stats,
      baseStats: cell.unit.baseStats,
      arrows: cell.unit.arrows,
      augmentId: cell.unit.augmentId,
      owner: cell.unit.owner,
      terrain: cell.terrain,
      terrainMod: cell.unit.terrainMod,
      lastAugmented: cell.unit.lastAugmented,
    });
  };

  const handleTileClick = (r: number, c: number) => {
    setHoveredBiomeTile(null);
    const cell = board[r]?.[c];
    if (!cell) return;

    // Outside player's active turn, clicking any unit inspects it
    if (phase !== 'playing' || turn !== 'player' || isAiBusy) {
      if (cell.unit) openUnitPreview(cell);
      return;
    }

    const key = `${r}-${c}`;

    // 1. Deploying a selected hand card
    if (selectedHandCard && validDeploySet.has(key) && apLeft > 0) {
      const res = deployBattlefieldCard(board, r, c, selectedHandCard, 'player');
      const nextHand = playerHand.filter((h) => h.uid !== selectedHandCard.uid);
      const nextAp = apLeft - 1;
      setBoard(res.nextBoard);
      setPlayerHand(nextHand);
      setSelectedHandUid(null);
      setSelectedUnitPos(null);
      setApLeft(nextAp);
      sound.place();
      setBattleLog(
        `Deployed ${res.attackerName}${res.terrainSummary ? ` (${res.terrainSummary})` : ''}${
          res.augmentSummary ? ` · ${res.augmentSummary}` : ''
        }${res.shrineCaptured ? ' · Shrine captured!' : '.'}`
      );
      if (nextAp <= 0) {
        const t = window.setTimeout(() => beginRivalTurn(res.nextBoard), 360);
        timersRef.current.push(t);
      }
      return;
    }

    // 2. Moving or striking with selected friendly unit
    const moveOpt = validUnitMoveMap.get(key);
    if (selectedUnitPos && moveOpt && apLeft > 0) {
      const res = executeUnitMoveOrStrike(board, selectedUnitPos.row, selectedUnitPos.col, r, c);
      const nextAp = apLeft - 1;
      setBoard(res.nextBoard);
      setSelectedUnitPos(null);
      setApLeft(nextAp);

      if (res.clash) {
        setActiveClash(res.clash);
        const clearT = window.setTimeout(() => setActiveClash(null), 1400);
        timersRef.current.push(clearT);
        sound.clash(res.clash.attackerWon);
        if (res.outcome === 'clash_won') {
          setPlayerKnockouts((k) => k + 1);
          setBattleLog(
            `${res.attackerName} defeated ${res.defenderName} (${toHexDigit(
              res.clash.attackerVal
            )}${res.clash.attackType} vs ${toHexDigit(res.clash.defenderVal)})${
              res.shrineCaptured ? ' & seized a Shrine!' : '!'
            }`
          );
        } else {
          setBattleLog(
            `${res.defenderName} won the clash (${toHexDigit(res.clash.defenderVal)} vs ${toHexDigit(
              res.clash.attackerVal
            )}${res.clash.attackType}) and eliminated ${res.attackerName}!`
          );
        }
      } else if (res.outcome === 'flank_ko') {
        setPlayerKnockouts((k) => k + 1);
        sound.flip(1);
        setBattleLog(
          `Flank Ambush! ${res.attackerName} struck ${res.defenderName}'s unguarded side for an instant KO${
            res.shrineCaptured ? ' & claimed a Shrine!' : '!'
          }`
        );
      } else {
        sound.place();
        setBattleLog(
          `${res.attackerName} ${moveOpt.isRiverGlide ? 'glided across the river' : 'marched'}${
            res.terrainSummary ? ` (${res.terrainSummary})` : ''
          }${res.shrineCaptured ? ' · Shrine captured!' : '.'}`
        );
      }

      if (res.capturedKeepWinner) {
        concludeMatch(res.capturedKeepWinner, `You breached ${currentFighter.name}'s Keep!`);
        return;
      }

      const elim = checkEliminationWinner(
        res.nextBoard,
        playerHand.length,
        playerDeck.length,
        rivalHand.length,
        rivalDeck.length
      );
      if (elim) {
        concludeMatch(elim.winner, elim.reason);
        return;
      }

      if (nextAp <= 0) {
        const t = window.setTimeout(() => beginRivalTurn(res.nextBoard), 460);
        timersRef.current.push(t);
      }
      return;
    }

    // 3. Selecting a ready friendly unit on the board
    if (cell.unit && cell.unit.owner === 'player' && !cell.unit.hasActed && apLeft > 0) {
      sound.select();
      setSelectedHandUid(null);
      setSelectedUnitPos((prev) =>
        prev?.row === r && prev?.col === c ? null : { row: r, col: c }
      );
      return;
    }

    // 4. Clicking any enemy unit or already-acted friendly unit opens large Tarot preview
    if (cell.unit) {
      openUnitPreview(cell);
    }
  };

  const boardCounts = useMemo(() => countUnitsOnBoard(board), [board]);

  // =========================================================================
  // SETUP SCREEN — MAP + OPPONENT + DECK SELECTION
  // =========================================================================
  if (phase === 'setup') {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              sound.select();
              onExitToArena();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10182a] border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Play Modes</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/45 text-emerald-200 text-xs font-semibold">
            <MapIcon className="w-3.5 h-3.5" />
            <span>Tactical Battlefield · 7×5 Skirmish</span>
          </span>
        </div>

        <div className="text-center space-y-1.5">
          <h1 className="font-[var(--font-display)] text-2xl sm:text-4xl font-bold text-amber-100">
            Battlefield Skirmish
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            Deploy a 10-card army and march troops along their compass arrows across a 7×5 biome
            battlefield. Spend <strong className="text-slate-200">2 AP per turn</strong>—first to{' '}
            <strong className="text-amber-200">{BF_VP_TO_WIN} Shrine VP</strong> or capture the
            enemy Keep wins.
          </p>
        </div>

        {/* 4 Handcrafted Aerial Biome Maps */}
        <div className="space-y-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 px-1">
            1. Choose Battlefield Map
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {BATTLEFIELD_MAPS.map((m) => {
              const active = m.id === selectedMapId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setSelectedMapId(m.id);
                  }}
                  className={`rounded-2xl p-4 text-left border flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                    active
                      ? 'bg-[#182644] border-amber-400 shadow-[0_10px_28px_rgba(251,191,36,0.2)]'
                      : 'bg-[#0e1526] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="font-[var(--font-display)] text-base font-bold text-amber-100">
                      {m.name}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{m.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {m.biomes.map((b) => (
                      <BiomePill key={b} biome={b} compact />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Opponent + Deck Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[#0e1526] border border-slate-800 p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
              2. Rival Commander (Unlocked Tiers)
            </div>
            <select
              aria-label="Choose battlefield opponent"
              value={currentFighter.id}
              onChange={(e) => {
                sound.select();
                setSelectedFighterId(e.target.value);
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#090f1d] border border-slate-700 text-sm font-medium text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {unlockedFighters.map((f) => (
                <option key={f.id} value={f.id}>
                  Tier {f.tierNumber} · {f.name} ({f.title}) — +{Math.round(f.winGold * 1.25)}g
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {CARD_MAP[currentFighter.avatarCardId] && (
                <img
                  src={getCardThumbUrl(CARD_MAP[currentFighter.avatarCardId].image)}
                  alt={currentFighter.name}
                  className="w-11 h-11 rounded-xl object-cover border border-amber-400/60 shrink-0"
                />
              )}
              <div>
                <div className="font-semibold text-slate-200">{currentFighter.name}</div>
                <div>{currentFighter.specialty}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0e1526] border border-slate-800 p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
              3. Your Vanguard Deck (Auto-expanded to 10 Troops)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.decks.map((d, idx) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    sound.select();
                    onSelectDeckSlot(idx);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    idx === profile.activeDeckIndex
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-[#090f1d] text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Starts with your 7 cards from <strong className="text-slate-200">{activeDeck.name}</strong>{' '}
              + drafts 3 top reserves from your library.
            </p>
          </div>
        </div>

        {/* Tactical Rules Quick Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-[#0c1322] border border-slate-800 p-3 space-y-1">
            <div className="font-semibold text-sky-300">Arrows = Move &amp; Strike</div>
            <p className="text-slate-400">
              Units step along their orange arrows. Attacking an enemy’s unguarded side scores an
              instant <strong className="text-emerald-300">Flank KO</strong>.
            </p>
          </div>
          <div className="rounded-xl bg-[#0c1322] border border-slate-800 p-3 space-y-1">
            <div className="font-semibold text-emerald-300">Living Biome Perks</div>
            <p className="text-slate-400">
              Tile biomes adjust stats live as you move. <strong className="text-sky-200">Water/Storm</strong>{' '}
              glide 2 tiles along rivers; <strong className="text-cyan-200">Highland</strong> gives +1 ATK downhill.
            </p>
          </div>
          <div className="rounded-xl bg-[#0c1322] border border-slate-800 p-3 space-y-1">
            <div className="font-semibold text-amber-300">Shrines &amp; Keep</div>
            <p className="text-slate-400">
              Control Shrines to score VP each turn and unlock forward deployment next to them—or
              march straight into the enemy Keep!
            </p>
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={startBattlefieldMatch}
            className="min-h-[54px] px-10 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 active:scale-[0.98] text-slate-950 font-[var(--font-display)] font-bold text-base sm:text-lg tracking-wide shadow-[0_12px_30px_rgba(245,158,11,0.35)] border border-amber-200/70 flex items-center gap-2.5 transition-transform cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Deploy to {currentMap.name}</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ACTIVE 7×5 BATTLEFIELD VIEW
  // =========================================================================
  return (
    <div className="w-full max-w-6xl mx-auto px-2.5 sm:px-5 py-2.5 sm:py-4 space-y-3">
      {/* Top Tactical Command HUD */}
      <div className="rounded-2xl bg-[#0e1526]/95 border border-slate-800 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Blue Player VP & Troops */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
            <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-blue-200">
              You
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-400/45 font-mono text-xs font-bold text-blue-200">
            {playerVp}/{BF_VP_TO_WIN} VP
          </div>
          <span className="hidden sm:inline text-xs text-slate-400">
            {boardCounts.player} on field · {playerHand.length + playerDeck.length} left
          </span>
        </div>

        {/* Center Turn + AP Pips + End Turn */}
        <div className="flex items-center gap-2.5">
          <div
            className={`px-3 py-1 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              turn === 'player'
                ? 'bg-amber-500/15 border-amber-400/60 text-amber-200'
                : 'bg-rose-950/60 border-rose-400/45 text-rose-200'
            }`}
          >
            <span>
              Turn {turnNumber} · {turn === 'player' ? 'Your Turn' : `${currentFighter.name}`}
            </span>
            {turn === 'player' && (
              <span className="inline-flex items-center gap-1 font-mono text-amber-300">
                <Zap className="w-3.5 h-3.5 fill-current" />
                {apLeft}/{BF_AP_PER_TURN} AP
              </span>
            )}
          </div>

          {turn === 'player' && !isAiBusy && phase === 'playing' && (
            <button
              type="button"
              onClick={() => {
                sound.select();
                beginRivalTurn(board);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>End Turn</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sound.select();
              clearTimers();
              setPhase('setup');
            }}
            title="Retreat to Battlefield Setup"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-300 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Crimson Rival VP & Troops */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-400">
            {boardCounts.rival} on field · {rivalHand.length + rivalDeck.length} left
          </span>
          <div className="px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-400/45 font-mono text-xs font-bold text-rose-200">
            {rivalVp}/{BF_VP_TO_WIN} VP
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-rose-200">
              {currentFighter.name}
            </span>
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
          </div>
        </div>
      </div>

      {/* Battle Ticker + Map Biomes Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#0b1120] border border-slate-800/90 text-xs">
        <span className="text-slate-300 truncate flex-1 min-w-[200px]">{battleLog}</span>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            {currentMap.name}:
          </span>
          {currentMap.biomes.map((b) => (
            <BiomePill key={b} biome={b} compact />
          ))}
        </div>
      </div>

      {/* 7×5 CONTINUOUS AERIAL BATTLEFIELD CANVAS */}
      <div className="relative rounded-2xl border-2 border-amber-500/35 p-2 sm:p-3 overflow-hidden bg-[#0a0f18] shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
        {/* Continuous Weathered Stone Floor */}
        <div
          aria-hidden="true"
          style={{
            backgroundImage: `url(${NEUTRAL_TERRAIN_IMAGE})`,
            backgroundSize: '260px 346px',
            backgroundRepeat: 'repeat',
          }}
          className="pointer-events-none absolute inset-0 opacity-80 brightness-[0.66] contrast-[1.08]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_92%_92%_at_50%_50%,rgba(6,10,18,0.06)_0%,rgba(6,10,18,0.5)_100%)]"
        />

        {/* Active Clash Floating Overlay */}
        {activeClash && (
          <div className="pointer-events-none absolute top-3 inset-x-0 z-30 flex justify-center animate-callout">
            <div className="rounded-xl bg-slate-950/95 border border-amber-400/80 px-4 py-2 shadow-2xl flex items-center gap-3 text-xs">
              <Swords className="w-4 h-4 text-amber-300" />
              <span className="font-semibold text-blue-300">{activeClash.attackerName}</span>
              <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                {toHexDigit(activeClash.attackerVal)}
                {activeClash.attackType} vs {toHexDigit(activeClash.defenderVal)}
              </span>
              <span className="font-semibold text-rose-300">{activeClash.defenderName}</span>
            </div>
          </div>
        )}

        <div className="relative z-10 grid grid-cols-7 gap-1 sm:gap-1.5">
          {board.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const key = `${rIdx}-${cIdx}`;
              const biomeMeta = cell.terrain ? BIOME_META[cell.terrain] : null;
              const isDeployTarget = validDeploySet.has(key);
              const moveOpt = validUnitMoveMap.get(key);
              const isSelectedUnit =
                selectedUnitPos?.row === rIdx && selectedUnitPos?.col === cIdx;
              const isStrikeTarget = moveOpt && (moveOpt.kind === 'flank' || moveOpt.kind === 'clash');
              const isMoveTarget = moveOpt && moveOpt.kind === 'move';
              const terrainEval =
                cell.terrain && activePreviewCardDef
                  ? evaluateTerrainEffect(cell.terrain, activePreviewCardDef)
                  : null;

              const unit = cell.unit;
              const unitDef = unit ? CARD_MAP[unit.cardId] : null;
              const unitModDelta = unit
                ? unit.stats.power -
                  unit.baseStats.power +
                  (unit.stats.pDef - unit.baseStats.pDef) +
                  (unit.stats.mDef - unit.baseStats.mDef)
                : 0;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTileClick(rIdx, cIdx)}
                  onMouseEnter={(e) => {
                    if (biomeMeta && !unit) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pad = 128;
                      const clampedX =
                        typeof window !== 'undefined'
                          ? Math.max(
                              pad,
                              Math.min(window.innerWidth - pad, rect.left + rect.width / 2)
                            )
                          : rect.left + rect.width / 2;
                      setHoveredBiomeTile({
                        biome: biomeMeta.id,
                        x: clampedX,
                        y: rect.top - 8,
                        preview: terrainEval,
                      });
                    }
                  }}
                  onMouseLeave={() => setHoveredBiomeTile(null)}
                  onContextMenu={(e) => {
                    if (unit) {
                      e.preventDefault();
                      openUnitPreview(cell);
                    }
                  }}
                  className={`group relative aspect-[6/7] rounded-lg border transition-all duration-150 overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isSelectedUnit
                      ? 'border-amber-300 ring-2 ring-amber-300/90 z-20 scale-[1.03]'
                      : isStrikeTarget
                      ? 'border-rose-400 ring-2 ring-rose-400/90 shadow-[0_0_20px_rgba(244,63,94,0.55)] z-20'
                      : isMoveTarget
                      ? 'border-emerald-300 ring-2 ring-emerald-400/75 shadow-[0_0_16px_rgba(52,211,153,0.4)] z-10'
                      : isDeployTarget
                      ? 'border-sky-300 ring-2 ring-sky-400/75 shadow-[0_0_16px_rgba(56,189,248,0.4)] z-10'
                      : cell.keepOwner === 'player'
                      ? 'border-blue-400/45'
                      : cell.keepOwner === 'rival'
                      ? 'border-rose-400/45'
                      : cell.isShrine
                      ? cell.shrineController === 'player'
                        ? 'border-blue-300/70'
                        : cell.shrineController === 'rival'
                        ? 'border-rose-300/70'
                        : 'border-amber-300/55'
                      : 'border-white/[0.1] hover:border-amber-300/45'
                  }`}
                >
                  {/* Feathered Biome Terrain Feature */}
                  {biomeMeta && (
                    <>
                      <img
                        src={biomeMeta.tileImage}
                        alt={biomeMeta.name}
                        draggable={false}
                        style={{
                          filter: biomeMeta.tileImageFilter,
                          maskImage:
                            'radial-gradient(ellipse 84% 86% at 50% 50%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.72) 74%, rgba(0,0,0,0) 100%)',
                          WebkitMaskImage:
                            'radial-gradient(ellipse 84% 86% at 50% 50%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.72) 74%, rgba(0,0,0,0) 100%)',
                        }}
                        className="pointer-events-none absolute -inset-[6%] w-[112%] h-[112%] object-cover select-none"
                      />
                      <div
                        style={{ background: biomeMeta.tileBlendGlow }}
                        className="pointer-events-none absolute inset-0"
                      />
                    </>
                  )}

                  {/* Subtle Deployment Column Tint (Col 0 blue / Col 6 crimson) */}
                  {cIdx === 0 && (
                    <div className="pointer-events-none absolute inset-0 bg-blue-500/[0.06]" />
                  )}
                  {cIdx === BF_COLS - 1 && (
                    <div className="pointer-events-none absolute inset-0 bg-rose-500/[0.06]" />
                  )}

                  {/* Keep Crest (When Empty) */}
                  {cell.keepOwner && !unit && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                      <Castle
                        className={`w-6 h-6 sm:w-7 sm:h-7 ${
                          cell.keepOwner === 'player'
                            ? 'text-blue-300/85 drop-shadow-[0_0_8px_rgba(96,165,250,0.7)]'
                            : 'text-rose-300/85 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                        }`}
                      />
                      <span
                        className={`text-[8px] sm:text-[9px] font-[var(--font-display)] font-bold uppercase tracking-widest ${
                          cell.keepOwner === 'player' ? 'text-blue-200/90' : 'text-rose-200/90'
                        }`}
                      >
                        Keep
                      </span>
                    </div>
                  )}

                  {/* Shrine Objective Crest */}
                  {cell.isShrine && !unit && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                      <Crown
                        className={`w-5 h-5 sm:w-6 sm:h-6 ${
                          cell.shrineController === 'player'
                            ? 'text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.9)]'
                            : cell.shrineController === 'rival'
                            ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                            : 'text-amber-300/90 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                        }`}
                      />
                      <span className="text-[7.5px] sm:text-[8.5px] font-[var(--font-display)] font-bold uppercase tracking-wider text-amber-100/90 bg-black/50 px-1 rounded">
                        Shrine
                      </span>
                    </div>
                  )}

                  {/* Legal Move / Deploy Overlay Dot */}
                  {!unit && (isMoveTarget || isDeployTarget) && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase tracking-wider shadow ${
                          isDeployTarget
                            ? 'bg-sky-950/90 border border-sky-300/80 text-sky-200'
                            : moveOpt?.isRiverGlide
                            ? 'bg-cyan-950/90 border border-cyan-300/80 text-cyan-200'
                            : 'bg-emerald-950/90 border border-emerald-300/80 text-emerald-200'
                        }`}
                      >
                        {isDeployTarget ? 'Deploy' : moveOpt?.isRiverGlide ? 'Glide' : 'Move'}
                      </span>
                    </div>
                  )}

                  {/* Deployed Battlefield Unit Token */}
                  {unit && unitDef && (
                    <div
                      className={`relative z-10 w-full h-full p-[3px] flex flex-col justify-between transition-opacity ${
                        unit.owner === 'player' && unit.hasActed && turn === 'player'
                          ? 'opacity-70'
                          : 'opacity-100'
                      }`}
                    >
                      <div
                        className={`relative w-full h-full rounded-[6px] overflow-hidden border-2 shadow-lg ${
                          unit.owner === 'player'
                            ? !unit.hasActed && turn === 'player'
                              ? 'border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.55)]'
                              : 'border-blue-500/70'
                            : 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.45)]'
                        }`}
                      >
                        {/* Unit Portrait */}
                        <img
                          src={getCardThumbUrl(unitDef.image)}
                          alt={unitDef.name}
                          draggable={false}
                          className={`w-full h-full object-cover object-top ${unitDef.artFilter ?? ''}`}
                        />

                        {/* Team Rim Vignette */}
                        <div
                          className={`pointer-events-none absolute inset-0 ${
                            unit.owner === 'player'
                              ? 'bg-gradient-to-t from-blue-950/85 via-transparent to-blue-950/35'
                              : 'bg-gradient-to-t from-rose-950/85 via-transparent to-rose-950/35'
                          }`}
                        />

                        {/* 8-Way Blazing Orange Movement/Attack Arrows */}
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 100 100"
                          className="pointer-events-none absolute inset-0 w-full h-full z-20"
                        >
                          {ALL_DIRS.map((dir) => {
                            const active = unit.arrows.includes(dir);
                            return (
                              <polygon
                                key={dir}
                                points={TOKEN_ARROW_POLYGONS[dir]}
                                fill={active ? '#ff7b1c' : 'rgba(255,255,255,0.12)'}
                                stroke={active ? '#05070e' : undefined}
                                strokeWidth={active ? 1.5 : undefined}
                              />
                            );
                          })}
                        </svg>

                        {/* Shrine Ownership Crown Badge on Occupied Shrine */}
                        {cell.isShrine && (
                          <span className="pointer-events-none absolute top-1 left-1 z-20 w-4 h-4 rounded-full bg-slate-950/90 border border-amber-300/80 flex items-center justify-center">
                            <Crown className="w-2.5 h-2.5 text-amber-300" />
                          </span>
                        )}

                        {/* Quick Inspect Button (Top-Right) */}
                        <span
                          role="button"
                          tabIndex={-1}
                          title="Inspect full card stats"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUnitPreview(cell);
                          }}
                          className="absolute top-1 right-1 z-30 w-4 h-4 rounded-full bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 border border-slate-500/70 text-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="w-2.5 h-2.5" />
                        </span>

                        {/* Bottom Compact Name + Effective Stat Code */}
                        <div className="pointer-events-none absolute inset-x-0.5 bottom-0.5 z-20 flex flex-col items-center">
                          <span className="max-w-full truncate text-[7.5px] sm:text-[9px] font-[var(--font-display)] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] px-0.5">
                            {unitDef.name}
                          </span>
                          <span
                            className={`px-1.5 py-[1px] rounded bg-slate-950/90 border font-mono text-[9px] sm:text-[10.5px] font-bold leading-none tabular-nums ${
                              unitModDelta > 0
                                ? 'border-emerald-400/80 text-emerald-300'
                                : unitModDelta < 0
                                ? 'border-rose-400/80 text-rose-300'
                                : 'border-amber-400/45 text-amber-200'
                            }`}
                          >
                            {formatTetraCode(unit.stats)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Active Hand Tray (5 Cards + Reserve Deck Counter) */}
      <div className="rounded-2xl bg-[#0e1526]/95 border border-slate-800 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-300">
              Active Hand ({playerHand.length}/{BF_HAND_LIMIT})
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Reserves: {playerDeck.length}</span>
          </div>
          {selectedHandCard && CARD_MAP[selectedHandCard.cardId] ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-200">
                Click a blue Deploy tile to summon {CARD_MAP[selectedHandCard.cardId].name}
              </span>
              <CardTraitPills
                element={CARD_MAP[selectedHandCard.cardId].element}
                tribe={CARD_MAP[selectedHandCard.cardId].tribe}
                compact
              />
            </div>
          ) : selectedBoardUnit && CARD_MAP[selectedBoardUnit.cardId] ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-emerald-300">
                {CARD_MAP[selectedBoardUnit.cardId].name} ready — click a highlighted square to move
                or strike
              </span>
              <CardTraitPills
                element={CARD_MAP[selectedBoardUnit.cardId].element}
                tribe={CARD_MAP[selectedBoardUnit.cardId].tribe}
                compact
              />
            </div>
          ) : (
            <span className="text-slate-400">
              Click a ready blue troop to move/strike, or click a hand card to deploy (1 AP each)
            </span>
          )}
        </div>

        <div className="flex items-center justify-start sm:justify-center gap-2.5 overflow-x-auto pb-1 pt-2 px-1">
          {playerHand.length === 0 ? (
            <div className="py-5 text-xs text-slate-500">All reserves deployed onto the field.</div>
          ) : (
            playerHand.map((hCard) => {
              const isSel = hCard.uid === selectedHandUid;
              return (
                <div key={hCard.uid} className="w-[106px] sm:w-[122px] shrink-0">
                  <GameCard
                    cardId={hCard.cardId}
                    stats={hCard.stats}
                    arrows={hCard.arrows}
                    augmentId={hCard.augmentId}
                    owner="player"
                    size="sm"
                    showName
                    selected={isSel}
                    onClick={() => {
                      if (turn !== 'player' || isAiBusy || apLeft <= 0) return;
                      sound.select();
                      setSelectedUnitPos(null);
                      setSelectedHandUid((cur) => (cur === hCard.uid ? null : hCard.uid));
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Hover-Only Unclipped Biome Tile Tooltip Portal */}
      {hoveredBiomeTile &&
        phase === 'playing' &&
        typeof document !== 'undefined' &&
        (() => {
          const b = BIOME_META[hoveredBiomeTile.biome];
          const p = hoveredBiomeTile.preview;
          return createPortal(
            <div
              role="tooltip"
              style={{
                left: `${hoveredBiomeTile.x}px`,
                top: `${hoveredBiomeTile.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="pointer-events-none fixed z-[200] w-max max-w-[260px] rounded-xl bg-slate-950/96 border border-slate-700/90 px-3 py-2 text-xs shadow-[0_14px_34px_rgba(0,0,0,0.85)] space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${b.badgeClass}`}
                >
                  <BiomeIcon biome={b.id} className="w-3 h-3" />
                </span>
                <span className={`font-[var(--font-display)] ${b.accentTextClass}`}>{b.name}</span>
              </div>
              <div className="text-[11px] text-emerald-300 leading-snug">▲ {b.favorsSummary}</div>
              <div className="text-[11px] text-rose-300 leading-snug">▼ {b.hindersSummary}</div>
              {b.id === 'water' && (
                <div className="text-[10.5px] text-sky-300">✦ Water/Storm glide 2 tiles on river</div>
              )}
              {b.id === 'highland' && (
                <div className="text-[10.5px] text-cyan-300">✦ +1 ATK when striking downhill</div>
              )}
              {p && p.hasEffect && (
                <div
                  className={`pt-1 mt-1 border-t border-slate-800 font-mono text-[11px] font-bold ${
                    p.isPositive ? 'text-emerald-200' : 'text-rose-200'
                  }`}
                >
                  Selected troop: {p.isPositive ? '▲' : '▼'} {p.shortTag}
                </div>
              )}
            </div>,
            document.body
          );
        })()}

      {/* Match Finished / Spoils Modal */}
      {phase === 'finished' && summary && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#04070f]/90 p-4"
        >
          <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-3xl bg-gradient-to-b from-[#16223c] via-[#11192d] to-[#0b1120] border border-amber-400/45 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                    summary.winner === 'player'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  }`}
                >
                  {summary.winner === 'player' ? (
                    <Trophy className="w-6 h-6" />
                  ) : (
                    <Shield className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h2 className="font-[var(--font-display)] text-2xl font-bold text-white">
                    {summary.winner === 'player' ? 'Battlefield Victory!' : 'Battlefield Defeat'}
                  </h2>
                  <p className="text-sm text-slate-300">{summary.reason}</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/60 border border-amber-400/50 font-mono text-sm font-bold text-amber-300">
                <Coins className="w-4 h-4" />
                <span>+{summary.goldEarned + summary.spoilBonusGold}g</span>
              </div>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {summary.winner === 'player' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-[var(--font-display)] text-base font-bold text-amber-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {summary.spoilClaimedUid
                          ? 'Spoil Claimed'
                          : `Claim 1 Spoil from ${currentFighter.name}'s Army`}
                      </span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {summary.rivalRoster.slice(0, 5).map((sCard) => {
                      const def = CARD_MAP[sCard.cardId];
                      const isClaimed = summary.spoilClaimedUid === sCard.uid;
                      const locked = Boolean(summary.spoilClaimedUid) && !isClaimed;
                      const ownedCount = profile.owned[sCard.cardId] ?? 0;
                      return (
                        <div
                          key={sCard.uid}
                          className={`rounded-2xl p-2.5 border flex flex-col gap-2 ${
                            isClaimed
                              ? 'bg-emerald-950/35 border-emerald-400/75'
                              : 'bg-[#0b1120] border-slate-800'
                          } ${locked ? 'opacity-45' : ''}`}
                        >
                          <GameCard
                            cardId={sCard.cardId}
                            stats={sCard.stats}
                            arrows={sCard.arrows}
                            augmentId={sCard.augmentId}
                            owner={isClaimed ? 'player' : 'neutral'}
                            size="md"
                            showName={false}
                            disabled={locked}
                            onClick={
                              summary.spoilClaimedUid
                                ? undefined
                                : () => {
                                    const res = onClaimSpoil(sCard);
                                    sound.coin();
                                    setSummary((cur) =>
                                      cur
                                        ? {
                                            ...cur,
                                            spoilClaimedUid: sCard.uid,
                                            spoilWasOverflow: res.wasOverflow,
                                            spoilBonusGold: res.bonusGold,
                                          }
                                        : cur
                                    );
                                  }
                            }
                          />
                          <div className="text-center text-xs space-y-0.5">
                            <div className="font-[var(--font-display)] font-bold text-slate-100 leading-tight">
                              {def?.name}
                            </div>
                            <div className="font-mono text-amber-200">
                              {formatTetraCode(sCard.stats)}
                            </div>
                            <div className="text-[11px] text-emerald-300 font-semibold">
                              {isClaimed
                                ? summary.spoilWasOverflow
                                  ? `Auto-Sold (+${summary.spoilBonusGold}g)`
                                  : `Claimed (${ownedCount}/${MAX_COPIES_PER_CARD})`
                                : ownedCount === 0
                                ? '★ New Card'
                                : `Owned ${ownedCount}/${MAX_COPIES_PER_CARD}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-[#0c1322] flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setPhase('setup');
                }}
                className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold cursor-pointer"
              >
                Change Map / Rival
              </button>
              <button
                type="button"
                onClick={startBattlefieldMatch}
                className="min-h-[44px] px-6 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-slate-950 font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
