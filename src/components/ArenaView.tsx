import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Eye,
  Flag,
  MousePointerClick,
  Sparkles,
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
  POWER_CARD_MAP,
  getPowerCardsForTier,
  getPowerRelicAffectedCells,
  isCampaignTierCleared,
  isPowerCardId,
} from '../data/powerCards';
import {
  DEFAULT_BOARD_SCALE,
  buildOpponentHand,
  buildPlayerHand,
  chooseAiMove,
  chooseMatchStarter,
  createBoard,
  getBoardScaleSpec,
  getScores,
  isBoardFull,
  resolvePlacement,
} from '../engine/triadEngine';
import { AutoBuildStrategy } from '../store/useProfile';
import {
  BiomeType,
  BoardCell,
  BoardScale,
  ClashDetail,
  DeckSlot,
  HandCard,
  MatchPhase,
  MatchSummary,
  Owner,
  PlayerProfile,
  Rarity,
} from '../types/game';
import { sound } from '../utils/sound';
import { ArenaSetupFlow, MatchMode, SetupStep } from './arena/ArenaSetupFlow';
import { CardSlamFlare } from './arena/CardSlamFlare';
import { MatchSpoilsModal } from './arena/MatchSpoilsModal';
import { useBoardDrag } from './arena/useBoardDrag';
import { BattlefieldMonolithFrame } from './BattlefieldChrome';
import { BiomeIcon, CardTraitPills } from './BiomeBadge';
import { GameCard } from './GameCard';
import { PlayLaunchIntent } from './HomeView';

interface ArenaViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  initialIntent?: PlayLaunchIntent;
  launchNonce?: number;
  onSelectBoardScale: (scale: BoardScale) => void;
  onSelectDeckSlot: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
  onSetDeckPowerCard: (powerCardId: string | null) => { ok: boolean; message?: string };
  onToggleDeckCard: (
    uidOrCardId: string,
    preferredSlotIndex?: number
  ) => { ok: boolean; message?: string; slotIndex?: number };
  onClearDeck: () => void;
  onAutoBuildDeck: (
    strategy: AutoBuildStrategy,
    targetBiomes?: BiomeType[],
    onlyEmptySlots?: boolean
  ) => void;
  onRecordMatch: (params: {
    fighterId: string;
    winner: 'player' | 'rival' | 'draw';
    goldEarned: number;
    flipsMade: number;
    combosMade?: number;
    isPerfect?: boolean;
    usedCardIds: string[];
  }) => void;
  onClaimSpoil: (
    spoilCard: HandCard
  ) => { isNew: boolean; wasOverflow: boolean; bonusGold: number; copyCount: number };
  onSellCardInstance: (
    instanceUid: string
  ) => { ok: boolean; goldEarned: number; cardName?: string; message?: string };
  onSellExtraCopies: (
    specificCardId?: string
  ) => { soldCount: number; goldEarned: number };
  onGoHome: () => void;
  onGoToGallery: () => void;
  onOpenRules: () => void;
  onToggleSound?: () => void;
  onToggleClickToPlace?: () => void;
  onMatchActiveChange?: (active: boolean) => void;
  onMatchThemeChange?: (theme: 'tavern' | 'duel' | 'boss') => void;
}

const HAND_HOTKEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'];

export const ArenaView: React.FC<ArenaViewProps> = ({
  profile,
  activeDeck,
  initialIntent = 'arena',
  launchNonce = 0,
  onSelectBoardScale,
  onSelectDeckSlot,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onSetDeckPowerCard,
  onToggleDeckCard,
  onClearDeck,
  onAutoBuildDeck,
  onRecordMatch,
  onClaimSpoil,
  onSellCardInstance,
  onSellExtraCopies,
  onGoHome,
  onGoToGallery,
  onOpenRules,
  onToggleSound,
  onToggleClickToPlace,
  onMatchActiveChange,
  onMatchThemeChange,
}) => {
  const [setupStep, setSetupStep] = useState<SetupStep>('details');
  const [gameMode, setGameMode] = useState<MatchMode>(
    initialIntent === 'quick' ? 'quick' : 'arena'
  );
  const [selectedTierNum, setSelectedTierNum] = useState<number>(1);
  const [selectedFighterId, setSelectedFighterId] = useState<string>('t1-f1');
  const { openPreview } = useCardPreview();
  const [phase, setPhase] = useState<MatchPhase>('setup');

  // Active match state
  const [matchScale, setMatchScale] = useState<BoardScale>(
    profile.boardScale ?? DEFAULT_BOARD_SCALE
  );
  const [board, setBoard] = useState<BoardCell[][]>([]);
  const [playerHand, setPlayerHand] = useState<HandCard[]>([]);
  const [rivalHand, setRivalHand] = useState<HandCard[]>([]);
  const [initialPlayerIds, setInitialPlayerIds] = useState<string[]>([]);
  const [initialRivalCards, setInitialRivalCards] = useState<HandCard[]>([]);
  const [turn, setTurn] = useState<Owner>('player');
  const [selectedHandUid, setSelectedHandUid] = useState<string | null>(null);
  const [hoveredDesktopHandIdx, setHoveredDesktopHandIdx] = useState<number | null>(null);
  const [hoveredPlacedRelicPos, setHoveredPlacedRelicPos] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirmingRetreat, setConfirmingRetreat] = useState(false);
  const [callout, setCallout] = useState<{ id: number; text: string } | null>(null);
  const [activeClash, setActiveClash] = useState<ClashDetail | null>(null);
  const [boardShakeRarity, setBoardShakeRarity] = useState<Rarity | null>(null);
  const [cellFlareMap, setCellFlareMap] = useState<
    Record<string, { id: number; rarity: Rarity; isRelic: boolean }>
  >({});
  const [lastBattleLog, setLastBattleLog] = useState<string>(
    'Drag a card from your right-hand fan onto any open battlefield socket · Click a card in hand to inspect full buffs.'
  );
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
    if (phase !== 'playing') {
      onMatchThemeChange('tavern');
    } else if (currentFighter.isBoss || currentFighter.tierNumber >= 9) {
      onMatchThemeChange('boss');
    } else {
      onMatchThemeChange('duel');
    }
  }, [phase, currentFighter.isBoss, currentFighter.tierNumber, onMatchThemeChange]);

  useEffect(() => {
    onMatchActiveChange?.(phase === 'playing');
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

      const chosenScale = profile.boardScale ?? DEFAULT_BOARD_SCALE;
      const spec = getBoardScaleSpec(chosenScale);
      const rawSlots = activeDeck.slots ?? activeDeck.cards;
      const activeUnitRefs = rawSlots
        .slice(0, spec.unitSlots)
        .filter((s): s is string => Boolean(s));
      if (activeUnitRefs.length < spec.unitSlots) return;

      clearTimers();
      setConfirmingRetreat(false);
      setHoveredDesktopHandIdx(null);
      setHoveredPlacedRelicPos(null);
      setSelectedTierNum(fighter.tierNumber);
      setSelectedFighterId(fighter.id);
      setMatchScale(chosenScale);

      const pHand = buildPlayerHand(
        activeUnitRefs,
        profile.inventory,
        chosenScale,
        activeDeck.powerSlot,
        profile.fighterWins
      );
      const rHand = buildOpponentHand(fighter.id, chosenScale);
      const regionBiomes = getFighterBiomes(fighter.id);
      const freshBoard = createBoard(regionBiomes, chosenScale);
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
      setInitialPlayerIds(pHand.filter((h) => !h.isPowerCard).map((h) => h.cardId));
      setInitialRivalCards(rHand.filter((h) => !h.isPowerCard));
      setTurn(starter);
      setSelectedHandUid(null);
      setActiveClash(null);
      setBoardShakeRarity(null);
      setCellFlareMap({});
      setPlayerFlipsCount(0);
      setPlayerCombosCount(0);
      setSummary(null);
      setIsAnimating(false);
      setLastBattleLog(
        `${spec.shortLabel} Duel vs ${fighter.name} (${spec.biomeCount} Biome tiles: ${uniqueSpawnedBiomes}) · ${
          starter === 'player'
            ? 'Your move!'
            : `${fighter.name} leads — you hold the final move.`
        }`
      );
      setPhase('playing');
      sound.place();
      showCallout(starter === 'player' ? 'Your Turn First' : 'Rival Leads');
    },
    [
      activeDeck.cards,
      activeDeck.powerSlot,
      activeDeck.slots,
      clearTimers,
      currentFighter,
      profile.boardScale,
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
      const isPerfect =
        totalCardsPlayed > 0 && scores.player === totalCardsPlayed && scores.rival === 0;

      const winner: Owner | 'draw' =
        scores.player > scores.rival
          ? 'player'
          : scores.rival > scores.player
          ? 'rival'
          : 'draw';

      const prevWinsMap = profile.fighterWins ?? {};
      const prevWinsOnFighter = prevWinsMap[currentFighter.id] ?? 0;
      const isFirstVictory = winner === 'player' && prevWinsOnFighter === 0;

      // Check if this victory completes all 5 challengers of `currentFighter.tierNumber` for the first time!
      const wasTierAlreadyCleared = isCampaignTierCleared(
        currentFighter.tierNumber,
        prevWinsMap
      );
      const simulatedNextWins =
        winner === 'player'
          ? { ...prevWinsMap, [currentFighter.id]: prevWinsOnFighter + 1 }
          : prevWinsMap;
      const newlyUnlockedPowerIds =
        winner === 'player' &&
        !wasTierAlreadyCleared &&
        isCampaignTierCleared(currentFighter.tierNumber, simulatedNextWins)
          ? getPowerCardsForTier(currentFighter.tierNumber).map((p) => p.id)
          : [];

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
        combosMade,
        isPerfect,
        usedCardIds: playerOrigIds,
      });

      const claimableRivalUnits = rivalOrigCards.filter((c) => !c.isPowerCard);
      const spoilPool: HandCard[] = bonusMythicDrop
        ? [bonusMythicDrop, ...claimableRivalUnits]
        : claimableRivalUnits;

      setSummary({
        fighterId: currentFighter.id,
        boardScale: matchScale,
        winner,
        playerScore: scores.player,
        rivalScore: scores.rival,
        isPerfect,
        isFirstVictory,
        newlyUnlockedPowerIds,
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
    [currentFighter, matchScale, onRecordMatch, profile.fighterWins, profile.owned]
  );

  const executeMove = useCallback(
    (owner: Owner, handUid: string, row: number, col: number) => {
      const hand = owner === 'player' ? playerHand : rivalHand;
      const idx = hand.findIndex((h) => h.uid === handUid);
      if (idx === -1) return;
      const chosen = hand[idx];
      const chosenUnitDef = CARD_MAP[chosen.cardId];
      const chosenPowerDef = POWER_CARD_MAP[chosen.cardId];
      const displayName = chosenPowerDef?.name ?? chosenUnitDef?.name ?? 'Card';

      if (!board[row]?.[col] || board[row][col].blocked || board[row][col].card) return;

      setIsAnimating(true);
      setConfirmingRetreat(false);
      setHoveredDesktopHandIdx(null);
      setHoveredPlacedRelicPos(null);

      const slamRarity: Rarity =
        chosenPowerDef?.rarity ?? chosenUnitDef?.rarity ?? 'common';
      const colsCount = board[0]?.length ?? 6;
      const slamPan = colsCount > 1 ? (col / (colsCount - 1)) * 0.7 - 0.35 : 0;
      sound.placeSlab(slamRarity, Boolean(chosenPowerDef), slamPan);

      const slamId = Date.now() + Math.random();
      const cellKey = `${row}-${col}`;
      setBoardShakeRarity(slamRarity);
      setCellFlareMap((prev) => ({
        ...prev,
        [cellKey]: {
          id: slamId,
          rarity: slamRarity,
          isRelic: Boolean(chosenPowerDef),
        },
      }));

      const clearShakeTimer = window.setTimeout(() => {
        setBoardShakeRarity(null);
      }, 420);
      const clearFlareTimer = window.setTimeout(() => {
        setCellFlareMap((prev) => {
          if (prev[cellKey]?.id !== slamId) return prev;
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });
      }, 1220);
      timersRef.current.push(clearShakeTimer, clearFlareTimer);

      const resolution = resolvePlacement(board, row, col, chosen, owner);

      const nextHand = hand.filter((h) => h.uid !== handUid);
      const nextPlayerHand = owner === 'player' ? nextHand : playerHand;
      const nextRivalHand = owner === 'rival' ? nextHand : rivalHand;

      setBoard(resolution.nextBoard);
      if (owner === 'player') {
        setPlayerHand(nextPlayerHand);
        setSelectedHandUid(null);
      } else {
        setRivalHand(nextRivalHand);
      }

      if (chosenPowerDef) {
        setActiveClash(null);
        const affectedCount = resolution.augments.length;
        setLastBattleLog(
          `${owner === 'player' ? 'You' : currentFighter.name} anchored ${
            chosenPowerDef.name
          } (${chosenPowerDef.shortTag})${
            affectedCount > 0 ? ` — affecting ${affectedCount} unit${affectedCount > 1 ? 's' : ''}!` : '!'
          }`
        );
        if (affectedCount > 0) {
          const hasDebuff = resolution.augments.some((a) => !a.isBuff);
          const relicSoundTimer = window.setTimeout(() => sound.augment(hasDebuff), 95);
          timersRef.current.push(relicSoundTimer);
        }
        showCallout(`${chosenPowerDef.name} (${chosenPowerDef.badgeLabel})`);
      } else {
        const comboFlips = resolution.flips.filter((f) => f.reason === 'combo').length;
        const unopposedFlips = resolution.flips.filter(
          (f) => f.reason === 'unopposed'
        ).length;
        const placedCardAfter = resolution.nextBoard[row][col].card;
        const placedMod = placedCardAfter?.terrainMod;
        const terrainSuffix = placedMod
          ? ` · ${BIOME_META[placedMod.biome].shortName} (${placedMod.label})`
          : '';
        const relicSuffix = placedCardAfter?.relicAuraMod
          ? ` · Relic (${placedCardAfter.relicAuraMod.label})`
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

          const clashSummaries = resolution.clashes.map((c, clashIdx) => {
            const atkHex = toHexDigit(c.attackerVal);
            const defHex = toHexDigit(c.defenderVal);
            const isLast = clashIdx === resolution.clashes.length - 1;
            return `${c.attackerName} (${atkHex}${c.attackType}) vs ${
              c.defenderName
            } (${defHex}): ${c.attackerWon ? 'Won' : 'Countered'}${
              isLast && comboFlips > 0 ? ` +${comboFlips} Combo!` : ''
            }`;
          });
          setLastBattleLog(
            `${clashSummaries.join(' · ')}${terrainSuffix}${relicSuffix}${augSuffix}`
          );

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
          setLastBattleLog(
            `${displayName} captured ${unopposedFlips} unopposed card${
              unopposedFlips > 1 ? 's' : ''
            }!${terrainSuffix}${relicSuffix}${augSuffix}`
          );
          const soundTimer = window.setTimeout(() => {
            sound.flip(unopposedFlips);
          }, 110);
          timersRef.current.push(soundTimer);
          showCallout(
            unopposedFlips > 1 ? `Multi-Capture ×${unopposedFlips}` : 'Unopposed Capture'
          );
        } else if (augCount > 0 && activeAugment) {
          setActiveClash(null);
          setLastBattleLog(
            `${displayName} activated ${activeAugment.name}: ${activeAugment.shortTag} on ${augCount} card${
              augCount > 1 ? 's' : ''
            }!`
          );
          const isDebuffAug = activeAugment.scope === 'adjacent_rivals';
          const augSoundTimer = window.setTimeout(() => {
            sound.augment(isDebuffAug);
          }, 95);
          timersRef.current.push(augSoundTimer);
          showCallout(`${activeAugment.name} (${activeAugment.shortTag})`);
        } else {
          setActiveClash(null);
          setLastBattleLog(
            `${
              owner === 'player' ? 'You' : currentFighter.name
            } deployed ${displayName}${terrainSuffix}${relicSuffix}.`
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
            const nextOwner: Owner = owner === 'player' ? 'rival' : 'player';
            const nextOwnerHand =
              nextOwner === 'player' ? nextPlayerHand : nextRivalHand;
            setTurn(nextOwnerHand.length > 0 ? nextOwner : owner);
            setIsAnimating(false);
          }
        }, settleDelay);
        timersRef.current.push(t);
        return;
      }

      // Power Relic settle transition
      const allCardsPlayedAfterRelic =
        (nextPlayerHand.length === 0 && nextRivalHand.length === 0) ||
        isBoardFull(resolution.nextBoard);

      const relicTimer = window.setTimeout(() => {
        if (allCardsPlayedAfterRelic) {
          finishMatch(
            resolution.nextBoard,
            playerFlipsCount,
            playerCombosCount,
            initialRivalCards,
            initialPlayerIds
          );
        } else {
          const nextOwner: Owner = owner === 'player' ? 'rival' : 'player';
          const nextOwnerHand =
            nextOwner === 'player' ? nextPlayerHand : nextRivalHand;
          setTurn(nextOwnerHand.length > 0 ? nextOwner : owner);
          setIsAnimating(false);
        }
      }, 300);
      timersRef.current.push(relicTimer);
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

  const handleExecutePlayerMove = useCallback(
    (uid: string, row: number, col: number) => {
      executeMove('player', uid, row, col);
    },
    [executeMove]
  );

  const clickToPlaceEnabled = Boolean(profile.clickToPlace);

  useEffect(() => {
    if (!clickToPlaceEnabled) {
      setSelectedHandUid(null);
    }
  }, [clickToPlaceEnabled]);

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
    clickToPlace: clickToPlaceEnabled,
    onSelectHandUid: setSelectedHandUid,
    onExecutePlayerMove: handleExecutePlayerMove,
    timersRef,
  });

  // Automated Rival AI Turn
  useEffect(() => {
    if (phase !== 'playing' || turn !== 'rival' || isAnimating) return;
    if (rivalHand.length === 0) {
      if (playerHand.length > 0 && !isBoardFull(board)) {
        setTurn('player');
      }
      return;
    }

    const thinkTimer = window.setTimeout(() => {
      const move = chooseAiMove(board, rivalHand, currentFighter.id);
      if (move && rivalHand[move.handIndex]) {
        executeMove('rival', rivalHand[move.handIndex].uid, move.row, move.col);
      }
    }, 680);

    timersRef.current.push(thinkTimer);
    return () => window.clearTimeout(thinkTimer);
  }, [board, currentFighter.id, executeMove, isAnimating, phase, playerHand.length, rivalHand, turn]);

  // Desktop Hand Hotkeys (1-9, 0, -) & Escape to cancel Retreat / selection
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

      if (e.key === 'Escape') {
        if (confirmingRetreat) {
          e.preventDefault();
          setConfirmingRetreat(false);
          return;
        }
        if (selectedHandUid) {
          e.preventDefault();
          setSelectedHandUid(null);
          return;
        }
      }

      const hotkeyIdx = HAND_HOTKEY_LABELS.indexOf(e.key);
      if (hotkeyIdx !== -1 && playerHand[hotkeyIdx]) {
        const targetCard = playerHand[hotkeyIdx];
        e.preventDefault();
        sound.select();
        setSelectedHandUid((cur) => (cur === targetCard.uid ? null : targetCard.uid));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmingRetreat, phase, playerHand, selectedHandUid]);

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

  const selectedHandCard = useMemo(
    () => playerHand.find((c) => c.uid === selectedHandUid) ?? null,
    [playerHand, selectedHandUid]
  );

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

  // Live Relic Aura Tile Highlighting when dragging/aiming a Power Relic OR hovering a placed Relic!
  const relicHighlightSet = useMemo(() => {
    const set = new Set<string>();
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    if (rows === 0 || cols === 0) return set;

    const activeDragOrSel = draggingCard?.card ?? selectedHandCard;
    if (
      activeDragOrSel &&
      (activeDragOrSel.isPowerCard || isPowerCardId(activeDragOrSel.cardId)) &&
      hoverCell
    ) {
      const pDef = POWER_CARD_MAP[activeDragOrSel.cardId];
      if (pDef) {
        for (const pt of getPowerRelicAffectedCells(
          rows,
          cols,
          hoverCell.row,
          hoverCell.col,
          pDef
        )) {
          set.add(`${pt.row}-${pt.col}`);
        }
      }
      return set;
    }

    if (hoveredPlacedRelicPos) {
      const placed =
        board[hoveredPlacedRelicPos.row]?.[hoveredPlacedRelicPos.col]?.card;
      if (placed?.isRelic) {
        const pDef = POWER_CARD_MAP[placed.cardId];
        if (pDef) {
          for (const pt of getPowerRelicAffectedCells(
            rows,
            cols,
            hoveredPlacedRelicPos.row,
            hoveredPlacedRelicPos.col,
            pDef
          )) {
            set.add(`${pt.row}-${pt.col}`);
          }
        }
      }
    }
    return set;
  }, [board, draggingCard?.card, hoverCell, hoveredPlacedRelicPos, selectedHandCard]);

  const openHandCardPreview = useCallback(
    (hCard: HandCard) => {
      sound.select();
      if (hCard.isPowerCard || isPowerCardId(hCard.cardId)) {
        openPreview({
          cardId: hCard.cardId,
          arrows: hCard.arrows,
          owner: 'player',
        });
        return;
      }
      openPreview({
        cardId: hCard.cardId,
        stats: hCard.stats,
        baseStats: hCard.stats,
        arrows: hCard.arrows,
        augmentId: hCard.augmentId,
        owner: 'player',
        arenaBiomes: activeBoardBiomes.map(([biome, count]) => ({ biome, count })),
      });
    },
    [activeBoardBiomes, openPreview]
  );

  const setupScale = profile.boardScale ?? DEFAULT_BOARD_SCALE;
  const previewDeckHand = useMemo(
    () =>
      buildPlayerHand(
        activeDeck.cards,
        profile.inventory,
        setupScale,
        activeDeck.powerSlot,
        profile.fighterWins
      ),
    [
      activeDeck.cards,
      activeDeck.powerSlot,
      profile.fighterWins,
      profile.inventory,
      setupScale,
    ]
  );

  const unlockedLadderTiers = useMemo(
    () =>
      LADDER_TIERS.filter((t) =>
        isTierUnlocked(t.tierNumber, profile.fighterWins ?? {})
      ),
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
      const picked =
        filtered[Math.floor(Math.random() * filtered.length)] ?? unlockedFighters[0];
      setSelectedTierNum(picked.tierNumber);
      setSelectedFighterId(picked.id);
      return picked;
    },
    [unlockedFighters]
  );

  useEffect(() => {
    setPhase('setup');
    setConfirmingRetreat(false);
    setSetupStep('details');
    if (initialIntent === 'quick') {
      setGameMode('quick');
      rollRandomFighter();
    } else {
      setGameMode('arena');
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
        onSelectBoardScale={onSelectBoardScale}
        onSelectTier={handleSelectTier}
        onSelectFighter={handleSelectFighter}
        onRollRandomFighter={rollRandomFighter}
        onSelectDeckSlot={onSelectDeckSlot}
        onCreateDeck={onCreateDeck}
        onRenameDeck={onRenameDeck}
        onDeleteDeck={onDeleteDeck}
        onSetDeckPowerCard={onSetDeckPowerCard}
        onToggleDeckCard={onToggleDeckCard}
        onClearDeck={onClearDeck}
        onAutoBuildDeck={onAutoBuildDeck}
        onSellCardInstance={onSellCardInstance}
        onSellExtraCopies={onSellExtraCopies}
        onStartMatch={startMatch}
        onGoHome={onGoHome}
        onGoToGallery={onGoToGallery}
        onOpenRules={onOpenRules}
      />
    );
  }

  // ==================== WIDESCREEN BATTLEFIELD + RIGHT-SIDE VERTICAL ARC FAN ====================
  const matchSpec = getBoardScaleSpec(matchScale);
  const maxExpectedRivalCards =
    matchSpec.unitSlots +
    (currentFighter.isBoss || currentFighter.tierNumber >= 2 ? 1 : 0);
  const playerAvatarCard =
    CARD_MAP[previewDeckHand[0]?.cardId ?? 'ember-imp'] ?? CARD_MAP['ember-imp'];
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];

  const boardFitClass =
    matchScale === '7x3'
      ? 'board-fit-7x3'
      : matchScale === '6x4'
      ? 'board-fit-6x4'
      : 'board-fit-6x3';

  const boardGridColsClass = matchSpec.cols === 7 ? 'grid-cols-7' : 'grid-cols-6';

  const mobileHandCardClass =
    playerHand.length >= 10
      ? 'w-[58px] sm:w-[70px] -ml-[26px] sm:-ml-[18px] first:ml-0'
      : playerHand.length >= 8
      ? 'w-[64px] sm:w-[76px] -ml-[22px] sm:-ml-[14px] first:ml-0'
      : playerHand.length >= 6
      ? 'w-[70px] sm:w-[82px] -ml-[16px] sm:-ml-[8px] first:ml-0'
      : 'w-[74px] sm:w-[88px] ml-1 first:ml-0';

  return (
    <div className="h-full w-full overflow-hidden flex flex-col px-2.5 sm:px-4 lg:px-6 pt-2 pb-1.5 lg:py-2.5 gap-2">
      {/* Compact Top Battlefield Header */}
      <div className="shrink-0 iron-panel px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 z-20">
        {/* Player Portrait + Score Seal */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 card-weathered-rim overflow-hidden border-2 border-[#4d84c4] shadow-[0_0_12px_rgba(59,130,246,0.35)]">
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
            <span className="organic-seal absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-b from-[#3b72b5] to-[#1e3d66] flex items-center justify-center font-mono text-[11px] font-bold tabular-nums text-white shadow">
              {scores.player}
            </span>
          </div>
          <div className="hidden sm:block">
            <div className="font-[var(--font-display)] text-xs font-bold tracking-wider text-[#bcd9f7]">
              You
            </div>
            <div className="text-[10.5px] text-[#9b896f] truncate max-w-[140px]">
              {activeDeck.name} · {matchSpec.shortLabel}
            </div>
          </div>
        </div>

        {/* Center Turn Banner, Active Biomes & 1-Line Combat Status */}
        <div className="flex flex-col items-center text-center min-w-0 flex-1 px-1">
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-full">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm font-[var(--font-display)] font-bold tracking-[0.12em] truncate ${
                turn === 'player' ? 'text-[#f2cc7b]' : 'text-[#eb8686]'
              }`}
            >
              <Swords className="w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0" />
              <span>
                {turn === 'player'
                  ? 'YOUR TURN'
                  : `${currentFighter.name.toUpperCase()}’S TURN`}
              </span>
            </span>

            {activeBoardBiomes.length > 0 && (
              <div className="hidden md:inline-flex items-center gap-1">
                {activeBoardBiomes.map(([biome, count]) => {
                  const meta = BIOME_META[biome];
                  return (
                    <span
                      key={biome}
                      title={`${meta.name} (×${count}) — ▲ ${meta.favorsSummary} · ▼ ${meta.hindersSummary}`}
                      className={`organic-tag inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono cursor-help ${meta.badgeClass}`}
                    >
                      <BiomeIcon biome={biome} className="w-2.5 h-2.5 shrink-0" />
                      <span>{meta.shortName}</span>
                      {count > 1 && <span className="opacity-80">×{count}</span>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <p className="font-[var(--font-serif)] text-xs lg:text-[13px] text-[#cbb89a] truncate max-w-full lg:max-w-[680px] leading-tight mt-0.5">
            {lastBattleLog}
          </p>
        </div>

        {/* Rival Hand Pips + Score + Accessibility Toggle + Retreat */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex flex-col items-end gap-0.5"
            title={`${currentFighter.name} has ${rivalHand.length} cards left in hand`}
            aria-label={`Rival has ${rivalHand.length} cards remaining`}
          >
            <span className="text-[9px] sm:text-[10px] font-mono font-semibold text-rose-300/90 leading-none">
              {rivalHand.length} in hand
            </span>
            <div className="flex items-center gap-[2px]">
              {Array.from({ length: maxExpectedRivalCards }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-[4.5px] sm:w-[5.5px] h-[9px] sm:h-[11px] border transition-opacity ${
                    idx < rivalHand.length
                      ? 'bg-gradient-to-b from-rose-500 to-rose-900 border-rose-300/70 opacity-100'
                      : 'bg-[#1c1510] border-[#3d3024] opacity-30'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="hidden xl:block text-right">
            <div className="font-[var(--font-display)] text-xs font-bold tracking-wider text-[#f1b4b4]">
              {currentFighter.name}
            </div>
            <div className="text-[10.5px] text-[#9b896f]">
              T{currentFighter.tierNumber} · {currentFighter.title}
            </div>
          </div>

          <div className="relative">
            <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 card-weathered-rim overflow-hidden border-2 border-[#b84646] shadow-[0_0_12px_rgba(220,38,38,0.35)]">
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
            <span className="organic-seal absolute -bottom-1 -left-1 w-5 h-5 bg-gradient-to-b from-[#b53a3a] to-[#691c1c] flex items-center justify-center font-mono text-[11px] font-bold tabular-nums text-white shadow">
              {scores.rival}
            </span>
          </div>

          {onToggleClickToPlace && (
            <button
              type="button"
              onClick={onToggleClickToPlace}
              aria-pressed={clickToPlaceEnabled}
              aria-label={
                clickToPlaceEnabled
                  ? 'Disable Click Card then Click Tile accessibility placement'
                  : 'Enable Click Card then Click Tile accessibility placement'
              }
              title={
                clickToPlaceEnabled
                  ? 'Click-to-Place ON (Click card to select, click tile to place · Right-click or tap Eye to inspect)'
                  : 'Accessibility: Enable Click Card → Click Tile placement (Default: Drag to Place · Click Card to Inspect)'
              }
              className={`w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center cursor-pointer transition-colors ${
                clickToPlaceEnabled
                  ? 'brass-btn text-[#1b1106]'
                  : 'iron-btn text-[#b8a58a] hover:text-[#f2d394]'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={profile.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              className="md:hidden w-7 h-7 flex items-center justify-center text-[#a59277] hover:text-[#efe3cd] cursor-pointer"
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
            className="md:hidden w-7 h-7 flex items-center justify-center text-[#e2b053] hover:text-[#f5d593] cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>

          {confirmingRetreat ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={handleConcede}
                className="crimson-btn min-h-[28px] lg:min-h-[32px] px-2.5 font-[var(--font-display)] text-[10px] lg:text-xs font-bold tracking-wider uppercase cursor-pointer"
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
                className="iron-btn w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center text-[#cbb89a] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                sound.latch(true);
                setConfirmingRetreat(true);
              }}
              aria-label="Exit or retreat from match"
              title="Exit / Retreat from match"
              className="md:hidden min-h-[28px] px-2.5 flex items-center gap-1 crimson-btn text-[10px] font-[var(--font-display)] font-bold uppercase tracking-wider cursor-pointer"
            >
              <Flag className="w-3 h-3" />
              <span>Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN HORIZONTAL STAGE: FULL-HEIGHT BATTLEFIELD (LEFT/CENTER) + VERTICAL ARC FAN (RIGHT) */}
      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
        {/* BATTLEFIELD STAGE (100% Vertical Height on Desktop!) */}
        <div className="mobile-board-stage desktop-board-stage flex-1 min-w-0 min-h-0 w-full h-full relative z-10 flex items-center justify-center py-0.5">
          {callout && (
            <div
              key={callout.id}
              className="pointer-events-none absolute top-2 z-40 animate-callout"
            >
              <div className="brass-panel px-5 py-1.5">
                <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-[#fae1a7] tracking-[0.1em]">
                  {callout.text}
                </span>
              </div>
            </div>
          )}

          {activeClash && (
            <div className="pointer-events-none absolute bottom-3 z-40 animate-callout">
              <div className="brass-panel px-4 py-2 flex items-center gap-2.5 text-xs">
                <span className="font-[var(--font-display)] font-bold text-[#9bc6f5]">
                  {activeClash.attackerName}
                </span>
                <span className="font-mono font-bold px-2 py-0.5 brass-plaque text-[#f5d284]">
                  {toHexDigit(activeClash.attackerVal)}
                  {activeClash.attackType} vs {toHexDigit(activeClash.defenderVal)}
                </span>
                <span className="font-[var(--font-display)] font-bold text-[#f2a0a0]">
                  {activeClash.defenderName}
                </span>
              </div>
            </div>
          )}

          <div
            className={`arena-monolith-frame relative ${boardFitClass} p-1.5 sm:p-2 lg:p-3 ${
              boardShakeRarity ? `animate-board-shake-${boardShakeRarity}` : ''
            }`}
          >
            <BattlefieldMonolithFrame />

            <div className="arena-monolith-bed relative p-1 sm:p-1.5 lg:p-2">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div
                  style={{
                    backgroundImage: `url(${NEUTRAL_TERRAIN_IMAGE})`,
                    backgroundSize: '260px 346px',
                    backgroundRepeat: 'repeat',
                  }}
                  className="absolute inset-0 opacity-82 brightness-[0.68] contrast-[1.08]"
                />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_90%_at_50%_50%,rgba(12,9,6,0.06)_0%,rgba(9,7,5,0.62)_100%)]" />
                <div className="arena-atmosphere arena-atmosphere-glow" />
                <div className="arena-atmosphere arena-atmosphere-dust" />
                <div className="arena-atmosphere arena-atmosphere-edge" />
              </div>

              <div
                ref={boardGridRef}
                className={`battlefield-grid relative z-10 grid ${boardGridColsClass} gap-1 sm:gap-1.5 lg:gap-2`}
              >
                {board.map((row, rIdx) =>
                  row.map((cell, cIdx) => {
                    const key = `${rIdx}-${cIdx}`;
                    const isOpenSocket =
                      phase === 'playing' &&
                      turn === 'player' &&
                      !isAnimating &&
                      !cell.card;
                    const canClickPlaceHere = isOpenSocket && Boolean(selectedHandUid);
                    const biomeMeta = cell.terrain ? BIOME_META[cell.terrain] : null;
                    const activePreviewCard = draggingCard?.card ?? selectedHandCard;
                    const activePreviewDef =
                      phase === 'playing' &&
                      turn === 'player' &&
                      !isAnimating &&
                      activePreviewCard &&
                      !activePreviewCard.isPowerCard
                        ? CARD_MAP[activePreviewCard.cardId]
                        : undefined;
                    const terrainPreview =
                      !cell.card && cell.terrain && activePreviewDef
                        ? evaluateTerrainEffect(cell.terrain, activePreviewDef)
                        : null;
                    const isRelicAuraTarget = relicHighlightSet.has(key);

                    if (cell.card) {
                      const placedCard = cell.card;
                      const cellFlare = cellFlareMap[key];
                      return (
                        <div
                          key={key}
                          onMouseEnter={() => {
                            if (placedCard.isRelic) {
                              setHoveredPlacedRelicPos({ row: rIdx, col: cIdx });
                            }
                          }}
                          onMouseLeave={() => {
                            if (placedCard.isRelic) {
                              setHoveredPlacedRelicPos((cur) =>
                                cur?.row === rIdx && cur?.col === cIdx ? null : cur
                              );
                            }
                          }}
                          className={`battlefield-occupied-stage relative aspect-[5/7] transition-transform ${
                            biomeMeta
                              ? `battlefield-occupied-${biomeMeta.id}`
                              : 'battlefield-occupied-neutral'
                          } ${cellFlare ? 'z-30' : ''} ${
                            isRelicAuraTarget
                              ? 'ring-2 ring-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.55)] z-20 scale-[1.02]'
                              : ''
                          }`}
                        >
                          {cellFlare && (
                            <CardSlamFlare
                              key={cellFlare.id}
                              rarity={cellFlare.rarity}
                              isRelic={cellFlare.isRelic}
                            />
                          )}
                          <GameCard
                            className="relative z-10"
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
                            showName
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
                                relicAuraMod: placedCard.relicAuraMod,
                                lastAugmented: placedCard.lastAugmented,
                              });
                            }}
                          />
                          {biomeMeta && !placedCard.isRelic && (
                            <span
                              aria-label={`${biomeMeta.name} tile`}
                              className={`organic-seal pointer-events-none absolute -top-1 -left-1 z-30 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-md ${biomeMeta.badgeClass}`}
                            >
                              <BiomeIcon
                                biome={biomeMeta.id}
                                className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                              />
                            </span>
                          )}
                        </div>
                      );
                    }

                    const isDropTarget =
                      hoverCell?.row === rIdx && hoverCell?.col === cIdx && isOpenSocket;
                    const isDragActive = Boolean(draggingCard && !draggingCard.returning);

                    return (
                      <button
                        key={key}
                        type="button"
                        data-drop-row={isOpenSocket ? rIdx : undefined}
                        data-drop-col={isOpenSocket ? cIdx : undefined}
                        aria-disabled={!canClickPlaceHere && !isDragActive}
                        onMouseEnter={(e) => {
                          if (biomeMeta && !isDragActive) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pad = 128;
                            const clampedX =
                              typeof window !== 'undefined'
                                ? Math.max(
                                    pad,
                                    Math.min(
                                      window.innerWidth - pad,
                                      rect.left + rect.width / 2
                                    )
                                  )
                                : rect.left + rect.width / 2;
                            setHoveredBiomeTile({
                              biome: biomeMeta.id,
                              x: clampedX,
                              y: rect.top - 8,
                              preview: terrainPreview,
                            });
                          }
                          if (canClickPlaceHere && !isDragActive) {
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
                          if (canClickPlaceHere) {
                            handleCellClick(rIdx, cIdx);
                          }
                        }}
                        aria-label={
                          biomeMeta
                            ? `${biomeMeta.name} tile at row ${rIdx + 1}, column ${cIdx + 1}`
                            : `Stone ground tile at row ${rIdx + 1}, column ${cIdx + 1}`
                        }
                        className={`battle-stone-socket battlefield-slab group relative aspect-[5/7] border transition-all duration-150 overflow-hidden bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          biomeMeta ? `battlefield-biome-${biomeMeta.id}` : 'battlefield-neutral-slab'
                        } ${
                          isDropTarget
                            ? 'border-[#f3c569] ring-2 ring-[#e5b353]/80 shadow-[0_0_24px_rgba(235,176,68,0.45)] scale-[1.03] cursor-pointer z-20'
                            : isRelicAuraTarget
                            ? 'border-sky-300/90 ring-2 ring-sky-400/75 bg-sky-400/15 shadow-[0_0_18px_rgba(56,189,248,0.4)] z-20'
                            : isDragActive && isOpenSocket
                            ? 'border-[#d6a348]/45 bg-amber-500/[0.05]'
                            : canClickPlaceHere
                            ? 'border-[#d8c098]/[0.24] hover:border-[#e5b55a]/80 cursor-pointer active:scale-[0.97]'
                            : 'border-[#d8c098]/[0.11] cursor-default'
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
                                opacity: 0.96,
                              }}
                              className={`battlefield-biome-art pointer-events-none absolute inset-0 w-full h-full object-cover select-none transition-transform duration-500 ${
                                isDropTarget ? 'scale-[1.06]' : 'group-hover:scale-[1.04]'
                              }`}
                            />
                            <div
                              style={{ background: biomeMeta.tileBlendGlow }}
                              className="battlefield-biome-glow pointer-events-none absolute inset-0"
                            />
                          </>
                        )}

                        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_8px_rgba(0,0,0,0.48)]" />

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
        </div>

        {/* DESKTOP RIGHT-SIDE VERTICAL ARC-FANNED HAND (lg+) */}
        <aside
          aria-label="Your battle hand"
          onMouseLeave={() => setHoveredDesktopHandIdx(null)}
          className="hidden lg:flex shrink-0 w-[148px] xl:w-[168px] 2xl:w-[186px] h-full flex-col items-center justify-center pr-1.5 select-none relative z-40"
        >
          <div className="flex flex-col items-center justify-center py-2">
            {playerHand.map((hCard, idx) => {
              const isSelected = hCard.uid === selectedHandUid;
              const isHovered = hoveredDesktopHandIdx === idx;
              const isAboveHovered =
                hoveredDesktopHandIdx !== null && idx < hoveredDesktopHandIdx;
              const isBelowHovered =
                hoveredDesktopHandIdx !== null && idx > hoveredDesktopHandIdx;
              const isBeingDragged = draggingCard?.card.uid === hCard.uid;
              const isRelic = Boolean(hCard.isPowerCard || isPowerCardId(hCard.cardId));

              const centerOffset = idx - (playerHand.length - 1) / 2;
              const restRotate = -centerOffset * 2.1;
              const restPushRight = Math.abs(centerOffset) * 3.8;
              const lifted = (isHovered || (isSelected && turn === 'player')) && !isBeingDragged;
              const overlapTop =
                idx === 0
                  ? '0px'
                  : playerHand.length >= 10
                  ? '-96px'
                  : playerHand.length >= 8
                  ? '-82px'
                  : playerHand.length >= 6
                  ? '-62px'
                  : playerHand.length >= 4
                  ? '-34px'
                  : '-10px';

              return (
                <div
                  key={hCard.uid}
                  onMouseEnter={() => setHoveredDesktopHandIdx(idx)}
                  onPointerDown={(e) => handleHandCardPointerDown(e, hCard)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openHandCardPreview(hCard);
                  }}
                  style={{
                    marginTop: overlapTop,
                    zIndex: isHovered ? 70 : lifted ? 60 : idx + 10,
                    transform: isBeingDragged
                      ? 'scale(0.94)'
                      : isHovered
                      ? 'translate3d(-30px, 0, 0) scale(1.16) rotate(0deg)'
                      : lifted
                      ? 'translate3d(-20px, 0, 0) scale(1.09) rotate(0deg)'
                      : isAboveHovered
                      ? `translate3d(${restPushRight}px, -18px, 0) rotate(${restRotate}deg)`
                      : isBelowHovered
                      ? `translate3d(${restPushRight}px, 24px, 0) rotate(${restRotate}deg)`
                      : `translate3d(${restPushRight}px, 0, 0) rotate(${restRotate}deg)`,
                    transition:
                      'transform 190ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease',
                    filter: lifted
                      ? isRelic
                        ? 'drop-shadow(0 18px 26px rgba(0, 0, 0, 0.92)) drop-shadow(0 0 12px rgba(56, 189, 248, 0.65))'
                        : 'drop-shadow(0 18px 26px rgba(0, 0, 0, 0.92)) drop-shadow(0 0 10px rgba(245, 190, 78, 0.55))'
                      : 'drop-shadow(-6px 8px 14px rgba(0, 0, 0, 0.72))',
                  }}
                  className={`relative w-[96px] xl:w-[108px] 2xl:w-[118px] shrink-0 will-change-transform ${
                    phase === 'playing' && turn === 'player' && !isAnimating
                      ? 'cursor-grab active:cursor-grabbing'
                      : 'cursor-pointer'
                  } ${isBeingDragged ? 'opacity-25' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`organic-seal pointer-events-none absolute top-1 left-1 z-30 w-4 h-4 font-mono text-[8.5px] font-bold flex items-center justify-center shadow ${
                      isSelected && turn === 'player'
                        ? 'bg-[#d8a243] text-[#171008]'
                        : isRelic
                        ? 'bg-sky-950/95 text-sky-200'
                        : 'bg-[#19120c]/95 text-[#cbb89a]'
                    }`}
                  >
                    {HAND_HOTKEY_LABELS[idx] ?? idx + 1}
                  </span>

                  {clickToPlaceEnabled && (isSelected || isHovered) && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        openHandCardPreview(hCard);
                      }}
                      aria-label="Inspect full card and biome buffs"
                      title="Inspect full card & biome buffs (or Right-Click)"
                      className="organic-seal absolute top-1 right-1 z-30 w-5 h-5 bg-[#1b130c]/95 text-[#f2d394] hover:text-white flex items-center justify-center shadow cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  )}

                  <GameCard
                    cardId={hCard.cardId}
                    stats={hCard.stats}
                    arrows={hCard.arrows}
                    augmentId={hCard.augmentId}
                    owner="player"
                    size="sm"
                    showName
                    selected={false}
                    disableLongPress
                    onClick={() => {
                      if (Date.now() < suppressHandClickUntilRef.current) return;
                      if (clickToPlaceEnabled) {
                        sound.select();
                        setSelectedHandUid((cur) => (cur === hCard.uid ? null : hCard.uid));
                      } else {
                        openHandCardPreview(hCard);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </aside>

        {/* MOBILE / TABLET BOTTOM OVERLAPPING FAN (< lg) */}
        <div className="flex lg:hidden shrink-0 h-[108px] sm:h-[122px] w-full items-end justify-center pb-safe relative z-40">
          <div
            ref={mobileHandFanRef}
            className="flex items-end justify-center pb-1 px-1 touch-none select-none w-full"
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openHandCardPreview(hCard);
                  }}
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
                      ? '-translate-y-3 scale-[1.1]'
                      : scrubCardUid
                      ? 'opacity-65'
                      : ''
                  }`}
                >
                  {clickToPlaceEnabled && isSelected && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        openHandCardPreview(hCard);
                      }}
                      aria-label="Inspect full card and biome buffs"
                      title="Inspect full card & biome buffs"
                      className="organic-seal absolute -top-2 right-0.5 z-40 w-5 h-5 bg-[#1b130c] text-[#f2d394] flex items-center justify-center shadow-md cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  )}

                  <GameCard
                    cardId={hCard.cardId}
                    stats={hCard.stats}
                    arrows={hCard.arrows}
                    augmentId={hCard.augmentId}
                    owner="player"
                    size="sm"
                    showName={false}
                    selected={false}
                    disableLongPress
                    className={
                      activeHighlight
                        ? 'drop-shadow-[0_0_10px_rgba(245,190,78,0.85)]'
                        : ''
                    }
                    onClick={() => {
                      if (Date.now() < suppressHandClickUntilRef.current) return;
                      if (clickToPlaceEnabled) {
                        sound.select();
                        setSelectedHandUid((cur) => (cur === hCard.uid ? null : hCard.uid));
                      } else {
                        openHandCardPreview(hCard);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
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
              className="pointer-events-none fixed z-[200] w-max max-w-[260px] brass-panel px-3.5 py-2.5 text-xs space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <span
                  className={`organic-seal w-5 h-5 flex items-center justify-center shrink-0 ${b.badgeClass}`}
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
        const scrubbedPower = POWER_CARD_MAP[scrubbedCard.cardId];
        const scrubbedDef = CARD_MAP[scrubbedCard.cardId];
        const scrubbedAug = resolveCardAugment(
          scrubbedCard.cardId,
          scrubbedCard.augmentId
        );
        const typeLabel =
          scrubbedCard.stats.type === 'P'
            ? 'Physical'
            : scrubbedCard.stats.type === 'M'
            ? 'Magical'
            : scrubbedCard.stats.type === 'X'
            ? 'Flexible'
            : 'Assault';
        return (
          <div className="lg:hidden pointer-events-none fixed inset-x-0 bottom-[126px] z-[80] flex flex-col items-center px-3">
            <div
              key={scrubbedCard.uid}
              className="animate-scrub-pop flex flex-col items-center w-full max-w-[290px]"
            >
              <div className="w-[168px] sm:w-[192px] shadow-[0_26px_64px_rgba(0,0,0,0.92),0_0_32px_rgba(224,165,68,0.35)]">
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

              <div className="mt-2 w-full brass-panel px-3 py-2 text-center space-y-1">
                {scrubbedPower ? (
                  <>
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      <span className="font-[var(--font-display)] font-bold text-sky-200 truncate">
                        {scrubbedPower.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-200 font-mono font-semibold">
                      {scrubbedPower.shortTag}
                    </div>
                    <div className="text-[10.5px] text-[#cbb89a] leading-snug">
                      {scrubbedPower.patternLabel}
                    </div>
                  </>
                ) : (
                  <>
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
                      <div className="organic-tag bg-[#24162b]/90 px-2.5 py-1 text-[10px] text-violet-100 flex items-center justify-center gap-1.5">
                        <Wand2 className="w-3 h-3 text-violet-300 shrink-0" />
                        <span className="truncate">
                          <strong className="text-violet-200">{scrubbedAug.name}:</strong>{' '}
                          {scrubbedAug.shortTag}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="text-[10px] text-[#e7c47a] font-medium pt-0.5">
                  {turn === 'player' && !isAnimating
                    ? clickToPlaceEnabled
                      ? 'Slide up onto board to play · Release to select'
                      : 'Slide up onto board to play · Tap card to inspect full buffs'
                    : 'Slide across hand to inspect · Tap card for full details'}
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
              el.style.transform = `translate3d(${initPos.x.toFixed(
                1
              )}px, ${initPos.y.toFixed(1)}px, 0) scale(1.08)`;
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

      {/* Match Finished / Spoils Modal */}
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
