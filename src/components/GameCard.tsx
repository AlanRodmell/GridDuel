import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Sparkles, Swords, Wand2, Zap } from 'lucide-react';
import {
  ALL_ARROW_DIRS,
  CARD_MAP,
  getCardThumbUrl,
  resolveCardAugment,
  toHexDigit,
} from '../data/cards';
import { POWER_CARD_MAP } from '../data/powerCards';
import { ArrowDir, AttackType, Owner, TetraStats } from '../types/game';
import { sound } from '../utils/sound';
import { useCardPreview } from '../context/cardPreviewContext';
import { ATTACK_TYPE_RULES, CARD_RARITY_THEMES } from '../styles/cardThemes';

interface GameCardProps {
  cardId: string;
  stats?: TetraStats;
  baseStats?: TetraStats;
  arrows?: ArrowDir[];
  augmentId?: string;
  owner?: Owner | 'neutral';
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  showArrows?: boolean;
  justPlaced?: boolean;
  flipKey?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'square' | 'tarot';
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
  onDoubleClick?: () => void;
  className?: string;
}

const TYPE_COLOR: Record<AttackType, string> = {
  P: 'text-amber-300',
  M: 'text-sky-300',
  X: 'text-emerald-300',
  A: 'text-rose-300',
};

const CARD_ARROW_POLYGONS: Record<ArrowDir, string> = {
  n: '50,1.2 53.8,6.4 46.2,6.4',
  ne: '97.8,2.0 92.2,3.0 97.0,7.8',
  e: '98.8,70 93.6,66.2 93.6,73.8',
  se: '97.8,138.0 92.2,137.0 97.0,132.2',
  s: '50,138.8 53.8,133.6 46.2,133.6',
  sw: '2.2,138.0 7.8,137.0 3.0,132.2',
  w: '1.2,70 6.4,66.2 6.4,73.8',
  nw: '2.2,2.0 7.8,3.0 3.0,7.8',
};

const TAROT_ARROW_POLYGONS: Record<ArrowDir, string> = {
  n: '150,4 158,15 142,15',
  ne: '293,7 280,9.5 290.5,20',
  e: '296,210 285,202 285,218',
  se: '293,413 280,410.5 290.5,400',
  s: '150,416 158,405 142,405',
  sw: '7,413 20,410.5 9.5,400',
  w: '4,210 15,202 15,218',
  nw: '7,7 20,9.5 9.5,20',
};

const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 10;

const GameCardInner: React.FC<GameCardProps> = ({
  cardId,
  stats,
  baseStats,
  arrows,
  augmentId,
  owner = 'neutral',
  faceDown = false,
  selected = false,
  disabled = false,
  showArrows = true,
  justPlaced = false,
  flipKey,
  size = 'md',
  variant = 'square',
  showName = false,
  targetStatus = null,
  highlightArrows = [],
  lastAugmented,
  disableLongPress = false,
  onClick,
  onDoubleClick,
  className = '',
}) => {
  const [imgStage, setImgStage] = useState<'thumb' | 'full' | 'failed'>(
    variant === 'tarot' ? 'full' : 'thumb'
  );
  const { openPreview } = useCardPreview();
  const [orbTip, setOrbTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const showOrbTip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const halfViewportPad = 92;
    const rawX = rect.left + rect.width / 2;
    const clampedX =
      typeof window !== 'undefined'
        ? Math.max(halfViewportPad, Math.min(window.innerWidth - halfViewportPad, rawX))
        : rawX;
    setOrbTip({ text, x: clampedX, y: rect.top - 8 });
  };

  const hideOrbTip = () => {
    setOrbTip(null);
  };

  const orbTooltipPortal =
    orbTip && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            style={{
              left: `${orbTip.x}px`,
              top: `${orbTip.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            className="pointer-events-none fixed z-[200] whitespace-nowrap brass-plaque px-3 py-1 text-[11px] font-mono font-semibold text-[#f7dfb0] shadow-[0_8px_24px_rgba(0,0,0,0.85)]"
          >
            {orbTip.text}
          </div>,
          document.body
        )
      : null;
  const longPressTimerRef = useRef<number | null>(null);
  const singleClickTimerRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const pressStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressClickUntilRef = useRef<number>(0);

  const card = CARD_MAP[cardId];
  const powerCard = POWER_CARD_MAP[cardId];

  useEffect(() => {
    setImgStage(variant === 'tarot' ? 'full' : 'thumb');
  }, [cardId, variant]);

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
      if (singleClickTimerRef.current !== null) {
        window.clearTimeout(singleClickTimerRef.current);
      }
    };
  }, []);

  const dispatchCardActivation = (e: React.MouseEvent) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (disabled) return;

    if (!onDoubleClick) {
      onClick?.();
      return;
    }

    const now = Date.now();
    const isSecondClick = e.detail >= 2 || now - lastTapTimeRef.current < 260;

    if (isSecondClick) {
      if (singleClickTimerRef.current !== null) {
        window.clearTimeout(singleClickTimerRef.current);
        singleClickTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;
      onDoubleClick();
      return;
    }

    lastTapTimeRef.current = now;
    if (!onClick) return;
    if (singleClickTimerRef.current !== null) {
      window.clearTimeout(singleClickTimerRef.current);
    }
    singleClickTimerRef.current = window.setTimeout(() => {
      singleClickTimerRef.current = null;
      lastTapTimeRef.current = 0;
      onClick();
    }, 190);
  };

  if (!card && !powerCard) return null;

  if (powerCard) {
    const pTheme = CARD_RARITY_THEMES[powerCard.rarity];
    const relicArrowSet = new Set(powerCard.dirs);
    const pHighlightSet = highlightArrows.length > 0 ? new Set(highlightArrows) : null;
    const pImgSrc =
      imgStage === 'thumb' ? getCardThumbUrl(powerCard.image) : powerCard.image;
    const handleRelicImgError = () => {
      setImgStage((prev) => (prev === 'thumb' ? 'full' : 'failed'));
    };

    const handleRelicPointerDown = (e: React.PointerEvent) => {
      setOrbTip(null);
      if (faceDown || disableLongPress) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearLongPress();
      pressStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        pressStartRef.current = null;
        suppressClickUntilRef.current = Date.now() + 450;
        sound.select();
        openPreview({
          cardId: powerCard.id,
          arrows: powerCard.dirs,
          owner,
        });
      }, LONG_PRESS_MS);
    };

    const handleRelicPointerMove = (e: React.PointerEvent) => {
      const start = pressStartRef.current;
      if (!start || start.pointerId !== e.pointerId) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_CANCEL_PX) {
        clearLongPress();
      }
    };

    const handleRelicClick = (e: React.MouseEvent) => {
      dispatchCardActivation(e);
    };

    const relicShadow =
      owner === 'player'
        ? '0 0 0 2px rgba(56, 189, 248, 0.92), 0 6px 18px rgba(14, 165, 233, 0.4)'
        : owner === 'rival'
        ? '0 0 0 2px rgba(244, 114, 182, 0.92), 0 6px 18px rgba(225, 29, 72, 0.4)'
        : '0 0 0 1.5px rgba(56, 189, 248, 0.65), 0 8px 20px rgba(0, 0, 0, 0.7)';

    const relicWash =
      owner === 'player'
        ? 'radial-gradient(ellipse 100% 90% at 50% 0%, rgba(14, 165, 233, 0.3) 0%, rgba(2, 132, 199, 0.14) 55%, rgba(15, 23, 42, 0.14) 100%)'
        : owner === 'rival'
        ? 'radial-gradient(ellipse 100% 90% at 50% 0%, rgba(236, 72, 153, 0.3) 0%, rgba(159, 18, 57, 0.14) 55%, rgba(15, 23, 42, 0.14) 100%)'
        : 'radial-gradient(ellipse 100% 90% at 50% 0%, rgba(56, 189, 248, 0.18) 0%, rgba(15, 23, 42, 0.15) 100%)';

    const isRelicInteractive = Boolean(onClick || onDoubleClick);
    const RelicTag = isRelicInteractive ? 'button' : 'div';

    if (variant === 'tarot') {
      return (
        <RelicTag
          type={isRelicInteractive ? 'button' : undefined}
          disabled={isRelicInteractive ? disabled : undefined}
          onClick={isRelicInteractive ? handleRelicClick : undefined}
          onPointerDown={handleRelicPointerDown}
          onPointerMove={handleRelicPointerMove}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
          onContextMenu={(e) => {
            if (!disableLongPress) e.preventDefault();
          }}
          aria-label={`${powerCard.name}, Power Relic (${powerCard.code}), ${powerCard.description}`}
          style={{
            background: pTheme.bezelGradient,
            boxShadow: relicShadow,
          }}
          className={`card-contain card-weathered-rim group relative aspect-[5/7] w-full p-[3.5px] text-left select-none no-touch-callout transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            justPlaced ? 'animate-card-drop' : ''
          } ${className}`}
        >
          <div
            style={{ background: pTheme.surfaceGradient }}
            className="card-weathered-rim relative w-full h-full overflow-hidden"
          >
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{ background: relicWash }}
            />

            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-35">
              <div
                className={`animate-foil-shimmer absolute -inset-y-16 w-1/2 bg-gradient-to-r from-transparent ${pTheme.foilVia} to-transparent`}
              />
            </div>

            {showArrows && (
              <svg
                aria-hidden="true"
                viewBox="0 0 300 420"
                className="pointer-events-none absolute inset-0 w-full h-full z-20"
              >
                {ALL_ARROW_DIRS.map((dir) => {
                  const isActive = relicArrowSet.has(dir);
                  const isHighlighted = pHighlightSet?.has(dir) ?? false;
                  return (
                    <polygon
                      key={dir}
                      points={TAROT_ARROW_POLYGONS[dir]}
                      fill={
                        isHighlighted
                          ? '#34f5a8'
                          : isActive
                          ? '#38bdf8'
                          : 'rgba(255, 255, 255, 0.12)'
                      }
                      stroke={isActive || isHighlighted ? '#041322' : undefined}
                      strokeWidth={isActive || isHighlighted ? 2.4 : undefined}
                      strokeLinejoin="round"
                    />
                  );
                })}
              </svg>
            )}

            <div className="relative z-10 h-full w-full px-[7.6%] py-[6%]">
              <div
                style={{ borderColor: 'rgba(125, 211, 252, 0.5)' }}
                className="h-full w-full rounded-[4px] border px-2.5 py-2 flex flex-col justify-between gap-1.5"
              >
                <div className="organic-tag bg-black/45 px-2.5 py-1 text-center shrink-0">
                  <div
                    style={{ color: pTheme.titleColor }}
                    className="font-[var(--font-display)] text-[13px] sm:text-[14.5px] font-bold uppercase tracking-[0.09em] leading-[1.15] [text-wrap:balance]"
                  >
                    {powerCard.name}
                  </div>
                  <div className="font-[var(--font-serif)] italic text-[11px] sm:text-[12px] text-sky-200 leading-tight truncate">
                    {powerCard.code} · Tier {powerCard.unlockTier} Relic Totem
                  </div>
                </div>

                <div
                  style={{
                    borderColor: 'rgba(125, 211, 252, 0.55)',
                    background: pTheme.archBackdrop,
                  }}
                  className="relative flex-1 min-h-0 w-full overflow-hidden rounded-t-[999px] rounded-b-[4px] border-[1.5px]"
                >
                  {imgStage !== 'failed' ? (
                    <img
                      src={pImgSrc}
                      alt={powerCard.name}
                      width={1024}
                      height={1024}
                      loading="eager"
                      decoding="async"
                      onError={handleRelicImgError}
                      className={`w-full h-full object-cover object-top pointer-events-none no-touch-callout ${
                        powerCard.artFilter ?? ''
                      }`}
                      draggable={false}
                    />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${powerCard.accentGradient} flex items-center justify-center`}
                    >
                      <Sparkles className="w-10 h-10 text-sky-300/85" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/75 to-transparent flex items-end justify-center pb-1">
                    <span className="organic-tag px-2.5 py-0.5 bg-sky-950/95 text-[10px] font-mono font-bold text-sky-200">
                      {powerCard.patternLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 px-0.5">
                  <span className="h-px flex-1 bg-sky-400/35" />
                  <span className="font-[var(--font-display)] text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-[0.16em] text-sky-200 whitespace-nowrap">
                    Power Relic · {pTheme.tierLabel}
                  </span>
                  <span className="h-px flex-1 bg-sky-400/35" />
                </div>

                <div className="organic-tag bg-black/45 px-2.5 py-1.5 text-center space-y-0.5 shrink-0">
                  <p className="font-[var(--font-serif)] text-[11px] sm:text-[12px] leading-[1.25] text-slate-100/95">
                    {powerCard.description}
                  </p>
                </div>

                <div className="organic-tag bg-sky-950/85 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-sky-200">
                    <Sparkles className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span>Un-Flippable Totem</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-amber-200">
                    {powerCard.badgeLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </RelicTag>
      );
    }

    const pInnerInset = size === 'xs' ? 'p-[5px]' : 'px-[6.8%] py-[6.8%]';

    return (
      <RelicTag
        type={isRelicInteractive ? 'button' : undefined}
        disabled={isRelicInteractive ? disabled : undefined}
        onClick={isRelicInteractive ? handleRelicClick : undefined}
        onPointerDown={handleRelicPointerDown}
        onPointerMove={handleRelicPointerMove}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(e) => {
          if (!disableLongPress) e.preventDefault();
        }}
        aria-label={`${powerCard.name}, Power Relic, ${powerCard.shortTag}`}
        style={{
          background: pTheme.bezelGradient,
          boxShadow: relicShadow,
        }}
        className={`card-contain card-weathered-rim group relative aspect-[5/7] w-full overflow-hidden p-[2px] sm:p-[2.5px] text-left select-none no-touch-callout transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
          selected
            ? '-translate-y-2.5 scale-[1.05] drop-shadow-[0_0_12px_rgba(56,189,248,0.85)] z-20'
            : onClick && !disabled
            ? 'cursor-pointer hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.97]'
            : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
          justPlaced ? 'animate-card-drop' : ''
        } ${className}`}
      >
        <div
          style={{ background: pTheme.surfaceGradient }}
          className="card-weathered-rim relative w-full h-full overflow-hidden [container-type:inline-size]"
        >
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{ background: relicWash }}
          />

          <div className={`relative z-10 w-full h-full ${pInnerInset}`}>
            <div
              style={{ borderColor: 'rgba(125, 211, 252, 0.55)' }}
              className="relative w-full h-full rounded-[4px] border flex flex-col items-center justify-between p-[2.5px] sm:p-[3.5px] gap-[2px] sm:gap-[3px] bg-black/25"
            >
              {showName && size !== 'xs' && (
                <div className="organic-tag w-full bg-sky-950/80 px-1 py-[1.5px] text-center shrink-0">
                  <div
                    style={{ color: pTheme.titleColor }}
                    className="font-[var(--font-display)] text-[clamp(5.5px,6.3cqw,9.5px)] font-bold uppercase tracking-[0.015em] leading-[1.12] [text-wrap:balance] break-normal"
                  >
                    {powerCard.name}
                  </div>
                </div>
              )}

              <div
                style={{
                  borderColor: 'rgba(125, 211, 252, 0.6)',
                  background: pTheme.archBackdrop,
                }}
                className="relative flex-1 min-h-0 w-full overflow-hidden rounded-t-[999px] rounded-b-[3px] border"
              >
                {imgStage !== 'failed' ? (
                  <img
                    src={pImgSrc}
                    alt={powerCard.name}
                    width={320}
                    height={320}
                    loading="lazy"
                    decoding="async"
                    onError={handleRelicImgError}
                    className={`w-full h-full object-cover object-top pointer-events-none no-touch-callout ${
                      powerCard.artFilter ?? ''
                    }`}
                    draggable={false}
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${powerCard.accentGradient} flex items-center justify-center p-1`}
                  >
                    <Sparkles className="w-5 h-5 text-sky-300" />
                  </div>
                )}

                <div className="pointer-events-none absolute top-1 inset-x-1 flex justify-center">
                  <span className="organic-tag px-1.5 py-[1px] bg-sky-950/95 text-[6.5px] sm:text-[7.5px] font-[var(--font-display)] font-bold uppercase tracking-wider text-sky-200">
                    Relic
                  </span>
                </div>
              </div>

              <div className="organic-tag w-full bg-sky-950/95 px-1 py-[2px] text-center shrink-0 flex items-center justify-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-sky-300 shrink-0 hidden sm:inline" />
                <span className="font-mono text-[7px] sm:text-[8.5px] font-bold text-amber-200 truncate">
                  {powerCard.badgeLabel}
                </span>
              </div>
            </div>
          </div>

          {showArrows && (
            <svg
              aria-hidden="true"
              viewBox="0 0 100 140"
              className="pointer-events-none absolute inset-0 w-full h-full z-20"
            >
              {ALL_ARROW_DIRS.map((dir) => {
                const isActive = relicArrowSet.has(dir);
                const isHighlighted = pHighlightSet?.has(dir) ?? false;
                return (
                  <polygon
                    key={dir}
                    points={CARD_ARROW_POLYGONS[dir]}
                    fill={
                      isHighlighted
                        ? '#34f5a8'
                        : isActive
                        ? '#38bdf8'
                        : 'rgba(255, 255, 255, 0.12)'
                    }
                    stroke={isActive || isHighlighted ? '#041322' : undefined}
                    strokeWidth={isActive || isHighlighted ? 1.15 : undefined}
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>
          )}
        </div>
      </RelicTag>
    );
  }

  if (!card) return null;

  const theme = CARD_RARITY_THEMES[card.rarity];
  const activeAugment = resolveCardAugment(card.id, augmentId);
  const effectiveStats = stats ?? card.stats;
  const effectiveArrows = arrows ?? card.arrows;
  const activeArrowSet = new Set(effectiveArrows);
  const highlightSet = highlightArrows.length > 0 ? new Set(highlightArrows) : null;
  const refStats = baseStats ?? effectiveStats;

  const pwrDelta = effectiveStats.power - refStats.power;
  const pDefDelta = effectiveStats.pDef - refStats.pDef;
  const mDefDelta = effectiveStats.mDef - refStats.mDef;
  const hasActiveBuff = pwrDelta > 0 || pDefDelta > 0 || mDefDelta > 0;
  const hasActiveDebuff = pwrDelta < 0 || pDefDelta < 0 || mDefDelta < 0;

  const handleImgError = () => {
    setImgStage((prev) => (prev === 'thumb' ? 'full' : 'failed'));
  };

  const imgSrc =
    imgStage === 'thumb' ? getCardThumbUrl(card.image) : card.image;

  const handlePointerDown = (e: React.PointerEvent) => {
    setOrbTip(null);
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
        augmentId,
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
    dispatchCardActivation(e);
  };

  const isCompact = size === 'xs';
  const isFoil = card.rarity === 'epic' || card.rarity === 'mythic';
  const pwrHex = toHexDigit(effectiveStats.power);
  const pDefHex = toHexDigit(effectiveStats.pDef);
  const mDefHex = toHexDigit(effectiveStats.mDef);

  const ownerShadow =
    owner === 'player'
      ? '0 0 0 2px rgba(96, 165, 250, 0.92), 0 6px 16px rgba(37, 99, 235, 0.36)'
      : owner === 'rival'
      ? '0 0 0 2px rgba(251, 113, 133, 0.92), 0 6px 16px rgba(225, 29, 72, 0.36)'
      : theme.outerGlow;

  const ownerWash =
    owner === 'player'
      ? 'radial-gradient(ellipse 100% 90% at 50% 0%, rgba(59, 130, 246, 0.26) 0%, rgba(29, 78, 216, 0.12) 55%, rgba(15, 23, 42, 0.1) 100%)'
      : owner === 'rival'
      ? 'radial-gradient(ellipse 100% 90% at 50% 0%, rgba(244, 63, 94, 0.28) 0%, rgba(190, 18, 60, 0.12) 55%, rgba(15, 23, 42, 0.1) 100%)'
      : undefined;

  if (faceDown) {
    const backTheme = CARD_RARITY_THEMES.mythic;
    return (
      <div
        onClick={disabled ? undefined : onClick}
        style={{
          background: backTheme.bezelGradient,
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.55)',
        }}
        className={`card-contain card-weathered-rim group relative aspect-[5/7] ${
          variant === 'tarot' ? 'p-[3px]' : 'p-[2px]'
        } w-full overflow-hidden select-none no-touch-callout transition-transform duration-150 ${
          onClick && !disabled
            ? 'cursor-pointer hover:-translate-y-1'
            : ''
        } ${className}`}
      >
        <div
          style={{ background: backTheme.surfaceGradient }}
          className="card-weathered-rim relative w-full h-full flex items-center justify-center overflow-hidden"
        >
          <div
            style={{ borderColor: backTheme.hairline }}
            className="absolute inset-2 rounded-[5px] border flex items-center justify-center"
          >
            <div
              style={{
                borderColor: backTheme.archBorder,
                background: backTheme.archBackdrop,
              }}
              className="w-[62%] h-[68%] rounded-t-[999px] rounded-b-[4px] border flex items-center justify-center"
            >
              <div className="w-7 h-7 sm:w-9 sm:h-9 rotate-45 rounded-sm border border-amber-300/75 flex items-center justify-center bg-gradient-to-br from-amber-500/25 to-amber-950/60 group-hover:scale-110 transition-transform">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 -rotate-45 text-amber-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isInteractive = Boolean(onClick || onDoubleClick);
  const Tag = isInteractive ? 'button' : 'div';
  const typeRule = ATTACK_TYPE_RULES[effectiveStats.type];

  const renderStatValueColor = (delta: number, fallback: string) =>
    delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : fallback;

  const typeShortLabel: Record<AttackType, string> = {
    P: 'Physical',
    M: 'Magical',
    X: 'Flexible',
    A: 'Assault',
  };

  // =========================================================================
  // FULL COLLECTOR TAROT VARIANT (Card Preview & Gallery Inspector)
  // =========================================================================
  if (variant === 'tarot') {
    const tarotStats = [
      {
        label: 'Attack',
        tooltip: `Attack · ${effectiveStats.power} (${pwrHex})`,
        value: pwrHex,
        colorClass: renderStatValueColor(pwrDelta, 'text-white'),
      },
      {
        label: 'Type',
        tooltip: `Type · ${typeShortLabel[effectiveStats.type]} (${effectiveStats.type})`,
        value: effectiveStats.type,
        colorClass: TYPE_COLOR[effectiveStats.type],
      },
      {
        label: 'Phys Def',
        tooltip: `Phys Def · ${effectiveStats.pDef} (${pDefHex})`,
        value: pDefHex,
        colorClass: renderStatValueColor(pDefDelta, 'text-slate-100'),
      },
      {
        label: 'Magic Def',
        tooltip: `Magic Def · ${effectiveStats.mDef} (${mDefHex})`,
        value: mDefHex,
        colorClass: renderStatValueColor(mDefDelta, 'text-slate-100'),
      },
    ];

    return (
      <Tag
        type={isInteractive ? 'button' : undefined}
        disabled={isInteractive ? disabled : undefined}
        onClick={isInteractive ? handleCardClick : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onContextMenu={(e) => {
          if (!disableLongPress) e.preventDefault();
        }}
        aria-label={`${card.name}, ${card.rarity}, stats ${pwrHex}${effectiveStats.type}${pDefHex}${mDefHex}, ${effectiveArrows.length} arrows`}
        style={{
          background: theme.bezelGradient,
          boxShadow: ownerShadow,
        }}
        className={`card-contain card-weathered-rim group relative aspect-[5/7] w-full p-[3.5px] text-left select-none no-touch-callout transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          justPlaced ? 'animate-card-drop' : ''
        } ${className}`}
      >
        <div
          key={flipKey ?? 'steady'}
          style={{ background: theme.surfaceGradient }}
          className={`card-weathered-rim relative w-full h-full overflow-hidden ${
            flipKey ? 'animate-card-flip' : ''
          }`}
        >
          {ownerWash && (
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{ background: ownerWash }}
            />
          )}

          {/* Foil Shimmer (only animated on single Tarot showcase card) */}
          {isFoil && (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-35">
              <div
                className={`animate-foil-shimmer absolute -inset-y-16 w-1/2 bg-gradient-to-r from-transparent ${theme.foilVia} to-transparent`}
              />
            </div>
          )}

          {/* Single-SVG 8-Way Compass Perimeter Arrows */}
          {showArrows && (
            <svg
              aria-hidden="true"
              viewBox="0 0 300 420"
              className="pointer-events-none absolute inset-0 w-full h-full z-20"
            >
              {ALL_ARROW_DIRS.map((dir) => {
                const isActive = activeArrowSet.has(dir);
                const isHighlighted = highlightSet?.has(dir) ?? false;
                return (
                  <polygon
                    key={dir}
                    points={TAROT_ARROW_POLYGONS[dir]}
                    fill={
                      isHighlighted
                        ? '#34f5a8'
                        : isActive
                        ? '#ff7b1c'
                        : 'rgba(255, 255, 255, 0.14)'
                    }
                    stroke={isActive || isHighlighted ? '#05070e' : undefined}
                    strokeWidth={isActive || isHighlighted ? 2.4 : undefined}
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>
          )}

          {/* Inner Hairline Frame — Proportional Inset Keeps Arrows Clear of Nameplate */}
          <div className="relative z-10 h-full w-full px-[7.6%] py-[6%]">
            <div
              style={{ borderColor: theme.hairline }}
              className="h-full w-full rounded-[4px] border px-2.5 py-2 flex flex-col justify-between gap-1.5"
            >
              {/* 1. Framed Serif Title Plate */}
              <div className="organic-tag bg-black/35 px-2.5 py-1 text-center shrink-0">
                <div
                  style={{ color: theme.titleColor }}
                  className="font-[var(--font-display)] text-[13px] sm:text-[14.5px] font-bold uppercase tracking-[0.09em] leading-[1.15] [text-wrap:balance]"
                >
                  {card.name}
                </div>
                <div
                  style={{ color: theme.subtitleColor }}
                  className="font-[var(--font-serif)] italic text-[11px] sm:text-[12px] leading-tight truncate"
                >
                  #{String(card.number).padStart(2, '0')} ·{' '}
                  {activeAugment ? activeAugment.name : typeRule.title}
                </div>
              </div>

              {/* 2. Arched Dome Artwork Window */}
              <div
                style={{
                  borderColor: theme.archBorder,
                  background: theme.archBackdrop,
                }}
                className="relative flex-1 min-h-0 w-full overflow-hidden rounded-t-[999px] rounded-b-[4px] border-[1.5px]"
              >
                {imgStage !== 'failed' ? (
                  <img
                    src={imgSrc}
                    alt={card.name}
                    width={1024}
                    height={1024}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={handleImgError}
                    className={`w-full h-full object-cover object-top pointer-events-none no-touch-callout ${
                      card.artFilter ?? ''
                    }`}
                    draggable={false}
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${card.accentGradient} flex items-center justify-center`}
                  >
                    <Shield className="w-10 h-10 text-amber-300/80" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/55 to-transparent" />
              </div>

              {/* 3. Role · Rarity Rule Divider */}
              <div className="flex items-center gap-2 shrink-0 px-0.5">
                <span
                  style={{ backgroundColor: theme.hairline }}
                  className="h-px flex-1"
                />
                <span
                  style={{ color: theme.labelColor }}
                  className="font-[var(--font-display)] text-[8.5px] sm:text-[9.5px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap"
                >
                  {card.role} · {theme.tierLabel}
                </span>
                <span
                  style={{ backgroundColor: theme.hairline }}
                  className="h-px flex-1"
                />
              </div>

              {/* 4. Framed Ability / Lore Box */}
              <div className="organic-tag bg-black/35 px-2.5 py-1.5 text-center space-y-0.5 shrink-0">
                <p className="font-[var(--font-serif)] text-[11px] sm:text-[12px] leading-[1.25] text-slate-100/95 line-clamp-2">
                  <strong style={{ color: theme.titleColor }} className="font-semibold">
                    {activeAugment ? `${activeAugment.name}.` : `${typeRule.title}.`}
                  </strong>{' '}
                  {activeAugment ? activeAugment.description : typeRule.rule}
                </p>
                <p
                  style={{ color: theme.subtitleColor }}
                  className="font-[var(--font-serif)] italic text-[10px] sm:text-[11px] leading-tight truncate"
                >
                  {activeAugment ? `“${activeAugment.shortTag}”` : typeRule.flavor}
                </p>
              </div>

              {/* 5. Four Full-Size Circular Metallic-Ringed Stat Orbs (Hover for Unclipped Portal Tooltip) */}
              <div className="grid grid-cols-4 gap-2 pt-0.5 shrink-0">
                {tarotStats.map((item) => (
                  <div
                    key={item.label}
                    onMouseEnter={(e) => showOrbTip(e, item.tooltip)}
                    onMouseLeave={hideOrbTip}
                    className="group/orb relative flex items-center justify-center"
                  >
                    <div
                      style={{ background: theme.orbRingGradient }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[1.5px] shadow-[0_2px_8px_rgba(0,0,0,0.65)] transition-transform duration-150 group-hover/orb:scale-108"
                    >
                      <div
                        style={{ background: theme.orbFill }}
                        className="w-full h-full rounded-full flex items-center justify-center"
                      >
                        <span
                          className={`font-mono text-base sm:text-lg font-bold tabular-nums leading-none ${item.colorClass}`}
                        >
                          {item.value}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {orbTooltipPortal}
      </Tag>
    );
  }

  // =========================================================================
  // SQUARE TACTICAL BOARD / HAND / GALLERY / SHOP VARIANT
  // =========================================================================
  const innerInsetClass =
    size === 'xs' ? 'p-[5px]' : 'px-[6.8%] py-[6.8%]';

  const orbMaxClass =
    size === 'sm'
      ? 'max-w-[22px] sm:max-w-[29px] lg:max-w-[35px] text-[8.5px] sm:text-[11.5px] lg:text-[13px]'
      : size === 'lg'
      ? 'max-w-[38px] sm:max-w-[44px] text-sm sm:text-base'
      : 'max-w-[30px] sm:max-w-[36px] text-xs sm:text-sm';

  const squareOrbs = [
    {
      key: 'pwr',
      tooltip: `Attack · ${effectiveStats.power} (${pwrHex})`,
      value: pwrHex,
      colorClass: renderStatValueColor(pwrDelta, 'text-white'),
    },
    {
      key: 'type',
      tooltip: `Type · ${typeShortLabel[effectiveStats.type]} (${effectiveStats.type})`,
      value: effectiveStats.type,
      colorClass: TYPE_COLOR[effectiveStats.type],
    },
    {
      key: 'pdef',
      tooltip: `Phys Def · ${effectiveStats.pDef} (${pDefHex})`,
      value: pDefHex,
      colorClass: renderStatValueColor(pDefDelta, 'text-slate-100'),
    },
    {
      key: 'mdef',
      tooltip: `Magic Def · ${effectiveStats.mDef} (${mDefHex})`,
      value: mDefHex,
      colorClass: renderStatValueColor(mDefDelta, 'text-slate-100'),
    },
  ];

  const directionsToRender = isCompact ? effectiveArrows : ALL_ARROW_DIRS;
  const showMediumDetails = size === 'md' || size === 'lg';

  return (
    <Tag
      type={isInteractive ? 'button' : undefined}
      disabled={isInteractive ? disabled : undefined}
      onClick={isInteractive ? handleCardClick : undefined}
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
        activeAugment ? `, Augment: ${activeAugment.description}` : ''
      }`}
      style={{
        background: theme.bezelGradient,
        boxShadow: ownerShadow,
      }}
      className={`card-contain card-weathered-rim group relative aspect-[5/7] w-full overflow-hidden p-[2px] sm:p-[2.5px] ${
        hasActiveBuff
          ? 'ring-2 ring-emerald-400/90'
          : hasActiveDebuff
          ? 'ring-2 ring-rose-400/90'
          : ''
      } text-left select-none no-touch-callout transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        selected
          ? '-translate-y-2.5 scale-[1.05] drop-shadow-[0_0_12px_rgba(245,190,78,0.8)] z-20'
          : isInteractive && !disabled
          ? 'cursor-pointer hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.97]'
          : ''
      } ${
        targetStatus === 'unopposed'
          ? 'ring-2 ring-emerald-400'
          : targetStatus === 'clash'
          ? 'ring-2 ring-amber-400'
          : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
        justPlaced ? 'animate-card-drop' : ''
      } ${className}`}
    >
      <div
        key={flipKey ?? 'steady'}
        style={{ background: theme.surfaceGradient }}
        className={`card-weathered-rim relative w-full h-full overflow-hidden [container-type:inline-size] ${
          flipKey ? 'animate-card-flip' : ''
        }`}
      >
        {ownerWash && (
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{ background: ownerWash }}
          />
        )}

        {/* Lightweight Static Foil Sheen on Epic/Mythic Grid Cards (Animates only when Selected) */}
        {isFoil && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-30">
            {selected ? (
              <div
                className={`animate-foil-shimmer absolute -inset-y-12 w-1/2 bg-gradient-to-r from-transparent ${theme.foilVia} to-transparent`}
              />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-tr from-transparent ${theme.foilVia} to-transparent opacity-50`}
              />
            )}
          </div>
        )}

        {/* Inner Tarot Hairline Frame with Arched Artwork + Circular Stat Orbs */}
        <div className={`relative z-10 w-full h-full ${innerInsetClass}`}>
          <div
            style={{
              borderColor:
                owner === 'player'
                  ? 'rgba(147, 197, 253, 0.55)'
                  : owner === 'rival'
                  ? 'rgba(253, 164, 175, 0.55)'
                  : theme.hairline,
            }}
            className="relative w-full h-full rounded-[4px] border flex flex-col items-center justify-between p-[2.5px] sm:p-[3.5px] gap-[2px] sm:gap-[3px] bg-black/15"
          >
            {/* Optional Serif Nameplate — Scales Proportionally to Card Width, Never Mid-Word Wraps */}
            {showName && !isCompact && !targetStatus && !hasActiveBuff && !hasActiveDebuff && (
              <div className="organic-tag w-full bg-black/50 px-1 py-[1.5px] text-center shrink-0">
                <div
                  style={{ color: theme.titleColor }}
                  className="font-[var(--font-display)] text-[clamp(5.5px,6.3cqw,9.5px)] font-bold uppercase tracking-[0.015em] leading-[1.12] [text-wrap:balance] break-normal"
                >
                  {card.name}
                </div>
              </div>
            )}

            {/* Arched Dome Portrait Frame */}
            <div
              style={{
                borderColor: theme.archBorder,
                background: theme.archBackdrop,
              }}
              className="relative flex-1 min-h-0 w-full overflow-hidden rounded-t-[999px] rounded-b-[3px] border"
            >
              {imgStage !== 'failed' ? (
                <img
                  src={imgSrc}
                  alt={card.name}
                  width={320}
                  height={320}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={handleImgError}
                  className={`w-full h-full object-cover object-top pointer-events-none no-touch-callout ${
                    card.artFilter ?? ''
                  }`}
                  draggable={false}
                />
              ) : (
                <div
                  className={`w-full h-full bg-gradient-to-br ${card.accentGradient} flex flex-col items-center justify-center p-1`}
                >
                  <Shield className="w-5 h-5 text-amber-300/80" />
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/60 to-transparent" />

              {!isCompact && activeAugment && !targetStatus && !hasActiveBuff && !hasActiveDebuff && (
                <div
                  title={`${activeAugment.name}: ${activeAugment.description}`}
                  className="pointer-events-none absolute bottom-0.5 inset-x-0.5 z-10 flex justify-center"
                >
                  <span className="organic-tag inline-flex items-center gap-0.5 bg-violet-950/95 px-1.5 py-[1px] text-[7px] sm:text-[8px] font-mono font-bold text-violet-100 max-w-full">
                    <Wand2 className="w-2 h-2 text-violet-300 shrink-0" />
                    <span className="truncate">{activeAugment.badgeLabel}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Role · Rarity Divider on Medium/Large Rectangular Cards */}
            {showMediumDetails && (
              <div className="w-full flex items-center gap-1 px-0.5 shrink-0">
                <span
                  style={{ backgroundColor: theme.hairline }}
                  className="h-px flex-1"
                />
                <span
                  style={{ color: theme.labelColor }}
                  className="font-[var(--font-display)] text-[6.5px] sm:text-[7.5px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap leading-none"
                >
                  {card.role} · {theme.tierLabel}
                </span>
                <span
                  style={{ backgroundColor: theme.hairline }}
                  className="h-px flex-1"
                />
              </div>
            )}

            {/* Bottom Stat Orbs (4 Circular Metallic-Ringed Badges, or Compact Pill on xs) */}
            {isCompact ? (
              <div
                style={{ borderColor: theme.hairline }}
                className="inline-flex items-center gap-0.5 rounded bg-black/75 border px-1 py-[1px] font-mono text-[8.5px] font-bold leading-none tabular-nums shrink-0"
              >
                <span className={renderStatValueColor(pwrDelta, 'text-white')}>{pwrHex}</span>
                <span className={TYPE_COLOR[effectiveStats.type]}>{effectiveStats.type}</span>
                <span className={renderStatValueColor(pDefDelta, 'text-slate-200')}>{pDefHex}</span>
                <span className={renderStatValueColor(mDefDelta, 'text-slate-200')}>{mDefHex}</span>
              </div>
            ) : (
              <div className="w-full grid grid-cols-4 gap-[3px] sm:gap-[4px] place-items-center shrink-0 pt-[1px]">
                {squareOrbs.map((orb) => (
                  <div
                    key={orb.key}
                    onMouseEnter={(e) => showOrbTip(e, orb.tooltip)}
                    onMouseLeave={hideOrbTip}
                    className="group/orb relative w-full flex items-center justify-center min-w-0"
                  >
                    <div
                      style={{
                        background:
                          hasActiveBuff
                            ? 'linear-gradient(145deg, #6ee7b7, #059669)'
                            : hasActiveDebuff
                            ? 'linear-gradient(145deg, #fda4af, #e11d48)'
                            : theme.orbRingGradient,
                      }}
                      className={`w-full aspect-square ${orbMaxClass} rounded-full p-[1.25px] transition-transform duration-150 group-hover/orb:scale-108`}
                    >
                      <div
                        style={{ background: theme.orbFill }}
                        className="w-full h-full rounded-full flex items-center justify-center font-mono font-bold tabular-nums leading-none"
                      >
                        <span className={orb.colorClass}>{orb.value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Board Target Indicator */}
        {targetStatus && (
          <div className="pointer-events-none absolute inset-x-2 top-3 z-30 flex justify-center">
            <span
              className={`organic-tag inline-flex items-center gap-1 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow ${
                targetStatus === 'unopposed'
                  ? 'bg-emerald-950/95 text-emerald-300'
                  : 'bg-amber-950/95 text-amber-200'
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

        {/* Active Board Augment Buff / Debuff Pill */}
        {(hasActiveBuff || hasActiveDebuff || lastAugmented) && !targetStatus && (
          <div className="pointer-events-none absolute top-2.5 inset-x-2 z-30 flex justify-center">
            <span
              className={`organic-tag inline-flex items-center gap-0.5 px-2 py-0.5 text-[8.5px] sm:text-[9.5px] font-mono font-bold tracking-tight shadow ${
                hasActiveDebuff && !hasActiveBuff
                  ? 'bg-rose-950/95 text-rose-200'
                  : 'bg-emerald-950/95 text-emerald-200'
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

        {/* Single-SVG 8-Way Compass Perimeter Arrows (5:7 Rectangular Coordinates) */}
        {showArrows && (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 140"
            className="pointer-events-none absolute inset-0 w-full h-full z-20"
          >
            {directionsToRender.map((dir) => {
              const isActive = activeArrowSet.has(dir);
              const isHighlighted = highlightSet?.has(dir) ?? false;
              return (
                <polygon
                  key={dir}
                  points={CARD_ARROW_POLYGONS[dir]}
                  fill={
                    isHighlighted
                      ? '#34f5a8'
                      : isActive
                      ? '#ff7b1c'
                      : 'rgba(255, 255, 255, 0.14)'
                  }
                  stroke={isActive || isHighlighted ? '#05070e' : undefined}
                  strokeWidth={isActive || isHighlighted ? 1.15 : undefined}
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>
        )}
      </div>
      {orbTooltipPortal}
    </Tag>
  );
};

export const GameCard = React.memo(GameCardInner);
