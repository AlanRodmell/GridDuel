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
            className="pointer-events-none fixed z-[200] whitespace-nowrap rounded-lg bg-slate-950/95 border border-amber-400/60 px-2.5 py-1 text-[11px] font-mono font-semibold text-amber-100 shadow-[0_8px_24px_rgba(0,0,0,0.75)]"
          >
            {orbTip.text}
          </div>,
          document.body
        )
      : null;
  const longPressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressClickUntilRef = useRef<number>(0);

  const card = CARD_MAP[cardId];

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
    };
  }, []);

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
        className={`card-contain group relative aspect-[5/7] ${
          variant === 'tarot' ? 'rounded-[16px] p-[3px]' : 'rounded-xl p-[2px]'
        } w-full overflow-hidden select-none no-touch-callout transition-transform duration-150 ${
          onClick && !disabled
            ? 'cursor-pointer hover:-translate-y-1'
            : ''
        } ${className}`}
      >
        <div
          style={{ background: backTheme.surfaceGradient }}
          className={`relative w-full h-full ${
            variant === 'tarot' ? 'rounded-[13px]' : 'rounded-[10px]'
          } flex items-center justify-center overflow-hidden`}
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

  const Tag = onClick ? 'button' : 'div';
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
        type={onClick ? 'button' : undefined}
        disabled={onClick ? disabled : undefined}
        onClick={onClick ? handleCardClick : undefined}
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
        className={`card-contain group relative aspect-[5/7] w-full rounded-[16px] p-[3.5px] text-left select-none no-touch-callout transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          justPlaced ? 'animate-card-drop' : ''
        } ${className}`}
      >
        <div
          key={flipKey ?? 'steady'}
          style={{ background: theme.surfaceGradient }}
          className={`relative w-full h-full rounded-[12.5px] overflow-hidden ${
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
              <div
                style={{ borderColor: theme.hairline }}
                className="rounded-[2px] border bg-black/25 px-2 py-1 text-center shrink-0"
              >
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
              <div
                style={{ borderColor: theme.hairline }}
                className="rounded-[2px] border bg-black/30 px-2 py-1.5 text-center space-y-0.5 shrink-0"
              >
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
    size === 'xs' ? 'p-[5px]' : 'px-[8.4%] py-[7%]';

  const orbMaxClass =
    size === 'sm'
      ? 'max-w-[24px] sm:max-w-[28px] text-[9.5px] sm:text-[11.5px]'
      : size === 'lg'
      ? 'max-w-[38px] sm:max-w-[44px] text-sm sm:text-base'
      : 'max-w-[30px] sm:max-w-[36px] text-xs sm:text-sm';

  const nameplateTextClass =
    size === 'sm'
      ? 'text-[7px] sm:text-[8px]'
      : size === 'lg'
      ? 'text-[9px] sm:text-[10.5px]'
      : 'text-[8px] sm:text-[9px]';

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
        activeAugment ? `, Augment: ${activeAugment.description}` : ''
      }`}
      style={{
        background: theme.bezelGradient,
        boxShadow: ownerShadow,
      }}
      className={`card-contain group relative aspect-[5/7] w-full overflow-hidden rounded-xl p-[2px] sm:p-[2.5px] ${
        hasActiveBuff
          ? 'ring-2 ring-emerald-400/90'
          : hasActiveDebuff
          ? 'ring-2 ring-rose-400/90'
          : ''
      } text-left select-none no-touch-callout transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        selected
          ? '-translate-y-2.5 scale-[1.05] ring-2 ring-amber-300 z-20'
          : onClick && !disabled
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
        className={`relative w-full h-full rounded-[9.5px] overflow-hidden ${
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
            className="relative w-full h-full rounded-[4px] border flex flex-col items-center justify-between p-[3px] sm:p-[4px] gap-[2px] sm:gap-[3px] bg-black/15"
          >
            {/* Optional Serif Nameplate — Standardized Uniform Font Size, Never Truncated */}
            {showName && !isCompact && !targetStatus && !hasActiveBuff && !hasActiveDebuff && (
              <div
                style={{ borderColor: theme.hairline }}
                className="w-full rounded-[2px] border bg-black/45 px-1 py-[1.5px] text-center shrink-0"
              >
                <div
                  style={{ color: theme.titleColor }}
                  className={`font-[var(--font-display)] font-bold uppercase tracking-[0.04em] leading-[1.12] [text-wrap:balance] break-words ${nameplateTextClass}`}
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
                  <span className="inline-flex items-center gap-0.5 rounded bg-violet-950/90 border border-violet-300/60 px-1 py-[0.5px] text-[7px] sm:text-[8px] font-mono font-bold text-violet-100 max-w-full">
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
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow border ${
                targetStatus === 'unopposed'
                  ? 'bg-emerald-950/95 text-emerald-300 border-emerald-400/80'
                  : 'bg-amber-950/95 text-amber-200 border-amber-400/80'
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
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8.5px] sm:text-[9.5px] font-mono font-bold tracking-tight border shadow ${
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
