import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Compass, Sparkles, X } from 'lucide-react';
import {
  CardPreviewContext,
  CardPreviewData,
} from '../context/cardPreviewContext';
import {
  CARD_MAP,
  formatArrowsCompact,
  formatTetraCode,
} from '../data/cards';
import { CARD_RARITY_THEMES } from '../styles/cardThemes';
import { GameCard } from './GameCard';

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

  const theme = card ? CARD_RARITY_THEMES[card.rarity] : null;
  const contextValue = useMemo(
    () => ({ openPreview, closePreview }),
    [openPreview, closePreview]
  );

  return (
    <CardPreviewContext.Provider value={contextValue}>
      {children}

      {preview && card && stats && theme && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Card preview: ${card.name}`}
          onClick={handleBackdropClick}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050811]/90 p-4 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-preview-pop relative w-full max-w-[420px] max-h-[95dvh] overflow-y-auto flex flex-col items-center gap-3 py-2"
          >
            {/* Floating Header Strip: Ownership + Close */}
            <div className="w-full flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${theme.badgeClass}`}
                >
                  {theme.tierLabel}
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

              <button
                type="button"
                onClick={closePreview}
                aria-label="Close card preview"
                className="w-8 h-8 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/90 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Full Luxury Collector Tarot Card */}
            <div className="w-full max-w-[368px] sm:max-w-[388px]">
              <GameCard
                cardId={card.id}
                stats={stats}
                baseStats={baseStats}
                arrows={arrows}
                augmentId={preview.augmentId}
                owner={preview.owner ?? 'neutral'}
                lastAugmented={preview.lastAugmented}
                variant="tarot"
                size="lg"
                showArrows
                disableLongPress
              />
            </div>

            {/* Active Board Augment Modification Banner */}
            {hasBoardMod && baseStats && (
              <div className="w-full max-w-[388px] rounded-xl bg-emerald-950/70 border border-emerald-400/50 px-3 py-2 flex items-center justify-between gap-2 text-xs">
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

            {/* Compact Decimal & Compass Readout Pill */}
            <div
              style={{ borderColor: theme.hairline }}
              className="w-full max-w-[388px] rounded-xl bg-[#0b101d]/90 border px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
            >
              <span className="font-mono tabular-nums text-slate-300">
                PWR {stats.power} · P.DEF {stats.pDef} · M.DEF {stats.mDef}
              </span>
              <span
                style={{ color: theme.titleColor }}
                className="inline-flex items-center gap-1 font-mono font-semibold shrink-0"
              >
                <Compass className="w-3 h-3" />
                <span>
                  {arrows.length}▲ ({formatArrowsCompact(arrows)})
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </CardPreviewContext.Provider>
  );
};
