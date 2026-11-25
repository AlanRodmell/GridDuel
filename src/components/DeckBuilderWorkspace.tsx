import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  HelpCircle,
  Layers,
  Play,
  Search,
  Sparkles,
  Trash2,
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
  MAX_COPIES_PER_CARD,
  formatArrowsCompact,
  formatTetraCode,
  getCardSellValue,
  getCardThumbUrl,
  getInstanceSortScore,
  resolveCardAugment,
  sortCardCopies,
} from '../data/cards';
import { getFighterBiomes } from '../data/ladder';
import { HAND_SIZE } from '../engine/triadEngine';
import { AutoBuildStrategy, DECK_CAPACITY, MAX_DECK_SLOTS } from '../store/useProfile';
import {
  AttackType,
  BiomeType,
  CardDef,
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

function formatDeltaBadge(copy: RolledCardInstance, best: RolledCardInstance): {
  label: string;
  className: string;
} {
  if (copy.uid === best.uid) {
    return {
      label: '★ Best Roll',
      className: 'bg-emerald-950/85 border-emerald-400/50 text-emerald-300',
    };
  }
  const copyTotal = copy.stats.power + copy.stats.pDef + copy.stats.mDef;
  const bestTotal = best.stats.power + best.stats.pDef + best.stats.mDef;
  const statDiff = copyTotal - bestTotal;
  const arrowDiff = copy.arrows.length - best.arrows.length;

  const parts: string[] = [];
  if (statDiff !== 0) {
    parts.push(`${statDiff > 0 ? `+${statDiff}` : statDiff} stat${Math.abs(statDiff) === 1 ? '' : 's'}`);
  }
  if (arrowDiff !== 0) {
    parts.push(`${arrowDiff > 0 ? `+${arrowDiff}` : arrowDiff}▲`);
  }
  if (parts.length === 0) {
    const identicalSplit =
      copy.stats.power === best.stats.power &&
      copy.stats.pDef === best.stats.pDef &&
      copy.stats.mDef === best.stats.mDef;
    return {
      label: identicalSplit ? '= Same Roll' : '⇄ Stat Split',
      className: 'bg-[#191410] border-[#4b3a29] text-[#cbb89a]',
    };
  }

  return {
    label: parts.join(' · '),
    className:
      statDiff >= 0 && arrowDiff >= 0
        ? 'bg-emerald-950/75 border-emerald-400/45 text-emerald-200'
        : statDiff <= 0 && arrowDiff <= 0
        ? 'bg-rose-950/75 border-rose-500/45 text-rose-300'
        : 'bg-sky-950/85 border-sky-400/45 text-sky-300',
  };
}

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
  onSellCardInstance: (
    instanceUid: string
  ) => { ok: boolean; goldEarned: number; cardName?: string; message?: string };
  onSellExtraCopies: (
    specificCardId?: string
  ) => { soldCount: number; goldEarned: number };
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
  onSellCardInstance,
  onSellExtraCopies,
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
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [groupByCard, setGroupByCard] = useState(true);
  const [compareCardId, setCompareCardId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  const arenaBiomes = useMemo(() => getFighterBiomes(currentFighter.id), [currentFighter.id]);
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];
  const activeDeckUidSet = useMemo(() => new Set(activeDeck.cards), [activeDeck.cards]);
  const allEquippedUidSet = useMemo(
    () => new Set(profile.decks.flatMap((d) => d.cards)),
    [profile.decks]
  );

  const totalOwnedCopies = useMemo(
    () => Object.values(profile.inventory).reduce((sum, list) => sum + list.length, 0),
    [profile.inventory]
  );

  const sellableExtrasSummary = useMemo(() => {
    let count = 0;
    let totalGold = 0;
    for (const [cid, list] of Object.entries(profile.inventory)) {
      if (list.length <= 1) continue;
      const card = CARD_MAP[cid];
      if (!card) continue;
      const sorted = sortCardCopies(list);
      const bestUid = sorted[0].uid;
      for (const inst of sorted) {
        if (inst.uid === bestUid) continue;
        if (allEquippedUidSet.has(inst.uid)) continue;
        if (inst.augmentId) continue;
        count += 1;
        totalGold += getCardSellValue(card, inst.stats, inst.arrows, inst.augmentId);
      }
    }
    return { count, totalGold };
  }, [allEquippedUidSet, profile.inventory]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    interface LibraryEntry {
      inst: RolledCardInstance;
      def: CardDef;
      allCopies: RolledCardInstance[];
      copyRank: number; // 0 = best copy
    }

    const entries: LibraryEntry[] = [];

    for (const [cid, rawCopies] of Object.entries(profile.inventory)) {
      if (rawCopies.length === 0) continue;
      const def = CARD_MAP[cid];
      if (!def) continue;
      if (onlyDuplicates && rawCopies.length < 2) continue;
      if (rarityFilter !== 'all' && def.rarity !== rarityFilter) continue;
      if (elementFilter !== 'all' && def.element !== elementFilter) continue;
      if (tribeFilter !== 'all' && def.tribe !== tribeFilter) continue;
      if (onlyBiomeFavored) {
        const favored = arenaBiomes.some((b) => evaluateTerrainEffect(b, def)?.isPositive);
        if (!favored) continue;
      }

      const sortedCopies = sortCardCopies(rawCopies);

      if (groupByCard) {
        // Show the equipped copy if one is in the active deck, otherwise the #1 best-rolled copy
        const matchingCopies = sortedCopies.filter((inst) => {
          if (typeFilter !== 'all' && inst.stats.type !== typeFilter) return false;
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
        });
        if (matchingCopies.length === 0) continue;
        const equippedRep = matchingCopies.find((c) => activeDeckUidSet.has(c.uid));
        const rep = equippedRep ?? matchingCopies[0];
        const rank = sortedCopies.findIndex((c) => c.uid === rep.uid);
        entries.push({
          inst: rep,
          def,
          allCopies: sortedCopies,
          copyRank: rank === -1 ? 0 : rank,
        });
      } else {
        sortedCopies.forEach((inst, rank) => {
          if (typeFilter !== 'all' && inst.stats.type !== typeFilter) return;
          const aug = resolveCardAugment(inst.cardId, inst.augmentId);
          if (onlyAugments && !aug) return;
          if (
            q &&
            !def.name.toLowerCase().includes(q) &&
            !ELEMENT_META[def.element].label.toLowerCase().includes(q) &&
            !TRIBE_META[def.tribe].label.toLowerCase().includes(q) &&
            !(aug && aug.name.toLowerCase().includes(q))
          ) {
            return;
          }
          entries.push({
            inst,
            def,
            allCopies: sortedCopies,
            copyRank: rank,
          });
        });
      }
    }

    return entries.sort((a, b) => {
      if (!groupByCard) {
        // Keep copies of the same card grouped side-by-side so comparing #1 vs #2/#3 is effortless!
        const aAnyInDeck = a.allCopies.some((c) => activeDeckUidSet.has(c.uid)) ? 1 : 0;
        const bAnyInDeck = b.allCopies.some((c) => activeDeckUidSet.has(c.uid)) ? 1 : 0;
        if (aAnyInDeck !== bAnyInDeck) return bAnyInDeck - aAnyInDeck;
        if (a.def.id !== b.def.id) {
          return (
            getInstanceSortScore(b.allCopies[0]) - getInstanceSortScore(a.allCopies[0]) ||
            a.def.number - b.def.number
          );
        }
        return a.copyRank - b.copyRank;
      }

      const aIn = a.allCopies.some((c) => activeDeckUidSet.has(c.uid)) ? 1 : 0;
      const bIn = b.allCopies.some((c) => activeDeckUidSet.has(c.uid)) ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      return getInstanceSortScore(b.inst) - getInstanceSortScore(a.inst);
    });
  }, [
    activeDeckUidSet,
    arenaBiomes,
    elementFilter,
    groupByCard,
    onlyAugments,
    onlyBiomeFavored,
    onlyDuplicates,
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

  const compareCardDef = compareCardId ? CARD_MAP[compareCardId] ?? null : null;
  const compareCopies = useMemo(() => {
    if (!compareCardId) return [];
    return sortCardCopies(profile.inventory[compareCardId] ?? []);
  }, [compareCardId, profile.inventory]);

  return (
    <div className="space-y-4">
      {toastMsg && (
        <div className="fixed bottom-20 md:bottom-8 right-4 z-50 rounded-[3px] brass-panel px-4 py-2.5 text-xs font-semibold text-[#f5d593] shadow-2xl flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#e2b053] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

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
              showSavedDecksDrawer ? 'brass-plaque text-[#f5d593]' : 'iron-btn text-[#dfd0b6]'
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

      {/* ACTIVE DECK PANEL: HORIZONTAL CASCADING CARD SPREAD */}
      <section className="brass-panel riveted-frame rounded-[4px] p-4 sm:p-5 space-y-3">
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

      {/* FULL-WIDTH OWNED CARD LIBRARY */}
      <section className="iron-panel rounded-[4px] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-[#3e3124]">
          <div>
            <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-[#f3dfb6] tracking-wide">
              Your Card Vault{' '}
              <span className="font-mono text-sm font-semibold text-[#e6b85c]">
                ({filteredEntries.length} {groupByCard ? 'cards' : 'copies'})
              </span>
            </h2>
            <p className="font-[var(--font-serif)] text-sm text-[#b39e81]">
              Click any card to equip it in <strong className="text-[#f3dfb6]">{activeDeck.name}</strong>
              , or click <strong className="text-[#f0c76e]">Compare Rolls</strong> on cards with 2+
              copies to inspect and sell extras.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {sellableExtrasSummary.count > 0 && (
              <button
                type="button"
                onClick={() => {
                  const res = onSellExtraCopies();
                  if (res.soldCount > 0) {
                    showToast(
                      `Sold ${res.soldCount} lower-rolled duplicate${
                        res.soldCount === 1 ? '' : 's'
                      } for +${res.goldEarned.toLocaleString()}g!`
                    );
                  }
                }}
                title="Sell unequipped, un-runed duplicate copies while keeping your best roll of every card"
                className="brass-plaque hover:border-[#e2b053] min-h-[38px] px-3 py-1.5 rounded-[3px] text-[#f5d593] font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 text-[#e2b053] shrink-0" />
                <span>
                  Sell {sellableExtrasSummary.count} Extra
                  {sellableExtrasSummary.count === 1 ? '' : 's'} (+
                  {sellableExtrasSummary.totalGold.toLocaleString()}g)
                </span>
              </button>
            )}

            <div className="relative w-full sm:w-60">
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
        </div>

        {/* Filter & Copy Grouping Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Grouped (Best Roll) vs All Copies Switch */}
          <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
            <button
              type="button"
              onClick={() => {
                sound.select();
                setGroupByCard(true);
              }}
              className={`min-h-[32px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors cursor-pointer ${
                groupByCard ? 'brass-btn font-bold' : 'text-[#a69277] hover:text-[#f0e4cc]'
              }`}
            >
              Best Roll
            </button>
            <button
              type="button"
              onClick={() => {
                sound.select();
                setGroupByCard(false);
              }}
              className={`min-h-[32px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors cursor-pointer ${
                !groupByCard ? 'brass-btn font-bold' : 'text-[#a69277] hover:text-[#f0e4cc]'
              }`}
            >
              All Copies
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.select();
              setOnlyDuplicates((v) => !v);
            }}
            className={`min-h-[34px] px-3 py-1 rounded-[3px] border font-[var(--font-display)] text-xs font-semibold transition-colors cursor-pointer ${
              onlyDuplicates
                ? 'brass-plaque border-[#e2b053] text-[#f5d593]'
                : 'basalt-recess text-[#dfd0b6] hover:border-[#8e6732]'
            }`}
          >
            2+ Copies
          </button>

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
                    ? 'brass-plaque text-[#f5d593] font-bold'
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

        {/* Clean Library Grid — Zero Redundant Stat/Arrow/Name Text Below Cards */}
        {filteredEntries.length === 0 ? (
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
                setOnlyDuplicates(false);
              }}
              className="iron-btn px-3.5 py-1.5 rounded-[3px] font-[var(--font-display)] text-xs cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredEntries.map(({ inst, def, allCopies, copyRank }) => {
              const inDeck = activeDeckUidSet.has(inst.uid);
              const equippedCopiesCount = allCopies.filter((c) => activeDeckUidSet.has(c.uid)).length;
              const aug = resolveCardAugment(inst.cardId, inst.augmentId);
              const biomeHints = arenaBiomes
                .map((b) => evaluateTerrainEffect(b, def))
                .filter((ev): ev is NonNullable<typeof ev> => Boolean(ev && ev.hasEffect));
              const copyCount = allCopies.length;
              const deltaVsBest =
                !groupByCard && copyCount > 1 ? formatDeltaBadge(inst, allCopies[0]) : null;
              const sellGold = getCardSellValue(def, inst.stats, inst.arrows, inst.augmentId);
              const canQuickSellInline =
                !groupByCard &&
                copyRank > 0 &&
                !inDeck &&
                !allEquippedUidSet.has(inst.uid) &&
                totalOwnedCopies > DECK_CAPACITY;

              return (
                <div
                  key={inst.uid}
                  className={`card-grid-item rounded-[4px] p-2 border flex flex-col gap-2 transition-colors ${
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

                    {/* Top-Left Copy Badge */}
                    {copyCount > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.select();
                          setCompareCardId(def.id);
                        }}
                        title={`Compare all ${copyCount} rolled copies of ${def.name}`}
                        className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-[2px] brass-plaque hover:border-[#f0c76e] font-mono text-[10px] font-bold text-[#f5d593] shadow cursor-pointer"
                      >
                        {groupByCard
                          ? `${copyCount}/${MAX_COPIES_PER_CARD}`
                          : `#${copyRank + 1}/${copyCount}`}
                      </button>
                    )}

                    {/* Top-Right In Deck Badge */}
                    {inDeck && (
                      <span className="pointer-events-none absolute top-2 right-2 z-20 px-2 py-0.5 rounded-[2px] bg-[#e2b053] text-[#170f06] border border-[#f8df9d] text-[10px] font-[var(--font-display)] font-bold flex items-center gap-0.5 shadow-lg">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>
                          {groupByCard && equippedCopiesCount > 1
                            ? `In Deck ×${equippedCopiesCount}`
                            : 'In Deck'}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Concise Non-Redundant Trait, Biome & Copy Action Strip */}
                  <div className="flex flex-col gap-1.5 px-0.5">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <CardTraitPills element={def.element} tribe={def.tribe} compact />
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

                    {aug && (
                      <div className="flex justify-center">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-violet-950/90 border border-violet-500/45 text-[10px] font-mono text-violet-200 max-w-full truncate">
                          <Wand2 className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                          <span className="truncate">{aug.name}</span>
                        </span>
                      </div>
                    )}

                    {/* Multi-Copy Compare / Quick-Sell Controls */}
                    {groupByCard && copyCount > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.select();
                          setCompareCardId(def.id);
                        }}
                        className="w-full min-h-[28px] rounded-[2px] iron-btn text-[11px] font-[var(--font-display)] font-semibold text-[#f0c76e] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Layers className="w-3 h-3 text-[#e2b053]" />
                        <span>Compare {copyCount} Rolls</span>
                      </button>
                    )}

                    {!groupByCard && deltaVsBest && (
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-semibold truncate ${deltaVsBest.className}`}
                        >
                          {deltaVsBest.label}
                        </span>
                        {canQuickSellInline && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = onSellCardInstance(inst.uid);
                              if (res.ok) {
                                showToast(`Sold ${def.name} copy for +${res.goldEarned}g!`);
                              } else if (res.message) {
                                showToast(res.message);
                              }
                            }}
                            className="px-2 py-0.5 rounded-[2px] crimson-btn font-mono text-[10px] font-bold inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>+{sellGold}g</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SIDE-BY-SIDE ROLLED COPY COMPARISON & QUICK-SELL MODAL */}
      {compareCardDef && compareCopies.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/90 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`Compare copies of ${compareCardDef.name}`}
          onClick={() => setCompareCardId(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92dvh] flex flex-col rounded-t-[6px] sm:rounded-[5px] brass-panel riveted-frame shadow-[0_32px_90px_rgba(0,0,0,0.92)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-[#4b3a26]/85 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-[#f6e1b5] tracking-wide">
                    {compareCardDef.name} — Rolled Copies ({compareCopies.length}/
                    {MAX_COPIES_PER_CARD})
                  </h3>
                  <span
                    className={`text-xs font-semibold capitalize ${RARITY_TEXT[compareCardDef.rarity]}`}
                  >
                    {compareCardDef.rarity}
                  </span>
                </div>
                <p className="font-[var(--font-serif)] text-xs sm:text-sm text-[#b39e81] mt-0.5">
                  Ranked strongest to weakest. Equip your preferred roll or sell spare copies for
                  Gold.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {compareCopies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = onSellExtraCopies(compareCardDef.id);
                      if (res.soldCount > 0) {
                        showToast(
                          `Sold ${res.soldCount} extra ${compareCardDef.name} cop${
                            res.soldCount === 1 ? 'y' : 'ies'
                          } for +${res.goldEarned.toLocaleString()}g!`
                        );
                      } else {
                        showToast(
                          'All extra copies are either equipped in a saved deck or carry a Runeforge augment.'
                        );
                      }
                    }}
                    className="brass-plaque hover:border-[#e2b053] min-h-[38px] px-3 py-1.5 rounded-[3px] font-[var(--font-display)] text-xs font-semibold text-[#f5d593] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Coins className="w-3.5 h-3.5 text-[#e2b053]" />
                    <span>Sell Extras (Keep Best)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCompareCardId(null)}
                  aria-label="Close comparison"
                  className="iron-btn w-9 h-9 rounded-[3px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {compareCopies.map((copy, idx) => {
                  const inActiveDeck = activeDeckUidSet.has(copy.uid);
                  const inOtherDeck = !inActiveDeck && allEquippedUidSet.has(copy.uid);
                  const delta = formatDeltaBadge(copy, compareCopies[0]);
                  const copyAug = resolveCardAugment(compareCardDef.id, copy.augmentId);
                  const sellGold = getCardSellValue(
                    compareCardDef,
                    copy.stats,
                    copy.arrows,
                    copy.augmentId
                  );
                  const canSell = totalOwnedCopies > DECK_CAPACITY;

                  return (
                    <div
                      key={copy.uid}
                      className={`rounded-[4px] p-2.5 border flex flex-col gap-2.5 ${
                        inActiveDeck
                          ? 'brass-plaque border-[#cf9a42]'
                          : idx === 0
                          ? 'bg-emerald-950/20 border-emerald-500/45'
                          : 'basalt-recess'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10.5px]">
                        <span className="font-mono font-bold text-[#cbb89a]">
                          Copy #{idx + 1}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-semibold ${delta.className}`}
                        >
                          {delta.label}
                        </span>
                      </div>

                      <GameCard
                        cardId={compareCardDef.id}
                        stats={copy.stats}
                        arrows={copy.arrows}
                        augmentId={copy.augmentId}
                        owner={inActiveDeck ? 'player' : 'neutral'}
                        size="lg"
                        showName={false}
                      />

                      <div className="text-center text-[11px] font-mono text-[#a69277]">
                        {formatArrowsCompact(copy.arrows)}
                      </div>

                      {copyAug && (
                        <div className="flex justify-center">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-violet-950/90 border border-violet-500/45 text-[10px] font-mono text-violet-200 max-w-full truncate">
                            <Wand2 className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                            <span className="truncate">{copyAug.name}</span>
                          </span>
                        </div>
                      )}

                      {inOtherDeck && (
                        <div className="text-center text-[10px] font-mono text-[#9bc6f5]">
                          In another saved deck
                        </div>
                      )}

                      <div className="mt-auto grid grid-cols-1 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            sound.select();
                            // If equipping this copy while another copy of the same card is in the deck, toggle normally
                            const res = onToggleDeckCard(copy.uid);
                            if (!res.ok && res.message) showToast(res.message);
                          }}
                          className={`min-h-[34px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs font-semibold cursor-pointer ${
                            inActiveDeck ? 'iron-btn' : 'brass-btn font-bold'
                          }`}
                        >
                          {inActiveDeck ? 'Unequip' : 'Equip in Deck'}
                        </button>

                        <button
                          type="button"
                          disabled={!canSell}
                          onClick={() => {
                            const res = onSellCardInstance(copy.uid);
                            if (res.ok) {
                              showToast(
                                `Sold ${compareCardDef.name} (${formatTetraCode(
                                  copy.stats
                                )}) for +${res.goldEarned}g!`
                              );
                              if (compareCopies.length <= 1) {
                                setCompareCardId(null);
                              }
                            } else if (res.message) {
                              showToast(res.message);
                            }
                          }}
                          className={`min-h-[32px] px-2.5 py-1 rounded-[2px] font-mono text-xs font-semibold flex items-center justify-center gap-1 ${
                            canSell
                              ? 'crimson-btn cursor-pointer'
                              : 'basalt-recess text-[#685a49] cursor-not-allowed'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Sell +{sellGold}g</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
