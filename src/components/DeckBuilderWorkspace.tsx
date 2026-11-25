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
  BiomeType,
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
  onAutoBuildDeck: (strategy: AutoBuildStrategy, targetBiomes?: BiomeType[]) => void;
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
  const [onlyBiomeFavored, setOnlyBiomeFavored] = useState(false);

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
        if (onlyBiomeFavored) {
          const favored = arenaBiomes.some((b) => evaluateTerrainEffect(b, def)?.isPositive);
          if (!favored) return false;
        }
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
    arenaBiomes,
    elementFilter,
    onlyAugments,
    onlyBiomeFavored,
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
      <div className="brass-panel riveted-frame rounded-[4px] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-[3px] overflow-hidden border-2 border-[#a83e3e] shrink-0 shadow">
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
            <div className="font-[var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e6b85c]">
              {gameMode === 'quick' ? 'Quick Random Duel' : `Tier ${currentFighter.tierNumber} Arena`}{' '}
              · +{currentFighter.winGold}g Purse
            </div>
            <div className="font-[var(--font-display)] text-base sm:text-lg font-bold text-[#f6e3be] leading-snug">
              Facing {currentFighter.name}{' '}
              <span className="font-[var(--font-serif)] italic text-sm font-normal text-[#bba688]">
                ({currentFighter.specialty})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="font-[var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-[#9b886e]">
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
            className={`min-h-[40px] px-3.5 py-2 rounded-[3px] border font-[var(--font-display)] text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer ${
              showSavedDecksDrawer
                ? 'brass-plaque text-[#f5d593]'
                : 'iron-btn text-[#dfd0b6]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#e2b053]" />
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
            className="brass-btn min-h-[42px] px-6 py-2 rounded-[3px] font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Match</span>
          </button>
        </div>
      </div>

      {/* Collapsible Saved Decks Manager */}
      {showSavedDecksDrawer && (
        <div className="iron-panel rounded-[4px] p-4 sm:p-5">
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
      <section className="brass-panel riveted-frame rounded-[4px] p-4 sm:p-5 space-y-3">
        {/* Compact Deck Controls Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#e5b55a]">
                Active Warband ·{' '}
                <span className="font-mono text-emerald-400">
                  {previewDeckHand.length}/{HAND_SIZE}
                </span>{' '}
                <span className="text-[#66543f]">·</span>{' '}
                <span className="font-mono text-[#e8d5b3]">{totalArrows} arrows</span>
              </div>
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-[#f6dfb0] leading-tight">
                {activeDeck.name}
              </h2>
            </div>

            {/* Quick Saved-Deck Iron Tabs */}
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
                    className={`px-2.5 py-1 rounded-[2px] text-[11px] font-[var(--font-display)] tracking-wide whitespace-nowrap transition-colors cursor-pointer border ${
                      isSel
                        ? 'brass-btn font-bold'
                        : 'basalt-recess text-[#a79479] hover:text-[#f0e4cc] hover:border-[#6e5025]'
                    }`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Compact Auto-Fill Row (Now includes Biome Fit!) */}
            <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
              <Sparkles className="w-3.5 h-3.5 text-[#e2b053] shrink-0 ml-1 mr-0.5" />
              <button
                type="button"
                onClick={() => onAutoBuildDeck('biome', arenaBiomes)}
                title="Auto-build warband favored by this challenger's Arena Biomes"
                className="px-2 py-1 rounded-[2px] bg-emerald-950/75 hover:bg-emerald-900/80 border border-emerald-500/45 text-[11px] font-[var(--font-display)] font-bold text-emerald-200 transition-colors cursor-pointer"
              >
                Biome Fit
              </button>
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
                  className="px-2 py-1 rounded-[2px] hover:bg-[#2a2118] text-[11px] font-[var(--font-display)] font-semibold text-[#dfd0b6] hover:text-[#f5d593] transition-colors cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenRules}
              className="iron-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] font-[var(--font-display)] text-[11px] cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#d8a64c]" />
              <span>Codex</span>
            </button>

            <button
              type="button"
              onClick={onGoToGallery}
              className="iron-btn px-2.5 py-1.5 rounded-[3px] font-[var(--font-display)] text-[11px] cursor-pointer"
            >
              Compendium →
            </button>
          </div>
        </div>

        {/* HORIZONTAL CASCADING DECK SPREAD — Recessed Leather War-Table Tray */}
        <div
          onMouseLeave={() => setHoveredDeckIdx(null)}
          className="basalt-recess rounded-[4px] relative w-full overflow-x-auto pt-5 pb-4 px-3 sm:px-6"
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

                  {/* Subtle Remove Seal When Pulled Out */}
                  {isHovered && canRemove && (
                    <span className="pointer-events-none absolute -top-2 -right-2 z-50 px-2 py-0.5 rounded-[2px] bg-[#7c1f1f] border border-rose-300 text-[10px] font-[var(--font-display)] font-bold text-white shadow-lg flex items-center gap-0.5">
                      <X className="w-3 h-3 stroke-[3]" />
                      <span>Remove</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="font-[var(--font-serif)] italic text-xs sm:text-sm text-[#a89478] text-center">
          Hover any card in your warband to fan it into full view · Click to remove
        </p>
      </section>

      {/* ================================================================= */}
      {/* FULL-WIDTH OWNED CARD LIBRARY                                     */}
      {/* ================================================================= */}
      <section className="iron-panel rounded-[4px] p-4 sm:p-5 space-y-4">
          {/* Library Header & Filter Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-[#3e3124]">
            <div>
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-[#f3dfb6] tracking-wide">
                Your Card Vault{' '}
                <span className="font-mono text-sm font-semibold text-[#e6b85c]">
                  ({filteredLibrary.length} copies)
                </span>
              </h2>
              <p className="font-[var(--font-serif)] text-sm text-[#b39e81]">
                Click any card to add it to <strong className="text-[#f3dfb6]">{activeDeck.name}</strong>{' '}
                (or hold any card to zoom its full tarot view).
              </p>
            </div>

            <div className="relative w-full xl:w-64">
              <Search className="w-4 h-4 text-[#8c785f] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search card or augment..."
                className="w-full min-h-[38px] pl-9 pr-3 rounded-[3px] basalt-recess focus:border-[#c89640] focus:outline-none text-xs text-[#efe3cd] placeholder:text-[#7d6c56]"
              />
            </div>
          </div>

          {/* Rarity + Attack Type Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
              {(['all', 'common', 'rare', 'epic', 'mythic'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setRarityFilter(r);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs capitalize transition-colors cursor-pointer ${
                    rarityFilter === r
                      ? 'brass-btn font-bold'
                      : 'text-[#a69277] hover:text-[#f0e4cc]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
              {(['all', 'P', 'M', 'X', 'A'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setTypeFilter(t);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors cursor-pointer ${
                    typeFilter === t
                      ? 'brass-plaque text-[#f5d593] font-bold'
                      : 'text-[#a69277] hover:text-[#f0e4cc]'
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
              className="min-h-[34px] px-2.5 py-1 rounded-[3px] basalt-recess hover:border-[#8e6732] text-xs font-medium text-[#e5d6bc] focus:outline-none focus:border-[#d4a046] cursor-pointer"
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
              className="min-h-[34px] px-2.5 py-1 rounded-[3px] basalt-recess hover:border-[#8e6732] text-xs font-medium text-[#e5d6bc] focus:outline-none focus:border-[#d4a046] cursor-pointer"
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
                setOnlyBiomeFavored((v) => !v);
              }}
              className={`min-h-[34px] px-3 py-1 rounded-[3px] border font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                onlyBiomeFavored
                  ? 'bg-emerald-800 border-emerald-400 text-white'
                  : 'basalt-recess text-emerald-300 hover:border-emerald-400/55'
              }`}
            >
              <span>▲ Favored Here</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                setOnlyAugments((v) => !v);
              }}
              className={`min-h-[34px] px-3 py-1 rounded-[3px] border font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                onlyAugments
                  ? 'bg-violet-800 border-violet-400 text-white'
                  : 'basalt-recess text-violet-300 hover:border-violet-400/55'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Augments Only</span>
            </button>
          </div>

          {/* Spacious Spread-Out Library Card Grid */}
          {filteredLibrary.length === 0 ? (
            <div className="basalt-recess rounded-[4px] p-10 text-center space-y-2">
              <p className="font-[var(--font-display)] text-sm font-semibold text-[#f0c76e]">
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
                  setOnlyBiomeFavored(false);
                }}
                className="iron-btn px-3.5 py-1.5 rounded-[3px] font-[var(--font-display)] text-xs cursor-pointer"
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
                    className={`card-grid-item rounded-[4px] p-2.5 border space-y-2 transition-colors ${
                      inDeck
                        ? 'brass-plaque border-[#cf9a42]'
                        : 'basalt-recess hover:border-[#6e522b]'
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
                        <span className="pointer-events-none absolute top-2 right-2 z-20 px-2 py-0.5 rounded-[2px] bg-[#e2b053] text-[#170f06] border border-[#f8df9d] text-[10px] font-[var(--font-display)] font-bold flex items-center gap-0.5 shadow-lg">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>In Deck</span>
                        </span>
                      )}
                    </div>

                    <div className="text-center space-y-1 px-0.5">
                      <div className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-[#f3e5cb] leading-snug [text-wrap:balance]">
                        {def.name}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-[11px]">
                        <span className={`capitalize font-semibold ${RARITY_TEXT[def.rarity]}`}>
                          {def.rarity}
                        </span>
                        <span className="text-[#5e4d3a]">·</span>
                        <span className="font-mono font-bold text-[#f0c76e]">
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
                              className={`inline-flex items-center rounded-[2px] px-1.5 py-[1px] border font-mono text-[10px] font-semibold cursor-help ${
                                hint.isPositive
                                  ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-300'
                                  : 'bg-rose-950/80 border-rose-500/45 text-rose-300'
                              }`}
                            >
                              {hint.isPositive ? '▲' : '▼'} {BIOME_META[hint.biome].shortName}
                            </span>
                          ))}
                        </div>
                      )}
                      {aug && (
                        <div className="pt-0.5 flex justify-center">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-violet-950/90 border border-violet-500/45 text-[10px] font-mono text-violet-200">
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
