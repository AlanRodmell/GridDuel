import React, { useEffect, useRef, useState } from 'react';
import { Shield, Sparkles, Swords, Wand2, Zap } from 'lucide-react';
import { CARD_MAP, toHexDigit } from '../data/cards';
import { ArrowDir, AttackType, Owner, Rarity, TetraStats } from '../types/game';
import { sound } from '../utils/sound';
import { useCardPreview } from '../context/cardPreviewContext';

interface GameCardProps {
  cardId: string;
  stats?: TetraStats;
  baseStats?: TetraStats;
  arrows?: ArrowDir[];
  owner?: Owner | 'neutral';
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  showArrows?: boolean;
  justPlaced?: boolean;
  flipKey?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  targetStatus?: 'unopposed' | 'clash' | null;
  highlightArrows?: ArrowDir[];
  lastAugmented?: {
    label: string;
    isBuff: boolean;
    timestamp: number;
  };
  disableLongPress?: boolean;
  onClick?: () => void;
  className?: string;
}

const RARITY_FRAME: Record<Rarity, { ring: string; gem: string; innerBorder: string }> = {
  common: {
    ring: 'ring-slate-400/40',
    gem: 'bg-slate-300 border-slate-100 shadow-[0_0_6px_rgba(203,213,225,0.65)]',
    innerBorder: 'border-slate-300/25',
  },
  rare: {
    ring: 'ring-sky-400/65',
    gem: 'bg-sky-400 border-sky-100 shadow-[0_0_8px_rgba(56,189,248,0.85)]',
    innerBorder: 'border-sky-300/45',
  },
  epic: {
    ring: 'ring-violet-400/80',
    gem: 'bg-violet-400 border-violet-100 shadow-[0_0_9px_rgba(167,139,250,0.9)]',
    innerBorder: 'border-violet-300/55',
  },
  mythic: {
    ring: 'ring-amber-400/95',
    gem: 'bg-amber-400 border-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.95)]',
    innerBorder: 'border-amber-300/75',
  },
};

const TYPE_COLOR: Record<AttackType, string> = {
  P: 'text-amber-300',
  M: 'text-sky-300',
  X: 'text-emerald-300',
  A: 'text-rose-300',
};

const ARROW_POSITIONS: Record<
  ArrowDir,
  { posClass: string; rotation: string }
> = {
  n: { posClass: 'top-0.5 left-1/2 -translate-x-1/2', rotation: 'rotate-0' },
  ne: { posClass: 'top-0.5 right-0.5', rotation: 'rotate-45' },
  e: { posClass: 'top-1/2 -translate-y-1/2 right-0.5', rotation: 'rotate-90' },
  se: { posClass: 'bottom-0.5 right-0.5', rotation: 'rotate-[135deg]' },
  s: { posClass: 'bottom-0.5 left-1/2 -translate-x-1/2', rotation: 'rotate-180' },
  sw: { posClass: 'bottom-0.5 left-0.5', rotation: 'rotate-[225deg]' },
  w: { posClass: 'top-1/2 -translate-y-1/2 left-0.5', rotation: 'rotate-[270deg]' },
  nw: { posClass: 'top-0.5 left-0.5', rotation: 'rotate-[315deg]' },
};

const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 10;

export const GameCard: React.FC<GameCardProps> = ({
  cardId,
  stats,
  baseStats,
  arrows,
  owner = 'neutral',
  faceDown = false,
  selected = false,
  disabled = false,
  showArrows = true,
  justPlaced = false,
  flipKey,
  size = 'md',
  showName = false,
  targetStatus = null,
  highlightArrows = [],
  lastAugmented,
  disableLongPress = false,
  onClick,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const { openPreview } = useCardPreview();
  const longPressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressClickUntilRef = useRef<number>(0);

  const card = CARD_MAP[cardId];

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  if (!card) return null;

  const effectiveStats = stats ?? card.stats;
  const effectiveArrows = arrows ?? card.arrows;
  const refStats = baseStats ?? effectiveStats;

  const pwrDelta = effectiveStats.power - refStats.power;
  const pDefDelta = effectiveStats.pDef - refStats.pDef;
  const mDefDelta = effectiveStats.mDef - refStats.mDef;
  const hasActiveBuff = pwrDelta > 0 || pDefDelta > 0 || mDefDelta > 0;
  const hasActiveDebuff = pwrDelta < 0 || pDefDelta < 0 || mDefDelta < 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (faceDown || disableLongPress) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    clearLongPress();
    pressStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      pressStartRef.current = null;
      suppressClickUntilRef.current = Date.now() + 450;
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(16);
      }
      sound.select();
      openPreview({
        cardId,
        stats: effectiveStats,
        baseStats: refStats,
        arrows: effectiveArrows,
        owner,
        lastAugmented,
      });
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pressStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_CANCEL_PX) {
      clearLongPress();
    }
  };

  const handlePointerEnd = () => {
    clearLongPress();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!disabled && onClick) {
      onClick();
    }
  };

  const isCompact = size === 'xs';
  const statTextSize =
    size === 'xs'
      ? 'text-[10px] leading-none tracking-wider'
      : size === 'sm'
      ? 'text-[10px] sm:text-[11px] leading-none tracking-wider'
      : size === 'lg'
      ? 'text-sm sm:text-base leading-none tracking-widest'
      : 'text-xs sm:text-[13px] leading-none tracking-wider';

  const rarityStyle = RARITY_FRAME[card.rarity];
  const isFoil = card.rarity === 'epic' || card.rarity === 'mythic';

  const ownerFrame =
    owner === 'player'
      ? 'border-blue-400 shadow-[0_6px_18px_rgba(37,99,235,0.28),inset_0_0_0_1px_rgba(147,197,253,0.45)]'
      : owner === 'rival'
      ? 'border-rose-500 shadow-[0_6px_18px_rgba(225,29,72,0.28),inset_0_0_0_1px_rgba(253,164,175,0.45)]'
      : card.rarity === 'mythic'
      ? 'border-amber-400/90 shadow-[0_8px_22px_rgba(245,158,11,0.28)]'
      : card.rarity === 'epic'
      ? 'border-violet-400/80 shadow-[0_6px_18px_rgba(139,92,246,0.22)]'
      : card.rarity === 'rare'
      ? 'border-sky-400/70 shadow-[0_4px_14px_rgba(14,165,233,0.18)]'
      : 'border-amber-500/45 shadow-md';

  const ownerTint =
    owner === 'player'
      ? 'from-blue-600/36 via-blue-950/15 to-blue-950/88'
      : owner === 'rival'
      ? 'from-rose-600/36 via-rose-950/15 to-rose-950/88'
      : 'from-slate-900/15 via-transparent to-slate-950/88';

  const pwrHex = toHexDigit(effectiveStats.power);
  const pDefHex = toHexDigit(effectiveStats.pDef);
  const mDefHex = toHexDigit(effectiveStats.mDef);

  if (faceDown) {
    return (
      <div
        onClick={disabled ? undefined : onClick}
        className={`group relative aspect-square w-full overflow-hidden rounded-xl border-2 border-amber-500/55 bg-gradient-to-br from-[#231a3a] via-[#131c33] to-[#0a0f1d] shadow-[0_8px_20px_rgba(0,0,0,0.6)] select-none no-touch-callout transition-transform duration-150 ${
          onClick && !disabled
            ? 'cursor-pointer hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_12px_25px_rgba(245,158,11,0.3)]'
            : ''
        } ${className}`}
      >
        {/* Ornate Card Back Pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.45) 0%, transparent 65%)',
          }}
        />
        <div className="absolute inset-1.5 rounded-lg border border-amber-400/35 flex items-center justify-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rotate-45 rounded-sm border-2 border-amber-400/50 flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-amber-900/30 shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:scale-110 transition-transform">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 -rotate-45 text-amber-300" />
          </div>
        </div>
      </div>
    );
  }

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      disabled={onClick ? disabled : undefined}
      onClick={onClick ? handleCardClick : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onContextMenu={(e) => {
        if (!disableLongPress) {
          e.preventDefault();
        }
      }}
      aria-label={`${card.name}, stats ${pwrHex}${effectiveStats.type}${pDefHex}${mDefHex}, ${effectiveArrows.length} arrows${
        card.augment ? `, Augment: ${card.augment.description}` : ''
      }`}
      className={`group relative aspect-square w-full overflow-hidden rounded-xl border-2 ${ownerFrame} ${
        owner === 'neutral' ? `ring-1 ${rarityStyle.ring}` : ''
      } ${
        hasActiveBuff
          ? 'ring-2 ring-emerald-400/80'
          : hasActiveDebuff
          ? 'ring-2 ring-rose-400/80'
          : ''
      } bg-slate-950 text-left select-none no-touch-callout transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        selected
          ? '-translate-y-2.5 scale-[1.05] ring-2 ring-amber-300 shadow-[0_16px_34px_rgba(245,158,11,0.45)] z-20'
          : onClick && !disabled
          ? 'cursor-pointer hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_12px_26px_rgba(0,0,0,0.65)] active:scale-[0.97]'
          : ''
      } ${
        targetStatus === 'unopposed'
          ? 'ring-2 ring-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.65)]'
          : targetStatus === 'clash'
          ? 'ring-2 ring-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.65)]'
          : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
        justPlaced ? 'animate-card-drop' : ''
      } ${className}`}
    >
      <div
        key={flipKey ?? 'steady'}
        className={`relative w-full h-full ${flipKey ? 'animate-card-flip' : ''}`}
      >
        {/* Artwork with Unique Per-Card Visual Grading */}
        {!imgFailed ? (
          <img
            src={card.image}
            alt={card.name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className={`w-full h-full object-cover pointer-events-none no-touch-callout transition-transform duration-300 group-hover:scale-[1.04] ${
              card.artFilter ?? ''
            }`}
            draggable={false}
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${card.accentGradient} flex flex-col items-center justify-center p-2`}
          >
            <Shield className="w-7 h-7 text-amber-400/80 mb-1" />
            <span className="text-[11px] font-medium text-slate-200 text-center leading-tight">
              {card.name}
            </span>
          </div>
        )}

        {/* Owner color scrim & bottom vignette */}
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${ownerTint}`}
        />

        {/* Animated Foil Sheen for Epic & Mythic Cards */}
        {isFoil && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-45">
            <div className="animate-foil-shimmer absolute -inset-y-12 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          </div>
        )}

        {/* Sculpted Beveled Inner Frame + Rarity Gem */}
        <div
          className={`pointer-events-none absolute inset-1.5 rounded-[8px] border ${rarityStyle.innerBorder} shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}
        >
          {!isCompact && (
            <span
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border ${rarityStyle.gem}`}
            />
          )}
        </div>

        {/* Live Board Target Indicator */}
        {targetStatus && (
          <div className="pointer-events-none absolute inset-x-2 top-2.5 z-30 flex justify-center">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-lg border ${
                targetStatus === 'unopposed'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-400/80'
                  : 'bg-amber-950/90 text-amber-200 border-amber-400/80'
              }`}
            >
              {targetStatus === 'unopposed' ? (
                <>
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  <span>Capture</span>
                </>
              ) : (
                <>
                  <Swords className="w-2.5 h-2.5" />
                  <span>Clash</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Active Board Augment Buff / Debuff Pill (when a placed card has been augmented on the board) */}
        {(hasActiveBuff || hasActiveDebuff || lastAugmented) && !targetStatus && (
          <div className="pointer-events-none absolute top-2 inset-x-2 z-20 flex justify-center">
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold tracking-tight border shadow ${
                hasActiveDebuff && !hasActiveBuff
                  ? 'bg-rose-950/95 text-rose-200 border-rose-400/80'
                  : 'bg-emerald-950/95 text-emerald-200 border-emerald-400/80'
              }`}
            >
              <Wand2 className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">
                {pwrDelta !== 0 ? `${pwrDelta > 0 ? '+' : ''}${pwrDelta}P ` : ''}
                {pDefDelta !== 0 || mDefDelta !== 0
                  ? `${(pDefDelta || mDefDelta) > 0 ? '+' : ''}${
                      pDefDelta === mDefDelta
                        ? `${pDefDelta}D`
                        : `${pDefDelta}PD/${mDefDelta}MD`
                    }`
                  : lastAugmented?.label ?? 'AUG'}
              </span>
            </span>
          </div>
        )}

        {/* Optional Card Name Banner (Top inset when showName is true and no targetStatus overlay) */}
        {showName && !targetStatus && !hasActiveBuff && !hasActiveDebuff && (
          <div className="pointer-events-none absolute top-2 inset-x-2 z-10 flex flex-col items-center gap-0.5">
            <span className="max-w-full truncate rounded-md bg-slate-950/85 backdrop-blur-[2px] px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-100 border border-amber-300/20 shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
              {card.name}
            </span>
            {card.augment && (
              <span
                title={card.augment.description}
                className="inline-flex items-center gap-0.5 rounded bg-violet-950/90 border border-violet-400/60 px-1 py-0.2 text-[8px] sm:text-[9px] font-mono font-bold text-violet-200 shadow"
              >
                <Wand2 className="w-2 h-2 text-violet-300 shrink-0" />
                <span>{card.augment.badgeLabel}</span>
              </span>
            )}
          </div>
        )}

        {/* Compact Augment Crest when showName is false (e.g. on board or compact view) */}
        {!showName && !isCompact && card.augment && !hasActiveBuff && !hasActiveDebuff && (
          <div
            title={`${card.augment.name}: ${card.augment.description}`}
            className="pointer-events-none absolute top-2 inset-x-2 z-10 flex justify-center"
          >
            <span className="inline-flex items-center gap-0.5 rounded bg-violet-950/90 border border-violet-400/60 px-1 py-0.2 text-[8px] sm:text-[9px] font-mono font-bold text-violet-200 shadow">
              <Wand2 className="w-2 h-2 text-violet-300 shrink-0" />
              <span className="truncate">{card.augment.badgeLabel}</span>
            </span>
          </div>
        )}

        {/* Embossed FF9 4-Character Hex Stat Plate at Bottom */}
        <div className="pointer-events-none absolute bottom-2.5 inset-x-1.5 z-10 flex justify-center">
          <div
            className={`inline-flex items-center gap-0.5 rounded-md bg-gradient-to-b from-slate-900/95 to-slate-950/95 px-1.5 py-0.5 border ${
              hasActiveBuff
                ? 'border-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.45)]'
                : hasActiveDebuff
                ? 'border-rose-400/80 shadow-[0_0_10px_rgba(244,63,94,0.45)]'
                : owner === 'player'
                ? 'border-blue-400/45'
                : owner === 'rival'
                ? 'border-rose-400/45'
                : 'border-amber-400/35'
            } shadow-[0_2px_8px_rgba(0,0,0,0.9)] font-mono font-bold tabular-nums ${statTextSize}`}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
          >
            <span
              className={
                pwrDelta > 0
                  ? 'text-emerald-300'
                  : pwrDelta < 0
                  ? 'text-rose-300'
                  : 'text-white'
              }
            >
              {pwrHex}
            </span>
            <span className={TYPE_COLOR[effectiveStats.type]}>{effectiveStats.type}</span>
            <span
              className={
                pDefDelta > 0
                  ? 'text-emerald-300'
                  : pDefDelta < 0
                  ? 'text-rose-300'
                  : 'text-slate-200'
              }
            >
              {pDefHex}
            </span>
            <span
              className={
                mDefDelta > 0
                  ? 'text-emerald-300'
                  : mDefDelta < 0
                  ? 'text-rose-300'
                  : 'text-slate-200'
              }
            >
              {mDefHex}
            </span>
          </div>
        </div>

        {/* 8-Way Perimeter Gold Arrows (N, NE, E, SE, S, SW, W, NW) */}
        {showArrows &&
          effectiveArrows.map((dir) => {
            const cfg = ARROW_POSITIONS[dir];
            const isHighlighted = highlightArrows.includes(dir);
            return (
              <span
                key={dir}
                aria-hidden="true"
                className={`pointer-events-none absolute ${cfg.posClass} z-20 flex items-center justify-center`}
              >
                <svg
                  viewBox="0 0 12 12"
                  className={`${
                    isCompact
                      ? 'w-2.5 h-2.5'
                      : size === 'sm'
                      ? 'w-2.5 h-2.5 sm:w-3 sm:h-3'
                      : 'w-3.5 h-3.5 sm:w-4 sm:h-4'
                  } ${cfg.rotation} ${
                    isHighlighted
                      ? 'text-emerald-300 scale-125 drop-shadow-[0_0_6px_rgba(52,211,153,0.95)]'
                      : selected
                      ? 'text-amber-200 animate-arrow-pulse'
                      : 'text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]'
                  }`}
                  fill="currentColor"
                >
                  <path
                    d="M6 0.6L11.2 10H0.8L6 0.6Z"
                    stroke="rgba(15,23,42,0.85)"
                    strokeWidth="0.9"
                  />
                </svg>
              </span>
            );
          })}
      </div>
    </Tag>
  );
};
