import React from 'react';
import {
  ChevronRight,
  Coins,
  Crown,
  Dices,
  Home,
  RefreshCw,
  Sparkles,
  Trophy,
  Wand2,
} from 'lucide-react';
import {
  CARD_MAP,
  CRAFTABLE_AUGMENT_MAP,
  MAX_COPIES_PER_CARD,
  formatTetraCode,
} from '../../data/cards';
import {
  HandCard,
  LadderFighter,
  MatchSummary,
  PlayerProfile,
  Rarity,
  RolledCardInstance,
} from '../../types/game';
import { sound } from '../../utils/sound';
import { GameCard } from '../GameCard';
import { MatchMode } from './ArenaSetupFlow';

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
  augmentId?: string;
}): number {
  const statTotal = card.stats.power + card.stats.pDef + card.stats.mDef;
  const augBonus = card.augmentId && CRAFTABLE_AUGMENT_MAP[card.augmentId] ? 6 : 0;
  return statTotal * 2 + card.arrows.length * 1.5 + card.stats.power * 0.25 + augBonus;
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
  const hasBonusRune = Boolean(spoil.augmentId && !best.augmentId);

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
  if (hasBonusRune) {
    deltaParts.push('+Rune');
  }
  const deltaSummary = deltaParts.join(' · ');

  const tooltip = `vs your best copy (${formatTetraCode(best.stats)}, ${best.arrows.length} arrows): ATK ${formatSignedDelta(pwrDelta)}, P.DEF ${formatSignedDelta(pDefDelta)}, M.DEF ${formatSignedDelta(mDefDelta)}, Arrows ${formatSignedDelta(arrowDelta)}`;

  if (
    statDelta >= 0 &&
    arrowDelta >= 0 &&
    (statDelta > 0 || arrowDelta > 0 || hasBonusRune)
  ) {
    return {
      verdict: 'upgrade',
      badgeText: `▲ ${deltaSummary}`,
      badgeClass: 'bg-emerald-950/85 text-emerald-300 border-emerald-400/50',
      tooltip,
    };
  }

  if (
    (statDelta > 0 && arrowDelta < 0) ||
    (statDelta < 0 && arrowDelta > 0) ||
    hasBonusRune
  ) {
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
        ? 'bg-[#191410] text-[#cbb89a] border-[#4b3a29]'
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

interface MatchSpoilsModalProps {
  summary: MatchSummary;
  profile: PlayerProfile;
  currentFighter: LadderFighter;
  gameMode: MatchMode;
  nextChallengeFighter: LadderFighter | null;
  onClaimSpoilCard: (card: HandCard) => void;
  onGoHome: () => void;
  onReturnToSetupDetails: () => void;
  onRematch: () => void;
  onStartNewRandomMatch: () => void;
  onChallengeNextFighter: (fighterId: string) => void;
}

export const MatchSpoilsModal: React.FC<MatchSpoilsModalProps> = ({
  summary,
  profile,
  currentFighter,
  gameMode,
  nextChallengeFighter,
  onClaimSpoilCard,
  onGoHome,
  onReturnToSetupDetails,
  onRematch,
  onStartNewRandomMatch,
  onChallengeNextFighter,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/90 p-0 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-result-title"
    >
      <div className="w-full max-w-5xl lg:max-w-6xl max-h-[94dvh] flex flex-col rounded-t-[6px] sm:rounded-[5px] brass-panel riveted-frame shadow-[0_32px_90px_rgba(0,0,0,0.92)] overflow-hidden">
        <div className="sm:hidden w-10 h-1 rounded-full bg-[#6d573e] mx-auto mt-2.5" />

        {/* Result Header */}
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
                  {gameMode === 'quick'
                    ? 'Quick Random Duel'
                    : `Tier ${currentFighter.tierNumber} Championship`}
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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-[3px] basalt-recess text-[#cbb89a]">
              Match Purse:{' '}
              <strong className="font-mono text-[#f0c76e]">+{summary.baseGold}g</strong>
            </span>
            {summary.firstWinBonus > 0 && (
              <span className="px-3 py-1.5 rounded-[3px] bg-emerald-950/60 border border-emerald-500/45 text-emerald-200">
                First Win: <strong className="font-mono">+{summary.firstWinBonus}g</strong>
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

          {summary.winner === 'player' && (
            <div className="space-y-4">
              {summary.bonusMythicDrop && (
                <div className="rounded-[3px] brass-plaque border-[#d9a243] px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm text-[#f7dca2] shadow-lg">
                  <Crown className="w-5 h-5 text-[#eab859] shrink-0" />
                  <span>
                    <strong>Mythic RNG Drop Triggered!</strong>{' '}
                    {CARD_MAP[summary.bonusMythicDrop.cardId]?.name} (
                    {formatTetraCode(summary.bonusMythicDrop.stats)}) materialized in the spoils
                    pool!
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
                    Click any card below to claim its rolled stats, arrows &amp; boss runes
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
                  const spoilRune = sCard.augmentId
                    ? CRAFTABLE_AUGMENT_MAP[sCard.augmentId]
                    : undefined;
                  const lockedOut = Boolean(summary.spoilClaimedUid) && !isClaimed;
                  const isUpgradeHighlight =
                    !summary.spoilClaimedUid &&
                    !isBonusMythic &&
                    (comparison?.verdict === 'upgrade' || Boolean(spoilRune)) &&
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
                          summary.spoilClaimedUid ? undefined : () => onClaimSpoilCard(sCard)
                        }
                      />

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
                        {spoilRune && (
                          <div className="flex justify-center">
                            <span
                              title={spoilRune.description}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-violet-950/90 border border-violet-400/50 font-mono text-[10.5px] font-semibold text-violet-200"
                            >
                              <Wand2 className="w-3 h-3 text-violet-300 shrink-0" />
                              <span>{spoilRune.name}</span>
                            </span>
                          </div>
                        )}
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

        {/* Footer Actions */}
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
                onReturnToSetupDetails();
              }}
              className="iron-btn min-h-[44px] px-4 rounded-[3px] font-[var(--font-display)] font-semibold text-xs sm:text-sm cursor-pointer"
            >
              {gameMode === 'quick' ? 'Opponent Setup' : 'Arena Ladder'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRematch}
              className="iron-btn min-h-[44px] px-5 rounded-[3px] font-[var(--font-display)] text-[#f0c76e] font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Rematch</span>
            </button>
            {gameMode === 'quick' ? (
              <button
                type="button"
                onClick={onStartNewRandomMatch}
                className="brass-btn min-h-[44px] px-5 rounded-[3px] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Dices className="w-4 h-4" />
                <span>New Random Match</span>
              </button>
            ) : (
              nextChallengeFighter && (
                <button
                  type="button"
                  onClick={() => onChallengeNextFighter(nextChallengeFighter.id)}
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
  );
};
