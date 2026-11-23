import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Compass, Shield, Sparkles, Swords, Wand2, X } from 'lucide-react';
import {
  CardPreviewContext,
  CardPreviewData,
} from '../context/cardPreviewContext';
import {
  CARD_MAP,
  formatArrowsCompact,
  formatTetraCode,
  toHexDigit,
} from '../data/cards';
import { AttackType, Rarity } from '../types/game';
import { GameCard } from './GameCard';

const RARITY_BADGE: Record<Rarity, string> = {
  common: 'bg-slate-800/90 text-slate-200 border-slate-500/50',
  rare: 'bg-sky-950/90 text-sky-200 border-sky-400/60',
  epic: 'bg-violet-950/90 text-violet-200 border-violet-400/70',
  mythic: 'bg-amber-950/90 text-amber-200 border-amber-400/80',
};

const ATTACK_TYPE_INFO: Record<
  AttackType,
  { label: string; color: string; desc: string }
> = {
  P: {
    label: 'Physical (P)',
    color: 'text-amber-300',
    desc: 'Strikes target P.Def',
  },
  M: {
    label: 'Magical (M)',
    color: 'text-sky-300',
    desc: 'Strikes target M.Def',
  },
  X: {
    label: 'Flexible (X)',
    color: 'text-emerald-300',
    desc: 'Strikes lower of P.Def / M.Def',
  },
  A: {
    label: 'Assault (A)',
    color: 'text-rose-300',
    desc: 'Strikes target lowest stat',
  },
};

export const CardPreviewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preview, setPreview] = useState<CardPreviewData | null>(null);
  const openedAtRef = useRef<number>(0);

  const openPreview = useCallback((data: CardPreviewData) => {
    openedAtRef.current = Date.now();
    setPreview(data);
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  // Dismiss on Escape key
  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreview(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  const handleBackdropClick = () => {
    // Brief grace period so lifting your thumb after a long-press never instantly closes the preview
    if (Date.now() - openedAtRef.current < 260) return;
    closePreview();
  };

  const card = preview ? CARD_MAP[preview.cardId] : null;
  const stats = preview?.stats ?? card?.stats;
  const baseStats = preview?.baseStats ?? stats;
  const arrows = preview?.arrows ?? card?.arrows ?? [];

  const pwrDelta = stats && baseStats ? stats.power - baseStats.power : 0;
  const pDefDelta = stats && baseStats ? stats.pDef - baseStats.pDef : 0;
  const mDefDelta = stats && baseStats ? stats.mDef - baseStats.mDef : 0;
  const hasBoardMod = pwrDelta !== 0 || pDefDelta !== 0 || mDefDelta !== 0;

  return (
    <CardPreviewContext.Provider value={{ openPreview, closePreview }}>
      {children}

      {preview && card && stats && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Card preview: ${card.name}`}
          onClick={handleBackdropClick}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/82 backdrop-blur-md p-4 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-preview-pop relative w-full max-w-[360px] max-h-[92dvh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#17233f] via-[#10182b] to-[#0a101d] border border-amber-400/45 shadow-[0_28px_70px_rgba(0,0,0,0.9)] p-4 sm:p-5 space-y-4"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={closePreview}
              aria-label="Close card preview"
              className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/90 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Card Title & Rarity Header */}
            <div className="pr-10 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-slate-400">
                  #{String(card.number).padStart(2, '0')}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${RARITY_BADGE[card.rarity]}`}
                >
                  {card.rarity}
                </span>
                {preview.owner === 'player' && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-950/90 border border-blue-400/60 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                    Your Card
                  </span>
                )}
                {preview.owner === 'rival' && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-950/90 border border-rose-400/60 text-[10px] font-bold uppercase tracking-wider text-rose-200">
                    Rival Card
                  </span>
                )}
              </div>
              <h2 className="font-[var(--font-display)] text-xl font-bold text-amber-100 leading-tight">
                {card.name}
              </h2>
            </div>

            {/* Large Magnified Card Artwork + Arrows */}
            <div className="flex justify-center">
              <div className="w-[236px] sm:w-[256px] shrink-0">
                <GameCard
                  cardId={card.id}
                  stats={stats}
                  baseStats={baseStats}
                  arrows={arrows}
                  owner={preview.owner ?? 'neutral'}
                  lastAugmented={preview.lastAugmented}
                  size="lg"
                  showArrows
                  disableLongPress
                />
              </div>
            </div>

            {/* Active Board Augment Modification Banner */}
            {hasBoardMod && baseStats && (
              <div className="rounded-xl bg-emerald-950/50 border border-emerald-400/50 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-200">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Board Augmented</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-slate-200">
                  {formatTetraCode(baseStats)} →{' '}
                  <span className="text-emerald-300">{formatTetraCode(stats)}</span>
                </span>
              </div>
            )}

            {/* 4-Column Stat Breakdown */}
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-xl bg-[#0b1222] border border-slate-800 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center justify-center gap-0.5">
                  <Swords className="w-2.5 h-2.5 text-amber-300" />
                  <span>PWR</span>
                </div>
                <div
                  className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                    pwrDelta > 0
                      ? 'text-emerald-300'
                      : pwrDelta < 0
                      ? 'text-rose-300'
                      : 'text-white'
                  }`}
                >
                  {toHexDigit(stats.power)}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {stats.power}
                  {pwrDelta !== 0 && (
                    <span className={pwrDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {' '}
                      ({pwrDelta > 0 ? '+' : ''}
                      {pwrDelta})
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#0b1222] border border-slate-800 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  TYPE
                </div>
                <div
                  className={`mt-0.5 font-mono text-base font-bold ${ATTACK_TYPE_INFO[stats.type].color}`}
                >
                  {stats.type}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {stats.type === 'P'
                    ? 'Phys'
                    : stats.type === 'M'
                    ? 'Magic'
                    : stats.type === 'X'
                    ? 'Flex'
                    : 'Assault'}
                </div>
              </div>

              <div className="rounded-xl bg-[#0b1222] border border-slate-800 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center justify-center gap-0.5">
                  <Shield className="w-2.5 h-2.5 text-slate-300" />
                  <span>P.DEF</span>
                </div>
                <div
                  className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                    pDefDelta > 0
                      ? 'text-emerald-300'
                      : pDefDelta < 0
                      ? 'text-rose-300'
                      : 'text-slate-100'
                  }`}
                >
                  {toHexDigit(stats.pDef)}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {stats.pDef}
                  {pDefDelta !== 0 && (
                    <span className={pDefDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {' '}
                      ({pDefDelta > 0 ? '+' : ''}
                      {pDefDelta})
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#0b1222] border border-slate-800 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center justify-center gap-0.5">
                  <Shield className="w-2.5 h-2.5 text-sky-300" />
                  <span>M.DEF</span>
                </div>
                <div
                  className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                    mDefDelta > 0
                      ? 'text-emerald-300'
                      : mDefDelta < 0
                      ? 'text-rose-300'
                      : 'text-slate-100'
                  }`}
                >
                  {toHexDigit(stats.mDef)}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {stats.mDef}
                  {mDefDelta !== 0 && (
                    <span className={mDefDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {' '}
                      ({mDefDelta > 0 ? '+' : ''}
                      {mDefDelta})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Attack Type & Arrow Compass Summary */}
            <div className="rounded-xl bg-[#0b1222] border border-slate-800/90 px-3 py-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-semibold ${ATTACK_TYPE_INFO[stats.type].color}`}>
                  {ATTACK_TYPE_INFO[stats.type].label}
                </span>
                <span className="text-slate-400 text-[11px]">
                  {ATTACK_TYPE_INFO[stats.type].desc}
                </span>
              </div>
              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold shrink-0">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{arrows.length}▲ Arrows</span>
                </span>
                <span className="font-mono text-[11px] text-slate-300 truncate">
                  {formatArrowsCompact(arrows)}
                </span>
              </div>
            </div>

            {/* Battlefield Augment Ability Box */}
            {card.augment && (
              <div className="rounded-xl bg-gradient-to-br from-violet-950/75 via-violet-950/45 to-slate-950 border border-violet-400/60 p-3 space-y-1 shadow-inner">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-200">
                    <Wand2 className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                    <span>{card.augment.name}</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-900/80 border border-violet-400/50 text-violet-200">
                    {card.augment.shortTag}
                  </span>
                </div>
                <p className="text-xs text-violet-100/90 leading-relaxed">
                  {card.augment.description}
                </p>
              </div>
            )}

            {/* Tap Outside Hint */}
            <button
              type="button"
              onClick={closePreview}
              className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </CardPreviewContext.Provider>
  );
};
