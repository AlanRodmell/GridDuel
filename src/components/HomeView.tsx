import React from 'react';
import {
  Check,
  ChevronRight,
  Crown,
  Dices,
  LayoutGrid,
  Trophy,
} from 'lucide-react';
import { CARD_MAP } from '../data/cards';
import {
  ALL_BOARD_SCALES,
  BOARD_SCALES,
  DEFAULT_BOARD_SCALE,
  getBoardScaleSpec,
} from '../engine/triadEngine';
import { CARD_RARITY_THEMES } from '../styles/cardThemes';
import { BoardScale, PlayerProfile } from '../types/game';
import { BrambleCrestDivider } from './BattlefieldChrome';

export type PlayLaunchIntent = 'arena' | 'quick';

interface HomeViewProps {
  profile: PlayerProfile;
  onSelectBoardScale: (scale: BoardScale) => void;
  onStartFlow: (intent: PlayLaunchIntent) => void;
}

/**
 * Pure decorative card-art illustration plate for the Home hero fan.
 * Renders a static framed portrait image OF a card — not an interactive GameCard component:
 * - Zero tooltips, zero click/long-press handlers, zero clip-path + drop-shadow ghosting
 * - GPU-composited (`backface-visibility: hidden`) with smooth spring-eased hover motion
 */
const HeroCardIllustration: React.FC<{
  cardId: string;
  className?: string;
}> = ({ cardId, className = '' }) => {
  const card = CARD_MAP[cardId];
  if (!card) return null;
  const theme = CARD_RARITY_THEMES[card.rarity];

  return (
    <div
      aria-hidden="true"
      style={{
        background: theme.bezelGradient,
        boxShadow:
          '0 22px 38px rgba(0, 0, 0, 0.78), 0 4px 12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 236, 190, 0.3)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
      className={`pointer-events-none select-none aspect-[5/7] w-full rounded-[8px] p-[3px] ${className}`}
    >
      <div
        style={{ background: theme.surfaceGradient }}
        className="w-full h-full rounded-[6px] p-[6%] flex flex-col justify-between gap-1.5 overflow-hidden"
      >
        <div
          style={{ borderColor: theme.hairline }}
          className="w-full h-full rounded-[4px] border px-2 py-1.5 flex flex-col justify-between gap-1.5 bg-black/20"
        >
          {/* Decorative Nameplate */}
          <div className="rounded-[3px] bg-black/45 px-2 py-1 text-center shrink-0 border border-white/5">
            <div
              style={{ color: theme.titleColor }}
              className="font-[var(--font-display)] text-[10px] sm:text-[11.5px] font-bold uppercase tracking-[0.08em] leading-tight truncate"
            >
              {card.name}
            </div>
          </div>

          {/* Arched Oil Portrait Image */}
          <div
            style={{
              borderColor: theme.archBorder,
              background: theme.archBackdrop,
            }}
            className="relative flex-1 min-h-0 w-full overflow-hidden rounded-t-[999px] rounded-b-[4px] border"
          >
            <img
              src={card.image}
              alt=""
              width={512}
              height={512}
              loading="eager"
              decoding="async"
              draggable={false}
              className={`w-full h-full object-cover object-top ${card.artFilter ?? ''}`}
            />
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/65 to-transparent" />
          </div>

          {/* Decorative Engraved Role Filigree */}
          <div className="flex items-center gap-1.5 shrink-0 px-0.5 py-0.5">
            <span style={{ backgroundColor: theme.hairline }} className="h-px flex-1" />
            <span
              style={{ color: theme.labelColor }}
              className="font-[var(--font-display)] text-[7.5px] sm:text-[8.5px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap"
            >
              {theme.tierLabel}
            </span>
            <span style={{ backgroundColor: theme.hairline }} className="h-px flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({
  profile,
  onSelectBoardScale,
  onStartFlow,
}) => {
  const activeScale = profile.boardScale ?? DEFAULT_BOARD_SCALE;
  const scaleSpec = getBoardScaleSpec(activeScale);

  return (
    <div className="w-full max-w-[1620px] mx-auto px-5 sm:px-8 lg:px-10 py-6 lg:py-9 space-y-7 lg:space-y-8">
      {/* Top Hero & Smooth Fanned Card Art Showcase */}
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
              unlock directional Power Relic Totems or launch a Quick Random Duel.
            </p>
          </div>
        </div>

        {/* Right Fanned Card Art Illustration Showcase (Pure Static Art · Smooth Spring Fan · Zero Tooltips) */}
        <div className="lg:col-span-6 flex items-center justify-center py-2">
          <div className="group/fan relative w-full max-w-[500px] h-[270px] sm:h-[330px] xl:h-[360px] flex items-center justify-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-8 rounded-full bg-gradient-to-tr from-[#c97c24]/18 via-[#8d4218]/12 to-[#d6a348]/16 blur-2xl transition-opacity duration-700 ease-out group-hover/fan:opacity-100 opacity-80"
            />

            {/* Left Wing Card Art */}
            <div
              style={{
                transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                backfaceVisibility: 'hidden',
              }}
              className="relative z-10 w-[145px] sm:w-[178px] xl:w-[196px] -mr-12 sm:-mr-14 transform-gpu will-change-transform -rotate-[11deg] translate-y-3 group-hover/fan:-translate-x-3 group-hover/fan:-rotate-[14deg] group-hover/fan:translate-y-1.5"
            >
              <HeroCardIllustration cardId="glacial-mage" />
            </div>

            {/* Center Sovereign Card Art */}
            <div
              style={{
                transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                backfaceVisibility: 'hidden',
              }}
              className="relative z-20 w-[170px] sm:w-[208px] xl:w-[228px] transform-gpu will-change-transform -translate-y-2 group-hover/fan:-translate-y-4 group-hover/fan:scale-[1.025]"
            >
              <HeroCardIllustration cardId="solar-sovereign" />
            </div>

            {/* Right Wing Card Art */}
            <div
              style={{
                transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                backfaceVisibility: 'hidden',
              }}
              className="relative z-10 w-[145px] sm:w-[178px] xl:w-[196px] -ml-12 sm:-ml-14 transform-gpu will-change-transform rotate-[11deg] translate-y-3 group-hover/fan:translate-x-3 group-hover/fan:rotate-[14deg] group-hover/fan:translate-y-1.5"
            >
              <HeroCardIllustration cardId="abyssal-lich" />
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
            onClick={() => onStartFlow('arena')}
            className="group brass-panel riveted-frame p-6 text-left flex flex-col justify-between gap-5 transition-transform duration-300 ease-out hover:-translate-y-1 cursor-pointer"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 brass-plaque flex items-center justify-center text-[#eab95d]">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="organic-tag px-2.5 py-1 bg-[#1e150c] font-mono text-xs font-bold text-[#f0c76e]">
                  10 Sanctuary Tiers
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-[var(--font-display)] text-xl font-bold tracking-wide text-[#f6dfb0] group-hover:text-[#fde9be] transition-colors">
                  Championship Arena
                </h2>
                <p className="font-[var(--font-serif)] text-base text-[#cbb89a] leading-relaxed">
                  Progress through 10 themed sanctuaries on a {scaleSpec.shortLabel} battlefield,
                  clear full tiers to unlock Power Relics, and hunt Mythic boss drops.
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
            onClick={() => onStartFlow('quick')}
            className="group iron-panel riveted-frame p-6 text-left flex flex-col justify-between gap-5 transition-transform duration-300 ease-out hover:-translate-y-1 cursor-pointer"
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
