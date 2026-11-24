import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Dices,
  Flag,
  Home,
  Lock,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Wand2,
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
  CARDS,
  MAX_COPIES_PER_CARD,
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
  getTierProgress,
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
  Rarity,
  RolledCardInstance,
} from '../types/game';
import { sound } from '../utils/sound';
import { BiomeIcon, BiomePill, CardTraitPills } from './BiomeBadge';
import { DeckBuilderWorkspace } from './DeckBuilderWorkspace';
import { GameCard } from './GameCard';
import { PlayLaunchIntent } from './HomeView';

type SetupStep = 'mode' | 'details' | 'deck';
type MatchMode = 'arena' | 'quick';

const SPOIL_RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  mythic: 'text-amber-300',
};

interface SpoilComparison {
  verdict: 'upgrade' | 'tradeoff' | 'equal' | 'weaker';
  badgeText: string;
  badgeClass: string;
  tooltip: string;
}

function getInstancePowerScore(card: {
  stats: { power: number; pDef: number; mDef: number };
  arrows: unknown[];
}): number {
  const statTotal = card.stats.power + card.stats.pDef + card.stats.mDef;
  return statTotal * 2 + card.arrows.length * 1.5 + card.stats.power * 0.25;
}

function formatSignedDelta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function compareSpoilToLibrary(
  spoil: HandCard,
  ownedInstances: RolledCardInstance[]
): SpoilComparison | null {
  if (ownedInstances.length === 0) return null;

  let best = ownedInstances[0];
  let bestScore = getInstancePowerScore(best);
  for (let i = 1; i < ownedInstances.length; i++) {
    const score = getInstancePowerScore(ownedInstances[i]);
    if (score > bestScore) {
      best = ownedInstances[i];
      bestScore = score;
    }
  }

  const spoilStatTotal = spoil.stats.power + spoil.stats.pDef + spoil.stats.mDef;
  const bestStatTotal = best.stats.power + best.stats.pDef + best.stats.mDef;
  const statDelta = spoilStatTotal - bestStatTotal;
  const arrowDelta = spoil.arrows.length - best.arrows.length;
  const pwrDelta = spoil.stats.power - best.stats.power;
  const pDefDelta = spoil.stats.pDef - best.stats.pDef;
  const mDefDelta = spoil.stats.mDef - best.stats.mDef;
  const scoreDelta = getInstancePowerScore(spoil) - bestScore;

  const deltaParts: string[] = [];
  if (statDelta !== 0) {
    deltaParts.push(
      `${formatSignedDelta(statDelta)} ${Math.abs(statDelta) === 1 ? 'stat' : 'stats'}`
    );
  }
  if (arrowDelta !== 0) {
    deltaParts.push(
      `${formatSignedDelta(arrowDelta)} ${Math.abs(arrowDelta) === 1 ? 'arrow' : 'arrows'}`
    );
  }
  const deltaSummary = deltaParts.join(' · ');

  const tooltip = `vs your best copy (${formatTetraCode(best.stats)}, ${best.arrows.length} arrows): ATK ${formatSignedDelta(pwrDelta)}, P.DEF ${formatSignedDelta(pDefDelta)}, M.DEF ${formatSignedDelta(mDefDelta)}, Arrows ${formatSignedDelta(arrowDelta)}`;

  if (statDelta >= 0 && arrowDelta >= 0 && (statDelta > 0 || arrowDelta > 0)) {
    return {
      verdict: 'upgrade',
      badgeText: `▲ ${deltaSummary}`,
      badgeClass: 'bg-emerald-950/85 text-emerald-300 border-emerald-400/50',
      tooltip,
    };
  }

  if ((statDelta > 0 && arrowDelta < 0) || (statDelta < 0 && arrowDelta > 0)) {
    return {
      verdict: scoreDelta > 0 ? 'upgrade' : 'tradeoff',
      badgeText: `${scoreDelta > 0 ? '▲' : '⇄'} ${deltaSummary}`,
      badgeClass:
        scoreDelta > 0
          ? 'bg-emerald-950/75 text-emerald-200 border-emerald-400/45'
          : 'bg-sky-950/85 text-sky-300 border-sky-400/45',
      tooltip,
    };
  }

  if (statDelta === 0 && arrowDelta === 0) {
    const identicalSplit = pwrDelta === 0 && pDefDelta === 0 && mDefDelta === 0;
    return {
      verdict: identicalSplit ? 'equal' : 'tradeoff',
      badgeText: identicalSplit ? '= Matches best' : '⇄ Different stat split',
      badgeClass: identicalSplit
        ? 'bg-slate-900/90 text-slate-300 border-slate-700/80'
        : 'bg-sky-950/85 text-sky-300 border-sky-400/45',
      tooltip,
    };
  }

  return {
    verdict: 'weaker',
    badgeText: `▼ ${deltaSummary}`,
    badgeClass: 'bg-rose-950/75 text-rose-300 border-rose-500/40',
    tooltip,
  };
}

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
  onAutoBuildDeck: (strategy: AutoBuildStrategy) => void;
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
  const [callout, setCallout] = useState<{ id: number; text: string } | null>(null);
  const [activeClash, setActiveClash] = useState<ClashDetail | null>(null);
  const [lastBattleLog, setLastBattleLog] = useState<string>(
    'Drag or tap a card from your 7-card hand onto any open socket on the 4×4 board.'
  );
  const [battleHistory, setBattleHistory] = useState<string[]>([]);
  const [playerFlipsCount, setPlayerFlipsCount] = useState(0);
  const [playerCombosCount, setPlayerCombosCount] = useState(0);
  const [summary, setSummary] = useState<MatchSummary | null>(null);

  // Tactile 60fps card drag-and-drop state
  const [draggingCard, setDraggingCard] = useState<{
    card: HandCard;
    width: number;
    originLeft: number;
    originTop: number;
    returning: boolean;
  } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [hoveredBiomeTile, setHoveredBiomeTile] = useState<{
    biome: BiomeType;
    x: number;
    y: number;
    preview: TerrainEvaluation | null;
  } | null>(null);
  const [scrubCardUid, setScrubCardUid] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);
  const boardGridRef = useRef<HTMLDivElement | null>(null);
  const mobileHandFanRef = useRef<HTMLDivElement | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const hoverCellRef = useRef<{ row: number; col: number } | null>(null);
  const suppressHandClickUntilRef = useRef<number>(0);
  const scrubCardUidRef = useRef<string | null>(null);
  const playerHandRef = useRef<HandCard[]>(playerHand);
  const canPlayerPlayRef = useRef<boolean>(false);
  const cachedCellsRef = useRef<
    { row: number; col: number; left: number; right: number; top: number; bottom: number }[]
  >([]);
  const mobileScrubRef = useRef<{
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    startCard: HandCard;
    startRect: { left: number; top: number; width: number; height: number };
    fanLeft: number;
    fanRight: number;
    fanTop: number;
    mode: 'pending' | 'scrubbing';
    activeUid: string;
  } | null>(null);
  const dragPendingRef = useRef<{
    card: HandCard;
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    width: number;
    offsetX: number;
    offsetY: number;
    active: boolean;
    curX: number;
    curY: number;
    targetX: number;
    targetY: number;
    tilt: number;
  } | null>(null);

  playerHandRef.current = playerHand;
  canPlayerPlayRef.current = phase === 'playing' && turn === 'player' && !isAnimating;

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) {
      window.clearTimeout(t);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

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

  useEffect(() => {
    if (phase !== 'playing' || !lastBattleLog) return;
    setBattleHistory((prev) =>
      prev[0] === lastBattleLog ? prev : [lastBattleLog, ...prev].slice(0, 24)
    );
  }, [lastBattleLog, phase]);

  const totalConqueredFighters = useMemo(() => {
    return ALL_FIGHTERS.filter((f) => (profile.fighterWins?.[f.id] ?? 0) > 0).length;
  }, [profile.fighterWins]);

  const handleSelectTier = (tierNum: number) => {
    sound.select();
    setSelectedTierNum(tierNum);
    const tier = LADDER_TIERS.find((t) => t.tierNumber === tierNum);
    if (tier && tier.fighters.length > 0) {
      // Pick first unbeaten fighter in this tier, or the first fighter
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

      // High-Tier & Boss RNG Mythic Drop Roll (Tiers 6-10 & Bosses) with rolled stats & arrows!
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
      sound.place();

      const resolution = resolvePlacement(
        board,
        row,
        col,
        chosen,
        owner
      );

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
        const c = resolution.clashes[0];
        setActiveClash(c);
        const clearClashTimer = window.setTimeout(() => {
          setActiveClash(null);
        }, 1450);
        timersRef.current.push(clearClashTimer);

        const atkHex = toHexDigit(c.attackerVal);
        const defHex = toHexDigit(c.defenderVal);
        const clashSummary = `${c.attackerName} (${atkHex}${c.attackType}) vs ${c.defenderName} (${defHex}) · ${
          c.attackerWon ? `${c.attackerName} wins clash!` : `${c.defenderName} counter-flips!`
        }${comboFlips > 0 ? ` +${comboFlips} Combo!` : ''}${terrainSuffix}${augSuffix}`;
        setLastBattleLog(clashSummary);

        const clashTimer = window.setTimeout(() => {
          sound.clash(c.attackerWon);
        }, 70);
        const soundTimer = window.setTimeout(() => {
          if (comboFlips > 0) sound.combo();
          else sound.flip(resolution.flips.length);
        }, 210);
        timersRef.current.push(clashTimer, soundTimer);

        if (comboFlips > 0) {
          showCallout(`Combo Chain ×${resolution.flips.length}`);
        } else {
          showCallout(
            c.attackerWon
              ? `Clash Won (${atkHex}${c.attackType} vs ${defHex})`
              : `Countered (${atkHex}${c.attackType} vs ${defHex})`
          );
        }
      } else if (unopposedFlips > 0) {
        setActiveClash(null);
        setLastBattleLog(
          `${chosenDef.name} captured ${unopposedFlips} unopposed card${
            unopposedFlips > 1 ? 's' : ''
          }!${terrainSuffix}${augSuffix}`
        );
        const soundTimer = window.setTimeout(() => {
          sound.flip(unopposedFlips);
        }, 110);
        timersRef.current.push(soundTimer);
        showCallout(unopposedFlips > 1 ? `Multi-Capture ×${unopposedFlips}` : 'Unopposed Capture');
      } else if (augCount > 0 && activeAugment) {
        setActiveClash(null);
        setLastBattleLog(
          `${chosenDef.name} activated ${activeAugment.name}: ${activeAugment.shortTag} on ${augCount} card${
            augCount > 1 ? 's' : ''
          }!`
        );
        sound.select();
        showCallout(`${activeAugment.name} (${activeAugment.shortTag})`);
      } else {
        setActiveClash(null);
        setLastBattleLog(
          `${owner === 'player' ? 'You' : currentFighter.name} deployed ${chosenDef.name} (${formatTetraCode(
            chosen.stats
          )})${terrainSuffix}.`
        );
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

  const handleCellClick = (row: number, col: number) => {
    if (phase !== 'playing' || turn !== 'player' || isAnimating) return;
    if (!selectedHandUid) return;
    const cell = board[row]?.[col];
    if (!cell || cell.blocked || cell.card) return;
    setHoverCell(null);
    hoverCellRef.current = null;
    executeMove('player', selectedHandUid, row, col);
  };

  // Clear drag state if turn or match phase ends
  useEffect(() => {
    if (phase !== 'playing') {
      mobileScrubRef.current = null;
      scrubCardUidRef.current = null;
      setScrubCardUid(null);
    }
    if (phase !== 'playing' || turn !== 'player' || isAnimating) {
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      dragPendingRef.current = null;
      setDraggingCard(null);
      setHoverCell(null);
      hoverCellRef.current = null;
    }
  }, [isAnimating, phase, turn]);

  // Global pointer tracking for mobile press-and-slide hand scrubbing + 60fps card drag & spring return
  useEffect(() => {
    const startPhysicsLoop = () => {
      if (dragRafRef.current !== null) return;
      const tick = () => {
        const d = dragPendingRef.current;
        const ghost = dragGhostRef.current;
        if (!d || !d.active) {
          dragRafRef.current = null;
          return;
        }
        const dx = d.targetX - d.curX;
        const dy = d.targetY - d.curY;
        // Smooth follow + subtle velocity-driven tilt
        d.curX += dx * 0.42;
        d.curY += dy * 0.42;
        const targetTilt = Math.max(-14, Math.min(14, dx * 0.55));
        d.tilt += (targetTilt - d.tilt) * 0.28;

        if (ghost) {
          ghost.style.transform = `translate3d(${d.curX.toFixed(1)}px, ${d.curY.toFixed(
            1
          )}px, 0) rotate(${d.tilt.toFixed(2)}deg) scale(1.08)`;
        }
        dragRafRef.current = window.requestAnimationFrame(tick);
      };
      dragRafRef.current = window.requestAnimationFrame(tick);
    };

    const cacheOpenDropCells = () => {
      const cells: typeof cachedCellsRef.current = [];
      if (boardGridRef.current) {
        const nodes = boardGridRef.current.querySelectorAll<HTMLElement>('[data-drop-row]');
        nodes.forEach((node) => {
          const r = Number(node.dataset.dropRow);
          const c = Number(node.dataset.dropCol);
          const rect = node.getBoundingClientRect();
          cells.push({
            row: r,
            col: c,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          });
        });
      }
      cachedCellsRef.current = cells;
    };

    const activateBoardDrag = (
      card: HandCard,
      pointerId: number,
      pointerType: string,
      clientX: number,
      clientY: number,
      originRect: { left: number; top: number; width: number; height: number }
    ) => {
      const ghostWidth = Math.min(Math.max(originRect.width, 96), 124);
      const ghostHeight = (ghostWidth * 7) / 5;
      const offsetX = ghostWidth * 0.5;
      const offsetY = ghostHeight * 0.5;
      const touchLiftY = pointerType === 'touch' ? 28 : 0;

      suppressHandClickUntilRef.current = Date.now() + 450;
      cacheOpenDropCells();

      dragPendingRef.current = {
        card,
        pointerId,
        pointerType,
        startX: clientX,
        startY: clientY,
        originLeft: originRect.left,
        originTop: originRect.top,
        width: ghostWidth,
        offsetX,
        offsetY,
        active: true,
        curX: originRect.left,
        curY: originRect.top,
        targetX: clientX - offsetX,
        targetY: clientY - offsetY - touchLiftY,
        tilt: 0,
      };

      setSelectedHandUid(card.uid);
      setDraggingCard({
        card,
        width: ghostWidth,
        originLeft: originRect.left,
        originTop: originRect.top,
        returning: false,
      });
      sound.select();
      startPhysicsLoop();
    };

    const handlePointerMove = (e: PointerEvent) => {
      // 1. Mobile Press-and-Slide Hand Scrubbing (with seamless slide-up-to-play handoff)
      const s = mobileScrubRef.current;
      if (s && e.pointerId === s.pointerId) {
        const moveDx = e.clientX - s.startX;
        const moveDy = e.clientY - s.startY;
        const dist = Math.hypot(moveDx, moveDy);

        if (s.mode === 'pending') {
          if (dist < 8) return;

          // Pulling straight upward toward the board starts an immediate card drag
          if (
            canPlayerPlayRef.current &&
            moveDy < -10 &&
            Math.abs(moveDy) >= Math.abs(moveDx) * 1.05
          ) {
            mobileScrubRef.current = null;
            if (s.pointerType === 'touch') e.preventDefault();
            activateBoardDrag(
              s.startCard,
              e.pointerId,
              s.pointerType,
              e.clientX,
              e.clientY,
              s.startRect
            );
            return;
          }

          // Sliding across the hand enters scrub-preview mode
          s.mode = 'scrubbing';
          suppressHandClickUntilRef.current = Date.now() + 450;
        }

        if (s.pointerType === 'touch') {
          e.preventDefault();
        }

        // Slide upward out of the hand fan while scrubbing to seamlessly drag that card onto the board
        if (canPlayerPlayRef.current && e.clientY < s.fanTop - 26) {
          const hand = playerHandRef.current;
          const activeCard = hand.find((c) => c.uid === s.activeUid) ?? s.startCard;
          const slotEl = mobileHandFanRef.current?.querySelector<HTMLElement>(
            `[data-hand-uid="${activeCard.uid}"]`
          );
          const slotRect = slotEl
            ? slotEl.getBoundingClientRect()
            : { left: e.clientX - 38, top: s.fanTop, width: 76, height: 106 };

          mobileScrubRef.current = null;
          scrubCardUidRef.current = null;
          setScrubCardUid(null);
          activateBoardDrag(
            activeCard,
            e.pointerId,
            s.pointerType,
            e.clientX,
            e.clientY,
            slotRect
          );
          return;
        }

        // Map pointer X across the fan width into equal, jitter-free card scrub bands
        const hand = playerHandRef.current;
        if (hand.length > 0) {
          const span = Math.max(1, s.fanRight - s.fanLeft);
          const t = Math.max(0, Math.min(0.999, (e.clientX - s.fanLeft) / span));
          const idx = Math.floor(t * hand.length);
          const targetCard = hand[idx];

          if (targetCard && scrubCardUidRef.current !== targetCard.uid) {
            s.activeUid = targetCard.uid;
            scrubCardUidRef.current = targetCard.uid;
            setScrubCardUid(targetCard.uid);
            setSelectedHandUid(targetCard.uid);
            sound.hover();
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(8);
            }
          }
        }
        return;
      }

      // 2. Active Card Drag-and-Drop Tracking
      const d = dragPendingRef.current;
      if (!d || e.pointerId !== d.pointerId) return;

      const moveDx = e.clientX - d.startX;
      const moveDy = e.clientY - d.startY;
      const dist = Math.hypot(moveDx, moveDy);

      if (!d.active) {
        const threshold = d.pointerType === 'touch' ? 11 : 6;
        if (dist < threshold) return;

        d.active = true;
        suppressHandClickUntilRef.current = Date.now() + 450;
        cacheOpenDropCells();

        const touchLiftY = d.pointerType === 'touch' ? 28 : 0;
        d.curX = d.originLeft;
        d.curY = d.originTop;
        d.targetX = e.clientX - d.offsetX;
        d.targetY = e.clientY - d.offsetY - touchLiftY;
        d.tilt = 0;

        setSelectedHandUid(d.card.uid);
        setDraggingCard({
          card: d.card,
          width: d.width,
          originLeft: d.originLeft,
          originTop: d.originTop,
          returning: false,
        });
        sound.select();
        startPhysicsLoop();
      }

      if (d.pointerType === 'touch') {
        e.preventDefault();
      }

      const touchLiftY = d.pointerType === 'touch' ? 28 : 0;
      d.targetX = e.clientX - d.offsetX;
      d.targetY = e.clientY - d.offsetY - touchLiftY;

      // Hit-test pointer against cached open sockets
      const hitY = e.clientY - (d.pointerType === 'touch' ? 18 : 0);
      let matched: { row: number; col: number } | null = null;
      for (const rect of cachedCellsRef.current) {
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          hitY >= rect.top &&
          hitY <= rect.bottom
        ) {
          matched = { row: rect.row, col: rect.col };
          break;
        }
      }

      const prev = hoverCellRef.current;
      if (prev?.row !== matched?.row || prev?.col !== matched?.col) {
        hoverCellRef.current = matched;
        setHoverCell(matched);
        if (matched) {
          sound.hover();
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const s = mobileScrubRef.current;
      if (s && e.pointerId === s.pointerId) {
        if (s.mode === 'scrubbing') {
          suppressHandClickUntilRef.current = Date.now() + 300;
        }
        mobileScrubRef.current = null;
        scrubCardUidRef.current = null;
        setScrubCardUid(null);
        return;
      }

      const d = dragPendingRef.current;
      if (!d || e.pointerId !== d.pointerId) return;

      const wasActive = d.active;
      const dropTarget = hoverCellRef.current;
      const draggedCard = d.card;
      const originLeft = d.originLeft;
      const originTop = d.originTop;
      const width = d.width;

      dragPendingRef.current = null;
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      if (!wasActive) return;

      suppressHandClickUntilRef.current = Date.now() + 350;
      hoverCellRef.current = null;
      setHoverCell(null);

      if (dropTarget) {
        const cell = board[dropTarget.row]?.[dropTarget.col];
        if (cell && !cell.blocked && !cell.card) {
          setDraggingCard(null);
          executeMove('player', draggedCard.uid, dropTarget.row, dropTarget.col);
          return;
        }
      }

      // Spring-return smoothly back to the card's original hand slot
      setDraggingCard({
        card: draggedCard,
        width,
        originLeft,
        originTop,
        returning: true,
      });

      window.requestAnimationFrame(() => {
        if (dragGhostRef.current) {
          dragGhostRef.current.style.transition =
            'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out';
          dragGhostRef.current.style.transform = `translate3d(${originLeft}px, ${originTop}px, 0) rotate(0deg) scale(1)`;
          dragGhostRef.current.style.opacity = '0.88';
        }
      });

      const clearTimer = window.setTimeout(() => {
        setDraggingCard((cur) => (cur?.returning ? null : cur));
      }, 225);
      timersRef.current.push(clearTimer);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, [board, executeMove]);

  const handleMobileFanPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    hCard: HandCard
  ) => {
    if (phase !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cardRect = e.currentTarget.getBoundingClientRect();
    const fanRect = mobileHandFanRef.current?.getBoundingClientRect() ?? cardRect;

    mobileScrubRef.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      startCard: hCard,
      startRect: {
        left: cardRect.left,
        top: cardRect.top,
        width: cardRect.width,
        height: cardRect.height,
      },
      fanLeft: fanRect.left,
      fanRight: fanRect.right,
      fanTop: fanRect.top,
      mode: 'pending',
      activeUid: hCard.uid,
    };
  };

  const handleHandCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, hCard: HandCard) => {
    if (phase !== 'playing' || turn !== 'player' || isAnimating) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ghostWidth = Math.min(Math.max(rect.width, 96), 124);
    const scaleOffsetX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * ghostWidth;
    const ghostHeight = (ghostWidth * 7) / 5;
    const scaleOffsetY = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * ghostHeight;

    dragPendingRef.current = {
      card: hCard,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: ghostWidth,
      offsetX: scaleOffsetX,
      offsetY: scaleOffsetY,
      active: false,
      curX: rect.left,
      curY: rect.top,
      targetX: rect.left,
      targetY: rect.top,
      tilt: 0,
    };
  };

  const handleConcede = () => {
    clearTimers();
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

  // Find next unlocked fighter on the ladder for one-tap progression after a match
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

  // Live tactical Capture / Clash preview when dragging or hovering an open board socket
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

  // Sync setup step when launched from Home CTA (Play a Match / Arena / Quick Random Duel)
  useEffect(() => {
    if (launchNonce === 0) return;
    setPhase('setup');
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

  const playerAvatarCard =
    CARD_MAP[previewDeckHand[0]?.cardId ?? 'ember-imp'] ?? CARD_MAP['ember-imp'];
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];
  const currentTierUnlocked = isTierUnlocked(currentTier.tierNumber, profile.fighterWins ?? {});
  const currentTierProg = getTierProgress(currentTier.tierNumber, profile.fighterWins ?? {});

  // ==================== GUIDED SETUP FLOW (MODE → DETAILS → DECK) ====================
  if (phase === 'setup') {
    const stepOrder: { id: SetupStep; num: number; label: string }[] = [
      { id: 'mode', num: 1, label: 'Mode' },
      { id: 'details', num: 2, label: gameMode === 'quick' ? 'Random Rival' : 'Challenger' },
      { id: 'deck', num: 3, label: 'Deck' },
    ];
    const currentStepIdx = stepOrder.findIndex((s) => s.id === setupStep);

    const handleStepBack = () => {
      sound.select();
      if (setupStep === 'deck') {
        setSetupStep('details');
      } else if (setupStep === 'details') {
        setSetupStep('mode');
      } else {
        onGoHome();
      }
    };

    return (
      <div
        className={`w-full ${
          setupStep === 'deck' ? 'max-w-none' : 'max-w-6xl'
        } mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6`}
      >
        {/* Rugged Forged-Iron Breadcrumb & Back Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleStepBack}
            className="iron-btn inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-[3px] font-[var(--font-display)] text-xs sm:text-sm font-semibold tracking-wide cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#d8a64c]" />
            <span>
              {setupStep === 'mode'
                ? 'Campaign'
                : setupStep === 'details'
                ? 'Choose Mode'
                : 'Change Opponent'}
            </span>
          </button>

          <nav aria-label="Match setup steps" className="flex items-center gap-1.5 sm:gap-2">
            {stepOrder.map((step, idx) => {
              const isCurrent = step.id === setupStep;
              const isCompleted = idx < currentStepIdx;
              const canJump = idx < currentStepIdx;
              return (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    disabled={!canJump}
                    onClick={() => {
                      if (!canJump) return;
                      sound.select();
                      setSetupStep(step.id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] font-[var(--font-display)] text-xs tracking-wide transition-colors ${
                      isCurrent
                        ? 'brass-plaque text-[#f5d593] font-bold'
                        : isCompleted
                        ? 'iron-btn text-[#d9c9ae] hover:text-[#f5d593] cursor-pointer'
                        : 'text-[#6e5f4c] border border-transparent cursor-default'
                    }`}
                  >
                    <span className="font-mono text-[11px]">{step.num}.</span>
                    <span>{step.label}</span>
                  </button>
                  {idx < stepOrder.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-[#66543f] shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* --------------------------------------------------------------- */}
        {/* STEP 1: MODE SELECTION                                          */}
        {/* --------------------------------------------------------------- */}
        {setupStep === 'mode' && (
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f3dfb6] tracking-[0.08em]">
                Choose Battle Mode
              </h1>
              <div className="ornate-divider max-w-[200px] mx-auto" />
              <p className="font-[var(--font-serif)] text-base sm:text-lg text-[#bfa98b]">
                Climb the ranked 10-Tier Arena ladder or jump straight into a one-off exhibition
                against a random opponent.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto pt-2">
              {/* Mode Card 1: Championship Arena */}
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setGameMode('arena');
                  setSetupStep('details');
                }}
                className="group brass-panel riveted-frame rounded-[4px] hover:border-[#b38338] p-6 text-left flex flex-col justify-between gap-6 transition-transform duration-200 hover:-translate-y-1 cursor-pointer"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-[3px] brass-plaque flex items-center justify-center text-[#eab95d]">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-[2px] brass-plaque font-mono text-xs font-bold text-[#f0c76e]">
                      {totalConqueredFighters}/{ALL_FIGHTERS.length} Conquered
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="font-[var(--font-display)] text-xl font-bold tracking-wide text-[#f6dfb0] group-hover:text-[#fde9be] transition-colors">
                      Championship Arena
                    </h2>
                    <p className="font-[var(--font-serif)] text-base text-[#cbb89a] leading-relaxed">
                      Progress through 10 themed sanctuaries on an open 4×4 biome grid, defeat tier
                      bosses, and unlock Mythic drops.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#4b3a26]/70 font-[var(--font-display)] text-xs uppercase tracking-wider font-bold text-[#e9ba62]">
                  <span>Select Tier &amp; Challenger</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* Mode Card 2: One-Off Random Match */}
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setGameMode('quick');
                  rollRandomFighter();
                  setSetupStep('details');
                }}
                className="group iron-panel riveted-frame rounded-[4px] hover:border-[#9e7538] p-6 text-left flex flex-col justify-between gap-6 transition-transform duration-200 hover:-translate-y-1 cursor-pointer"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-[3px] brass-plaque flex items-center justify-center text-[#d8a752]">
                      <Dices className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-[2px] basalt-recess font-mono text-xs font-bold text-[#dfcca9]">
                      4×4 Skirmish
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="font-[var(--font-display)] text-xl font-bold tracking-wide text-[#f2e2c4] group-hover:text-[#f8e1b0] transition-colors">
                      Quick Random Duel
                    </h2>
                    <p className="font-[var(--font-serif)] text-base text-[#cbb89a] leading-relaxed">
                      Draw a surprise opponent from your unlocked ladder tiers for a brisk 4×4 duel
                      with Gold &amp; Spoil rewards.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#3c3024]/80 font-[var(--font-display)] text-xs uppercase tracking-wider font-bold text-[#d8b068]">
                  <span>Roll Random Opponent</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* STEP 2A: CHAMPIONSHIP ARENA DETAILS → SINGLE TABBED COMPONENT   */}
        {/* --------------------------------------------------------------- */}
        {setupStep === 'details' && gameMode === 'arena' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f3dfb6] tracking-[0.06em]">
                  Championship Arena
                </h1>
                <p className="font-[var(--font-serif)] text-base text-[#b7a285] mt-0.5">
                  Choose a tier and challenger tab, then muster your warband.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[3px] brass-plaque text-xs">
                <Crown className="w-4 h-4 text-[#e2b053]" />
                <span className="font-mono font-bold text-[#f0c76e]">
                  {totalConqueredFighters}/{ALL_FIGHTERS.length} Conquered
                </span>
              </div>
            </div>

            {/* Compact 10-Tier Carved Stone Strip */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {LADDER_TIERS.map((tier) => {
                const unlocked = isTierUnlocked(tier.tierNumber, profile.fighterWins ?? {});
                const prog = getTierProgress(tier.tierNumber, profile.fighterWins ?? {});
                const isSelected = tier.tierNumber === selectedTierNum;
                const isCleared = prog.defeated === prog.total;

                return (
                  <button
                    key={tier.tierNumber}
                    type="button"
                    onClick={() => handleSelectTier(tier.tierNumber)}
                    className={`rounded-[3px] px-2 py-2 text-left border transition-colors cursor-pointer ${
                      isSelected
                        ? 'brass-plaque border-[#d9a44b] text-[#f8de9f] shadow-[0_0_14px_rgba(208,148,52,0.22)]'
                        : unlocked
                        ? 'iron-panel text-[#d9c8ac] hover:border-[#7a5d34]'
                        : 'basalt-recess text-[#685a49] opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-[var(--font-display)] text-[11px] font-bold">
                        T{tier.tierNumber}
                      </span>
                      {!unlocked ? (
                        <Lock className="w-3 h-3 text-[#685a49]" />
                      ) : isCleared ? (
                        <Crown className="w-3 h-3 text-[#e5b55a]" />
                      ) : (
                        <span className="font-mono text-[10px] text-[#9b896f]">
                          {prog.defeated}/{prog.total}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Single Unified Tabbed Challenger Dossier */}
            <div className="brass-panel riveted-frame rounded-[4px] overflow-hidden">
              {/* Region Header Bar */}
              <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#4b3a26]/80 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-[#f4dcb0] leading-tight tracking-wide">
                    {currentTier.name}
                  </h2>
                  <p className="font-[var(--font-serif)] italic text-sm text-[#baa587] mt-0.5">
                    {currentTier.regionSubtitle}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-[2px] basalt-recess font-mono text-xs font-semibold ${currentTier.accentColor}`}
                >
                  {currentTier.cardRangeLabel}
                </span>
              </div>

              {/* Notched Iron & Leather Challenger Tabs Bar */}
              <div
                role="tablist"
                aria-label="Tier challengers"
                className="flex items-stretch gap-1.5 px-4 sm:px-6 py-3 bg-[#110d0a]/90 border-b border-[#3f3123] overflow-x-auto"
              >
                {currentTier.fighters.map((fighter) => {
                  const active = fighter.id === currentFighter.id;
                  const winsCount = profile.fighterWins?.[fighter.id] ?? 0;
                  const isConquered = winsCount > 0;
                  const avatar = CARD_MAP[fighter.avatarCardId];

                  return (
                    <button
                      key={fighter.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleSelectFighter(fighter.id)}
                      className={`flex-1 min-w-[126px] rounded-[3px] px-2.5 py-2 border flex items-center gap-2 text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-b from-[#302316] to-[#1e160f] border-[#cf9a42] border-b-2 border-b-[#f0c76e] text-[#fae3b2] shadow-[0_4px_14px_rgba(0,0,0,0.5)]'
                          : 'bg-[#17120e] border-[#362a20] text-[#b7a386] hover:border-[#664e2e] hover:text-[#efe3cd]'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`w-8 h-8 rounded-[2px] overflow-hidden border ${
                            isConquered
                              ? 'border-emerald-500'
                              : active
                              ? 'border-[#e5b55a]'
                              : 'border-[#4a3a2a]'
                          }`}
                        >
                          {avatar && (
                            <img
                              src={getCardThumbUrl(avatar.image)}
                              alt={fighter.name}
                              width={320}
                              height={320}
                              loading="lazy"
                              decoding="async"
                              className={`w-full h-full object-cover ${avatar.artFilter ?? ''}`}
                            />
                          )}
                        </div>
                        {isConquered && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-[2px] bg-emerald-600 text-[#0d0a08] flex items-center justify-center border border-emerald-200">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-[var(--font-display)] text-xs font-bold truncate">
                            {fighter.name}
                          </span>
                          {fighter.isBoss && (
                            <Crown className="w-3 h-3 text-[#e8ba5d] shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-[#968369]">
                          {isConquered ? (
                            <span className="text-emerald-400">{winsCount}W</span>
                          ) : (
                            <span>#{fighter.orderInTier}</span>
                          )}{' '}
                          · <span className="text-[#e7b960]">+{fighter.winGold}g</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Challenger Details Body */}
              <div className="p-5 sm:p-6 space-y-5">
                {!currentTierUnlocked && (
                  <div className="rounded-[3px] bg-[#2a1a10]/85 border border-[#8e5c26] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#f2cfa0]">
                    <span>
                      Defeat{' '}
                      <strong>
                        {
                          LADDER_TIERS.find((t) => t.tierNumber === currentTier.tierNumber - 1)
                            ?.requiredWinsToUnlockNext
                        }{' '}
                        challengers
                      </strong>{' '}
                      in Tier {currentTier.tierNumber - 1} to unlock this tier.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectTier(currentTier.tierNumber - 1)}
                      className="brass-btn px-3 py-1 rounded-[2px] text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Go to Tier {currentTier.tierNumber - 1}
                    </button>
                  </div>
                )}

                {/* Challenger Spotlight */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[3px] overflow-hidden border-2 border-[#b98739] shrink-0 shadow-[0_8px_22px_rgba(0,0,0,0.7)]">
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
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px]">
                      <span className="font-[var(--font-display)] font-semibold uppercase tracking-widest text-[#e2b053]">
                        Challenger #{currentFighter.orderInTier}
                      </span>
                      {currentFighter.isBoss && (
                        <span className="px-2 py-0.5 rounded-[2px] brass-plaque font-[var(--font-display)] font-bold uppercase text-[#f4d084]">
                          Tier Boss
                        </span>
                      )}
                      {(profile.fighterWins?.[currentFighter.id] ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-[2px] bg-emerald-950/90 border border-emerald-500/45 font-mono font-bold text-emerald-300">
                          ✓ Defeated ({profile.fighterWins?.[currentFighter.id]}W)
                        </span>
                      )}
                    </div>
                    <h3 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f7e7c7] leading-tight tracking-wide">
                      {currentFighter.name}
                    </h3>
                    <p className="font-[var(--font-serif)] text-base text-[#cbb89a]">
                      {currentFighter.title}{' '}
                      <span className="text-[#6d5b46]">·</span>{' '}
                      <span className="text-[#ebc77e] italic font-semibold">{currentFighter.specialty}</span>
                    </p>
                  </div>
                </div>

                {/* Carved Basalt Match Specs Ledger */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="basalt-recess rounded-[3px] px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-[var(--font-display)] uppercase tracking-wider text-[11px] text-[#9b886e]">
                      Victory Payout
                    </span>
                    <span className="font-mono font-bold text-[#f0c76e]">
                      +{currentFighter.winGold}g
                      {(profile.fighterWins?.[currentFighter.id] ?? 0) === 0 && (
                        <span className="text-emerald-400">
                          {' '}
                          (+{currentFighter.firstWinBonusGold}g 1st)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="basalt-recess rounded-[3px] px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-[var(--font-display)] uppercase tracking-wider text-[11px] text-[#9b886e]">
                      Spoils Card Pool
                    </span>
                    <span className="font-mono font-semibold text-[#e8d9be]">
                      #{String(currentFighter.minCardNumber).padStart(2, '0')}–#
                      {String(currentFighter.maxCardNumber).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="basalt-recess rounded-[3px] px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-[var(--font-display)] uppercase tracking-wider text-[11px] text-[#9b886e] shrink-0">
                      Signature Cards
                    </span>
                    <span className="text-[#e8d9be] font-medium text-right truncate">
                      {currentFighter.signatureCardIds
                        .map((id) => CARD_MAP[id]?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>

                  <div className="basalt-recess rounded-[3px] px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-[var(--font-display)] uppercase tracking-wider text-[11px] text-[#9b886e] shrink-0">
                      Arena Biomes
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {getFighterBiomes(currentFighter.id).map((b) => (
                        <BiomePill key={b} biome={b} compact />
                      ))}
                    </div>
                  </div>

                  {(currentFighter.mythicDropChance ?? 0) > 0 && (
                    <div className="sm:col-span-2 rounded-[3px] brass-plaque px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="font-[var(--font-display)] uppercase tracking-wider text-[11px] text-[#e9c479] font-semibold">
                        Mythic Bonus Drop
                      </span>
                      <span className="font-mono font-bold text-[#f6d58b]">
                        ★ {Math.round((currentFighter.mythicDropChance ?? 0) * 100)}% Chance on Win
                      </span>
                    </div>
                  )}
                </div>

                {/* Action + Progress Footer */}
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    disabled={!currentTierUnlocked}
                    onClick={() => {
                      sound.select();
                      setSetupStep('deck');
                    }}
                    className={`w-full min-h-[52px] rounded-[3px] font-bold text-sm sm:text-base flex items-center justify-center gap-2 ${
                      currentTierUnlocked
                        ? 'brass-btn cursor-pointer'
                        : 'basalt-recess text-[#6e5f4c] font-[var(--font-display)] cursor-not-allowed'
                    }`}
                  >
                    {currentTierUnlocked ? (
                      <>
                        <span>Challenge {currentFighter.name} · Build Deck</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Unlock Tier {currentTier.tierNumber} First</span>
                      </>
                    )}
                  </button>

                  <div className="font-[var(--font-serif)] text-sm text-[#a69277] text-center">
                    {currentTier.tierNumber < 10
                      ? `Tier Progress: ${currentTierProg.defeated}/${currentTier.requiredWinsToUnlockNext} wins to unlock Tier ${
                          currentTier.tierNumber + 1
                        }`
                      : `Final Sanctum: ${currentTierProg.defeated}/${currentTier.fighters.length} defeated`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* STEP 2B: QUICK RANDOM DUEL DETAILS → CONFIRM                    */}
        {/* --------------------------------------------------------------- */}
        {setupStep === 'details' && gameMode === 'quick' && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] brass-plaque text-[#e9c479] font-[var(--font-display)] uppercase tracking-[0.16em] text-[11px] font-semibold">
                <Dices className="w-3.5 h-3.5 text-[#d8a243]" />
                <span>Quick Random Duel</span>
              </div>
              <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f3dfb6] tracking-wide">
                Your Random Challenger
              </h1>
            </div>

            <div className="brass-panel riveted-frame rounded-[4px] p-6 sm:p-7 space-y-6">
              {/* Ladder-Locked Pool Info + Re-roll */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[3px] basalt-recess text-xs">
                  <Lock className="w-3.5 h-3.5 text-[#d8a64c] shrink-0" />
                  <span className="text-[#cbb89a]">
                    Pool:{' '}
                    <strong className="font-mono text-[#f0c76e]">
                      {unlockedLadderTiers.length === 1
                        ? 'Tier 1'
                        : `Tiers 1–${unlockedLadderTiers[unlockedLadderTiers.length - 1]?.tierNumber ?? 1}`}
                    </strong>{' '}
                    <span className="text-[#88765f]">({unlockedFighters.length} rivals)</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sound.select();
                    rollRandomFighter(currentFighter.id);
                  }}
                  className="iron-btn inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-[3px] font-[var(--font-display)] text-xs font-semibold tracking-wide cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5 text-[#e2b053]" />
                  <span>Re-roll Opponent</span>
                </button>
              </div>

              {/* Rolled Opponent Spotlight */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                <div className="w-24 h-24 rounded-[3px] overflow-hidden border-2 border-[#b98739] shadow-[0_8px_22px_rgba(0,0,0,0.7)] shrink-0">
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

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-[2px] brass-plaque font-mono font-bold text-[#e9c479]">
                      Tier {currentFighter.tierNumber} · {currentTier.name}
                    </span>
                    {currentFighter.isBoss && (
                      <span className="px-2 py-0.5 rounded-[2px] bg-[#3b2210] border border-[#c88c38] font-[var(--font-display)] font-bold text-[#f7d894]">
                        Tier Boss
                      </span>
                    )}
                  </div>
                  <h2 className="font-[var(--font-display)] text-2xl font-bold text-[#f7e7c7] tracking-wide">
                    {currentFighter.name}
                  </h2>
                  <p className="font-[var(--font-serif)] text-base text-[#cbb89a]">
                    {currentFighter.title} — <span className="text-[#ebc77e] italic">{currentFighter.specialty}</span>
                  </p>
                </div>
              </div>

              {/* Match Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                <div className="basalt-recess rounded-[3px] p-3">
                  <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                    Board
                  </div>
                  <div className="font-mono font-bold text-[#efe3cd] mt-0.5">4×4 Open</div>
                </div>
                <div className="basalt-recess rounded-[3px] p-3">
                  <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                    Hands
                  </div>
                  <div className="font-mono font-bold text-[#efe3cd] mt-0.5">
                    {HAND_SIZE} Cards Each
                  </div>
                </div>
                <div className="basalt-recess rounded-[3px] p-3">
                  <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                    Victory Purse
                  </div>
                  <div className="font-mono font-bold text-[#f0c76e] mt-0.5">
                    +{currentFighter.winGold}g
                  </div>
                </div>
                <div className="basalt-recess rounded-[3px] p-3">
                  <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                    Spoils Pool
                  </div>
                  <div className="font-mono font-bold text-[#e5cfa4] mt-0.5">
                    #{String(currentFighter.minCardNumber).padStart(2, '0')}–#
                    {String(currentFighter.maxCardNumber).padStart(2, '0')}
                  </div>
                </div>
              </div>

              {/* Arena Biome Forecast */}
              <div className="basalt-recess rounded-[3px] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-[var(--font-display)] uppercase tracking-wider text-[11px] text-[#9b886e]">
                  Arena Biomes (4 tiles spawned)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {getFighterBiomes(currentFighter.id).map((b) => (
                    <BiomePill key={b} biome={b} compact />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setSetupStep('deck');
                }}
                className="brass-btn w-full min-h-[52px] rounded-[3px] font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Confirm Match · Build Deck</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* STEP 3: 2-PANEL DECK FORGE → START MATCH                        */}
        {/* --------------------------------------------------------------- */}
        {setupStep === 'deck' && (
          <DeckBuilderWorkspace
            profile={profile}
            activeDeck={activeDeck}
            previewDeckHand={previewDeckHand}
            currentFighter={currentFighter}
            gameMode={gameMode}
            onSelectDeckSlot={onSelectDeckSlot}
            onCreateDeck={onCreateDeck}
            onRenameDeck={onRenameDeck}
            onDeleteDeck={onDeleteDeck}
            onToggleDeckCard={onToggleDeckCard}
            onAutoBuildDeck={onAutoBuildDeck}
            onStartMatch={startMatch}
            onGoToGallery={onGoToGallery}
            onOpenRules={onOpenRules}
          />
        )}
      </div>
    );
  }

  // ==================== ACTIVE MATCH VIEW (4x4 TABLETOP · ZERO-SCROLL MOBILE) ====================
  const selectedActiveAugment =
    selectedHandCard
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
          <p className="font-[var(--font-serif)] text-xs lg:text-[13px] text-[#cbb89a] truncate max-w-full lg:max-w-[440px] leading-tight mt-0.5">
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
            title="Field Codex"
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-[3px] text-[#e2b053] hover:text-[#f5d593] hover:bg-[#271e16] transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleConcede}
            aria-label="Leave match"
            title="Retreat from match"
            className="w-7 h-7 lg:min-h-[38px] lg:min-w-[38px] flex items-center justify-center rounded-[3px] iron-btn text-[#b8a58a] hover:text-rose-300 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
          </button>
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
            {/* Unbroken Weathered Stone Battlefield Floor Beneath All 16 Squares */}
            <div
              aria-hidden="true"
              style={{
                backgroundImage: `url(${NEUTRAL_TERRAIN_IMAGE})`,
                backgroundSize: '260px 346px',
                backgroundRepeat: 'repeat',
              }}
              className="pointer-events-none absolute inset-0 opacity-80 brightness-[0.68] contrast-[1.08]"
            />
            {/* Soft Moody Vignette Unifying the Whole Map */}
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
                      {/* Feathered Top-Down Biome Feature Blended Directly Into the Stone Battlefield */}
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

                      {/* Subtle Carved Tactical Socket Depth */}
                      <div className="pointer-events-none absolute inset-0 rounded-[4px] shadow-[inset_0_1px_8px_rgba(0,0,0,0.48)]" />

                      {/* Subtle Drop Glow Only When Actively Targeting */}
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

              {/* Selected Card Live Matchups Against This Board's Active Biomes */}
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
              Drag or click card → tile
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
              {playerHand.map((hCard) => {
                const isSelected = hCard.uid === selectedHandUid;
                const isBeingDragged = draggingCard?.card.uid === hCard.uid;
                return (
                  <div
                    key={hCard.uid}
                    onPointerDown={(e) => handleHandCardPointerDown(e, hCard)}
                    className={`w-auto transition-opacity duration-150 ${
                      phase === 'playing' && turn === 'player' && !isAnimating
                        ? 'cursor-grab active:cursor-grabbing'
                        : ''
                    } ${isBeingDragged ? 'opacity-25 scale-95' : ''}`}
                  >
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
                        c.uid === scrubbedCard.uid
                          ? 'w-4 bg-[#e5b55a]'
                          : 'w-1.5 bg-[#534332]'
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
              const d = dragPendingRef.current;
              const initX = d ? d.curX : draggingCard.originLeft;
              const initY = d ? d.curY : draggingCard.originTop;
              el.style.transform = `translate3d(${initX.toFixed(1)}px, ${initY.toFixed(
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

      {/* ==================== MATCH FINISHED / CARVED RELIQUARY SPOILS MODAL ==================== */}
      {phase === 'finished' && summary && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/90 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-result-title"
        >
          <div className="w-full max-w-5xl lg:max-w-6xl max-h-[94dvh] flex flex-col rounded-t-[6px] sm:rounded-[5px] brass-panel riveted-frame shadow-[0_32px_90px_rgba(0,0,0,0.92)] overflow-hidden">
            <div className="sm:hidden w-10 h-1 rounded-full bg-[#6d573e] mx-auto mt-2.5" />

            {/* Spacious Result Header */}
            <div className="px-6 py-5 border-b border-[#4c3b27]/85 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-[3px] border flex items-center justify-center shrink-0 ${
                    summary.winner === 'player'
                      ? 'brass-plaque text-[#f0c76e]'
                      : summary.winner === 'draw'
                      ? 'iron-panel text-[#cbb89a]'
                      : 'bg-[#361515] border-[#8c3636] text-rose-300'
                  }`}
                >
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h2
                    id="match-result-title"
                    className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f6e1b5] tracking-wide"
                  >
                    {summary.isPerfect
                      ? `Perfect Victory! (${summary.playerScore}–0)`
                      : summary.winner === 'player'
                      ? `Victory over ${currentFighter.name}`
                      : summary.winner === 'draw'
                      ? 'Hard-Fought Draw'
                      : `Defeated by ${currentFighter.name}`}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                    <span className="font-[var(--font-serif)] text-sm text-[#b39e81]">
                      {gameMode === 'quick' ? 'Quick Random Duel' : `Tier ${currentFighter.tierNumber} Championship`}
                    </span>
                    {summary.isFirstVictory && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>First-Time Conquest!</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-[3px] basalt-recess font-mono text-2xl font-bold tabular-nums">
                  <span className="text-[#78aef0]">{summary.playerScore}</span>
                  <span className="text-[#5e4d3a] mx-2">–</span>
                  <span className="text-rose-400">{summary.rivalScore}</span>
                </div>
                <div className="px-4 py-2 rounded-[3px] brass-plaque font-mono text-lg font-bold tabular-nums text-[#f0c76e] flex items-center gap-1.5">
                  <Coins className="w-5 h-5 text-[#dca342]" />
                  <span>+{summary.totalGold + summary.spoilBonusGold}g</span>
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {/* Compact Gold Breakdown Plaques */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-[3px] basalt-recess text-[#cbb89a]">
                  Match Purse:{' '}
                  <strong className="font-mono text-[#f0c76e]">+{summary.baseGold}g</strong>
                </span>
                {summary.firstWinBonus > 0 && (
                  <span className="px-3 py-1.5 rounded-[3px] bg-emerald-950/60 border border-emerald-500/45 text-emerald-200">
                    First Win:{' '}
                    <strong className="font-mono">+{summary.firstWinBonus}g</strong>
                  </span>
                )}
                {summary.dominanceBonus > 0 && (
                  <span className="px-3 py-1.5 rounded-[3px] basalt-recess text-[#cbb89a]">
                    {summary.isPerfect ? 'Perfect Bonus' : 'Dominance'}:{' '}
                    <strong className="font-mono text-[#f0c76e]">+{summary.dominanceBonus}g</strong>
                  </span>
                )}
                {summary.comboBonus > 0 && (
                  <span className="px-3 py-1.5 rounded-[3px] basalt-recess text-[#cbb89a]">
                    Combos:{' '}
                    <strong className="font-mono text-[#f0c76e]">+{summary.comboBonus}g</strong>
                  </span>
                )}
                {summary.spoilBonusGold > 0 && (
                  <span className="px-3 py-1.5 rounded-[3px] basalt-recess text-[#cbb89a]">
                    5/5 Auto-Sell:{' '}
                    <strong className="font-mono text-[#f0c76e]">+{summary.spoilBonusGold}g</strong>
                  </span>
                )}
              </div>

              {/* Spacious Spoils Grid on Victory */}
              {summary.winner === 'player' && (
                <div className="space-y-4">
                  {summary.bonusMythicDrop && (
                    <div className="rounded-[3px] brass-plaque border-[#d9a243] px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm text-[#f7dca2] shadow-lg">
                      <Crown className="w-5 h-5 text-[#eab859] shrink-0" />
                      <span>
                        <strong>Mythic RNG Drop Triggered!</strong>{' '}
                        {CARD_MAP[summary.bonusMythicDrop.cardId]?.name} (
                        {formatTetraCode(summary.bonusMythicDrop.stats)}) materialized in the spoils pool!
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-[var(--font-display)] text-base sm:text-lg font-bold text-[#f3d492] tracking-wide">
                      {summary.spoilClaimedUid
                        ? 'Rolled Spoil Claimed'
                        : `Claim 1 Rolled Card from ${currentFighter.name}’s Hand`}
                    </h3>
                    {!summary.spoilClaimedUid && (
                      <span className="font-[var(--font-serif)] italic text-sm text-[#b39e81]">
                        Click any card below to claim its rolled stats &amp; arrows
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {summary.rivalHandCards.map((sCard) => {
                      const cardDef = CARD_MAP[sCard.cardId];
                      const isClaimed = summary.spoilClaimedUid === sCard.uid;
                      const ownedInstances = profile.inventory[sCard.cardId] ?? [];
                      const ownedCopies = profile.owned[sCard.cardId] ?? ownedInstances.length;
                      const comparison = !summary.spoilClaimedUid
                        ? compareSpoilToLibrary(sCard, ownedInstances)
                        : null;
                      const isBonusMythic = summary.bonusMythicDrop?.uid === sCard.uid;
                      const lockedOut = Boolean(summary.spoilClaimedUid) && !isClaimed;
                      const isUpgradeHighlight =
                        !summary.spoilClaimedUid &&
                        !isBonusMythic &&
                        comparison?.verdict === 'upgrade' &&
                        ownedCopies < MAX_COPIES_PER_CARD;
                      return (
                        <div
                          key={sCard.uid}
                          className={`rounded-[4px] p-3 border flex flex-col gap-2.5 transition-colors ${
                            isClaimed
                              ? 'bg-emerald-950/35 border-emerald-500/75'
                              : isBonusMythic && !summary.spoilClaimedUid
                              ? 'brass-plaque border-[#dca342]'
                              : isUpgradeHighlight
                              ? 'bg-emerald-950/25 border-emerald-500/50'
                              : 'basalt-recess'
                          } ${lockedOut ? 'opacity-45' : ''}`}
                        >
                          <GameCard
                            cardId={sCard.cardId}
                            stats={sCard.stats}
                            arrows={sCard.arrows}
                            augmentId={sCard.augmentId}
                            owner={isClaimed ? 'player' : 'neutral'}
                            size="lg"
                            showName={false}
                            selected={isClaimed || (isBonusMythic && !summary.spoilClaimedUid)}
                            disabled={lockedOut}
                            onClick={
                              summary.spoilClaimedUid
                                ? undefined
                                : () => handleClaimSpoilCard(sCard)
                            }
                          />

                          {/* Full, Un-Squashed Card Name & Library Comparison Readout */}
                          <div className="space-y-1.5 text-center px-0.5">
                            <div className="font-[var(--font-display)] text-sm font-bold text-[#f3e5cb] leading-snug">
                              {cardDef?.name ?? 'Card'}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-xs">
                              {cardDef && (
                                <span
                                  className={`capitalize font-semibold ${SPOIL_RARITY_TEXT[cardDef.rarity]}`}
                                >
                                  {cardDef.rarity}
                                </span>
                              )}
                              <span className="text-[#5e4d3a]">·</span>
                              <span className="font-mono font-bold text-[#f0c76e]">
                                {formatTetraCode(sCard.stats)}
                              </span>
                            </div>
                            {comparison && (
                              <div className="flex justify-center">
                                <span
                                  title={comparison.tooltip}
                                  className={`inline-flex items-center rounded-[2px] border px-2 py-0.5 font-mono text-[11px] font-semibold leading-tight cursor-help ${comparison.badgeClass}`}
                                >
                                  {comparison.badgeText}
                                </span>
                              </div>
                            )}
                            <div
                              className={`text-xs font-semibold ${
                                isClaimed
                                  ? 'text-emerald-400'
                                  : isBonusMythic
                                  ? 'text-[#f0c76e]'
                                  : ownedCopies === 0
                                  ? 'text-emerald-400'
                                  : 'text-[#9e8a70]'
                              }`}
                            >
                              {isClaimed
                                ? summary.spoilWasOverflow
                                  ? `Auto-Sold (+${summary.spoilBonusGold}g)`
                                  : `Claimed (${ownedCopies}/${MAX_COPIES_PER_CARD})`
                                : isBonusMythic
                                ? '★ Mythic Bonus Drop'
                                : ownedCopies === 0
                                ? '★ New Card'
                                : ownedCopies >= MAX_COPIES_PER_CARD
                                ? `Owned: ${ownedCopies}/${MAX_COPIES_PER_CARD} · Auto-sells`
                                : `Owned: ${ownedCopies}/${MAX_COPIES_PER_CARD}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {summary.spoilClaimedCardId && (
                    <div className="rounded-[3px] bg-emerald-950/55 border border-emerald-500/45 px-4 py-2.5 text-xs sm:text-sm text-emerald-200 font-medium">
                      {CARD_MAP[summary.spoilClaimedCardId]?.name}{' '}
                      {summary.spoilWasOverflow
                        ? `was already at ${MAX_COPIES_PER_CARD}/${MAX_COPIES_PER_CARD} copies and auto-sold for +${summary.spoilBonusGold}g!`
                        : `added to your collection (${
                            profile.owned[summary.spoilClaimedCardId] ?? 1
                          }/${MAX_COPIES_PER_CARD} copies owned)!`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Forged Footer Actions */}
            <div className="px-6 py-4 border-t border-[#4b3a26]/85 bg-[#120d0a] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.select();
                    onGoHome();
                  }}
                  className="iron-btn min-h-[44px] px-4 rounded-[3px] font-[var(--font-display)] font-semibold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-4 h-4 text-[#d8a64c]" />
                  <span>Campaign</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.select();
                    setPhase('setup');
                    setSetupStep('details');
                  }}
                  className="iron-btn min-h-[44px] px-4 rounded-[3px] font-[var(--font-display)] font-semibold text-xs sm:text-sm cursor-pointer"
                >
                  {gameMode === 'quick' ? 'Opponent Setup' : 'Arena Ladder'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={startMatch}
                  className="iron-btn min-h-[44px] px-5 rounded-[3px] font-[var(--font-display)] text-[#f0c76e] font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Rematch</span>
                </button>
                {gameMode === 'quick' ? (
                  <button
                    type="button"
                    onClick={() => {
                      sound.select();
                      const next = rollRandomFighter(currentFighter.id);
                      startMatchWithFighter(next.id);
                    }}
                    className="brass-btn min-h-[44px] px-5 rounded-[3px] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Dices className="w-4 h-4" />
                    <span>New Random Match</span>
                  </button>
                ) : (
                  nextChallengeFighter && (
                    <button
                      type="button"
                      onClick={() => startMatchWithFighter(nextChallengeFighter.id)}
                      className="brass-btn min-h-[44px] px-5 rounded-[3px] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Next: {nextChallengeFighter.name}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
