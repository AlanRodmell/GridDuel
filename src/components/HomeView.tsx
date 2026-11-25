import React from 'react';
import {
  Check,
  ChevronRight,
  Crown,
  Dices,
  LayoutGrid,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ALL_FIGHTERS } from '../data/ladder';
import { POWER_CARDS, getUnlockedPowerCards } from '../data/powerCards';
import {
  ALL_BOARD_SCALES,
  BOARD_SCALES,
  DEFAULT_BOARD_SCALE,
  getBoardScaleSpec,
} from '../engine/triadEngine';
import { BoardScale, PlayerProfile } from '../types/game';
import { sound } from '../utils/sound';
import { BrambleCrestDivider } from './BattlefieldChrome';
import { GameCard } from './GameCard';

export type PlayLaunchIntent = 'arena' | 'quick';

interface HomeViewProps {
  profile: PlayerProfile;
  ownedUniqueCount: number;
  totalCards: number;
  onSelectBoardScale: (scale: BoardScale) => void;
  onStartFlow: (intent: PlayLaunchIntent) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  profile,
  ownedUniqueCount,
  totalCards,
  onSelectBoardScale,
  onStartFlow,
}) => {
  const conqueredCount = Object.values(profile.fighterWins ?? {}).filter(
    (w) => w > 0
  ).length;
  const unlockedRelicsCount = getUnlockedPowerCards(profile.fighterWins).length;
  const activeScale = profile.boardScale ?? DEFAULT_BOARD_SCALE;
  const scaleSpec = getBoardScaleSpec(activeScale);

  return (
    <div className="w-full max-w-[1620px] mx-auto px-5 sm:px-8 lg:px-10 py-6 lg:py-9 space-y-7 lg:space-y-8">
      {/* Top Hero & Fanned Tarot Showcase */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4 text-center lg:text-left">
          <div className="war-banner-tab inline-flex items-center gap-2 pl-3.5 pr-5 py-1.5 bg-gradient-to-r from-[#3b2915] to-[#24190d] text-[#edd08e] font-[var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.18em] shadow">
            <Crown className="w-3.5 h-3.5 text-[#d8a243]" />
            <span>6×3 · 7×3 · 6×4 Tactical Biome &amp; Relic War</span>
          </div>

          <div className="space-y-2.5">
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-[0.08em] text-[#f5dfb2] leading-[1.05] drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)]">
              GridDuel
            </h1>
            <BrambleCrestDivider className="max-w-[280px] mx-auto lg:mx-0" />
            <p className="font-[var(--font-serif)] italic text-lg sm:text-xl text-[#dec391]">
              “Master the terrain, anchor your Relics, claim the board.”
            </p>
            <p className="font-[var(--font-serif)] text-sm sm:text-base text-[#c7b69a] leading-relaxed max-w-xl mx-auto lg:mx-0">
              Choose your battlefield scale below, then climb the 10-tier Championship Arena to
              unlock 12 directional Power Relic Totems or roll a Quick Random Duel.
            </p>
          </div>

          {/* Compact Campaign Progress Strip */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1 text-xs">
            <span className="organic-tag px-3 py-1 bg-[#1b140d] font-mono text-[#dfd0b6]">
              Record:{' '}
              <strong className="text-emerald-400">{profile.wins}W</strong>
              <span className="text-[#5e4d3a]"> · </span>
              <strong className="text-rose-400">{profile.losses}L</strong>
            </span>
            <span className="organic-tag px-3 py-1 bg-[#1b140d] font-mono text-[#f0c76e]">
              Arena: <strong>{conqueredCount}/{ALL_FIGHTERS.length}</strong>
            </span>
            <span className="organic-tag px-3 py-1 bg-sky-950/85 font-mono text-sky-200 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-300" />
              <span>
                Relics: <strong>{unlockedRelicsCount}/{POWER_CARDS.length}</strong>
              </span>
            </span>
            <span className="organic-tag px-3 py-1 bg-[#1b140d] font-mono text-[#e8d5b3]">
              Cards: <strong>{ownedUniqueCount}/{totalCards}</strong>
            </span>
          </div>
        </div>

        {/* Right Fanned Collector Tarot Showcase */}
        <div className="lg:col-span-6 flex items-center justify-center py-2">
          <div className="relative w-full max-w-[500px] h-[270px] sm:h-[330px] xl:h-[360px] flex items-center justify-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-6 rounded-full bg-gradient-to-tr from-[#c97c24]/20 via-[#8d4218]/14 to-[#d6a348]/18 blur-2xl"
            />

            <div className="w-[145px] sm:w-[178px] xl:w-[196px] -mr-12 sm:-mr-14 -rotate-[11deg] translate-y-3 opacity-92 transition-transform duration-300 hover:-translate-y-1 hover:z-30 drop-shadow-[0_18px_24px_rgba(0,0,0,0.8)]">
              <GameCard cardId="glacial-mage" variant="tarot" size="md" showArrows />
            </div>

            <div className="relative z-20 w-[170px] sm:w-[208px] xl:w-[228px] -translate-y-2 transition-transform duration-300 hover:-translate-y-4 drop-shadow-[0_24px_32px_rgba(0,0,0,0.88)]">
              <GameCard cardId="solar-sovereign" variant="tarot" size="lg" showArrows />
            </div>

            <div className="w-[145px] sm:w-[178px] xl:w-[196px] -ml-12 sm:-ml-14 rotate-[11deg] translate-y-3 opacity-92 transition-transform duration-300 hover:-translate-y-1 hover:z-30 drop-shadow-[0_18px_24px_rgba(0,0,0,0.8)]">
              <GameCard cardId="abyssal-lich" variant="tarot" size="md" showArrows />
            </div>
          </div>
        </div>
      </section>

      {/* UNIFIED BATTLE OPTIONS HUB: SCALE SELECTOR + ARENA / QUICK DUEL */}
      <section className="space-y-5">
        {/* 1. Battlefield Scale Selector */}
        <div className="brass-panel p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-[#e2b053]" />
              <h2 className="font-[var(--font-display)] text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#f5dfb2]">
                Battlefield Scale
              </h2>
            </div>
            <span className="font-[var(--font-serif)] italic text-xs sm:text-sm text-[#b7a285]">
              Applies to both Championship Arena &amp; Quick Random Duel
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ALL_BOARD_SCALES.map((sc) => {
              const s = BOARD_SCALES[sc];
              const isSelected = sc === activeScale;
              return (
                <button
                  key={sc}
                  type="button"
                  onClick={() => onSelectBoardScale(sc)}
                  className={`p-3.5 text-left flex flex-col justify-between gap-1.5 transition-transform cursor-pointer ${
                    isSelected
                      ? 'brass-btn font-bold'
                      : 'iron-btn text-[#e5d5b7] hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-[var(--font-display)] text-sm sm:text-base font-bold">
                      {s.name}
                    </span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </div>
                  <div
                    className={`font-mono text-[11px] ${
                      isSelected ? 'text-[#251707]' : 'text-[#cbb89a]'
                    }`}
                  >
                    {s.rows * s.cols} Tiles · {s.unitSlots} Units + 1 Relic · {s.biomeCount} Biomes
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Direct Battle Mode Launch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            type="button"
            onClick={() => {
              sound.select();
              onStartFlow('arena');
            }}
            className="group brass-panel riveted-frame p-6 text-left flex flex-col justify-between gap-5 transition-transform duration-200 hover:-translate-y-1 cursor-pointer"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 brass-plaque flex items-center justify-center text-[#eab95d]">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="organic-tag px-2.5 py-1 bg-[#1e150c] font-mono text-xs font-bold text-[#f0c76e]">
                  {conqueredCount}/{ALL_FIGHTERS.length} Conquered
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-[var(--font-display)] text-xl font-bold tracking-wide text-[#f6dfb0] group-hover:text-[#fde9be] transition-colors">
                  Championship Arena
                </h2>
                <p className="font-[var(--font-serif)] text-base text-[#cbb89a] leading-relaxed">
                  Progress through 10 themed sanctuaries on a {scaleSpec.shortLabel} battlefield,
                  clear full tiers to unlock all 12 Power Relics, and hunt Mythic boss drops.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3.5 border-t border-[#4b3a26]/70 font-[var(--font-display)] text-xs uppercase tracking-wider font-bold text-[#e9ba62]">
              <span>Select Tier &amp; Challenger ({scaleSpec.shortLabel})</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.select();
              onStartFlow('quick');
            }}
            className="group iron-panel riveted-frame p-6 text-left flex flex-col justify-between gap-5 transition-transform duration-200 hover:-translate-y-1 cursor-pointer"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 brass-plaque flex items-center justify-center text-[#d8a752]">
                  <Dices className="w-5 h-5" />
                </div>
                <span className="organic-tag px-2.5 py-1 bg-[#18120c] font-mono text-xs font-bold text-[#dfcca9]">
                  {scaleSpec.name}
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-[var(--font-display)] text-xl font-bold tracking-wide text-[#f2e2c4] group-hover:text-[#f8e1b0] transition-colors">
                  Quick Random Duel
                </h2>
                <p className="font-[var(--font-serif)] text-base text-[#cbb89a] leading-relaxed">
                  Draw a surprise challenger from your unlocked ladder tiers for an instant{' '}
                  {scaleSpec.shortLabel} exhibition with full Gold &amp; Spoil rewards.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3.5 border-t border-[#3c3024]/80 font-[var(--font-display)] text-xs uppercase tracking-wider font-bold text-[#d8b068]">
              <span>Roll Random Challenger ({scaleSpec.shortLabel})</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
