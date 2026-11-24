import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Layers,
  Play,
  Search,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import {
  ALL_ELEMENTS,
  ALL_TRIBES,
  BIOME_META,
  ELEMENT_META,
  TRIBE_META,
  evaluateTerrainEffect,
} from '../data/biomes';
import {
  CARD_MAP,
  formatTetraCode,
  getCardThumbUrl,
  getStatsPowerScore,
  resolveCardAugment,
} from '../data/cards';
import { getFighterBiomes } from '../data/ladder';
import { HAND_SIZE } from '../engine/triadEngine';
import { AutoBuildStrategy, MAX_DECK_SLOTS } from '../store/useProfile';
import {
  AttackType,
  CardElement,
  CardTribe,
  DeckSlot,
  HandCard,
  LadderFighter,
  PlayerProfile,
  Rarity,
  RolledCardInstance,
} from '../types/game';
import { sound } from '../utils/sound';
import { BiomePill, CardTraitPills } from './BiomeBadge';
import { DeckShelf } from './DeckShelf';
import { GameCard } from './GameCard';

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  mythic: 'text-amber-300',
};

interface DeckBuilderWorkspaceProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  previewDeckHand: HandCard[];
  currentFighter: LadderFighter;
  gameMode: 'arena' | 'quick';
  onSelectDeckSlot: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
  onToggleDeckCard: (uidOrCardId: string) => { ok: boolean; message?: string };
  onAutoBuildDeck: (strategy: AutoBuildStrategy) => void;
  onStartMatch: () => void;
  onGoToGallery: () => void;
  onOpenRules: () => void;
}

export const DeckBuilderWorkspace: React.FC<DeckBuilderWorkspaceProps> = ({
  profile,
  activeDeck,
  previewDeckHand,
  currentFighter,
  gameMode,
  onSelectDeckSlot,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onToggleDeckCard,
  onAutoBuildDeck,
  onStartMatch,
  onGoToGallery,
  onOpenRules,
}) => {
  const [hoveredDeckIdx, setHoveredDeckIdx] = useState<number | null>(null);
  const [showSavedDecksDrawer, setShowSavedDecksDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AttackType>('all');
  const [elementFilter, setElementFilter] = useState<'all' | CardElement>('all');
  const [tribeFilter, setTribeFilter] = useState<'all' | CardTribe>('all');
  const [onlyAugments, setOnlyAugments] = useState(false);

  const arenaBiomes = useMemo(() => getFighterBiomes(currentFighter.id), [currentFighter.id]);
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];
  const activeDeckUidSet = useMemo(() => new Set(activeDeck.cards), [activeDeck.cards]);

  const filteredLibrary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const all: RolledCardInstance[] = Object.values(profile.inventory).flat();

    return all
      .filter((inst) => {
        const def = CARD_MAP[inst.cardId];
        if (!def) return false;
        if (rarityFilter !== 'all' && def.rarity !== rarityFilter) return false;
        if (typeFilter !== 'all' && inst.stats.type !== typeFilter) return false;
        if (elementFilter !== 'all' && def.element !== elementFilter) return false;
        if (tribeFilter !== 'all' && def.tribe !== tribeFilter) return false;
        const aug = resolveCardAugment(inst.cardId, inst.augmentId);
        if (onlyAugments && !aug) return false;
        if (
          q &&
          !def.name.toLowerCase().includes(q) &&
          !ELEMENT_META[def.element].label.toLowerCase().includes(q) &&
          !TRIBE_META[def.tribe].label.toLowerCase().includes(q) &&
          !(aug && aug.name.toLowerCase().includes(q))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aIn = activeDeckUidSet.has(a.uid) ? 1 : 0;
        const bIn = activeDeckUidSet.has(b.uid) ? 1 : 0;
        if (aIn !== bIn) return bIn - aIn;
        return (
          getStatsPowerScore(b.stats, b.arrows.length) -
          getStatsPowerScore(a.stats, a.arrows.length)
        );
      });
  }, [
    activeDeckUidSet,
    elementFilter,
    onlyAugments,
    profile.inventory,
    rarityFilter,
    searchQuery,
    tribeFilter,
    typeFilter,
  ]);

  const totalArrows = useMemo(
    () => previewDeckHand.reduce((sum, c) => sum + c.arrows.length, 0),
    [previewDeckHand]
  );

  return (
    <div className="space-y-4">
      {/* Compact Top Matchup + Saved Decks Toggle + Start Match Strip */}
      <div className="rounded-2xl bg-gradient-to-r from-[#14203c] via-[#10182b] to-[#211326] border border-amber-500/35 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-rose-400/80 shrink-0">
            {rivalAvatarCard && (
              <img
                src={getCardThumbUrl(rivalAvatarCard.image)}
                alt={currentFighter.name}
                width={320}
                height={320}
                loading="lazy"
                decoding="async"
                className={`w-full h-full object-cover ${rivalAvatarCard.artFilter ?? ''}`}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              {gameMode === 'quick' ? 'Quick Random Duel' : `Tier ${currentFighter.tierNumber} Arena`}{' '}
              · +{currentFighter.winGold}g Purse
            </div>
            <div className="font-[var(--font-display)] text-base sm:text-lg font-bold text-white leading-snug">
              Facing {currentFighter.name}{' '}
              <span className="text-xs font-sans font-normal text-slate-400">
                ({currentFighter.specialty})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Arena Biomes:
              </span>
              {arenaBiomes.map((b) => (
                <BiomePill key={b} biome={b} compact />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sound.select();
              setShowSavedDecksDrawer((v) => !v);
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showSavedDecksDrawer
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-[#0b1120] border-slate-700 text-slate-200 hover:border-amber-400/50'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-300" />
            <span>
              Saved Decks ({profile.decks.length}/{MAX_DECK_SLOTS})
            </span>
            {showSavedDecksDrawer ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onStartMatch}
            className="min-h-[42px] px-6 py-2 rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 active:scale-[0.98] text-slate-950 font-[var(--font-display)] font-bold text-sm sm:text-base tracking-wide shadow-[0_8px_22px_rgba(245,158,11,0.35)] border border-amber-200/70 flex items-center gap-2 transition-transform cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Match</span>
          </button>
        </div>
      </div>

      {/* Collapsible Hearthstone Saved Decks Manager */}
      {showSavedDecksDrawer && (
        <div className="rounded-2xl bg-[#10182a] border border-amber-500/35 p-4 sm:p-5 shadow-xl">
          <DeckShelf
            decks={profile.decks}
            activeDeckIndex={profile.activeDeckIndex}
            inventory={profile.inventory}
            onSelectDeck={onSelectDeckSlot}
            onCreateDeck={onCreateDeck}
            onRenameDeck={onRenameDeck}
            onDeleteDeck={onDeleteDeck}
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* ACTIVE DECK PANEL: HORIZONTAL CASCADING CARD SPREAD               */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-gradient-to-b from-[#131d36] via-[#0f172a] to-[#0a101d] border border-amber-500/35 p-4 sm:p-5 space-y-3 shadow-[0_18px_42px_rgba(0,0,0,0.5)]">
        {/* Compact Deck Controls Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
                Active Deck ·{' '}
                <span className="font-mono text-emerald-300">
                  {previewDeckHand.length}/{HAND_SIZE}
                </span>{' '}
                <span className="text-slate-500">·</span>{' '}
                <span className="font-mono text-sky-300">{totalArrows} arrows</span>
              </div>
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-amber-100 leading-tight">
                {activeDeck.name}
              </h2>
            </div>

            {/* Quick Saved-Deck Pills */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
              {profile.decks.map((d, idx) => {
                const isSel = idx === profile.activeDeckIndex;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      sound.select();
                      onSelectDeckSlot(idx);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                      isSel
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                        : 'bg-[#0a101e] text-slate-400 border-slate-800 hover:text-slate-100'
                    }`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Compact Auto-Fill Row */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#090f1d] border border-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1 mr-0.5" />
              {(
                [
                  { id: 'power', label: 'Power' },
                  { id: 'arrows', label: 'Arrows' },
                  { id: 'augments', label: 'Augs' },
                  { id: 'assault', label: 'X/A' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onAutoBuildDeck(opt.id)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-800 text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenRules}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#090f1d] border border-slate-800 text-[11px] text-slate-300 hover:text-amber-200 hover:border-amber-400/40 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Rules</span>
            </button>

            <button
              type="button"
              onClick={onGoToGallery}
              className="px-2.5 py-1.5 rounded-lg bg-[#090f1d] border border-slate-800 text-[11px] text-slate-300 hover:text-amber-200 hover:border-amber-400/40 transition-colors cursor-pointer"
            >
              Compendium →
            </button>
          </div>
        </div>

        {/* HORIZONTAL CASCADING DECK SPREAD — Hover Pulls Card Completely Into View */}
        <div
          onMouseLeave={() => setHoveredDeckIdx(null)}
          className="relative w-full overflow-x-auto pt-5 pb-4 px-3 sm:px-6"
        >
          <div className="flex items-center justify-start md:justify-center min-w-max mx-auto">
            {previewDeckHand.map((hCard, idx) => {
              const isHovered = hoveredDeckIdx === idx;
              const isLeftOfHovered = hoveredDeckIdx !== null && idx < hoveredDeckIdx;
              const isRightOfHovered = hoveredDeckIdx !== null && idx > hoveredDeckIdx;
              const canRemove = previewDeckHand.length > 1;
              const centerOffset = idx - (previewDeckHand.length - 1) / 2;
              const restRotate = centerOffset * 1.1;
              const restDropY = Math.abs(centerOffset) * 2.5;

              return (
                <div
                  key={hCard.uid}
                  onMouseEnter={() => setHoveredDeckIdx(idx)}
                  style={{
                    marginLeft: idx === 0 ? 0 : '-26px',
                    zIndex: isHovered ? 40 : idx + 1,
                    transform: isHovered
                      ? 'translate3d(0, -16px, 0) scale(1.1) rotate(0deg)'
                      : isLeftOfHovered
                      ? `translate3d(-16px, ${restDropY}px, 0) rotate(${restRotate}deg)`
                      : isRightOfHovered
                      ? `translate3d(26px, ${restDropY}px, 0) rotate(${restRotate}deg)`
                      : `translate3d(0, ${restDropY}px, 0) rotate(${restRotate}deg)`,
                    transition:
                      'transform 210ms cubic-bezier(0.22, 1, 0.36, 1), filter 210ms ease',
                    filter: isHovered
                      ? 'drop-shadow(0 18px 28px rgba(0, 0, 0, 0.88))'
                      : 'drop-shadow(-6px 8px 14px rgba(0, 0, 0, 0.55))',
                  }}
                  className="relative w-[124px] sm:w-[148px] lg:w-[168px] xl:w-[180px] 2xl:w-[194px] shrink-0 will-change-transform"
                >
                  <GameCard
                    cardId={hCard.cardId}
                    stats={hCard.stats}
                    arrows={hCard.arrows}
                    augmentId={hCard.augmentId}
                    owner="player"
                    size="md"
                    showName
                    selected={isHovered}
                    onClick={() => {
                      if (!canRemove) return;
                      sound.select();
                      onToggleDeckCard(hCard.uid);
                      setHoveredDeckIdx(null);
                    }}
                  />

                  {/* Subtle Remove Pill When Pulled Out */}
                  {isHovered && canRemove && (
                    <span className="pointer-events-none absolute -top-2 -right-2 z-50 px-2 py-0.5 rounded-full bg-rose-600 border border-rose-200 text-[10px] font-bold text-white shadow-lg flex items-center gap-0.5">
                      <X className="w-3 h-3 stroke-[3]" />
                      <span>Remove</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          Hover any card in your hand to fan it into full view · Click to remove
        </p>
      </section>

      {/* ================================================================= */}
      {/* FULL-WIDTH OWNED CARD LIBRARY                                     */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#0e1526] border border-slate-800/90 p-4 sm:p-5 space-y-4">
          {/* Library Header & Filter Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-slate-100">
                Your Card Library{' '}
                <span className="font-mono text-sm font-semibold text-amber-300">
                  ({filteredLibrary.length} copies)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Click any card to add it to <strong className="text-slate-200">{activeDeck.name}</strong>{' '}
                (or hold any card to zoom its full tarot view).
              </p>
            </div>

            <div className="relative w-full xl:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search card or augment..."
                className="w-full min-h-[38px] pl-9 pr-3 rounded-xl bg-[#090f1d] border border-slate-800 focus:border-amber-400/60 focus:outline-none text-xs text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Rarity + Attack Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#090f1d] border border-slate-800">
              {(['all', 'common', 'rare', 'epic', 'mythic'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setRarityFilter(r);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                    rarityFilter === r
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#090f1d] border border-slate-800">
              {(['all', 'P', 'M', 'X', 'A'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setTypeFilter(t);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    typeFilter === t
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter by element"
              value={elementFilter}
              onChange={(e) => {
                sound.select();
                setElementFilter(e.target.value as 'all' | CardElement);
              }}
              className="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#090f1d] border border-slate-800 hover:border-amber-400/50 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All Elements</option>
              {ALL_ELEMENTS.map((el) => (
                <option key={el} value={el}>
                  {ELEMENT_META[el].label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by tribe"
              value={tribeFilter}
              onChange={(e) => {
                sound.select();
                setTribeFilter(e.target.value as 'all' | CardTribe);
              }}
              className="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#090f1d] border border-slate-800 hover:border-amber-400/50 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All Tribes</option>
              {ALL_TRIBES.map((tr) => (
                <option key={tr} value={tr}>
                  {TRIBE_META[tr].label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                sound.select();
                setOnlyAugments((v) => !v);
              }}
              className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                onlyAugments
                  ? 'bg-violet-600 border-violet-400 text-white'
                  : 'bg-[#090f1d] border-slate-800 text-violet-300 hover:border-violet-500/50'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Augments Only</span>
            </button>
          </div>

          {/* Spacious Spread-Out Library Card Grid */}
          {filteredLibrary.length === 0 ? (
            <div className="rounded-2xl bg-[#090f1d] border border-slate-800 p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-amber-200">
                No owned cards match these filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRarityFilter('all');
                  setTypeFilter('all');
                  setElementFilter('all');
                  setTribeFilter('all');
                  setOnlyAugments(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
              {filteredLibrary.map((inst) => {
                const def = CARD_MAP[inst.cardId];
                if (!def) return null;
                const inDeck = activeDeckUidSet.has(inst.uid);
                const aug = resolveCardAugment(inst.cardId, inst.augmentId);
                const biomeHints = arenaBiomes
                  .map((b) => evaluateTerrainEffect(b, def))
                  .filter((ev): ev is NonNullable<typeof ev> => Boolean(ev && ev.hasEffect));

                return (
                  <div
                    key={inst.uid}
                    className={`card-grid-item rounded-2xl p-2.5 border space-y-2 transition-colors ${
                      inDeck
                        ? 'bg-blue-950/30 border-blue-400/60 shadow-[0_6px_18px_rgba(37,99,235,0.2)]'
                        : 'bg-[#090f1d] border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative">
                      <GameCard
                        cardId={inst.cardId}
                        stats={inst.stats}
                        arrows={inst.arrows}
                        augmentId={inst.augmentId}
                        owner={inDeck ? 'player' : 'neutral'}
                        size="lg"
                        showName
                        onClick={() => {
                          sound.select();
                          onToggleDeckCard(inst.uid);
                        }}
                      />
                      {inDeck && (
                        <span className="pointer-events-none absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center gap-0.5 shadow-lg">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>In Deck</span>
                        </span>
                      )}
                    </div>

                    <div className="text-center space-y-1 px-0.5">
                      <div className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-slate-100 leading-snug [text-wrap:balance]">
                        {def.name}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-[11px]">
                        <span className={`capitalize font-semibold ${RARITY_TEXT[def.rarity]}`}>
                          {def.rarity}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono font-bold text-amber-300">
                          {formatTetraCode(inst.stats)}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <CardTraitPills element={def.element} tribe={def.tribe} compact />
                      </div>
                      {biomeHints.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1 pt-0.5">
                          {biomeHints.slice(0, 2).map((hint) => (
                            <span
                              key={hint.biome}
                              title={`${BIOME_META[hint.biome].name}: ${hint.shortTag}`}
                              className={`inline-flex items-center rounded px-1.5 py-[1px] border font-mono text-[10px] font-semibold cursor-help ${
                                hint.isPositive
                                  ? 'bg-emerald-950/85 border-emerald-400/50 text-emerald-300'
                                  : 'bg-rose-950/80 border-rose-400/45 text-rose-300'
                              }`}
                            >
                              {hint.isPositive ? '▲' : '▼'} {BIOME_META[hint.biome].shortName}
                            </span>
                          ))}
                        </div>
                      )}
                      {aug && (
                        <div className="pt-0.5 flex justify-center">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-950/90 border border-violet-500/40 text-[10px] font-mono text-violet-200">
                            <Wand2 className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                            <span>{aug.name}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
    </div>
  );
};
