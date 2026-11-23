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
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-12 sm:space-y-16">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
        {/* Left Copy & Primary CTAs */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/35 text-amber-200 text-xs font-medium tracking-wide">
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>4×4 Tactical Fantasy Card Duel</span>
          </div>

          <div className="space-y-3">
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-wide text-amber-100 leading-[1.08]">
              Aether Triad
            </h1>
            <p className="font-[var(--font-serif)] italic text-lg sm:text-xl text-amber-200/85">
              “A kingdom is only as wide as its arrows.”
            </p>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Outflank rivals across a 4×4 obsidian board using 8-way compass arrows, hexadecimal
              clashes, combo chains, and custom Runeforge augments.
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
              className="min-h-[52px] px-7 py-3 rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 active:scale-[0.98] text-slate-950 font-[var(--font-display)] font-bold text-base tracking-wide shadow-[0_10px_28px_rgba(245,158,11,0.35)] border border-amber-200/70 flex items-center justify-center gap-2 transition-transform cursor-pointer"
            >
              <Swords className="w-5 h-5" />
              <span>Play a Match</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                onStartFlow('quick');
              }}
              className="min-h-[52px] px-5 py-3 rounded-xl bg-[#11192d] hover:bg-[#182442] border border-sky-400/40 text-sky-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Dices className="w-4 h-4 text-sky-300" />
              <span>Quick Random Duel</span>
            </button>
          </div>

          {/* Secondary Utility Links */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 pt-1 text-xs sm:text-sm text-slate-400">
            <button
              type="button"
              onClick={() => {
                sound.select();
                onOpenGallery();
              }}
              className="inline-flex items-center gap-1.5 hover:text-amber-200 transition-colors cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4 text-slate-400" />
              <span>
                Gallery ({ownedUniqueCount}/{totalCards})
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                sound.select();
                onOpenShop();
              }}
              className="inline-flex items-center gap-1.5 hover:text-amber-200 transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-slate-400" />
              <span>Shop &amp; Runeforge</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sound.select();
                onOpenRules();
              }}
              className="inline-flex items-center gap-1.5 hover:text-amber-200 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>How to Play</span>
            </button>
          </div>
        </div>

        {/* Right Fanned Collector Tarot Showcase */}
        <div className="lg:col-span-6 flex items-center justify-center py-4 sm:py-6">
          <div className="relative w-full max-w-[440px] h-[300px] sm:h-[360px] flex items-center justify-center">
            {/* Ambient Gold & Violet Halo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-6 rounded-full bg-gradient-to-tr from-amber-500/15 via-violet-500/12 to-sky-500/15 blur-2xl"
            />

            {/* Left Card (Rare) */}
            <div className="w-[155px] sm:w-[190px] -mr-14 sm:-mr-16 -rotate-[11deg] translate-y-4 opacity-90 transition-transform duration-300 hover:-translate-y-1 hover:z-30">
              <GameCard
                cardId="glacial-mage"
                variant="tarot"
                size="md"
                showArrows
              />
            </div>

            {/* Center Hero Card (Mythic) */}
            <div className="relative z-20 w-[180px] sm:w-[220px] -translate-y-2 transition-transform duration-300 hover:-translate-y-4">
              <GameCard
                cardId="solar-sovereign"
                variant="tarot"
                size="lg"
                showArrows
              />
            </div>

            {/* Right Card (Epic) */}
            <div className="w-[155px] sm:w-[190px] -ml-14 sm:-ml-16 rotate-[11deg] translate-y-4 opacity-90 transition-transform duration-300 hover:-translate-y-1 hover:z-30">
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

      {/* Clean 3-Pillar Game Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#0e1526]/90 border border-slate-800/90 p-5 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300">
            <Compass className="w-4 h-4" />
          </div>
          <h2 className="font-[var(--font-display)] text-base font-bold text-slate-100">
            8-Way Flanks &amp; Clashes
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Point unopposed arrows to capture rivals instantly, or trigger high-stakes hex stat
            clashes that chain into multi-card combos.
          </p>
        </div>

        <div className="rounded-2xl bg-[#0e1526]/90 border border-slate-800/90 p-5 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-center text-sky-300">
            <Trophy className="w-4 h-4" />
          </div>
          <h2 className="font-[var(--font-display)] text-base font-bold text-slate-100">
            Arena Ladder or Quick Duel
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Climb the 10-tier Championship Arena to unlock Bosses &amp; Mythic drops, or jump into a
            one-off duel against a random challenger.
          </p>
        </div>

        <div className="rounded-2xl bg-[#0e1526]/90 border border-slate-800/90 p-5 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-400/35 flex items-center justify-center text-violet-300">
            <Hammer className="w-4 h-4" />
          </div>
          <h2 className="font-[var(--font-display)] text-base font-bold text-slate-100">
            Collect &amp; Runeforge
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Claim spoils from defeated foes, hunt peak stat rolls across {totalCards} cards, and
            imbue custom Augment Runes at the Shop Runeforge.
          </p>
        </div>
      </section>

      {/* Subtle Progress Footer Bar */}
      <section className="rounded-2xl bg-[#0c1322] border border-slate-800/80 px-5 py-4 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-300">
          <span>
            Record:{' '}
            <strong className="font-mono text-emerald-300">{profile.wins}W</strong>{' '}
            <span className="text-slate-600">·</span>{' '}
            <strong className="font-mono text-rose-300">{profile.losses}L</strong>
          </span>
          <span>
            Arena Conquered:{' '}
            <strong className="font-mono text-amber-300">
              {conqueredCount}/{ALL_FIGHTERS.length}
            </strong>
          </span>
          <span>
            Collection:{' '}
            <strong className="font-mono text-sky-300">
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
          className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-semibold transition-colors cursor-pointer"
        >
          <span>Continue Arena Ladder</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
};
