import React from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Dices,
  Lock,
  Trophy,
  Wand2,
} from 'lucide-react';
import { CARD_MAP, getCardThumbUrl } from '../../data/cards';
import {
  ALL_FIGHTERS,
  LADDER_TIERS,
  getFighterBiomes,
  getFighterPoolLabel,
  getTierProgress,
  isTierUnlocked,
} from '../../data/ladder';
import { HAND_SIZE } from '../../engine/triadEngine';
import { AutoBuildStrategy } from '../../store/useProfile';
import {
  BiomeType,
  DeckSlot,
  HandCard,
  LadderFighter,
  LadderTier,
  PlayerProfile,
} from '../../types/game';
import { sound } from '../../utils/sound';
import { BiomePill } from '../BiomeBadge';
import { DeckBuilderWorkspace } from '../DeckBuilderWorkspace';

export type SetupStep = 'mode' | 'details' | 'deck';
export type MatchMode = 'arena' | 'quick';

interface ArenaSetupFlowProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  setupStep: SetupStep;
  setSetupStep: (step: SetupStep) => void;
  gameMode: MatchMode;
  setGameMode: (mode: MatchMode) => void;
  selectedTierNum: number;
  currentTier: LadderTier;
  currentFighter: LadderFighter;
  totalConqueredFighters: number;
  unlockedLadderTiers: LadderTier[];
  unlockedFighters: LadderFighter[];
  previewDeckHand: HandCard[];
  onSelectTier: (tierNum: number) => void;
  onSelectFighter: (fighterId: string) => void;
  onRollRandomFighter: (excludeId?: string) => LadderFighter;
  onSelectDeckSlot: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
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
  onSellCardInstance: (
    instanceUid: string
  ) => { ok: boolean; goldEarned: number; cardName?: string; message?: string };
  onSellExtraCopies: (
    specificCardId?: string
  ) => { soldCount: number; goldEarned: number };
  onStartMatch: () => void;
  onGoHome: () => void;
  onGoToGallery: () => void;
  onOpenRules: () => void;
}

export const ArenaSetupFlow: React.FC<ArenaSetupFlowProps> = ({
  profile,
  activeDeck,
  setupStep,
  setSetupStep,
  gameMode,
  setGameMode,
  selectedTierNum,
  currentTier,
  currentFighter,
  totalConqueredFighters,
  unlockedLadderTiers,
  unlockedFighters,
  previewDeckHand,
  onSelectTier,
  onSelectFighter,
  onRollRandomFighter,
  onSelectDeckSlot,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onToggleDeckCard,
  onClearDeck,
  onAutoBuildDeck,
  onSellCardInstance,
  onSellExtraCopies,
  onStartMatch,
  onGoHome,
  onGoToGallery,
  onOpenRules,
}) => {
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];
  const currentTierUnlocked = isTierUnlocked(currentTier.tierNumber, profile.fighterWins ?? {});
  const currentTierProg = getTierProgress(currentTier.tierNumber, profile.fighterWins ?? {});

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

  const bossRuneTierLabel =
    currentFighter.isBoss && currentFighter.tierNumber >= 8
      ? 'Sovereign Runes'
      : currentFighter.isBoss && currentFighter.tierNumber >= 6
      ? 'Major Runes'
      : currentFighter.isBoss && currentFighter.tierNumber >= 4
      ? 'Minor Rune'
      : null;

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${
        setupStep === 'deck'
          ? 'max-w-none py-2.5 lg:py-3 space-y-2.5 lg:h-full lg:flex lg:flex-col lg:overflow-hidden'
          : 'max-w-6xl py-5 sm:py-6 space-y-5 sm:space-y-6'
      }`}
    >
      {/* Rugged Forged-Iron Breadcrumb & Back Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
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

      {/* STEP 1: MODE SELECTION */}
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
                    Progress through 10 themed sanctuaries on an open 5×3 landscape biome grid,
                    defeat rune-wielding tier bosses, and unlock Mythic drops.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#4b3a26]/70 font-[var(--font-display)] text-xs uppercase tracking-wider font-bold text-[#e9ba62]">
                <span>Select Tier &amp; Challenger</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                setGameMode('quick');
                onRollRandomFighter();
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
                    5×3 Skirmish
                  </span>
                </div>

                <div className="space-y-2">
                  <h2 className="font-[var(--font-display)] text-xl font-bold tracking-wide text-[#f2e2c4] group-hover:text-[#f8e1b0] transition-colors">
                    Quick Random Duel
                  </h2>
                  <p className="font-[var(--font-serif)] text-base text-[#cbb89a] leading-relaxed">
                    Draw a surprise opponent from your unlocked ladder tiers for a brisk 5×3 duel
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

      {/* STEP 2A: CHAMPIONSHIP ARENA DETAILS */}
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
                  onClick={() => onSelectTier(tier.tierNumber)}
                  className={`px-2.5 py-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'brass-btn font-bold'
                      : unlocked
                      ? 'iron-btn text-[#d9c8ac]'
                      : 'brass-plaque text-[#685a49] opacity-55'
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

          <div className="brass-panel riveted-frame rounded-[4px] overflow-hidden">
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

            <div
              role="tablist"
              aria-label="Tier challengers"
              className="flex items-stretch gap-2 px-4 sm:px-6 py-3 overflow-x-auto"
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
                    onClick={() => onSelectFighter(fighter.id)}
                    className={`war-banner-tab flex-1 min-w-[132px] pl-2.5 pr-4 py-2 flex items-center gap-2 text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#4b3319] via-[#342312] to-[#23170c] text-[#fae3b2] shadow-[inset_3px_0_0_#f0c76e]'
                        : 'bg-[#17120d]/85 text-[#b7a386] hover:bg-[#261c13] hover:text-[#efe3cd]'
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
                    onClick={() => onSelectTier(currentTier.tierNumber - 1)}
                    className="brass-btn px-3 py-1 rounded-[2px] text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Go to Tier {currentTier.tierNumber - 1}
                  </button>
                </div>
              )}

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
                    {bossRuneTierLabel && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#24162b] border border-violet-400/50 font-mono font-bold text-violet-200">
                        <Wand2 className="w-3 h-3 text-violet-300" />
                        <span>Wields {bossRuneTierLabel}</span>
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
                    <span className="text-[#ebc77e] italic font-semibold">
                      {currentFighter.specialty}
                    </span>
                  </p>
                </div>
              </div>

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
                    {getFighterPoolLabel(currentFighter)}
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

      {/* STEP 2B: QUICK RANDOM DUEL DETAILS */}
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
                  onRollRandomFighter(currentFighter.id);
                }}
                className="iron-btn inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-[3px] font-[var(--font-display)] text-xs font-semibold tracking-wide cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5 text-[#e2b053]" />
                <span>Re-roll Opponent</span>
              </button>
            </div>

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
                  {currentFighter.title} —{' '}
                  <span className="text-[#ebc77e] italic">{currentFighter.specialty}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
              <div className="basalt-recess rounded-[3px] p-3">
                <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                  Board
                </div>
                <div className="font-mono font-bold text-[#efe3cd] mt-0.5">5×3 Open</div>
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
                <div className="font-mono font-bold text-[#e5cfa4] mt-0.5 truncate">
                  {getFighterPoolLabel(currentFighter)}
                </div>
              </div>
            </div>

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

      {/* STEP 3: DECK BUILDER WORKSPACE */}
      {setupStep === 'deck' && (
        <DeckBuilderWorkspace
          profile={profile}
          activeDeck={activeDeck}
          currentFighter={currentFighter}
          gameMode={gameMode}
          onSelectDeckSlot={onSelectDeckSlot}
          onCreateDeck={onCreateDeck}
          onRenameDeck={onRenameDeck}
          onDeleteDeck={onDeleteDeck}
          onToggleDeckCard={onToggleDeckCard}
          onClearDeck={onClearDeck}
          onAutoBuildDeck={onAutoBuildDeck}
          onSellCardInstance={onSellCardInstance}
          onSellExtraCopies={onSellExtraCopies}
          onStartMatch={onStartMatch}
          onGoToGallery={onGoToGallery}
          onOpenRules={onOpenRules}
        />
      )}
    </div>
  );
};
