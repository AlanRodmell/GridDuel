import React from 'react';
import {
  BookOpen,
  ChevronRight,
  Compass,
  Crown,
  Dices,
  Hammer,
  LayoutGrid,
  ShoppingBag,
  Swords,
  Trophy,
} from 'lucide-react';
import { ALL_FIGHTERS } from '../data/ladder';
import { PlayerProfile } from '../types/game';
import { sound } from '../utils/sound';
import { GameCard } from './GameCard';

export type PlayLaunchIntent = 'choose' | 'arena' | 'quick';

interface HomeViewProps {
  profile: PlayerProfile;
  ownedUniqueCount: number;
  totalCards: number;
  onStartFlow: (intent: PlayLaunchIntent) => void;
  onOpenGallery: () => void;
  onOpenShop: () => void;
  onOpenRules: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  profile,
  ownedUniqueCount,
  totalCards,
  onStartFlow,
  onOpenGallery,
  onOpenShop,
  onOpenRules,
}) => {
  const conqueredCount = Object.values(profile.fighterWins ?? {}).filter((w) => w > 0).length;

  return (
    <div className="w-full max-w-[1680px] mx-auto px-5 sm:px-8 lg:px-10 py-8 lg:py-12 space-y-10 lg:space-y-12">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
        {/* Left Copy & Primary CTAs */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[3px] brass-plaque text-[#e9c479] font-[var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.18em]">
            <Crown className="w-3.5 h-3.5 text-[#d8a243]" />
            <span>4×4 Tactical Biome Card War</span>
          </div>

          <div className="space-y-3">
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl lg:text-[58px] font-bold tracking-[0.08em] text-[#f5dfb2] leading-[1.05] drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)]">
              GridDuel
            </h1>
            <div className="ornate-divider max-w-[260px] mx-auto lg:mx-0" />
            <p className="font-[var(--font-serif)] italic text-xl sm:text-2xl text-[#dec391]">
              “Master the terrain, command the arrows, claim the board.”
            </p>
            <p className="font-[var(--font-serif)] text-base sm:text-lg text-[#c7b69a] leading-relaxed max-w-xl mx-auto lg:mx-0">
              Outflank rivals across an open 4×4 biome battlefield using 8-way compass arrows,
              elemental &amp; tribal terrain shifts, combo chains, and forged Runeforge augments.
            </p>
          </div>

          {/* Primary Play CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                sound.select();
                onStartFlow('choose');
              }}
              className="brass-btn min-h-[52px] px-7 py-3 rounded-[3px] font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <Swords className="w-5 h-5" />
              <span>Enter the Arena</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                onStartFlow('quick');
              }}
              className="iron-btn min-h-[52px] px-5 py-3 rounded-[3px] font-[var(--font-display)] font-semibold tracking-wide text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Dices className="w-4 h-4 text-[#d8a64c]" />
              <span>Quick Random Duel</span>
            </button>
          </div>

          {/* Secondary Utility Links */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 pt-1 text-xs sm:text-sm font-[var(--font-display)] tracking-wide text-[#a89578]">
            <button
              type="button"
              onClick={() => {
                sound.select();
                onOpenGallery();
              }}
              className="inline-flex items-center gap-1.5 hover:text-[#f2d089] transition-colors cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4 text-[#9a8364]" />
              <span>
                Compendium ({ownedUniqueCount}/{totalCards})
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                sound.select();
                onOpenShop();
              }}
              className="inline-flex items-center gap-1.5 hover:text-[#f2d089] transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-[#9a8364]" />
              <span>Vault &amp; Runeforge</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sound.select();
                onOpenRules();
              }}
              className="inline-flex items-center gap-1.5 hover:text-[#f2d089] transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#9a8364]" />
              <span>Field Codex</span>
            </button>
          </div>
        </div>

        {/* Right Fanned Collector Tarot Showcase */}
        <div className="lg:col-span-6 flex items-center justify-center py-4 sm:py-6">
          <div className="relative w-full max-w-[540px] h-[320px] sm:h-[400px] xl:h-[440px] flex items-center justify-center">
            {/* Warm Candlelit & Ember Hearth Halo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-6 rounded-full bg-gradient-to-tr from-[#c97c24]/20 via-[#8d4218]/14 to-[#d6a348]/18 blur-2xl"
            />

            {/* Left Card (Rare) */}
            <div className="w-[165px] sm:w-[205px] xl:w-[228px] -mr-14 sm:-mr-16 -rotate-[11deg] translate-y-4 opacity-92 transition-transform duration-300 hover:-translate-y-1 hover:z-30 drop-shadow-[0_18px_24px_rgba(0,0,0,0.8)]">
              <GameCard
                cardId="glacial-mage"
                variant="tarot"
                size="md"
                showArrows
              />
            </div>

            {/* Center Hero Card (Mythic) */}
            <div className="relative z-20 w-[195px] sm:w-[240px] xl:w-[266px] -translate-y-2 transition-transform duration-300 hover:-translate-y-4 drop-shadow-[0_24px_32px_rgba(0,0,0,0.88)]">
              <GameCard
                cardId="solar-sovereign"
                variant="tarot"
                size="lg"
                showArrows
              />
            </div>

            {/* Right Card (Epic) */}
            <div className="w-[165px] sm:w-[205px] xl:w-[228px] -ml-14 sm:-ml-16 rotate-[11deg] translate-y-4 opacity-92 transition-transform duration-300 hover:-translate-y-1 hover:z-30 drop-shadow-[0_18px_24px_rgba(0,0,0,0.8)]">
              <GameCard
                cardId="abyssal-lich"
                variant="tarot"
                size="md"
                showArrows
              />
            </div>
          </div>
        </div>
      </section>

      {/* Rugged 3-Pillar Campaign Plaques */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="iron-panel riveted-frame rounded-[4px] p-5 space-y-2.5">
          <div className="w-9 h-9 rounded-[3px] brass-plaque flex items-center justify-center text-[#e6b85c]">
            <Compass className="w-4 h-4" />
          </div>
          <h2 className="font-[var(--font-display)] text-base font-bold tracking-wide text-[#f2dfb9]">
            8-Way Flanks &amp; Clashes
          </h2>
          <p className="font-[var(--font-serif)] text-[15px] text-[#bda98c] leading-relaxed">
            Point unopposed arrows to capture rivals instantly, or trigger high-stakes hex stat
            clashes that chain into multi-card combos.
          </p>
        </div>

        <div className="iron-panel riveted-frame rounded-[4px] p-5 space-y-2.5">
          <div className="w-9 h-9 rounded-[3px] brass-plaque flex items-center justify-center text-[#d99d4a]">
            <Trophy className="w-4 h-4" />
          </div>
          <h2 className="font-[var(--font-display)] text-base font-bold tracking-wide text-[#f2dfb9]">
            Arena Ladder &amp; Skirmish
          </h2>
          <p className="font-[var(--font-serif)] text-[15px] text-[#bda98c] leading-relaxed">
            Climb the 10-tier Championship Arena to unlock Bosses &amp; Mythic drops, or jump into a
            one-off duel against a random unlocked rival.
          </p>
        </div>

        <div className="iron-panel riveted-frame rounded-[4px] p-5 space-y-2.5">
          <div className="w-9 h-9 rounded-[3px] brass-plaque flex items-center justify-center text-[#e0934c]">
            <Hammer className="w-4 h-4" />
          </div>
          <h2 className="font-[var(--font-display)] text-base font-bold tracking-wide text-[#f2dfb9]">
            Spoils &amp; Runeforge
          </h2>
          <p className="font-[var(--font-serif)] text-[15px] text-[#bda98c] leading-relaxed">
            Claim spoils from defeated foes, hunt peak stat rolls across {totalCards} cards, and
            imbue custom Augment Runes at the Runeforge anvil.
          </p>
        </div>
      </section>

      {/* Campaign Ledger Footer Bar */}
      <section className="brass-panel riveted-frame rounded-[4px] px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[#cbbba0]">
          <span className="font-[var(--font-display)] tracking-wide text-xs uppercase">
            Record:{' '}
            <strong className="font-mono text-sm text-emerald-400">{profile.wins}W</strong>{' '}
            <span className="text-[#5e4d3a]">·</span>{' '}
            <strong className="font-mono text-sm text-rose-400">{profile.losses}L</strong>
          </span>
          <span className="font-[var(--font-display)] tracking-wide text-xs uppercase">
            Arena Conquered:{' '}
            <strong className="font-mono text-sm text-[#f0c76e]">
              {conqueredCount}/{ALL_FIGHTERS.length}
            </strong>
          </span>
          <span className="font-[var(--font-display)] tracking-wide text-xs uppercase">
            Compendium:{' '}
            <strong className="font-mono text-sm text-[#e8d5b3]">
              {ownedUniqueCount}/{totalCards}
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            sound.select();
            onStartFlow('arena');
          }}
          className="inline-flex items-center gap-1.5 font-[var(--font-display)] text-xs sm:text-sm uppercase tracking-wider text-[#f0c76e] hover:text-[#fae2a8] font-bold transition-colors cursor-pointer"
        >
          <span>Continue Arena Ladder</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
};
