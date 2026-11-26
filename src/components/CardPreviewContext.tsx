import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Compass, Sparkles, Wand2, X } from 'lucide-react';
import {
  CardPreviewContext,
  CardPreviewData,
} from '../context/cardPreviewContext';
import { BIOME_META, ELEMENT_META, evaluateTerrainEffect } from '../data/biomes';
import {
  CARD_MAP,
  formatArrowsCompact,
  formatTetraCode,
  resolveCardAugment,
} from '../data/cards';
import { POWER_CARD_MAP } from '../data/powerCards';
import { CARD_RARITY_THEMES } from '../styles/cardThemes';
import { sound } from '../utils/sound';
import { BiomeIcon, CardTraitPills } from './BiomeBadge';
import { GameCard } from './GameCard';

export const CardPreviewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preview, setPreview] = useState<CardPreviewData | null>(null);
  const openedAtRef = useRef<number>(0);

  const openPreview = useCallback((data: CardPreviewData) => {
    openedAtRef.current = Date.now();
    sound.drawer(true);
    setPreview(data);
  }, []);

  const closePreview = useCallback(() => {
    sound.drawer(false);
    setPreview(null);
  }, []);

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
    if (Date.now() - openedAtRef.current < 260) return;
    closePreview();
  };

  const card = preview ? CARD_MAP[preview.cardId] ?? null : null;
  const powerCard = preview ? POWER_CARD_MAP[preview.cardId] ?? null : null;
  const stats = preview?.stats ?? card?.stats;
  const baseStats = preview?.baseStats ?? stats;
  const arrows = preview?.arrows ?? card?.arrows ?? powerCard?.dirs ?? [];

  const pwrDelta = stats && baseStats ? stats.power - baseStats.power : 0;
  const pDefDelta = stats && baseStats ? stats.pDef - baseStats.pDef : 0;
  const mDefDelta = stats && baseStats ? stats.mDef - baseStats.mDef : 0;
  const hasBoardMod = pwrDelta !== 0 || pDefDelta !== 0 || mDefDelta !== 0;
  const netModDelta = pwrDelta + pDefDelta + mDefDelta;
  const terrainMeta = preview?.terrain ? BIOME_META[preview.terrain] : null;
  const activeAugment =
    card && preview ? resolveCardAugment(card.id, preview.augmentId) : undefined;

  const arenaBiomeBreakdown = useMemo(() => {
    if (!card || !stats || preview?.terrain || !preview?.arenaBiomes?.length) {
      return [];
    }
    return preview.arenaBiomes.map(({ biome, count }) => {
      const meta = BIOME_META[biome];
      const effect = evaluateTerrainEffect(biome, card);
      const projectedStats =
        effect && effect.hasEffect
          ? {
              ...stats,
              power: Math.max(0, Math.min(15, stats.power + effect.powerDelta)),
              pDef: Math.max(0, Math.min(15, stats.pDef + effect.pDefDelta)),
              mDef: Math.max(0, Math.min(15, stats.mDef + effect.mDefDelta)),
            }
          : stats;
      return { meta, count, effect, projectedStats };
    });
  }, [card, preview?.arenaBiomes, preview?.terrain, stats]);

  const activeRarity = card?.rarity ?? powerCard?.rarity ?? null;
  const theme = activeRarity ? CARD_RARITY_THEMES[activeRarity] : null;
  const contextValue = useMemo(
    () => ({ openPreview, closePreview }),
    [openPreview, closePreview]
  );

  return (
    <CardPreviewContext.Provider value={contextValue}>
      {children}

      {preview && powerCard && theme && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Relic preview: ${powerCard.name}`}
          onClick={handleBackdropClick}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#060403]/92 p-4 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-preview-pop relative w-full max-w-[420px] max-h-[95dvh] overflow-y-auto flex flex-col items-center gap-3 py-2"
          >
            <div className="w-full flex items-center justify-between gap-2 px-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="organic-tag px-2.5 py-0.5 bg-sky-950/95 text-[10px] font-[var(--font-display)] font-bold uppercase tracking-wider text-sky-200">
                  Power Relic · {powerCard.code}
                </span>
                <span
                  className={`organic-tag px-2.5 py-0.5 text-[10px] font-semibold ${
                    ELEMENT_META[powerCard.element].badgeClass
                  }`}
                >
                  {ELEMENT_META[powerCard.element].label}
                </span>
                {preview.owner === 'player' && (
                  <span className="organic-tag px-2.5 py-0.5 bg-[#162944] text-[10px] font-[var(--font-display)] font-bold uppercase tracking-wider text-[#bcd9f7]">
                    Your Relic
                  </span>
                )}
                {preview.owner === 'rival' && (
                  <span className="organic-tag px-2.5 py-0.5 bg-[#3a1616] text-[10px] font-[var(--font-display)] font-bold uppercase tracking-wider text-[#f3b6b6]">
                    Rival Relic
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={closePreview}
                aria-label="Close card preview"
                className="iron-btn w-8 h-8 rounded-[3px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full max-w-[368px] sm:max-w-[388px]">
              <GameCard
                cardId={powerCard.id}
                arrows={powerCard.dirs}
                owner={preview.owner ?? 'neutral'}
                variant="tarot"
                size="lg"
                showArrows
                disableLongPress
              />
            </div>

            <div className="w-full max-w-[388px] brass-panel px-3.5 py-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-[var(--font-display)] text-[10.5px] font-bold uppercase tracking-[0.14em] text-sky-300">
                  Persistent Relic Totem Specifics
                </span>
                <span className="font-mono text-[10.5px] text-[#e7c47a]">
                  Tier {powerCard.unlockTier} Clear
                </span>
              </div>

              <div className="organic-tag bg-[#151d28]/90 px-3 py-2 text-[11.5px] text-sky-100 space-y-1">
                <div className="font-[var(--font-display)] font-semibold text-amber-200">
                  Target Pattern: {powerCard.patternLabel}
                </div>
                <p className="text-[#dfd0b6] leading-snug">{powerCard.description}</p>
              </div>

              <p className="font-[var(--font-serif)] italic text-[11.5px] text-[#b8a487] leading-snug">
                Occupies an open battlefield socket as an un-flippable structure. Affects units
                already on target tiles and any units placed or flipped onto those tiles later!
              </p>
            </div>
          </div>
        </div>
      )}

      {preview && card && stats && theme && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Card preview: ${card.name}`}
          onClick={handleBackdropClick}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#060403]/92 p-4 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-preview-pop relative w-full max-w-[420px] max-h-[95dvh] overflow-y-auto flex flex-col items-center gap-3 py-2"
          >
            <div className="w-full flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`organic-tag px-2.5 py-0.5 text-[10px] font-[var(--font-display)] font-bold uppercase tracking-wider ${theme.badgeClass}`}
                >
                  {theme.tierLabel}
                </span>
                <CardTraitPills element={card.element} tribe={card.tribe} compact />
                {preview.owner === 'player' && (
                  <span className="organic-tag px-2.5 py-0.5 bg-[#162944] text-[10px] font-[var(--font-display)] font-bold uppercase tracking-wider text-[#bcd9f7]">
                    Your Card
                  </span>
                )}
                {preview.owner === 'rival' && (
                  <span className="organic-tag px-2.5 py-0.5 bg-[#3a1616] text-[10px] font-[var(--font-display)] font-bold uppercase tracking-wider text-[#f3b6b6]">
                    Rival Card
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={closePreview}
                aria-label="Close card preview"
                className="iron-btn w-8 h-8 rounded-[3px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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

            {terrainMeta && (
              <div
                className={`organic-tag w-full max-w-[388px] px-3.5 py-2 flex items-center justify-between gap-2 text-xs ${terrainMeta.badgeClass}`}
              >
                <span className="inline-flex items-center gap-1.5 font-[var(--font-display)] font-semibold">
                  <BiomeIcon biome={terrainMeta.id} className="w-3.5 h-3.5 shrink-0" />
                  <span>{terrainMeta.name}</span>
                </span>
                <span className="font-mono font-bold">
                  {preview.terrainMod ? preview.terrainMod.label : 'Neutral (no modifier)'}
                </span>
              </div>
            )}

            {preview.relicAuraMod && (
              <div
                className={`organic-tag w-full max-w-[388px] px-3.5 py-2 flex items-center justify-between gap-2 text-xs ${
                  preview.relicAuraMod.isPositive
                    ? 'bg-sky-950/90 text-sky-100'
                    : 'bg-rose-950/90 text-rose-100'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 font-[var(--font-display)] font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  <span>Relic Totem Aura</span>
                </span>
                <span className="font-mono font-bold truncate max-w-[230px]">
                  {preview.relicAuraMod.label}
                </span>
              </div>
            )}

            {hasBoardMod && baseStats && (
              <div
                className={`organic-tag w-full max-w-[388px] px-3.5 py-2 flex items-center justify-between gap-2 text-xs ${
                  netModDelta < 0
                    ? 'bg-rose-950/85 text-rose-100'
                    : 'bg-emerald-950/85 text-emerald-100'
                }`}
              >
                <span
                  className={`inline-flex items-center gap-1.5 font-[var(--font-display)] font-semibold ${
                    netModDelta < 0 ? 'text-rose-200' : 'text-emerald-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Effective Board Stats</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-[#efe3cd]">
                  {formatTetraCode(baseStats)} →{' '}
                  <span className={netModDelta < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                    {formatTetraCode(stats)}
                  </span>
                </span>
              </div>
            )}

            {arenaBiomeBreakdown.length > 0 && (
              <div className="w-full max-w-[388px] brass-panel px-3.5 py-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-[var(--font-display)] text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#e7c47a]">
                    Battlefield Biome Specifics
                  </span>
                  <span className="text-[10px] font-mono text-[#a89477]">
                    If placed on tile
                  </span>
                </div>

                <div className="space-y-1.5">
                  {arenaBiomeBreakdown.map(({ meta, count, effect, projectedStats }) => {
                    const hasEffect = Boolean(effect?.hasEffect);
                    const isBuff = Boolean(effect?.isPositive);
                    return (
                      <div
                        key={meta.id}
                        className={`organic-tag px-2.5 py-1.5 flex items-center justify-between gap-2 ${
                          hasEffect
                            ? isBuff
                              ? 'bg-emerald-950/75 text-emerald-100'
                              : 'bg-rose-950/75 text-rose-100'
                            : 'bg-[#1a130d]/85 text-[#baa689]'
                        }`}
                      >
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 font-[var(--font-display)] font-semibold text-[11.5px]">
                            <BiomeIcon biome={meta.id} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{meta.name}</span>
                            <span className="font-mono text-[10px] opacity-80">×{count}</span>
                          </span>
                          <span className="text-[10.5px] opacity-90 leading-tight">
                            {hasEffect && effect
                              ? effect.reasons.join(' · ')
                              : `No modifier (${meta.favorsSummary})`}
                          </span>
                        </div>

                        {hasEffect && effect ? (
                          <div className="shrink-0 text-right font-mono">
                            <div
                              className={`text-[11px] font-bold ${
                                isBuff ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {isBuff ? '▲' : '▼'} {effect.shortTag}
                            </div>
                            <div className="text-[10px] text-[#efe3cd]/90 tabular-nums">
                              {formatTetraCode(stats)} → {formatTetraCode(projectedStats)}
                            </div>
                          </div>
                        ) : (
                          <span className="shrink-0 font-mono text-[10.5px] text-[#8f7d64]">
                            Neutral
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeAugment && (
              <div className="organic-tag w-full max-w-[388px] bg-[#23152c]/90 px-3.5 py-2 text-xs text-violet-100 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-[var(--font-display)] font-bold text-violet-200">
                    <Wand2 className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                    <span>{activeAugment.name}</span>
                  </span>
                  <span className="font-mono text-[10.5px] font-bold text-violet-300">
                    {activeAugment.shortTag}
                  </span>
                </div>
                <p className="text-[11px] text-violet-100/90 leading-snug">
                  {activeAugment.description}
                </p>
              </div>
            )}

            <div className="w-full max-w-[388px] brass-panel px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-mono tabular-nums text-[#dfd0b6]">
                ATK {stats.power} · {stats.type} · P.DEF {stats.pDef} · M.DEF {stats.mDef}
              </span>
              <span
                style={{ color: theme.titleColor }}
                className="inline-flex items-center gap-1 font-mono font-semibold shrink-0"
              >
                <Compass className="w-3 h-3" />
                <span>
                  {arrows.length} ({formatArrowsCompact(arrows)})
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </CardPreviewContext.Provider>
  );
};
