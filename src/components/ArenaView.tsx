import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Compass,
  Flag,
  Swords,
  Volume2,
  VolumeX,
  Wand2,
  X,
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
  CARDS,
  formatTetraCode,
  getCardThumbUrl,
  resolveCardAugment,
  rollCardArrows,
  rollCardStats,
  toHexDigit,
} from '../data/cards';
import {
  ALL_FIGHTERS,
  FIGHTER_MAP,
  LADDER_TIERS,
  getFighterBiomes,
  isTierUnlocked,
} from '../data/ladder';
import {
  BIOME_TILE_COUNT,
  HAND_SIZE,
  buildOpponentHand,
  buildPlayerHand,
  chooseAiMove,
  chooseMatchStarter,
  createBoard,
  getScores,
  isBoardFull,
  resolvePlacement,
} from '../engine/triadEngine';
import { AutoBuildStrategy } from '../store/useProfile';
import {
  BiomeType,
  BoardCell,
  ClashDetail,
  DeckSlot,
  HandCard,
  MatchPhase,
  MatchSummary,
  Owner,
  PlayerProfile,
} from '../types/game';
import { sound } from '../utils/sound';
import { ArenaSetupFlow, MatchMode, SetupStep } from './arena/ArenaSetupFlow';
import { MatchSpoilsModal } from './arena/MatchSpoilsModal';
import { useBoardDrag } from './arena/useBoardDrag';
import { BiomeIcon, CardTraitPills } from './BiomeBadge';
import { GameCard } from './GameCard';
import { PlayLaunchIntent } from './HomeView';

interface ArenaViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  initialIntent?: PlayLaunchIntent;
  launchNonce?: number;
  onSelectDeckSlot: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
  onToggleDeckCard: (uidOrCardId: string) => { ok: boolean; message?: string };
  onAutoBuildDeck: (strategy: AutoBuildStrategy, targetBiomes?: BiomeType[]) => void;
  onRecordMatch: (params: {
    fighterId: string;
    winner: 'player' | 'rival' | 'draw';
    goldEarned: number;
    flipsMade: number;
    usedCardIds: string[];
  }) => void;
  onClaimSpoil: (
    spoilCard: HandCard
  ) => { isNew: boolean; wasOverflow: boolean; bonusGold: number; copyCount: number };
  onGoHome: () => void;
  onGoToGallery: () => void;
  onOpenRules: () => void;
  onToggleSound?: () => void;
  onMatchActiveChange?: (active: boolean) => void;
  onMatchThemeChange?: (theme: 'tavern' | 'duel' | 'boss') => void;
}

export const ArenaView: React.FC<ArenaViewProps> = ({
  profile,
  activeDeck,
  initialIntent = 'choose',
  launchNonce = 0,
  onSelectDeckSlot,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onToggleDeckCard,
  onAutoBuildDeck,
  onRecordMatch,
  onClaimSpoil,
  onGoHome,
  onGoToGallery,
  onOpenRules,
  onToggleSound,
  onMatchActiveChange,
  onMatchThemeChange,
}) => {
  const [setupStep, setSetupStep] = useState<SetupStep>(
    initialIntent === 'choose' ? 'mode' : 'details'
  );
  const [gameMode, setGameMode] = useState<MatchMode>(
    initialIntent === 'quick' ? 'quick' : 'arena'
  );
  const [selectedTierNum, setSelectedTierNum] = useState<number>(1);
  const [selectedFighterId, setSelectedFighterId] = useState<string>('t1-f1');
  const { openPreview } = useCardPreview();
  const [phase, setPhase] = useState<MatchPhase>('setup');

  // Active match state
  const [board, setBoard] = useState<BoardCell[][]>([]);
  const [playerHand, setPlayerHand] = useState<HandCard[]>([]);
  const [rivalHand, setRivalHand] = useState<HandCard[]>([]);
  const [initialPlayerIds, setInitialPlayerIds] = useState<string[]>([]);
  const [initialRivalCards, setInitialRivalCards] = useState<HandCard[]>([]);
  const [turn, setTurn] = useState<Owner>('player');
  const [selectedHandUid, setSelectedHandUid] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirmingRetreat, setConfirmingRetreat] = useState(false);
  const [callout, setCallout] = useState<{ id: number; text: string } | null>(null);
  const [activeClash, setActiveClash] = useState<ClashDetail | null>(null);
  const [lastBattleLog, setLastBattleLog] = useState<string>(
    'Drag or tap a card from your 7-card hand onto any open socket on the 4×4 board.'
  );
  const [battleHistory, setBattleHistory] = useState<string[]>([]);
  const [playerFlipsCount, setPlayerFlipsCount] = useState(0);
  const [playerCombosCount, setPlayerCombosCount] = useState(0);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [hoveredBiomeTile, setHoveredBiomeTile] = useState<{
    biome: BiomeType;
    x: number;
    y: number;
    preview: TerrainEvaluation | null;
  } | null>(null);

  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) {
      window.clearTimeout(t);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const appendBattleLogs = useCallback((entries: string[]) => {
    if (entries.length === 0) return;
    setLastBattleLog(entries.join(' · '));
    setBattleHistory((prev) => [...entries, ...prev].slice(0, 32));
  }, []);

  const currentTier = useMemo(
    () => LADDER_TIERS.find((t) => t.tierNumber === selectedTierNum) ?? LADDER_TIERS[0],
    [selectedTierNum]
  );

  const currentFighter = useMemo(
    () => FIGHTER_MAP[selectedFighterId] ?? currentTier.fighters[0] ?? ALL_FIGHTERS[0],
    [currentTier.fighters, selectedFighterId]
  );

  useEffect(() => {
    if (!onMatchThemeChange) return;
    if (phase === 'setup') {
      onMatchThemeChange('tavern');
    } else if (currentFighter.isBoss || currentFighter.tierNumber >= 9) {
      onMatchThemeChange('boss');
    } else {
      onMatchThemeChange('duel');
    }
  }, [phase, currentFighter.isBoss, currentFighter.tierNumber, onMatchThemeChange]);

  useEffect(() => {
    onMatchActiveChange?.(phase !== 'setup');
    return () => {
      onMatchActiveChange?.(false);
    };
  }, [phase, onMatchActiveChange]);

  const totalConqueredFighters = useMemo(() => {
    return ALL_FIGHTERS.filter((f) => (profile.fighterWins?.[f.id] ?? 0) > 0).length;
  }, [profile.fighterWins]);

  const handleSelectTier = (tierNum: number) => {
    sound.select();
    setSelectedTierNum(tierNum);
    const tier = LADDER_TIERS.find((t) => t.tierNumber === tierNum);
    if (tier && tier.fighters.length > 0) {
      const firstUnbeaten = tier.fighters.find(
        (f) => (profile.fighterWins?.[f.id] ?? 0) === 0
      );
      setSelectedFighterId((firstUnbeaten ?? tier.fighters[0]).id);
    }
  };

  const handleSelectFighter = (fighterId: string) => {
    sound.select();
    const f = FIGHTER_MAP[fighterId];
    if (f) {
      setSelectedTierNum(f.tierNumber);
      setSelectedFighterId(f.id);
    }
  };

  const showCallout = useCallback((text: string) => {
    setCallout({ id: Date.now() + Math.random(), text });
  }, []);

  const startMatchWithFighter = useCallback(
    (fighterIdToStart: string) => {
      const fighter = FIGHTER_MAP[fighterIdToStart] ?? currentFighter;
      if (!isTierUnlocked(fighter.tierNumber, profile.fighterWins ?? {})) return;

      clearTimers();
      setConfirmingRetreat(false);
      setSelectedTierNum(fighter.tierNumber);
      setSelectedFighterId(fighter.id);

      const pHand = buildPlayerHand(activeDeck.cards, profile.inventory);
      const rHand = buildOpponentHand(fighter.id);
      const regionBiomes = getFighterBiomes(fighter.id);
      const freshBoard = createBoard(regionBiomes);
      const uniqueSpawnedBiomes = Array.from(
        new Set(
          freshBoard
            .flat()
            .map((c) => c.terrain)
            .filter((t): t is BiomeType => Boolean(t))
        )
      )
        .map((b) => BIOME_META[b].shortName)
        .join(' & ');
      const starter: Owner = chooseMatchStarter(fighter.tierNumber);

      setBoard(freshBoard);
      setPlayerHand(pHand);
      setRivalHand(rHand);
      setInitialPlayerIds(pHand.map((h) => h.cardId));
      setInitialRivalCards(rHand);
      setTurn(starter);
      setSelectedHandUid(pHand[0]?.uid ?? null);
      setActiveClash(null);
      setPlayerFlipsCount(0);
      setPlayerCombosCount(0);
      setSummary(null);
      setIsAnimating(false);
      const introLog = `Open 4×4 Duel vs ${fighter.name} (${BIOME_TILE_COUNT} Biome tiles: ${uniqueSpawnedBiomes}). ${
        starter === 'player'
          ? 'Your move!'
          : `${fighter.name} leads — you hold the final move.`
      }`;
      setLastBattleLog(introLog);
      setBattleHistory([introLog]);
      setPhase('playing');
      sound.place();
      showCallout(starter === 'player' ? 'Your Turn First' : 'Rival Leads');
    },
    [
      activeDeck.cards,
      clearTimers,
      currentFighter,
      profile.fighterWins,
      profile.inventory,
      showCallout,
    ]
  );

  const startMatch = useCallback(() => {
    startMatchWithFighter(currentFighter.id);
  }, [currentFighter.id, startMatchWithFighter]);

  const finishMatch = useCallback(
    (
      finalBoard: BoardCell[][],
      flipsMade: number,
      combosMade: number,
      rivalOrigCards: HandCard[],
      playerOrigIds: string[]
    ) => {
      const scores = getScores(finalBoard);
      const totalCardsPlayed = scores.player + scores.rival;
      const isPerfect = scores.player === totalCardsPlayed && scores.rival === 0;

      const winner: Owner | 'draw' =
        scores.player > scores.rival
          ? 'player'
          : scores.rival > scores.player
          ? 'rival'
          : 'draw';

      const prevWinsOnFighter = profile.fighterWins?.[currentFighter.id] ?? 0;
      const isFirstVictory = winner === 'player' && prevWinsOnFighter === 0;

      const baseGold =
        winner === 'player'
          ? currentFighter.winGold
          : winner === 'draw'
          ? currentFighter.drawGold
          : currentFighter.lossGold;

      const firstWinBonus = isFirstVictory ? currentFighter.firstWinBonusGold : 0;
      const margin = Math.max(0, scores.player - scores.rival);
      const dominanceBonus =
        winner === 'player' ? (isPerfect ? 45 : margin >= 4 ? margin * 3 : 0) : 0;
      const comboBonus = winner === 'player' ? combosMade * 8 : 0;
      const totalGold = baseGold + firstWinBonus + dominanceBonus + comboBonus;

      let bonusMythicDrop: HandCard | null = null;
      const baseMythicChance = currentFighter.mythicDropChance ?? 0;
      if (winner === 'player' && baseMythicChance > 0) {
        const effectiveChance = Math.min(0.95, baseMythicChance + (isPerfect ? 0.12 : 0));
        if (Math.random() < effectiveChance) {
          const allMythics = CARDS.filter((c) => c.rarity === 'mythic');
          const unownedMythics = allMythics.filter((c) => (profile.owned[c.id] ?? 0) === 0);
          const pool =
            unownedMythics.length > 0 && Math.random() < 0.75 ? unownedMythics : allMythics;
          const rolled = pool[Math.floor(Math.random() * pool.length)];
          if (rolled) {
            bonusMythicDrop = {
              uid: `mythic-drop-${rolled.id}-${Date.now().toString(36)}`,
              cardId: rolled.id,
              stats: rollCardStats(rolled),
              arrows: rollCardArrows(rolled),
            };
          }
        }
      }

      if (winner === 'player') sound.victory();
      else if (winner === 'rival') sound.defeat();
      else sound.select();

      onRecordMatch({
        fighterId: currentFighter.id,
        winner,
        goldEarned: totalGold,
        flipsMade,
        usedCardIds: playerOrigIds,
      });

      const spoilPool: HandCard[] = bonusMythicDrop
        ? [bonusMythicDrop, ...rivalOrigCards]
        : rivalOrigCards;

      setSummary({
        fighterId: currentFighter.id,
        winner,
        playerScore: scores.player,
        rivalScore: scores.rival,
        isPerfect,
        isFirstVictory,
        baseGold,
        firstWinBonus,
        dominanceBonus,
        comboBonus,
        totalGold,
        rivalHandCards: spoilPool,
        bonusMythicDrop,
        spoilClaimedUid: null,
        spoilClaimedCardId: null,
        spoilWasOverflow: false,
        spoilBonusGold: 0,
      });
      setPhase('finished');
    },
    [currentFighter, onRecordMatch, profile.fighterWins, profile.owned]
  );

  const executeMove = useCallback(
    (owner: Owner, handUid: string, row: number, col: number) => {
      const hand = owner === 'player' ? playerHand : rivalHand;
      const idx = hand.findIndex((h) => h.uid === handUid);
      if (idx === -1) return;
      const chosen = hand[idx];
      const chosenDef = CARD_MAP[chosen.cardId];
      if (!board[row]?.[col] || board[row][col].blocked || board[row][col].card) return;

      setIsAnimating(true);
      setConfirmingRetreat(false);
      sound.place();

      const resolution = resolvePlacement(board, row, col, chosen, owner);

      const nextHand = hand.filter((h) => h.uid !== handUid);
      const nextPlayerHand = owner === 'player' ? nextHand : playerHand;
      const nextRivalHand = owner === 'rival' ? nextHand : rivalHand;

      setBoard(resolution.nextBoard);
      if (owner === 'player') {
        setPlayerHand(nextPlayerHand);
        setSelectedHandUid(nextPlayerHand[0]?.uid ?? null);
      } else {
        setRivalHand(nextRivalHand);
      }

      const comboFlips = resolution.flips.filter((f) => f.reason === 'combo').length;
      const unopposedFlips = resolution.flips.filter((f) => f.reason === 'unopposed').length;
      const placedMod = resolution.nextBoard[row][col].card?.terrainMod;
      const terrainSuffix = placedMod
        ? ` · ${BIOME_META[placedMod.biome].shortName} (${placedMod.label})`
        : '';
      const activeAugment = resolveCardAugment(chosen.cardId, chosen.augmentId);
      const augCount = resolution.augments.length;
      const augSuffix =
        augCount > 0 && activeAugment
          ? ` · ${activeAugment.name} (${activeAugment.shortTag} ×${augCount})`
          : '';

      let updatedFlips = playerFlipsCount;
      let updatedCombos = playerCombosCount;
      if (owner === 'player' && resolution.flips.length > 0) {
        updatedFlips += resolution.flips.length;
        setPlayerFlipsCount(updatedFlips);
        if (comboFlips > 0) {
          updatedCombos += 1;
          setPlayerCombosCount(updatedCombos);
        }
      }

      if (resolution.clashes.length > 0) {
        const primaryClash = resolution.clashes[0];
        setActiveClash(primaryClash);
        const clearClashTimer = window.setTimeout(() => {
          setActiveClash(null);
        }, 1450);
        timersRef.current.push(clearClashTimer);

        // Log every clash in resolution.clashes so multi-clash drops never hide outcomes
        const clashEntries = resolution.clashes.map((c, clashIdx) => {
          const atkHex = toHexDigit(c.attackerVal);
          const defHex = toHexDigit(c.defenderVal);
          const isLastClash = clashIdx === resolution.clashes.length - 1;
          const prefix =
            resolution.clashes.length > 1
              ? `[Clash ${clashIdx + 1}/${resolution.clashes.length}] `
              : '';
          return `${prefix}${c.attackerName} (${atkHex}${c.attackType}) vs ${c.defenderName} (${defHex}) · ${
            c.attackerWon ? `${c.attackerName} wins clash!` : `${c.defenderName} counter-flips!`
          }${isLastClash && comboFlips > 0 ? ` +${comboFlips} Combo!` : ''}${
            clashIdx === 0 ? `${terrainSuffix}${augSuffix}` : ''
          }`;
        });
        appendBattleLogs([...clashEntries].reverse());

        const anyWon = resolution.clashes.some((c) => c.attackerWon);
        const clashTimer = window.setTimeout(() => {
          sound.clash(anyWon);
        }, 70);
        const soundTimer = window.setTimeout(() => {
          if (comboFlips > 0) sound.combo();
          else sound.flip(resolution.flips.length);
        }, 210);
        timersRef.current.push(clashTimer, soundTimer);

        const pAtkHex = toHexDigit(primaryClash.attackerVal);
        const pDefHex = toHexDigit(primaryClash.defenderVal);
        if (comboFlips > 0) {
          showCallout(`Combo Chain ×${resolution.flips.length}`);
        } else if (resolution.clashes.length > 1) {
          const wonCount = resolution.clashes.filter((c) => c.attackerWon).length;
          showCallout(`Multi-Clash (${wonCount}/${resolution.clashes.length} Won)`);
        } else {
          showCallout(
            primaryClash.attackerWon
              ? `Clash Won (${pAtkHex}${primaryClash.attackType} vs ${pDefHex})`
              : `Countered (${pAtkHex}${primaryClash.attackType} vs ${pDefHex})`
          );
        }
      } else if (unopposedFlips > 0) {
        setActiveClash(null);
        appendBattleLogs([
          `${chosenDef.name} captured ${unopposedFlips} unopposed card${
            unopposedFlips > 1 ? 's' : ''
          }!${terrainSuffix}${augSuffix}`,
        ]);
        const soundTimer = window.setTimeout(() => {
          sound.flip(unopposedFlips);
        }, 110);
        timersRef.current.push(soundTimer);
        showCallout(unopposedFlips > 1 ? `Multi-Capture ×${unopposedFlips}` : 'Unopposed Capture');
      } else if (augCount > 0 && activeAugment) {
        setActiveClash(null);
        appendBattleLogs([
          `${chosenDef.name} activated ${activeAugment.name}: ${activeAugment.shortTag} on ${augCount} card${
            augCount > 1 ? 's' : ''
          }!`,
        ]);
        sound.select();
        showCallout(`${activeAugment.name} (${activeAugment.shortTag})`);
      } else {
        setActiveClash(null);
        appendBattleLogs([
          `${owner === 'player' ? 'You' : currentFighter.name} deployed ${chosenDef.name} (${formatTetraCode(
            chosen.stats
          )})${terrainSuffix}.`,
        ]);
      }

      const allCardsPlayed =
        (nextPlayerHand.length === 0 && nextRivalHand.length === 0) ||
        isBoardFull(resolution.nextBoard);

      const settleDelay = resolution.flips.length > 0 ? 560 : 260;
      const t = window.setTimeout(() => {
        if (allCardsPlayed) {
          finishMatch(
            resolution.nextBoard,
            updatedFlips,
            updatedCombos,
            initialRivalCards,
            initialPlayerIds
          );
        } else {
          setTurn(owner === 'player' ? 'rival' : 'player');
          setIsAnimating(false);
        }
      }, settleDelay);
      timersRef.current.push(t);
    },
    [
      appendBattleLogs,
      board,
      currentFighter.name,
      finishMatch,
      initialPlayerIds,
      initialRivalCards,
      playerCombosCount,
      playerFlipsCount,
      playerHand,
      rivalHand,
      showCallout,
    ]
  );

  const handleExecutePlayerMove = useCallback(
    (uid: string, row: number, col: number) => {
      executeMove('player', uid, row, col);
    },
    [executeMove]
  );

  const {
    draggingCard,
    hoverCell,
    setHoverCell,
    clearHoverCell,
    scrubCardUid,
    boardGridRef,
    mobileHandFanRef,
    dragGhostRef,
    suppressHandClickUntilRef,
    handleMobileFanPointerDown,
    handleHandCardPointerDown,
    getInitialGhostPos,
  } = useBoardDrag({
    board,
    phase,
    turn,
    isAnimating,
    playerHand,
    onSelectHandUid: setSelectedHandUid,
    onExecutePlayerMove: handleExecutePlayerMove,
    timersRef,
  });

  // Automated Rival AI Turn
  useEffect(() => {
    if (phase !== 'playing' || turn !== 'rival' || isAnimating) return;
    if (rivalHand.length === 0) return;

    const thinkTimer = window.setTimeout(() => {
      const move = chooseAiMove(board, rivalHand, currentFighter.id);
      if (move && rivalHand[move.handIndex]) {
        executeMove('rival', rivalHand[move.handIndex].uid, move.row, move.col);
      }
    }, 680);

    timersRef.current.push(thinkTimer);
    return () => window.clearTimeout(thinkTimer);
  }, [board, currentFighter.id, executeMove, isAnimating, phase, rivalHand, turn]);

  // Desktop Hand Hotkeys (1-7) & Escape to cancel Retreat confirmation
  useEffect(() => {
    if (phase !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape' && confirmingRetreat) {
        e.preventDefault();
        setConfirmingRetreat(false);
        return;
      }

      if (e.key >= '1' && e.key <= '7') {
        const idx = Number(e.key) - 1;
        const targetCard = playerHand[idx];
        if (targetCard) {
          e.preventDefault();
          sound.select();
          setSelectedHandUid(targetCard.uid);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmingRetreat, phase, playerHand]);

  const handleCellClick = (row: number, col: number) => {
    if (phase !== 'playing' || turn !== 'player' || isAnimating) return;
    if (!selectedHandUid) return;
    const cell = board[row]?.[col];
    if (!cell || cell.blocked || cell.card) return;
    clearHoverCell();
    executeMove('player', selectedHandUid, row, col);
  };

  const handleConcede = () => {
    clearTimers();
    setConfirmingRetreat(false);
    setPhase('setup');
  };

  const handleClaimSpoilCard = (spoilCard: HandCard) => {
    if (!summary || summary.spoilClaimedUid) return;
    const res = onClaimSpoil(spoilCard);
    setSummary({
      ...summary,
      spoilClaimedUid: spoilCard.uid,
      spoilClaimedCardId: spoilCard.cardId,
      spoilWasOverflow: res.wasOverflow,
      spoilBonusGold: res.bonusGold,
    });
  };

  const nextChallengeFighter = useMemo(() => {
    const idx = ALL_FIGHTERS.findIndex((f) => f.id === currentFighter.id);
    if (idx === -1) return null;
    for (let i = idx + 1; i < ALL_FIGHTERS.length; i++) {
      const candidate = ALL_FIGHTERS[i];
      if (isTierUnlocked(candidate.tierNumber, profile.fighterWins ?? {})) {
        return candidate;
      }
    }
    return null;
  }, [currentFighter.id, profile.fighterWins]);

  const scores = useMemo(() => getScores(board), [board]);

  const selectedHandCard = useMemo(() => {
    return playerHand.find((c) => c.uid === selectedHandUid) ?? null;
  }, [playerHand, selectedHandUid]);

  const selectedCardDef = useMemo(() => {
    return selectedHandCard ? CARD_MAP[selectedHandCard.cardId] ?? null : null;
  }, [selectedHandCard]);

  const activeBoardBiomes = useMemo(() => {
    const counts = new Map<BiomeType, number>();
    for (const row of board) {
      for (const cell of row) {
        if (cell.terrain) {
          counts.set(cell.terrain, (counts.get(cell.terrain) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries());
  }, [board]);

  const previewDeckHand = useMemo(
    () => buildPlayerHand(activeDeck.cards, profile.inventory),
    [activeDeck.cards, profile.inventory]
  );

  const unlockedLadderTiers = useMemo(
    () => LADDER_TIERS.filter((t) => isTierUnlocked(t.tierNumber, profile.fighterWins ?? {})),
    [profile.fighterWins]
  );

  const unlockedFighters = useMemo(() => {
    const list = unlockedLadderTiers.flatMap((t) => t.fighters);
    return list.length > 0 ? list : LADDER_TIERS[0].fighters;
  }, [unlockedLadderTiers]);

  const rollRandomFighter = useCallback(
    (excludeId?: string) => {
      const filtered =
        unlockedFighters.length > 1 && excludeId
          ? unlockedFighters.filter((f) => f.id !== excludeId)
          : unlockedFighters;
      const picked = filtered[Math.floor(Math.random() * filtered.length)] ?? unlockedFighters[0];
      setSelectedTierNum(picked.tierNumber);
      setSelectedFighterId(picked.id);
      return picked;
    },
    [unlockedFighters]
  );

  useEffect(() => {
    if (launchNonce === 0) return;
    setPhase('setup');
    setConfirmingRetreat(false);
    if (initialIntent === 'quick') {
      setGameMode('quick');
      setSetupStep('details');
      rollRandomFighter();
    } else if (initialIntent === 'arena') {
      setGameMode('arena');
      setSetupStep('details');
    } else {
      setSetupStep('mode');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchNonce, initialIntent]);

  if (phase === 'setup') {
    return (
      <ArenaSetupFlow
        profile={profile}
        activeDeck={activeDeck}
        setupStep={setupStep}
        setSetupStep={setSetupStep}
        gameMode={gameMode}
        setGameMode={setGameMode}
        selectedTierNum={selectedTierNum}
        currentTier={currentTier}
        currentFighter={currentFighter}
        totalConqueredFighters={totalConqueredFighters}
        unlockedLadderTiers={unlockedLadderTiers}
        unlockedFighters={unlockedFighters}
        previewDeckHand={previewDeckHand}
        onSelectTier={handleSelectTier}
        onSelectFighter={handleSelectFighter}
        onRollRandomFighter={rollRandomFighter}
        onSelectDeckSlot={onSelectDeckSlot}
        onCreateDeck={onCreateDeck}
        onRenameDeck={onRenameDeck}
        onDeleteDeck={onDeleteDeck}
        onToggleDeckCard={onToggleDeckCard}
        onAutoBuildDeck={onAutoBuildDeck}
        onStartMatch={startMatch}
        onGoHome={onGoHome}
        onGoToGallery={onGoToGallery}
        onOpenRules={onOpenRules}
      />
    );
  }

  // ==================== ACTIVE MATCH VIEW (4x4 TABLETOP · ZERO-SCROLL MOBILE) ====================
  const playerAvatarCard =
    CARD_MAP[previewDeckHand[0]?.cardId ?? 'ember-imp'] ?? CARD_MAP['ember-imp'];
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];
  const selectedActiveAugment = selectedHandCard
    ? resolveCardAugment(selectedHandCard.cardId, selectedHandCard.augmentId)
    : undefined;

  const mobileHandCardClass =
    playerHand.length >= 7
      ? 'w-[70px] sm:w-[82px] -ml-[22px] sm:-ml-[16px] first:ml-0'
      : playerHand.length === 6
      ? 'w-[72px] sm:w-[84px] -ml-[15px] sm:-ml-[8px] first:ml-0'
      : playerHand.length === 5
      ? 'w-[74px] sm:w-[86px] -ml-[6px] sm:ml-0 first:ml-0'
      : 'w-[76px] sm:w-[88px] ml-2 first:ml-0';

  return (
    <div className="h-full w-full overflow-hidden flex flex-col px-2.5 sm:px-4 lg:px-5 py-2 lg:py-3 gap-2 lg:gap-3">
      {/* Forged-Iron Hero Portrait Medallions & Turn Banner */}
      <div className="shrink-0 iron-panel riveted-frame rounded-[4px] px-3 sm:px-4 py-1.5 lg:py-2 flex items-center justify-between gap-2">
        {/* Player Hero Medallion + Score Seal */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 rounded-[3px] overflow-hidden border-2 border-[#4d84c4] shadow-[0_0_12px_rgba(59,130,246,0.35)]">
              {playerAvatarCard && (
                <img
                  src={getCardThumbUrl(playerAvatarCard.image)}
                  alt="You"
                  width={320}
                  height={320}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover ${playerAvatarCard.artFilter ?? ''}`}
                />
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 lg:w-6 lg:h-6 rounded-[2px] bg-gradient-to-b from-[#3b72b5] to-[#1e3d66] border border-[#96c4f5] flex items-center justify-center font-mono text-[11px] lg:text-xs font-bold tabular-nums text-white shadow">
              {scores.player}
            </span>
          </div>
          <div className="hidden lg:block">
            <div className="font-[var(--font-display)] text-xs font-bold tracking-wider text-[#bcd9f7]">
              You
            </div>
            <div className="text-[11px] text-[#9b896f]">{activeDeck.name}</div>
          </div>
        </div>

        {/* Center Forged Turn Banner & Live Clash Log */}
        <div className="flex flex-col items-center text-center min-w-0 flex-1 px-1">
          <div
            className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm font-[var(--font-display)] font-bold tracking-[0.12em] truncate max-w-full ${
              turn === 'player' ? 'text-[#f2cc7b]' : 'text-[#eb8686]'
            }`}
          >
            <Swords className="w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0" />
            <span className="truncate">
              {turn === 'player'
                ? 'YOUR TURN'
                : `${currentFighter.name.toUpperCase()}’S TURN`}
            </span>
          </div>
          <p className="font-[var(--font-serif)] text-xs lg:text-[13px] text-[#cbb89a] truncate max-w-full lg:max-w-[500px] leading-tight mt-0.5">
            {lastBattleLog}
          </p>
        </div>

        {/* Rival Hero Medallion + Mobile Card Pips + Score Seal + Utility Icons */}
        <div className="flex items-center gap-1.5 lg:gap-2.5 shrink-0">
          {/* Mobile Mini Rival Hand Pips */}
          <div
            className="flex lg:hidden flex-col items-end gap-0.5 mr-0.5"
            aria-label={`Rival has ${rivalHand.length} cards remaining`}
          >
            <span className="text-[9px] font-mono font-semibold text-rose-300/90 leading-none">
              {rivalHand.length} left
            </span>
            <div className="flex items-center gap-[2.5px]">
              {Array.from({ length: HAND_SIZE }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-[4.5px] h-[8px] rounded-[1px] border transition-opacity ${
                    idx < rivalHand.length
                      ? 'bg-gradient-to-b from-rose-500 to-rose-800 border-rose-300/60 opacity-100'
                      : 'bg-[#211913] border-[#3d3024] opacity-35'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="hidden lg:block text-right">
            <div className="font-[var(--font-display)] text-xs font-bold tracking-wider text-[#f1b4b4]">
              {currentFighter.name}
            </div>
            <div className="text-[11px] text-[#9b896f]">
              Tier {currentFighter.tierNumber} · {currentFighter.title}
            </div>
          </div>
          <div className="relative">
            <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 rounded-[3px] overflow-hidden border-2 border-[#b84646] shadow-[0_0_12px_rgba(220,38,38,0.35)]">
              {rivalAvatarCard && (
                <img
                  src={getCardThumbUrl(rivalAvatarCard.image)}
                  alt={currentFighter.name}
                  width={320}
                  height={320}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover ${rivalAvatarCard.artFilter ?? ''}`}
                />
              )}
            </div>
            <span className="absolute -bottom-1 -left-1 w-5 h-5 lg:w-6 lg:h-6 rounded-[2px] bg-gradient-to-b from-[#b53a3a] to-[#691c1c] border border-[#f5a3a3] flex items-center justify-center font-mono text-[11px] lg:text-xs font-bold tabular-nums text-white shadow">
              {scores.rival}
            </span>
          </div>

          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={profile.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              className="lg:hidden w-7 h-7 flex items-center justify-center rounded-[3px] text-[#a59277] hover:text-[#efe3cd] hover:bg-[#271e16] transition-colors cursor-pointer"
            >
              {profile.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sound.select();
              onOpenRules();
            }}
            aria-label="Open game rules"
            title="Field Codex (R)"
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-[3px] text-[#e2b053] hover:text-[#f5d593] hover:bg-[#271e16] transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>

          {confirmingRetreat ? (
            <div className="inline-flex items-center gap-1 rounded-[3px] basalt-recess p-0.5 border border-rose-500/45">
              <button
                type="button"
                onClick={handleConcede}
                className="crimson-btn min-h-[28px] lg:min-h-[34px] px-2 lg:px-2.5 rounded-[2px] font-[var(--font-display)] text-[10px] lg:text-xs font-bold tracking-wider uppercase cursor-pointer"
              >
                Retreat
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setConfirmingRetreat(false);
                }}
                aria-label="Cancel retreat"
                title="Cancel (Esc)"
                className="iron-btn w-7 h-7 lg:w-[34px] lg:h-[34px] rounded-[2px] flex items-center justify-center text-[#cbb89a] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                sound.select();
                setConfirmingRetreat(true);
              }}
              aria-label="Retreat from match"
              title="Retreat from match"
              className="w-7 h-7 lg:min-h-[38px] lg:min-w-[38px] flex items-center justify-center rounded-[3px] iron-btn text-[#b8a58a] hover:text-rose-300 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Full-Height Desktop 3-Column Tabletop (Zero Scroll) + Mobile Flex Stage */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[268px_minmax(0,1fr)_356px] xl:grid-cols-[308px_minmax(0,1fr)_420px] 2xl:grid-cols-[340px_minmax(0,1fr)_480px] gap-2 lg:gap-4 items-stretch">
        {/* LEFT COMMAND PANEL (Desktop): Rival Hand + Active Biomes + Field Ledger */}
        <aside className="hidden lg:flex flex-col gap-3 min-h-0 h-full overflow-hidden order-1">
          {/* Rival Hand Fan */}
          <div className="shrink-0 iron-panel rounded-[4px] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e99f9f] truncate">
                {currentFighter.name}’s Hand
              </span>
              <span className="font-mono text-xs font-bold text-[#f5c0c0] bg-[#361616] border border-[#7c3434] px-2 py-0.5 rounded-[2px]">
                {rivalHand.length}/{HAND_SIZE}
              </span>
            </div>

            <div className="basalt-recess rounded-[3px] flex items-center justify-center py-2 min-h-[82px]">
              {rivalHand.length === 0 ? (
                <span className="font-[var(--font-serif)] italic text-sm text-[#7f6d58]">
                  All rival cards played
                </span>
              ) : (
                rivalHand.map((hCard, idx) => (
                  <div
                    key={hCard.uid}
                    style={{ marginLeft: idx === 0 ? 0 : '-24px', zIndex: idx + 1 }}
                    className="w-[56px] xl:w-[62px] shrink-0"
                  >
                    <GameCard cardId={hCard.cardId} owner="rival" faceDown size="xs" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Biomes Field Breakdown */}
          {activeBoardBiomes.length > 0 && (
            <div className="shrink-0 iron-panel rounded-[4px] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e9be69]">
                  Active Field Biomes
                </span>
                <span className="text-[10px] font-mono text-[#99866d]">4 tiles</span>
              </div>
              <div className="space-y-1.5">
                {activeBoardBiomes.map(([biome, count]) => {
                  const meta = BIOME_META[biome];
                  return (
                    <div
                      key={biome}
                      className="basalt-recess rounded-[3px] px-2.5 py-2 space-y-0.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span
                            className={`w-4 h-4 rounded-[2px] border flex items-center justify-center shrink-0 ${meta.badgeClass}`}
                          >
                            <BiomeIcon biome={biome} className="w-2.5 h-2.5" />
                          </span>
                          <span className={`font-[var(--font-display)] ${meta.accentTextClass}`}>
                            {meta.name}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-[#9c896e]">×{count}</span>
                      </div>
                      <div className="text-[10.5px] text-emerald-300/95 leading-snug">
                        ▲ {meta.favorsSummary}
                      </div>
                      <div className="text-[10.5px] text-rose-300/95 leading-snug">
                        ▼ {meta.hindersSummary}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Scrolling Field Combat Ledger */}
          <div className="flex-1 min-h-0 iron-panel rounded-[4px] p-3 flex flex-col gap-2 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between">
              <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#dfd0b6]">
                Battle Chronicle
              </span>
              <span className="text-[10px] font-mono text-[#8b7962]">
                Click tile to inspect
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
              {battleHistory.map((entry, idx) => (
                <div
                  key={`${idx}-${entry.slice(0, 18)}`}
                  className={`rounded-[3px] px-2.5 py-1.5 font-[var(--font-serif)] text-[13px] leading-snug border ${
                    idx === 0
                      ? 'brass-plaque text-[#f6dfb0] font-semibold'
                      : 'basalt-recess text-[#b3a086]'
                  }`}
                >
                  {entry}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER FULL-HEIGHT 4x4 AERIAL BATTLEFIELD (Carved Basalt & Brass Frame) */}
        <div className="mobile-board-stage desktop-board-stage flex-1 min-h-0 h-full order-2 relative flex items-center justify-center w-full">
          {/* Animated Floating Callout Banner */}
          {callout && (
            <div
              key={callout.id}
              className="pointer-events-none absolute top-2 z-30 animate-callout"
            >
              <div className="brass-panel rounded-[3px] border-2 border-[#e0ae53] px-4 py-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.9)]">
                <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-[#fae1a7] tracking-[0.1em]">
                  {callout.text}
                </span>
              </div>
            </div>
          )}

          {/* Animated Clash Duel Mini-Overlay */}
          {activeClash && (
            <div className="pointer-events-none absolute bottom-3 z-30 animate-callout">
              <div className="brass-panel rounded-[3px] border border-[#d8a243] px-3.5 py-2 shadow-2xl flex items-center gap-2.5 text-xs">
                <span className="font-[var(--font-display)] font-bold text-[#9bc6f5]">
                  {activeClash.attackerName}
                </span>
                <span className="font-mono font-bold px-1.5 py-0.5 rounded-[2px] brass-plaque text-[#f5d284]">
                  {toHexDigit(activeClash.attackerVal)}
                  {activeClash.attackType} vs {toHexDigit(activeClash.defenderVal)}
                </span>
                <span className="font-[var(--font-display)] font-bold text-[#f2a0a0]">
                  {activeClash.defenderName}
                </span>
              </div>
            </div>
          )}

          {/* Floating Mobile Augment Ribbon */}
          {selectedActiveAugment && !activeClash && (
            <div className="pointer-events-none lg:hidden absolute bottom-1 inset-x-1 z-20 flex justify-center">
              <div className="max-w-full rounded-[3px] bg-[#211626]/95 border border-violet-400/55 px-2.5 py-1 text-[10px] text-violet-100 flex items-center gap-1.5 shadow-lg">
                <Wand2 className="w-3 h-3 text-violet-300 shrink-0" />
                <span className="truncate">
                  <strong className="text-violet-200">{selectedActiveAugment.name}:</strong>{' '}
                  {selectedActiveAugment.shortTag}
                </span>
              </div>
            </div>
          )}

          {/* Continuous Blended Open 4x4 Aerial Battlefield Canvas in Carved Basalt Frame */}
          <div className="relative mobile-board-fit desktop-board-fit rounded-[5px] border-2 border-[#7b5b2f] p-1.5 sm:p-2 lg:p-3 overflow-hidden bg-[#120e0a] shadow-[0_26px_64px_rgba(0,0,0,0.85),inset_0_0_0_2px_rgba(14,10,7,0.9),inset_0_0_0_3px_rgba(218,168,84,0.28)]">
            <div
              aria-hidden="true"
              style={{
                backgroundImage: `url(${NEUTRAL_TERRAIN_IMAGE})`,
                backgroundSize: '260px 346px',
                backgroundRepeat: 'repeat',
              }}
              className="pointer-events-none absolute inset-0 opacity-80 brightness-[0.68] contrast-[1.08]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_90%_at_50%_50%,rgba(12,9,6,0.08)_0%,rgba(10,7,5,0.56)_100%)]"
            />

            <div ref={boardGridRef} className="relative z-10 grid grid-cols-4 gap-1.5 sm:gap-2">
              {board.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const key = `${rIdx}-${cIdx}`;
                  const canPlaceHere =
                    phase === 'playing' &&
                    turn === 'player' &&
                    !isAnimating &&
                    Boolean(selectedHandUid) &&
                    !cell.card;
                  const biomeMeta = cell.terrain ? BIOME_META[cell.terrain] : null;
                  const activePreviewDef =
                    phase === 'playing' && turn === 'player' && !isAnimating
                      ? CARD_MAP[(draggingCard?.card ?? selectedHandCard)?.cardId ?? '']
                      : undefined;
                  const terrainPreview =
                    !cell.card && cell.terrain && activePreviewDef
                      ? evaluateTerrainEffect(cell.terrain, activePreviewDef)
                      : null;

                  if (cell.card) {
                    const placedCard = cell.card;
                    return (
                      <div
                        key={key}
                        title={
                          biomeMeta
                            ? `${biomeMeta.name}: ${
                                placedCard.terrainMod
                                  ? placedCard.terrainMod.label
                                  : 'No terrain effect on this card'
                              } · Click to inspect`
                            : 'Click card to inspect stats'
                        }
                        className="relative aspect-[5/7]"
                      >
                        <GameCard
                          cardId={placedCard.cardId}
                          stats={placedCard.stats}
                          baseStats={placedCard.baseStats}
                          arrows={placedCard.arrows}
                          augmentId={placedCard.augmentId}
                          owner={placedCard.owner}
                          justPlaced={placedCard.justPlaced}
                          flipKey={placedCard.lastFlippedAt}
                          lastAugmented={placedCard.lastAugmented}
                          size="sm"
                          onClick={() => {
                            sound.select();
                            openPreview({
                              cardId: placedCard.cardId,
                              stats: placedCard.stats,
                              baseStats: placedCard.baseStats,
                              arrows: placedCard.arrows,
                              augmentId: placedCard.augmentId,
                              owner: placedCard.owner,
                              terrain: cell.terrain,
                              terrainMod: placedCard.terrainMod,
                              lastAugmented: placedCard.lastAugmented,
                            });
                          }}
                        />
                        {biomeMeta && (
                          <span
                            aria-label={`${biomeMeta.name} tile`}
                            className={`pointer-events-none absolute -top-1 -left-1 z-30 w-4 h-4 sm:w-5 sm:h-5 rounded-[2px] border flex items-center justify-center shadow-md ${biomeMeta.badgeClass}`}
                          >
                            <BiomeIcon biome={biomeMeta.id} className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        )}
                      </div>
                    );
                  }

                  const isDropTarget =
                    hoverCell?.row === rIdx && hoverCell?.col === cIdx && canPlaceHere;
                  const isDragActive = Boolean(draggingCard && !draggingCard.returning);

                  return (
                    <button
                      key={key}
                      type="button"
                      data-drop-row={canPlaceHere ? rIdx : undefined}
                      data-drop-col={canPlaceHere ? cIdx : undefined}
                      aria-disabled={!canPlaceHere}
                      onMouseEnter={(e) => {
                        if (biomeMeta && !isDragActive) {
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
                            preview: terrainPreview,
                          });
                        }
                        if (canPlaceHere && !isDragActive) {
                          sound.hover();
                          setHoverCell({ row: rIdx, col: cIdx });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredBiomeTile(null);
                        if (!isDragActive) {
                          setHoverCell((cur) =>
                            cur?.row === rIdx && cur?.col === cIdx ? null : cur
                          );
                        }
                      }}
                      onClick={() => {
                        setHoveredBiomeTile(null);
                        if (canPlaceHere) {
                          handleCellClick(rIdx, cIdx);
                        }
                      }}
                      aria-label={
                        biomeMeta
                          ? `${biomeMeta.name} tile at row ${rIdx + 1}, column ${cIdx + 1}`
                          : `Stone ground tile at row ${rIdx + 1}, column ${cIdx + 1}`
                      }
                      className={`group relative aspect-[5/7] rounded-[4px] border transition-all duration-150 overflow-hidden bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        isDropTarget
                          ? 'border-[#f3c569] ring-2 ring-[#e5b353]/80 shadow-[0_0_24px_rgba(235,176,68,0.45)] scale-[1.03] cursor-pointer z-20'
                          : isDragActive && canPlaceHere
                          ? 'border-[#d6a348]/45 bg-amber-500/[0.05]'
                          : canPlaceHere
                          ? 'border-[#e8d5b3]/[0.15] hover:border-[#e5b55a]/75 cursor-pointer active:scale-[0.97]'
                          : 'border-[#e8d5b3]/[0.08] cursor-default'
                      }`}
                    >
                      {biomeMeta && (
                        <>
                          <img
                            src={biomeMeta.tileImage}
                            alt={biomeMeta.name}
                            loading="eager"
                            decoding="async"
                            draggable={false}
                            style={{
                              filter: biomeMeta.tileImageFilter,
                              maskImage:
                                'radial-gradient(ellipse 84% 86% at 50% 50%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.72) 74%, rgba(0,0,0,0) 100%)',
                              WebkitMaskImage:
                                'radial-gradient(ellipse 84% 86% at 50% 50%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.72) 74%, rgba(0,0,0,0) 100%)',
                            }}
                            className={`pointer-events-none absolute -inset-[6%] w-[112%] h-[112%] object-cover select-none transition-transform duration-200 ${
                              isDropTarget ? 'scale-[1.06]' : 'group-hover:scale-[1.04]'
                            }`}
                          />
                          <div
                            style={{ background: biomeMeta.tileBlendGlow }}
                            className="pointer-events-none absolute inset-0"
                          />
                        </>
                      )}

                      <div className="pointer-events-none absolute inset-0 rounded-[4px] shadow-[inset_0_1px_8px_rgba(0,0,0,0.48)]" />

                      {isDropTarget && (
                        <div className="pointer-events-none absolute inset-0 bg-amber-400/15 shadow-[inset_0_0_18px_rgba(240,185,78,0.45)]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COMMAND PANEL: Live Selected Card Dossier + Spacious Desktop Hand Tray */}
        <aside className="shrink-0 lg:shrink lg:min-h-0 lg:h-full lg:flex lg:flex-col lg:gap-2.5 order-3 w-full pb-safe lg:pb-0">
          {/* Desktop Permanent Selected Card Dossier */}
          {selectedCardDef && selectedHandCard && (
            <div className="hidden lg:block shrink-0 brass-panel rounded-[4px] p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-[var(--font-display)] text-sm font-bold tracking-wide text-[#f6dfb0] truncate">
                  {selectedCardDef.name}
                </span>
                <span className="font-mono text-sm font-bold text-[#f0c76e] shrink-0">
                  {formatTetraCode(selectedHandCard.stats)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <CardTraitPills
                  element={selectedCardDef.element}
                  tribe={selectedCardDef.tribe}
                  compact
                />
                <span className="flex items-center gap-1 text-[#cbb89a] font-mono text-[11px]">
                  <Compass className="w-3.5 h-3.5 text-[#e2b053]" />
                  {selectedHandCard.arrows.length} arrows
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#a79479]">
                ATK {toHexDigit(selectedHandCard.stats.power)} · Type {selectedHandCard.stats.type}{' '}
                · P.DEF {toHexDigit(selectedHandCard.stats.pDef)} · M.DEF{' '}
                {toHexDigit(selectedHandCard.stats.mDef)}
              </div>

              {(() => {
                const matchups = activeBoardBiomes
                  .map(([b]) => evaluateTerrainEffect(b, selectedCardDef))
                  .filter((ev): ev is NonNullable<typeof ev> => Boolean(ev && ev.hasEffect));
                if (matchups.length === 0) return null;
                return (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-[#4b3a26]/70">
                    {matchups.map((m) => (
                      <span
                        key={m.biome}
                        className={`inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 font-mono text-[10.5px] font-semibold ${
                          m.isPositive
                            ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                            : 'bg-rose-950/80 border-rose-500/45 text-rose-200'
                        }`}
                      >
                        <BiomeIcon biome={m.biome} className="w-3 h-3 shrink-0" />
                        <span>
                          {BIOME_META[m.biome].shortName}: {m.shortTag}
                        </span>
                      </span>
                    ))}
                  </div>
                );
              })()}

              {selectedActiveAugment && (
                <div className="rounded-[3px] bg-[#24162b]/80 border border-violet-400/50 px-2.5 py-1.5 text-[11px] text-violet-100 flex items-start gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-violet-200">{selectedActiveAugment.name}:</strong>{' '}
                    <span>{selectedActiveAugment.description}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hand Header */}
          <div className="flex items-center justify-between gap-2 mb-0.5 lg:mb-0 px-1 shrink-0 min-h-[20px]">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-[var(--font-display)] text-[11px] lg:text-xs font-bold uppercase tracking-wider text-[#b7d6f5]">
                Your Hand ({playerHand.length})
              </span>
              <span className="lg:hidden text-[10px] text-[#9b896f]">
                · Slide to inspect
              </span>
            </div>
            <span className="hidden lg:inline font-[var(--font-serif)] italic text-xs text-[#9b896f]">
              Keys 1–7 or drag → tile
            </span>
            {selectedCardDef && selectedHandCard && (
              <div className="flex lg:hidden items-center justify-end gap-1.5 text-[11px] text-[#efe3cd] min-w-0">
                <span className="font-[var(--font-display)] font-semibold truncate">
                  {selectedCardDef.name}
                </span>
                <span className="font-mono font-bold tabular-nums text-[#f0c76e] shrink-0">
                  {formatTetraCode(selectedHandCard.stats)}
                </span>
              </div>
            )}
          </div>

          {/* Mobile Zero-Scroll 7-Card Overlapping Fan */}
          <div
            ref={mobileHandFanRef}
            className="flex lg:hidden items-end justify-center pt-4 pb-1.5 px-1 touch-none select-none"
          >
            {playerHand.map((hCard) => {
              const isSelected = hCard.uid === selectedHandUid;
              const isScrubbed = hCard.uid === scrubCardUid;
              const isBeingDragged = draggingCard?.card.uid === hCard.uid;
              const activeHighlight =
                (isScrubbed || (isSelected && turn === 'player')) && !isBeingDragged;
              return (
                <div
                  key={hCard.uid}
                  data-hand-uid={hCard.uid}
                  onPointerDown={(e) => handleMobileFanPointerDown(e, hCard)}
                  className={`relative shrink-0 transition-transform duration-150 ${mobileHandCardClass} ${
                    isScrubbed ? 'z-40' : activeHighlight ? 'z-30' : 'z-10'
                  } ${
                    phase === 'playing' && turn === 'player' && !isAnimating
                      ? 'cursor-grab active:cursor-grabbing'
                      : 'cursor-pointer'
                  } ${
                    isBeingDragged
                      ? 'opacity-25 scale-95'
                      : isScrubbed
                      ? '-translate-y-4 scale-[1.16]'
                      : activeHighlight
                      ? '-translate-y-2.5 scale-[1.1]'
                      : scrubCardUid
                      ? 'opacity-65'
                      : ''
                  }`}
                >
                  <GameCard
                    cardId={hCard.cardId}
                    stats={hCard.stats}
                    arrows={hCard.arrows}
                    augmentId={hCard.augmentId}
                    owner="player"
                    size="sm"
                    showName={false}
                    selected={activeHighlight}
                    onClick={() => {
                      if (Date.now() < suppressHandClickUntilRef.current) return;
                      sound.select();
                      setSelectedHandUid(hCard.uid);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Desktop Full-Height Scrollable Recessed Hand Tray */}
          <div className="hidden lg:block flex-1 min-h-0 overflow-y-auto basalt-recess rounded-[4px] p-2.5">
            <div className="grid grid-cols-2 2xl:grid-cols-3 gap-2.5">
              {playerHand.map((hCard, idx) => {
                const isSelected = hCard.uid === selectedHandUid;
                const isBeingDragged = draggingCard?.card.uid === hCard.uid;
                return (
                  <div
                    key={hCard.uid}
                    onPointerDown={(e) => handleHandCardPointerDown(e, hCard)}
                    className={`relative w-auto transition-opacity duration-150 ${
                      phase === 'playing' && turn === 'player' && !isAnimating
                        ? 'cursor-grab active:cursor-grabbing'
                        : ''
                    } ${isBeingDragged ? 'opacity-25 scale-95' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute top-1 left-1 z-30 w-4 h-4 rounded-[2px] border font-mono text-[9.5px] font-bold flex items-center justify-center shadow ${
                        isSelected && turn === 'player'
                          ? 'bg-[#d8a243] border-[#fbe2a8] text-[#171008]'
                          : 'bg-[#140f0b]/90 border-[#584531] text-[#bfa98b]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <GameCard
                      cardId={hCard.cardId}
                      stats={hCard.stats}
                      arrows={hCard.arrows}
                      augmentId={hCard.augmentId}
                      owner="player"
                      size="md"
                      showName
                      selected={isSelected && turn === 'player' && !isBeingDragged}
                      onClick={() => {
                        if (Date.now() < suppressHandClickUntilRef.current) return;
                        sound.select();
                        setSelectedHandUid(hCard.uid);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Hover-Only Unclipped Biome Tile Tooltip Portal */}
      {hoveredBiomeTile &&
        !draggingCard &&
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
              className="pointer-events-none fixed z-[200] w-max max-w-[260px] brass-panel rounded-[3px] px-3 py-2 text-xs shadow-[0_14px_34px_rgba(0,0,0,0.9)] space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <span
                  className={`w-5 h-5 rounded-[2px] border flex items-center justify-center shrink-0 ${b.badgeClass}`}
                >
                  <BiomeIcon biome={b.id} className="w-3 h-3" />
                </span>
                <span className={`font-[var(--font-display)] ${b.accentTextClass}`}>
                  {b.name}
                </span>
              </div>
              <div className="text-[11px] text-emerald-300 leading-snug">
                ▲ {b.favorsSummary}
              </div>
              <div className="text-[11px] text-rose-300 leading-snug">
                ▼ {b.hindersSummary}
              </div>
              {p && p.hasEffect && (
                <div
                  className={`pt-1 mt-1 border-t border-[#4b3a26]/80 font-mono text-[11px] font-bold ${
                    p.isPositive ? 'text-emerald-200' : 'text-rose-200'
                  }`}
                >
                  Selected card: {p.isPositive ? '▲' : '▼'} {p.shortTag}
                </div>
              )}
            </div>,
            document.body
          );
        })()}

      {/* Mobile Press-and-Slide Enlarged Card Preview Overlay */}
      {(() => {
        if (!scrubCardUid || draggingCard) return null;
        const scrubbedCard = playerHand.find((c) => c.uid === scrubCardUid);
        if (!scrubbedCard) return null;
        const scrubbedDef = CARD_MAP[scrubbedCard.cardId];
        const scrubbedAug = resolveCardAugment(scrubbedCard.cardId, scrubbedCard.augmentId);
        const typeLabel =
          scrubbedCard.stats.type === 'P'
            ? 'Physical'
            : scrubbedCard.stats.type === 'M'
            ? 'Magical'
            : scrubbedCard.stats.type === 'X'
            ? 'Flexible'
            : 'Assault';
        return (
          <div className="lg:hidden pointer-events-none fixed inset-x-0 bottom-[134px] z-[80] flex flex-col items-center px-3">
            <div
              key={scrubbedCard.uid}
              className="animate-scrub-pop flex flex-col items-center w-full max-w-[290px]"
            >
              <div className="w-[172px] sm:w-[196px] rounded-[4px] shadow-[0_26px_64px_rgba(0,0,0,0.92),0_0_32px_rgba(224,165,68,0.35)]">
                <GameCard
                  cardId={scrubbedCard.cardId}
                  stats={scrubbedCard.stats}
                  arrows={scrubbedCard.arrows}
                  augmentId={scrubbedCard.augmentId}
                  owner="player"
                  size="lg"
                  showName
                  selected
                  disableLongPress
                />
              </div>

              <div className="mt-2 w-full brass-panel rounded-[3px] px-3 py-2 shadow-2xl text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="font-[var(--font-display)] font-bold text-[#f6e3be] truncate">
                    {scrubbedDef?.name ?? 'Card'}
                  </span>
                  <span className="font-mono font-bold text-[#f0c76e] shrink-0">
                    {formatTetraCode(scrubbedCard.stats)}
                  </span>
                </div>

                {scrubbedDef && (
                  <div className="flex justify-center">
                    <CardTraitPills
                      element={scrubbedDef.element}
                      tribe={scrubbedDef.tribe}
                      compact
                    />
                  </div>
                )}

                <div className="text-[11px] text-[#cbb89a] font-mono">
                  Pwr {toHexDigit(scrubbedCard.stats.power)} · {typeLabel} · P.Def{' '}
                  {toHexDigit(scrubbedCard.stats.pDef)} · M.Def{' '}
                  {toHexDigit(scrubbedCard.stats.mDef)}
                </div>

                {scrubbedAug && (
                  <div className="rounded-[2px] bg-[#24162b]/85 border border-violet-400/45 px-2 py-1 text-[10px] text-violet-100 flex items-center justify-center gap-1.5">
                    <Wand2 className="w-3 h-3 text-violet-300 shrink-0" />
                    <span className="truncate">
                      <strong className="text-violet-200">{scrubbedAug.name}:</strong>{' '}
                      {scrubbedAug.shortTag}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  {playerHand.map((c) => (
                    <span
                      key={c.uid}
                      className={`h-1.5 rounded-[1px] transition-all ${
                        c.uid === scrubbedCard.uid ? 'w-4 bg-[#e5b55a]' : 'w-1.5 bg-[#534332]'
                      }`}
                    />
                  ))}
                </div>

                <div className="text-[10px] text-[#e7c47a] font-medium">
                  {turn === 'player' && !isAnimating
                    ? 'Slide up onto board to play · Release to select'
                    : 'Slide across hand to inspect · Release to close'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating 60fps Dragged Card Ghost */}
      {draggingCard && (
        <div
          ref={(el) => {
            dragGhostRef.current = el;
            if (el && !el.style.transform) {
              const initPos = getInitialGhostPos();
              el.style.transform = `translate3d(${initPos.x.toFixed(1)}px, ${initPos.y.toFixed(
                1
              )}px, 0) scale(1.08)`;
            }
          }}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: draggingCard.width,
          }}
          className="drag-card-ghost pointer-events-none fixed z-[90]"
        >
          <GameCard
            cardId={draggingCard.card.cardId}
            stats={draggingCard.card.stats}
            arrows={draggingCard.card.arrows}
            augmentId={draggingCard.card.augmentId}
            owner="player"
            size="sm"
            showName
            disableLongPress
          />
        </div>
      )}

      {/* Match Finished / Carved Reliquary Spoils Modal */}
      {phase === 'finished' && summary && (
        <MatchSpoilsModal
          summary={summary}
          profile={profile}
          currentFighter={currentFighter}
          gameMode={gameMode}
          nextChallengeFighter={nextChallengeFighter}
          onClaimSpoilCard={handleClaimSpoilCard}
          onGoHome={onGoHome}
          onReturnToSetupDetails={() => {
            setPhase('setup');
            setSetupStep('details');
          }}
          onRematch={startMatch}
          onStartNewRandomMatch={() => {
            const next = rollRandomFighter(currentFighter.id);
            startMatchWithFighter(next.id);
          }}
          onChallengeNextFighter={(fighterId) => startMatchWithFighter(fighterId)}
        />
      )}
    </div>
  );
};
