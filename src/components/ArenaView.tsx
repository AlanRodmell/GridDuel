import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Flag,
  HelpCircle,
  Lock,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  CARD_MAP,
  CARDS,
  MAX_COPIES_PER_CARD,
  formatTetraCode,
  rollCardArrows,
  rollCardStats,
  toHexDigit,
} from '../data/cards';
import {
  ALL_FIGHTERS,
  FIGHTER_MAP,
  LADDER_TIERS,
  getTierProgress,
  isTierUnlocked,
} from '../data/ladder';
import {
  HAND_SIZE,
  buildOpponentHand,
  buildPlayerHand,
  chooseAiMove,
  createBoard,
  getScores,
  isBoardFull,
  resolvePlacement,
} from '../engine/triadEngine';
import {
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
import { GameCard } from './GameCard';

interface ArenaViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  onSelectDeckSlot: (index: number) => void;
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
  onGoToGallery: () => void;
  onOpenRules: () => void;
  onMatchThemeChange?: (theme: 'tavern' | 'duel' | 'boss') => void;
}

export const ArenaView: React.FC<ArenaViewProps> = ({
  profile,
  activeDeck,
  onSelectDeckSlot,
  onRecordMatch,
  onClaimSpoil,
  onGoToGallery,
  onOpenRules,
  onMatchThemeChange,
}) => {
  const [selectedTierNum, setSelectedTierNum] = useState<number>(1);
  const [selectedFighterId, setSelectedFighterId] = useState<string>('t1-f1');
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
    'Select a card from your 7-card hand, then tap any open stone socket on the 5×5 board.'
  );
  const [playerFlipsCount, setPlayerFlipsCount] = useState(0);
  const [playerCombosCount, setPlayerCombosCount] = useState(0);
  const [summary, setSummary] = useState<MatchSummary | null>(null);

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
    if (phase === 'setup') {
      onMatchThemeChange('tavern');
    } else if (currentFighter.isBoss || currentFighter.tierNumber >= 9) {
      onMatchThemeChange('boss');
    } else {
      onMatchThemeChange('duel');
    }
  }, [phase, currentFighter.isBoss, currentFighter.tierNumber, onMatchThemeChange]);

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
      const freshBoard = createBoard();
      const blockedCount = freshBoard.flat().filter((c) => c.blocked).length;
      const starter: Owner = Math.random() < 0.55 ? 'player' : 'rival';

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
      setLastBattleLog(
        `5×5 Duel vs ${fighter.name} (${blockedCount} blocked tiles). ${
          starter === 'player' ? 'Your move!' : `${fighter.name} leads.`
        }`
      );
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
      const augCount = resolution.augments.length;
      const augSuffix =
        augCount > 0 && chosenDef.augment
          ? ` · ${chosenDef.augment.name} (${chosenDef.augment.shortTag} ×${augCount})`
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
        }${comboFlips > 0 ? ` +${comboFlips} Combo!` : ''}${augSuffix}`;
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
          }!${augSuffix}`
        );
        const soundTimer = window.setTimeout(() => {
          sound.flip(unopposedFlips);
        }, 110);
        timersRef.current.push(soundTimer);
        showCallout(unopposedFlips > 1 ? `Multi-Capture ×${unopposedFlips}` : 'Unopposed Capture');
      } else if (augCount > 0 && chosenDef.augment) {
        setActiveClash(null);
        setLastBattleLog(
          `${chosenDef.name} activated ${chosenDef.augment.name}: ${chosenDef.augment.shortTag} on ${augCount} card${
            augCount > 1 ? 's' : ''
          }!`
        );
        sound.select();
        showCallout(`${chosenDef.augment.name} (${chosenDef.augment.shortTag})`);
      } else {
        setActiveClash(null);
        setLastBattleLog(
          `${owner === 'player' ? 'You' : currentFighter.name} deployed ${chosenDef.name} (${formatTetraCode(
            chosen.stats
          )} · ${chosen.arrows.length}▲).`
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
    executeMove('player', selectedHandUid, row, col);
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

  const previewDeckHand = useMemo(
    () => buildPlayerHand(activeDeck.cards, profile.inventory),
    [activeDeck.cards, profile.inventory]
  );
  const playerAvatarCard =
    CARD_MAP[previewDeckHand[0]?.cardId ?? 'ember-imp'] ?? CARD_MAP['ember-imp'];
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];
  const currentTierUnlocked = isTierUnlocked(currentTier.tierNumber, profile.fighterWins ?? {});
  const currentTierProg = getTierProgress(currentTier.tierNumber, profile.fighterWins ?? {});

  // ==================== SETUP VIEW (10-TIER CHALLENGER LADDER) ====================
  if (phase === 'setup') {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
        {/* Top Ladder Header & Overall Conquest Progress */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide [text-wrap:balance]">
              10-Tier Challenger Ladder
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Conquer challengers in each tier to claim their cards and unlock higher ranks.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <div className="rounded-xl bg-[#10182a] border border-slate-800 px-3.5 py-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">Challengers Conquered:</span>
              <span className="font-mono font-bold tabular-nums text-amber-300">
                {totalConqueredFighters} / {ALL_FIGHTERS.length}
              </span>
            </div>
          </div>
        </div>

        {/* 10-Tier Horizontal Ladder Navigation Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
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
                className={`group relative rounded-xl p-2.5 text-left border transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#1e2c4e] to-[#121b31] border-amber-400 shadow-[0_6px_18px_rgba(245,158,11,0.25)] -translate-y-0.5'
                    : unlocked
                    ? 'bg-[#10182a] border-slate-800 hover:border-slate-700'
                    : 'bg-[#0b101c] border-slate-900/90 opacity-65 hover:opacity-90'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-[var(--font-display)] text-xs font-bold ${
                      isSelected
                        ? 'text-amber-200'
                        : unlocked
                        ? 'text-slate-200'
                        : 'text-slate-500'
                    }`}
                  >
                    Tier {tier.tierNumber}
                  </span>
                  {!unlocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  ) : isCleared ? (
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <span className="font-mono text-[11px] tabular-nums text-slate-400">
                      {prog.defeated}/{prog.total}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isCleared
                        ? 'bg-amber-400'
                        : unlocked
                        ? 'bg-sky-400'
                        : 'bg-slate-700'
                    }`}
                    style={{
                      width: `${prog.total > 0 ? Math.round((prog.defeated / prog.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-start">
          {/* Left Column: Selected Tier Roster (5 Fighters in Tiers 1-6, 4 in Tiers 7-8, 3 in Tier 9, 2 in Tier 10) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Tier Banner & Unlock Condition */}
            <div className="rounded-2xl bg-[#10182a] border border-slate-800/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-slate-100">
                    {currentTier.name}
                  </h2>
                  {!currentTierUnlocked && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-300">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Locked</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{currentTier.regionSubtitle}</p>
              </div>

              <div className="text-left sm:text-right shrink-0 space-y-0.5">
                <div className={`text-xs font-semibold ${currentTier.accentColor}`}>
                  Pool: {currentTier.cardRangeLabel}
                </div>
                <div className="text-[11px] text-slate-400">
                  {currentTier.tierNumber < 10
                    ? `Beat ${currentTier.requiredWinsToUnlockNext} of ${currentTier.fighters.length} to unlock Tier ${
                        currentTier.tierNumber + 1
                      } (${currentTierProg.defeated}/${currentTier.requiredWinsToUnlockNext})`
                    : `Final Sanctum (${currentTierProg.defeated}/${currentTier.fighters.length} defeated)`}
                </div>
              </div>
            </div>

            {!currentTierUnlocked && (
              <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-200">
                <span>
                  Defeat at least{' '}
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
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold shrink-0 cursor-pointer"
                >
                  Go to Tier {currentTier.tierNumber - 1}
                </button>
              </div>
            )}

            {/* Fighter Cards Grid inside Current Tier */}
            <div className="space-y-2.5">
              {currentTier.fighters.map((fighter) => {
                const active = fighter.id === currentFighter.id;
                const winsCount = profile.fighterWins?.[fighter.id] ?? 0;
                const isConquered = winsCount > 0;
                const avatar = CARD_MAP[fighter.avatarCardId];

                return (
                  <button
                    key={fighter.id}
                    type="button"
                    onClick={() => handleSelectFighter(fighter.id)}
                    className={`group relative w-full overflow-hidden rounded-2xl p-3.5 sm:p-4 text-left border transition-all duration-150 cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#1c2a4b] via-[#15203a] to-[#11192e] border-amber-400 shadow-[0_8px_24px_rgba(245,158,11,0.22)]'
                        : 'bg-[#10182a] border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Rank Number & Illustrated Portrait */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 ${
                              isConquered
                                ? 'border-emerald-400'
                                : active
                                ? 'border-amber-400'
                                : 'border-slate-700'
                            } shadow-md`}
                          >
                            {avatar && (
                              <img
                                src={avatar.image}
                                alt={fighter.name}
                                className={`w-full h-full object-cover ${avatar.artFilter ?? ''}`}
                              />
                            )}
                          </div>
                          <span
                            className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border shadow ${
                              isConquered
                                ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                                : 'bg-slate-900 text-slate-200 border-slate-600'
                            }`}
                          >
                            {isConquered ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              fighter.orderInTier
                            )}
                          </span>
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-[var(--font-display)] text-sm sm:text-base font-bold truncate ${
                                active ? 'text-amber-200' : 'text-slate-100'
                              }`}
                            >
                              {fighter.name}
                            </span>
                            <span className="text-xs text-slate-400 hidden sm:inline">
                              · {fighter.title}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 truncate">
                            Deck Pool:{' '}
                            <span className="text-amber-200/90 font-medium">
                              {fighter.specialty}
                            </span>
                          </p>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span>
                              Cards #{String(fighter.minCardNumber).padStart(2, '0')}–#
                              {String(fighter.maxCardNumber).padStart(2, '0')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Signature:{' '}
                              <strong className="text-slate-200">
                                {fighter.signatureCardIds
                                  .map((id) => CARD_MAP[id]?.name)
                                  .filter(Boolean)
                                  .join(', ')}
                              </strong>
                            </span>
                            {fighter.isBoss && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-300 font-semibold">Tier Boss</span>
                              </>
                            )}
                            {(fighter.mythicDropChance ?? 0) > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-200 font-semibold">
                                  ★ {Math.round((fighter.mythicDropChance ?? 0) * 100)}% Mythic RNG
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Reward & Conquest Status */}
                      <div className="text-right shrink-0 space-y-1">
                        <div className="inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-bold tabular-nums text-amber-300">
                          <Coins className="w-3.5 h-3.5" />
                          <span>+{fighter.winGold}g</span>
                        </div>
                        {!isConquered ? (
                          <div className="text-[11px] font-semibold text-emerald-300">
                            +{fighter.firstWinBonusGold}g First Win
                          </div>
                        ) : (
                          <div className="text-[11px] font-mono text-emerald-400">
                            Conquered ({winsCount}W)
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Challenger Dossier & Active 5-Card Hand Pedestal */}
          <div className="lg:col-span-5 space-y-5">
            {/* Selected Challenger Dossier + Signature Cards Preview */}
            <div className="rounded-2xl bg-gradient-to-b from-[#17233f] to-[#0f172a] border border-amber-500/35 p-4 sm:p-5 space-y-4 shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/90">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-amber-400 shrink-0 shadow">
                    {rivalAvatarCard && (
                      <img
                        src={rivalAvatarCard.image}
                        alt={currentFighter.name}
                        className={`w-full h-full object-cover ${rivalAvatarCard.artFilter ?? ''}`}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                      Tier {currentFighter.tierNumber} · Challenger #{currentFighter.orderInTier}
                    </div>
                    <h2 className="font-[var(--font-display)] text-lg font-bold text-slate-100 truncate">
                      {currentFighter.name}
                    </h2>
                    <p className="text-xs text-slate-400 truncate">
                      Spoils Pool: Cards #{String(currentFighter.minCardNumber).padStart(2, '0')}–#
                      {String(currentFighter.maxCardNumber).padStart(2, '0')}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-bold text-amber-300">
                    +{currentFighter.winGold}g
                  </div>
                  {(profile.fighterWins?.[currentFighter.id] ?? 0) === 0 && (
                    <div className="text-[11px] text-emerald-300 font-medium">
                      +{currentFighter.firstWinBonusGold}g Bonus
                    </div>
                  )}
                </div>
              </div>

              {/* Player's Switchable 5-Card Hand */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">
                      Your Battle Hand: {activeDeck.name}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Switch preset hands or edit in the 90-Card Compendium
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToGallery}
                    className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Edit Hand
                  </button>
                </div>

                {/* 3 Saved Hand Slot Switcher */}
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0a101e] border border-slate-800">
                  {profile.decks.map((slot, idx) => {
                    const isCurrent = idx === profile.activeDeckIndex;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          sound.select();
                          onSelectDeckSlot(idx);
                        }}
                        className={`min-h-[36px] px-2 py-1 rounded-lg text-xs font-medium transition-colors truncate cursor-pointer ${
                          isCurrent
                            ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-bold shadow'
                            : 'text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {slot.name}
                      </button>
                    );
                  })}
                </div>

                {/* 7-Card Hand Preview */}
                <div className="flex gap-2 overflow-x-auto pb-1.5 snap-x sm:grid sm:grid-cols-4 lg:grid-cols-4 sm:overflow-visible sm:pb-0">
                  {previewDeckHand.map((hCard) => (
                    <div
                      key={hCard.uid}
                      className="w-[92px] sm:w-auto shrink-0 snap-start"
                    >
                      <GameCard
                        cardId={hCard.cardId}
                        stats={hCard.stats}
                        arrows={hCard.arrows}
                        owner="player"
                        size="sm"
                        showName
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={!currentTierUnlocked}
                onClick={startMatch}
                className={`w-full min-h-[50px] rounded-xl font-[var(--font-display)] font-bold text-base tracking-wide flex items-center justify-center gap-2 transition-all ${
                  currentTierUnlocked
                    ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 active:scale-[0.98] text-slate-950 shadow-[0_8px_25px_rgba(245,158,11,0.35)] border border-amber-200/60 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {currentTierUnlocked ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Challenge {currentFighter.name} (5×5 Arena)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Unlock Tier {currentTier.tierNumber} First</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between px-1 text-xs text-slate-400">
              <span>5×5 Board · {HAND_SIZE} Cards Each · Win to claim 1 Spoil</span>
              <button
                type="button"
                onClick={onOpenRules}
                className="inline-flex items-center gap-1 text-slate-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Tetra Rules &amp; Augments</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ACTIVE MATCH VIEW (TACTILE HEARTHSTONE-STYLE 5x5 TABLETOP) ====================
  return (
    <div className="w-full max-w-6xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-4">
      {/* Top Hero Portrait Medallions & Glowing Score Orbs */}
      <div className="rounded-2xl bg-gradient-to-r from-[#101c35] via-[#131c31] to-[#261326] border border-slate-800/90 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shadow-lg">
        {/* Player Hero Medallion + Score Crystal */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]">
              {playerAvatarCard && (
                <img
                  src={playerAvatarCard.image}
                  alt="You"
                  className={`w-full h-full object-cover ${playerAvatarCard.artFilter ?? ''}`}
                />
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-b from-blue-400 to-blue-600 border border-blue-200 flex items-center justify-center font-mono text-xs font-bold tabular-nums text-white shadow">
              {scores.player}
            </span>
          </div>
          <div className="hidden xs:block">
            <div className="text-xs font-bold text-blue-200">You</div>
            <div className="text-[11px] text-slate-400">{activeDeck.name}</div>
          </div>
        </div>

        {/* Center Turn Banner & Live Clash Log */}
        <div className="flex flex-col items-center text-center min-w-0 px-2">
          <div
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-[var(--font-display)] font-bold tracking-wider ${
              turn === 'player' ? 'text-amber-300' : 'text-rose-300'
            }`}
          >
            <Swords className="w-3.5 h-3.5 shrink-0" />
            <span>
              {turn === 'player'
                ? 'YOUR TURN (5×5 ARENA)'
                : `${currentFighter.name.toUpperCase()}’S TURN`}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 truncate max-w-[220px] sm:max-w-[400px] mt-0.5">
            {lastBattleLog}
          </p>
        </div>

        {/* Rival Hero Medallion + Score Crystal + Concede */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-bold text-rose-200">{currentFighter.name}</div>
            <div className="text-[11px] text-slate-400">
              Tier {currentFighter.tierNumber} · {currentFighter.title}
            </div>
          </div>
          <div className="relative">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]">
              {rivalAvatarCard && (
                <img
                  src={rivalAvatarCard.image}
                  alt={currentFighter.name}
                  className={`w-full h-full object-cover ${rivalAvatarCard.artFilter ?? ''}`}
                />
              )}
            </div>
            <span className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-gradient-to-b from-rose-500 to-rose-700 border border-rose-200 flex items-center justify-center font-mono text-xs font-bold tabular-nums text-white shadow">
              {scores.rival}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConcede}
            aria-label="Leave match"
            title="Leave match"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Responsive Tabletop: Full-Width Mobile + 3-Column Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-start lg:items-center mt-2.5">
        {/* Rival Hand (Face-Down Ornate Backs) */}
        <div className="lg:col-span-2 order-1">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-xs font-semibold text-rose-300 truncate">
              Rival ({rivalHand.length})
            </span>
            <button
              type="button"
              onClick={onOpenRules}
              className="text-[11px] text-amber-300/90 hover:text-amber-200 underline underline-offset-4 shrink-0 cursor-pointer"
            >
              Guide
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
            {rivalHand.map((hCard) => (
              <div
                key={hCard.uid}
                className="w-[44px] sm:w-[52px] lg:w-auto shrink-0 snap-start"
              >
                <GameCard cardId={hCard.cardId} owner="rival" faceDown size="xs" />
              </div>
            ))}
          </div>
        </div>

        {/* Center 5x5 Tactile Sanctuary Board */}
        <div className="lg:col-span-7 order-2 relative flex flex-col items-center justify-center w-full">
          {/* Animated Floating Callout Banner */}
          {callout && (
            <div
              key={callout.id}
              className="pointer-events-none absolute -top-2.5 z-30 animate-callout"
            >
              <div className="rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400 px-4 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.85)]">
                <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-amber-200 tracking-wider">
                  {callout.text}
                </span>
              </div>
            </div>
          )}

          {/* Animated Clash Duel Mini-Overlay */}
          {activeClash && (
            <div className="pointer-events-none absolute bottom-3 z-30 animate-callout">
              <div className="rounded-xl bg-slate-950/95 border border-amber-400/80 px-3.5 py-2 shadow-2xl flex items-center gap-3 text-xs">
                <span className="font-semibold text-blue-300">{activeClash.attackerName}</span>
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  {toHexDigit(activeClash.attackerVal)}
                  {activeClash.attackType} vs {toHexDigit(activeClash.defenderVal)}
                </span>
                <span className="font-semibold text-rose-300">{activeClash.defenderName}</span>
              </div>
            </div>
          )}

          {/* Sculpted 5x5 Sanctuary Board Frame */}
          <div className="w-full max-w-[495px] sm:max-w-[545px] rounded-2xl hearth-table-surface border-2 border-amber-500/35 p-1.5 sm:p-3 shadow-[0_24px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {board.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const key = `${rIdx}-${cIdx}`;
                  const canPlaceHere =
                    phase === 'playing' &&
                    turn === 'player' &&
                    !isAnimating &&
                    Boolean(selectedHandUid) &&
                    !cell.blocked &&
                    !cell.card;

                  if (cell.blocked) {
                    return (
                      <div
                        key={key}
                        aria-label="Blocked stone monolith"
                        className="aspect-square rounded-xl bg-gradient-to-b from-[#3b2128] via-[#221218] to-[#11080c] border-2 border-rose-500/80 shadow-[0_6px_16px_rgba(0,0,0,0.85),inset_0_2px_8px_rgba(244,63,94,0.3)] flex flex-col items-center justify-center relative overflow-hidden select-none"
                      >
                        <div
                          className="absolute inset-0 opacity-35"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(135deg, rgba(244, 63, 94, 0.32) 0px, rgba(244, 63, 94, 0.32) 7px, rgba(15, 23, 42, 0.85) 7px, rgba(15, 23, 42, 0.85) 14px)',
                          }}
                        />
                        <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-rose-300/80 shadow" />
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-300/80 shadow" />
                        <span className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-rose-300/80 shadow" />
                        <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-300/80 shadow" />

                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="w-[130%] h-1 bg-rose-500/50 rotate-45 shadow" />
                          <div className="w-[130%] h-1 bg-rose-500/50 -rotate-45 shadow absolute" />
                        </div>

                        <div className="relative z-10 w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-b from-rose-900 to-slate-950 border-2 border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.65)] flex flex-col items-center justify-center">
                          <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-200 stroke-[2.5]" />
                        </div>
                        <span className="relative z-10 mt-0.5 px-1 py-0.2 rounded bg-slate-950/90 border border-rose-500/50 font-[var(--font-display)] text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-rose-200 shadow">
                          Blocked
                        </span>
                      </div>
                    );
                  }

                  if (cell.card) {
                    return (
                      <div key={key} className="aspect-square">
                        <GameCard
                          cardId={cell.card.cardId}
                          stats={cell.card.stats}
                          baseStats={cell.card.baseStats}
                          arrows={cell.card.arrows}
                          owner={cell.card.owner}
                          justPlaced={cell.card.justPlaced}
                          flipKey={cell.card.lastFlippedAt}
                          lastAugmented={cell.card.lastAugmented}
                          size="sm"
                        />
                      </div>
                    );
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!canPlaceHere}
                      onMouseEnter={() => {
                        if (canPlaceHere) {
                          sound.hover();
                        }
                      }}
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      aria-label={`Place card at row ${rIdx + 1}, column ${cIdx + 1}`}
                      className={`group relative aspect-square rounded-xl hearth-tile-socket border transition-all duration-150 flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        canPlaceHere
                          ? 'border-slate-700/80 hover:border-amber-300/75 hover:bg-slate-800/45 cursor-pointer active:scale-[0.96]'
                          : 'border-slate-800/80 cursor-default'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-transform ${
                          canPlaceHere
                            ? 'bg-slate-600/60 group-hover:scale-150 group-hover:bg-amber-300'
                            : 'bg-slate-800'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Player Hand — Interactive 7-Card Tray */}
        <div className="lg:col-span-3 order-3 w-full">
          <div className="flex items-center justify-between gap-2 mb-1 px-0.5">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-blue-300">
                Your Hand ({playerHand.length})
              </span>
              <span className="lg:hidden text-[10px] text-slate-400">
                · Hold any card to zoom
              </span>
            </div>
            {selectedCardDef && selectedHandCard && (
              <div className="flex items-center gap-1.5 text-xs text-slate-200 truncate">
                <span className="font-semibold truncate">{selectedCardDef.name}</span>
                <span className="font-mono font-bold tabular-nums text-amber-300 shrink-0">
                  {formatTetraCode(selectedHandCard.stats)}
                </span>
                <span className="text-slate-400 shrink-0">
                  · {selectedHandCard.arrows.length}▲
                </span>
              </div>
            )}
          </div>

          {/* Selected Card Augment Banner (Visible on both mobile & desktop when an Augment card is selected) */}
          {selectedCardDef?.augment && (
            <div className="mb-2 rounded-xl bg-violet-950/60 border border-violet-400/50 px-2.5 py-1.5 text-[11px] text-violet-100 flex items-start gap-1.5 shadow">
              <Wand2 className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" />
              <div>
                <strong className="text-violet-200">{selectedCardDef.augment.name}:</strong>{' '}
                <span>{selectedCardDef.augment.description}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pt-2.5 pb-2 px-1 snap-x lg:grid lg:grid-cols-2 lg:overflow-visible lg:pt-1 lg:px-0">
            {playerHand.map((hCard) => {
              const isSelected = hCard.uid === selectedHandUid;
              return (
                <div
                  key={hCard.uid}
                  className="w-[96px] sm:w-[106px] lg:w-auto shrink-0 snap-start"
                >
                  <GameCard
                    cardId={hCard.cardId}
                    stats={hCard.stats}
                    arrows={hCard.arrows}
                    owner="player"
                    size="sm"
                    showName
                    selected={isSelected && turn === 'player'}
                    onClick={() => {
                      sound.select();
                      setSelectedHandUid(hCard.uid);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {selectedCardDef && selectedHandCard && (
            <div className="mt-2 hidden lg:block rounded-xl bg-[#10182a] border border-amber-500/25 p-3 text-xs space-y-1.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">{selectedCardDef.name}</span>
                <span className="font-mono font-bold text-amber-300">
                  {formatTetraCode(selectedHandCard.stats)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>
                  Pwr {toHexDigit(selectedHandCard.stats.power)} · Type {selectedHandCard.stats.type}{' '}
                  · P.Def {toHexDigit(selectedHandCard.stats.pDef)} · M.Def{' '}
                  {toHexDigit(selectedHandCard.stats.mDef)}
                </span>
                <span className="flex items-center gap-1 text-amber-300">
                  <Compass className="w-3.5 h-3.5" />
                  {selectedHandCard.arrows.length}▲
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== MATCH FINISHED / SPOILS MODAL ==================== */}
      {phase === 'finished' && summary && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-result-title"
        >
          <div className="w-full sm:max-w-xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-gradient-to-b from-[#16223c] to-[#0f1628] border border-amber-400/40 shadow-2xl overflow-hidden">
            <div className="sm:hidden w-10 h-1 rounded-full bg-slate-600 mx-auto mt-2.5" />

            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Trophy
                  className={`w-5 h-5 ${
                    summary.winner === 'player'
                      ? 'text-amber-400'
                      : summary.winner === 'draw'
                      ? 'text-slate-300'
                      : 'text-rose-400'
                  }`}
                />
                <div>
                  <h2
                    id="match-result-title"
                    className="font-[var(--font-display)] text-xl font-bold text-slate-100"
                  >
                    {summary.isPerfect
                      ? `Perfect! (${summary.playerScore}–0)`
                      : summary.winner === 'player'
                      ? `Victory over ${currentFighter.name}`
                      : summary.winner === 'draw'
                      ? 'Draw'
                      : 'Defeat'}
                  </h2>
                  {summary.isFirstVictory && (
                    <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>First-Time Challenger Conquest!</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="font-mono text-lg font-bold tabular-nums">
                <span className="text-blue-400">{summary.playerScore}</span>
                <span className="text-slate-600 mx-1.5">–</span>
                <span className="text-rose-400">{summary.rivalScore}</span>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5">
              <div className="rounded-xl bg-[#0b111e] border border-slate-800 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    Match Purse (Tier {currentFighter.tierNumber} · {currentFighter.name})
                  </span>
                  <span className="font-mono tabular-nums text-amber-300">
                    +{summary.baseGold}g
                  </span>
                </div>
                {summary.firstWinBonus > 0 && (
                  <div className="flex items-center justify-between text-emerald-300 font-medium">
                    <span>First-Time Challenger Conquest Bonus</span>
                    <span className="font-mono tabular-nums">+{summary.firstWinBonus}g</span>
                  </div>
                )}
                {summary.dominanceBonus > 0 && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span>
                      {summary.isPerfect
                        ? `Perfect ${summary.playerScore}–0 Bonus`
                        : 'Dominance Bonus'}
                    </span>
                    <span className="font-mono tabular-nums text-amber-300">
                      +{summary.dominanceBonus}g
                    </span>
                  </div>
                )}
                {summary.comboBonus > 0 && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Combo Chain Bonus</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      +{summary.comboBonus}g
                    </span>
                  </div>
                )}
                {summary.spoilBonusGold > 0 && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Max Copies (5/5) Auto-Sell Bonus</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      +{summary.spoilBonusGold}g
                    </span>
                  </div>
                )}
                <div className="pt-2 mt-1 border-t border-slate-800 flex items-center justify-between font-semibold text-sm text-slate-100">
                  <span>Total Gold Earned</span>
                  <span className="font-mono tabular-nums text-amber-300 flex items-center gap-1">
                    <Coins className="w-4 h-4" />+{summary.totalGold + summary.spoilBonusGold}g
                  </span>
                </div>
              </div>

              {/* Claim 1 Rolled Spoil Card on Victory */}
              {summary.winner === 'player' && (
                <div className="space-y-2.5">
                  {summary.bonusMythicDrop && (
                    <div className="rounded-xl bg-gradient-to-r from-amber-950/70 via-amber-900/40 to-amber-950/70 border border-amber-400/75 px-3.5 py-2.5 flex items-center gap-2 text-xs text-amber-200 shadow-lg">
                      <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>
                        <strong>Mythic RNG Drop Triggered!</strong>{' '}
                        {CARD_MAP[summary.bonusMythicDrop.cardId]?.name} (
                        {formatTetraCode(summary.bonusMythicDrop.stats)} ·{' '}
                        {summary.bonusMythicDrop.arrows.length}▲) materialized in the spoils pool!
                      </span>
                    </div>
                  )}

                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold text-amber-200">
                      {summary.spoilClaimedUid
                        ? 'Rolled Spoil Claimed'
                        : `Claim 1 Rolled Card from ${currentFighter.name}’s Pool`}
                    </h3>
                    {!summary.spoilClaimedUid && (
                      <span className="text-xs text-slate-400">
                        Unique rolled stats &amp; arrows (max 5 copies per type)
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x">
                    {summary.rivalHandCards.map((sCard) => {
                      const isClaimed = summary.spoilClaimedUid === sCard.uid;
                      const ownedCopies = profile.owned[sCard.cardId] ?? 0;
                      const isBonusMythic = summary.bonusMythicDrop?.uid === sCard.uid;
                      const lockedOut = Boolean(summary.spoilClaimedUid) && !isClaimed;
                      return (
                        <div
                          key={sCard.uid}
                          className="w-[106px] shrink-0 snap-start flex flex-col items-center gap-1.5"
                        >
                          <GameCard
                            cardId={sCard.cardId}
                            stats={sCard.stats}
                            arrows={sCard.arrows}
                            owner={isClaimed ? 'player' : 'neutral'}
                            size="sm"
                            showName
                            selected={isClaimed || (isBonusMythic && !summary.spoilClaimedUid)}
                            disabled={lockedOut}
                            onClick={
                              summary.spoilClaimedUid
                                ? undefined
                                : () => handleClaimSpoilCard(sCard)
                            }
                          />
                          <span
                            className={`text-[11px] font-medium text-center truncate w-full ${
                              isBonusMythic ? 'text-amber-300 font-bold' : 'text-slate-300'
                            }`}
                          >
                            {isClaimed
                              ? summary.spoilWasOverflow
                                ? `Sold +${summary.spoilBonusGold}g`
                                : `Claimed (${ownedCopies}/${MAX_COPIES_PER_CARD})`
                              : isBonusMythic
                              ? `★ ${formatTetraCode(sCard.stats)} · ${sCard.arrows.length}▲`
                              : ownedCopies === 0
                              ? `New · ${formatTetraCode(sCard.stats)} · ${sCard.arrows.length}▲`
                              : `${ownedCopies}/${MAX_COPIES_PER_CARD} · ${formatTetraCode(
                                  sCard.stats
                                )} · ${sCard.arrows.length}▲`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {summary.spoilClaimedCardId && (
                    <p className="text-xs text-emerald-300">
                      {CARD_MAP[summary.spoilClaimedCardId]?.name}{' '}
                      {summary.spoilWasOverflow
                        ? `was already at ${MAX_COPIES_PER_CARD}/${MAX_COPIES_PER_CARD} copies and auto-sold for +${summary.spoilBonusGold}g!`
                        : `added to your collection (${
                            profile.owned[summary.spoilClaimedCardId] ?? 1
                          }/${MAX_COPIES_PER_CARD} copies owned)!`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-800 bg-[#0d1424] flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPhase('setup')}
                className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Ladder View
              </button>
              <button
                type="button"
                onClick={startMatch}
                className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rematch</span>
              </button>
              {nextChallengeFighter && (
                <button
                  type="button"
                  onClick={() => startMatchWithFighter(nextChallengeFighter.id)}
                  className="w-full sm:w-auto sm:flex-[1.4] min-h-[44px] px-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Next: {nextChallengeFighter.name}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
