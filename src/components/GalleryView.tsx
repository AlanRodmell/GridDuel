import React, { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Compass,
  Lock,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { ALL_ELEMENTS, ALL_TRIBES, ELEMENT_META, TRIBE_META } from '../data/biomes';
import {
  CARD_MAP,
  CARDS,
  MAX_COPIES_PER_CARD,
  RARITY_ARROW_RANGE,
  RARITY_STAT_RANGE,
  formatArrowsCompact,
  formatTetraCode,
  getCardSellValue,
  getStatsPowerScore,
  resolveCardAugment,
  toHexDigit,
} from '../data/cards';
import { AutoBuildStrategy, DECK_CAPACITY } from '../store/useProfile';
import {
  AttackType,
  CardDef,
  CardElement,
  CardTribe,
  DeckSlot,
  PlayerProfile,
  Rarity,
  RolledCardInstance,
} from '../types/game';
import { sound } from '../utils/sound';
import { CardTraitPills } from './BiomeBadge';
import { DeckShelf } from './DeckShelf';
import { GameCard } from './GameCard';

interface GalleryViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  ownedUniqueCount: number;
  totalCards: number;
  onSelectDeckSlot: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
  onToggleDeckCard: (uidOrCardId: string) => { ok: boolean; message?: string };
  onAutoBuildDeck: (strategy: AutoBuildStrategy) => void;
  onSellCardInstance: (
    instanceUid: string
  ) => { ok: boolean; goldEarned: number; cardName?: string; message?: string };
  onSellExtraCopies: (
    specificCardId?: string
  ) => { soldCount: number; goldEarned: number };
  onGoToShop: () => void;
}

type OwnershipFilter = 'all' | 'owned' | 'duplicates' | 'augments' | 'locked';
type RarityFilter = 'all' | Rarity;
type TypeFilter = 'all' | AttackType;

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  mythic: 'Mythic',
};

const RARITY_TEXT_COLOR: Record<Rarity, string> = {
  common: 'text-slate-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  mythic: 'text-amber-300',
};

const RARITY_BAR_COLOR: Record<Rarity, string> = {
  common: 'bg-slate-400',
  rare: 'bg-sky-400',
  epic: 'bg-violet-400',
  mythic: 'bg-amber-400',
};

const TYPE_DESCR: Record<AttackType, string> = {
  P: 'Physical (targets P.Def)',
  M: 'Magical (targets M.Def)',
  X: 'Flexible (targets lower Def)',
  A: 'Assault (highest vs lowest stat)',
};

export const GalleryView: React.FC<GalleryViewProps> = ({
  profile,
  activeDeck,
  ownedUniqueCount,
  totalCards,
  onSelectDeckSlot,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onToggleDeckCard,
  onAutoBuildDeck,
  onSellCardInstance,
  onSellExtraCopies,
  onGoToShop,
}) => {
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [elementFilter, setElementFilter] = useState<'all' | CardElement>('all');
  const [tribeFilter, setTribeFilter] = useState<'all' | CardTribe>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [selectedCopyUid, setSelectedCopyUid] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    window.setTimeout(() => {
      setFeedbackToast((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  // Map all owned instances by uid for quick lookup
  const instanceByUid = useMemo(() => {
    const map: Record<string, RolledCardInstance> = {};
    for (const list of Object.values(profile.inventory)) {
      for (const inst of list) {
        map[inst.uid] = inst;
      }
    }
    return map;
  }, [profile.inventory]);

  // Best (highest rolled) copy per cardId
  const bestCopyByCardId = useMemo(() => {
    const map: Record<string, RolledCardInstance> = {};
    for (const [cid, list] of Object.entries(profile.inventory)) {
      if (list.length > 0) {
        const sorted = [...list].sort(
          (a, b) =>
            getStatsPowerScore(b.stats, b.arrows.length) -
            getStatsPowerScore(a.stats, a.arrows.length)
        );
        map[cid] = sorted[0];
      }
    }
    return map;
  }, [profile.inventory]);

  // Count how many extra copies across the entire collection can be bulk-sold
  const sellableExtrasSummary = useMemo(() => {
    const equippedUids = new Set(profile.decks.flatMap((d) => d.cards));
    let count = 0;
    let totalGold = 0;

    for (const [cid, list] of Object.entries(profile.inventory)) {
      if (list.length <= 1) continue;
      const card = CARD_MAP[cid];
      if (!card) continue;
      const sorted = [...list].sort(
        (a, b) =>
          getStatsPowerScore(b.stats, b.arrows.length) -
          getStatsPowerScore(a.stats, a.arrows.length)
      );
      const bestUid = sorted[0].uid;
      for (const inst of sorted) {
        if (inst.uid === bestUid) continue;
        if (equippedUids.has(inst.uid)) continue;
        count += 1;
        totalGold += getCardSellValue(card, inst.stats, inst.arrows);
      }
    }
    return { count, totalGold };
  }, [profile.decks, profile.inventory]);

  const totalOwnedCopies = useMemo(() => {
    return Object.values(profile.inventory).reduce((sum, list) => sum + list.length, 0);
  }, [profile.inventory]);

  const rarityStats = useMemo(() => {
    const totals: Record<Rarity, { owned: number; total: number }> = {
      common: { owned: 0, total: 0 },
      rare: { owned: 0, total: 0 },
      epic: { owned: 0, total: 0 },
      mythic: { owned: 0, total: 0 },
    };
    for (const c of CARDS) {
      totals[c.rarity].total += 1;
      if ((profile.inventory[c.id]?.length ?? 0) > 0) {
        totals[c.rarity].owned += 1;
      }
    }
    return totals;
  }, [profile.inventory]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CARDS.filter((card) => {
      const copies = profile.inventory[card.id] ?? [];
      const owned = copies.length > 0;
      if (ownershipFilter === 'owned' && !owned) return false;
      if (ownershipFilter === 'duplicates' && copies.length < 2) return false;
      if (
        ownershipFilter === 'augments' &&
        !card.augment &&
        !copies.some((c) => Boolean(c.augmentId))
      ) {
        return false;
      }
      if (ownershipFilter === 'locked' && owned) return false;
      if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false;
      if (elementFilter !== 'all' && card.element !== elementFilter) return false;
      if (tribeFilter !== 'all' && card.tribe !== tribeFilter) return false;
      if (
        typeFilter !== 'all' &&
        card.stats.type !== typeFilter &&
        !copies.some((c) => c.stats.type === typeFilter)
      ) {
        return false;
      }
      if (
        q &&
        !card.name.toLowerCase().includes(q) &&
        !ELEMENT_META[card.element].label.toLowerCase().includes(q) &&
        !TRIBE_META[card.tribe].label.toLowerCase().includes(q) &&
        !String(card.number).padStart(2, '0').includes(q) &&
        !copies.some((c) => {
          const aug = resolveCardAugment(card.id, c.augmentId);
          return aug && (aug.name.toLowerCase().includes(q) || aug.description.toLowerCase().includes(q));
        }) &&
        !(card.augment && card.augment.description.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [
    elementFilter,
    ownershipFilter,
    profile.inventory,
    rarityFilter,
    searchQuery,
    tribeFilter,
    typeFilter,
  ]);

  const inspectedCard: CardDef | null = inspectedId ? CARD_MAP[inspectedId] ?? null : null;
  const inspectedCopies: RolledCardInstance[] = useMemo(() => {
    if (!inspectedCard) return [];
    const raw = profile.inventory[inspectedCard.id] ?? [];
    return [...raw].sort(
      (a, b) =>
        getStatsPowerScore(b.stats, b.arrows.length) -
        getStatsPowerScore(a.stats, a.arrows.length)
    );
  }, [inspectedCard, profile.inventory]);

  const activeInspectedCopy: RolledCardInstance | null = useMemo(() => {
    if (inspectedCopies.length === 0) return null;
    if (selectedCopyUid) {
      const found = inspectedCopies.find((c) => c.uid === selectedCopyUid);
      if (found) return found;
    }
    return inspectedCopies[0];
  }, [inspectedCopies, selectedCopyUid]);

  const activeDeckInstances = useMemo(() => {
    const list: RolledCardInstance[] = [];
    for (const ref of activeDeck.cards.slice(0, DECK_CAPACITY)) {
      if (instanceByUid[ref]) {
        list.push(instanceByUid[ref]);
      } else if (bestCopyByCardId[ref]) {
        list.push(bestCopyByCardId[ref]);
      }
    }
    return list;
  }, [activeDeck.cards, bestCopyByCardId, instanceByUid]);

  const pct = Math.round((ownedUniqueCount / totalCards) * 100);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-5 lg:py-7 space-y-6">
      {/* Floating Action Toast */}
      {feedbackToast && (
        <div className="fixed bottom-20 md:bottom-8 right-4 z-50 rounded-xl bg-slate-900/95 border border-amber-400/70 px-4 py-2.5 text-xs font-semibold text-amber-200 shadow-2xl flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Header + 90-Card Tier Breakdown + Bulk Sell Extras Button */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
            {totalCards}-Card Compendium &amp; Rolled Vault
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-400 mt-1">
            <span className="font-mono tabular-nums text-amber-300 font-semibold">
              {ownedUniqueCount} / {totalCards} Types ({pct}%)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              {totalOwnedCopies} Total Rolled Copies (Max {MAX_COPIES_PER_CARD} per card)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {sellableExtrasSummary.count > 0 && (
            <button
              type="button"
              onClick={() => {
                const res = onSellExtraCopies();
                if (res.soldCount > 0) {
                  showToast(
                    `Sold ${res.soldCount} extra card cop${
                      res.soldCount === 1 ? 'y' : 'ies'
                    } for +${res.goldEarned.toLocaleString()}g!`
                  );
                }
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md"
              title="Sell lower-rolled duplicate copies while keeping your best roll and all equipped hand cards"
            >
              <Coins className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                Sell {sellableExtrasSummary.count} Extra Cop
                {sellableExtrasSummary.count === 1 ? 'y' : 'ies'} (+
                {sellableExtrasSummary.totalGold.toLocaleString()}g)
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Rarity Tier Progress Strip with Stat & Arrow Roll Ranges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(['common', 'rare', 'epic', 'mythic'] as Rarity[]).map((r) => {
          const st = rarityStats[r];
          const tierPct = st.total > 0 ? Math.round((st.owned / st.total) * 100) : 0;
          const isSelected = rarityFilter === r;
          const rollRange = RARITY_STAT_RANGE[r];
          const arrowRange = RARITY_ARROW_RANGE[r];
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                sound.select();
                setRarityFilter(isSelected ? 'all' : r);
              }}
              className={`rounded-xl p-3 text-left border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#192540] border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                  : 'bg-[#10182a] border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold capitalize ${RARITY_TEXT_COLOR[r]}`}>
                  {r}
                </span>
                <span className="font-mono tabular-nums text-slate-300">
                  {st.owned}/{st.total}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Stats <strong className="text-slate-200">{rollRange.label}</strong> · Arrows{' '}
                <strong className="text-amber-300">{arrowRange.label}</strong>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${RARITY_BAR_COLOR[r]} transition-all duration-300`}
                  style={{ width: `${tierPct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Saved Decks Shelf & Active Deck Showcase */}
      <section className="rounded-2xl bg-gradient-to-b from-[#152038] to-[#0e1526] border border-amber-500/30 p-4 sm:p-5 space-y-5 shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
        <DeckShelf
          decks={profile.decks}
          activeDeckIndex={profile.activeDeckIndex}
          inventory={profile.inventory}
          onSelectDeck={onSelectDeckSlot}
          onCreateDeck={(name, dupIdx) => {
            const res = onCreateDeck(name, dupIdx);
            if (!res.ok && res.message) showToast(res.message);
            return res;
          }}
          onRenameDeck={onRenameDeck}
          onDeleteDeck={(idx) => {
            const res = onDeleteDeck(idx);
            if (!res.ok && res.message) showToast(res.message);
            return res;
          }}
        />

        <div className="pt-4 border-t border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-sm font-[var(--font-display)] font-bold text-slate-100">
            Active Deck: <span className="text-amber-200">{activeDeck.name}</span>{' '}
            <span className="font-mono text-xs text-slate-400">
              ({activeDeckInstances.length}/{DECK_CAPACITY})
            </span>
          </div>

          {/* One-Tap Smart Auto-Builders */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Auto-Forge {DECK_CAPACITY}-Card Deck:
            </span>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('power')}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              Highest Rolled Stats
            </button>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('arrows')}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              8-Way Arrows
            </button>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('augments')}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-violet-950/70 hover:bg-violet-900/80 border border-violet-500/40 text-violet-200 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Wand2 className="w-3 h-3" />
              <span>Augment Synergy</span>
            </button>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('assault')}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              X &amp; A Specialists
            </button>
          </div>
        </div>

        {/* Large Cards for Maximum Visibility (4-Col Grid on Desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
          {activeDeckInstances.map((inst) => (
            <div
              key={inst.uid}
              className="space-y-1.5"
            >
              <GameCard
                cardId={inst.cardId}
                stats={inst.stats}
                arrows={inst.arrows}
                augmentId={inst.augmentId}
                owner="player"
                size="md"
                showName
                onClick={() => {
                  sound.select();
                  setInspectedId(inst.cardId);
                  setSelectedCopyUid(inst.uid);
                }}
              />
              <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-300">
                <span className="text-amber-200 font-semibold">
                  {formatTetraCode(inst.stats)}
                </span>
                <span className="text-amber-300">{inst.arrows.length}▲</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10182a] border border-slate-800 overflow-x-auto max-w-full">
            {(['all', 'owned', 'duplicates', 'augments', 'locked'] as OwnershipFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  sound.select();
                  setOwnershipFilter(key);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === key
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {key === 'duplicates'
                  ? '2+ Copies'
                  : key === 'augments'
                  ? '★ Augments'
                  : key}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10182a] border border-slate-800 overflow-x-auto max-w-full">
            {(['all', 'common', 'rare', 'epic', 'mythic'] as RarityFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  sound.select();
                  setRarityFilter(key);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  rarityFilter === key
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10182a] border border-slate-800 overflow-x-auto max-w-full">
            {(['all', 'P', 'M', 'X', 'A'] as TypeFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  sound.select();
                  setTypeFilter(key);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  typeFilter === key
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {key === 'all' ? 'All Types' : `Type ${key}`}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter gallery by element"
            value={elementFilter}
            onChange={(e) => {
              sound.select();
              setElementFilter(e.target.value as 'all' | CardElement);
            }}
            className="min-h-[38px] px-2.5 py-1 rounded-xl bg-[#10182a] border border-slate-800 hover:border-amber-400/50 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="all">All Elements</option>
            {ALL_ELEMENTS.map((el) => (
              <option key={el} value={el}>
                {ELEMENT_META[el].label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter gallery by tribe"
            value={tribeFilter}
            onChange={(e) => {
              sound.select();
              setTribeFilter(e.target.value as 'all' | CardTribe);
            }}
            className="min-h-[38px] px-2.5 py-1 rounded-xl bg-[#10182a] border border-slate-800 hover:border-amber-400/50 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="all">All Tribes</option>
            {ALL_TRIBES.map((tr) => (
              <option key={tr} value={tr}>
                {TRIBE_META[tr].label}
              </option>
            ))}
          </select>
        </div>

        {/* Search by Name, Number, or Augment */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Find card, #01–#${totalCards}, or augment...`}
            aria-label="Search cards by name, number, or augment"
            className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl bg-[#10182a] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* 90-Card Gallery Grid — 2 Large Cards Per Row on Mobile, 5 on Desktop */}
      {filteredCards.length === 0 ? (
        <div className="rounded-2xl bg-[#10182a] border border-slate-800 p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-200">No cards match this filter.</p>
          <p className="text-xs text-slate-400">
            Try clearing a filter or visit the Shop to unlock new cards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
          {filteredCards.map((card) => {
            const copies = profile.inventory[card.id] ?? [];
            const count = copies.length;
            const isOwned = count > 0;
            const bestCopy = bestCopyByCardId[card.id];
            const equippedCountForType = copies.filter((c) =>
              activeDeck.cards.includes(c.uid)
            ).length;
            const inDeck = equippedCountForType > 0;

            if (!isOwned) {
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setInspectedId(card.id);
                    setSelectedCopyUid(null);
                  }}
                  className="card-grid-item group relative aspect-[5/7] rounded-xl border border-dashed border-slate-700/80 bg-[#0d1424] hover:border-amber-500/45 flex flex-col items-center justify-center p-3 text-center transition-transform duration-150 hover:-translate-y-1 cursor-pointer"
                >
                  <Lock className="w-6 h-6 text-slate-600 group-hover:text-amber-400/75 transition-colors mb-1.5" />
                  <span className="font-mono text-xs text-slate-400 tabular-nums font-semibold">
                    #{String(card.number).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-xs font-medium mt-0.5 ${RARITY_TEXT_COLOR[card.rarity]} opacity-80`}
                  >
                    {RARITY_LABEL[card.rarity]} · Roll {RARITY_STAT_RANGE[card.rarity].label}
                  </span>
                  {card.augment && (
                    <span className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-950/80 border border-violet-500/40 text-[10px] font-mono text-violet-200">
                      <Wand2 className="w-2.5 h-2.5 text-violet-300" />
                      <span>{card.augment.badgeLabel}</span>
                    </span>
                  )}
                </button>
              );
            }

            return (
              <div key={card.id} className="card-grid-item space-y-1.5">
                <div className="relative">
                  <GameCard
                    cardId={card.id}
                    stats={bestCopy?.stats}
                    arrows={bestCopy?.arrows}
                    augmentId={bestCopy?.augmentId}
                    owner={inDeck ? 'player' : 'neutral'}
                    showName
                    size="md"
                    onClick={() => {
                      sound.select();
                      setInspectedId(card.id);
                      setSelectedCopyUid(bestCopy?.uid ?? null);
                    }}
                  />
                  {/* Copy Count Badge (1/5 to 5/5) */}
                  <span
                    className={`pointer-events-none absolute top-2.5 left-2.5 z-20 px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold tabular-nums border shadow ${
                      count >= MAX_COPIES_PER_CARD
                        ? 'bg-amber-500 text-slate-950 border-amber-200'
                        : count > 1
                        ? 'bg-slate-900/90 text-amber-300 border-amber-400/50'
                        : 'bg-slate-900/85 text-slate-300 border-slate-700'
                    }`}
                  >
                    {count}/{MAX_COPIES_PER_CARD}
                  </span>
                  {inDeck && (
                    <span
                      title={`In ${activeDeck.name}`}
                      className="pointer-events-none absolute top-2.5 right-2.5 z-20 px-1.5 h-5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center gap-0.5 shadow"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      {equippedCountForType > 1 && <span>×{equippedCountForType}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between px-0.5 text-xs text-slate-400">
                  <span className={RARITY_TEXT_COLOR[card.rarity]}>
                    #{String(card.number).padStart(2, '0')} · {RARITY_LABEL[card.rarity]}
                  </span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {bestCopy ? formatTetraCode(bestCopy.stats) : formatTetraCode(card.stats)} ·{' '}
                    {bestCopy ? bestCopy.arrows.length : card.arrows.length}▲
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card Inspector & Rolled Copy Vault Modal — Wide 2-Column Showcase */}
      {inspectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#04070f]/88 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-title"
          onClick={() => setInspectedId(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#11192c] border border-amber-400/35 shadow-[0_30px_80px_rgba(0,0,0,0.9)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-slate-600 mx-auto mt-2.5" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h2
                  id="inspector-title"
                  className="font-[var(--font-display)] text-xl sm:text-2xl font-bold text-slate-100"
                >
                  {inspectedCopies.length > 0
                    ? `#${String(inspectedCard.number).padStart(2, '0')} ${inspectedCard.name}`
                    : `Locked Card #${String(inspectedCard.number).padStart(2, '0')}`}
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mt-0.5">
                  <span className={RARITY_TEXT_COLOR[inspectedCard.rarity]}>
                    {RARITY_LABEL[inspectedCard.rarity]} (Stats{' '}
                    {RARITY_STAT_RANGE[inspectedCard.rarity].label} · Arrows{' '}
                    {RARITY_ARROW_RANGE[inspectedCard.rarity].label})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Copies: {inspectedCopies.length}/{MAX_COPIES_PER_CARD}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedId(null)}
                aria-label="Close card details"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              {inspectedCopies.length > 0 && activeInspectedCopy ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Left: Full-Size Collector Tarot Card Showcase */}
                  <div className="md:col-span-5 flex flex-col items-center">
                    <div className="w-full max-w-[330px]">
                      <GameCard
                        cardId={inspectedCard.id}
                        stats={activeInspectedCopy.stats}
                        arrows={activeInspectedCopy.arrows}
                        augmentId={activeInspectedCopy.augmentId}
                        owner={
                          activeDeck.cards.includes(activeInspectedCopy.uid)
                            ? 'player'
                            : 'neutral'
                        }
                        variant="tarot"
                        size="lg"
                      />
                    </div>
                  </div>

                  {/* Right: Element/Tribe Traits, Augment Info, Stat Breakdown & Rolled Copy Vault */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0c1322] border border-slate-800 px-3.5 py-2.5 text-xs">
                      <span className="text-slate-400 font-medium">Element &amp; Tribe</span>
                      <CardTraitPills
                        element={inspectedCard.element}
                        tribe={inspectedCard.tribe}
                      />
                    </div>
                    {(() => {
                      const activeAug = resolveCardAugment(
                        inspectedCard.id,
                        activeInspectedCopy?.augmentId
                      );
                      if (!activeAug) return null;
                      const isCrafted = Boolean(activeInspectedCopy?.augmentId);
                      return (
                        <div className="rounded-xl bg-violet-950/60 border border-violet-400/50 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-violet-100">
                          <Wand2 className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-violet-200">
                              {isCrafted ? 'Crafted Runeforge Augment' : 'Innate Mythic Trait'} —{' '}
                              {activeAug.name} ({activeAug.shortTag})
                            </div>
                            <p className="text-slate-300 mt-0.5">{activeAug.description}</p>
                          </div>
                        </div>
                      );
                    })()}

                  {/* Selected Copy Stat Breakdown */}
                  <div className="grid grid-cols-4 gap-2 text-center rounded-xl bg-[#0c1322] border border-slate-800 p-3">
                    <div>
                      <p className="text-[11px] text-slate-400">
                        Power ({RARITY_STAT_RANGE[inspectedCard.rarity].label})
                      </p>
                      <p className="font-mono text-base font-bold tabular-nums text-white mt-0.5">
                        {toHexDigit(activeInspectedCopy.stats.power)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Type</p>
                      <p className="font-mono text-base font-bold tabular-nums text-amber-300 mt-0.5">
                        {activeInspectedCopy.stats.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">
                        P.Def ({RARITY_STAT_RANGE[inspectedCard.rarity].label})
                      </p>
                      <p className="font-mono text-base font-bold tabular-nums text-slate-200 mt-0.5">
                        {toHexDigit(activeInspectedCopy.stats.pDef)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">
                        M.Def ({RARITY_STAT_RANGE[inspectedCard.rarity].label})
                      </p>
                      <p className="font-mono text-base font-bold tabular-nums text-slate-200 mt-0.5">
                        {toHexDigit(activeInspectedCopy.stats.mDef)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-amber-300" />
                      <span>
                        Arrows ({activeInspectedCopy.arrows.length}▲):{' '}
                        <strong className="font-mono text-amber-200">
                          {formatArrowsCompact(activeInspectedCopy.arrows)}
                        </strong>
                      </span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {TYPE_DESCR[activeInspectedCopy.stats.type]}
                    </span>
                  </div>

                  {/* Rolled Copies List (Up to 5 Copies with Equip & Sell Actions) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Owned Rolled Copies ({inspectedCopies.length} / {MAX_COPIES_PER_CARD})
                      </h3>
                      {inspectedCopies.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = onSellExtraCopies(inspectedCard.id);
                            if (res.soldCount > 0) {
                              showToast(
                                `Sold ${res.soldCount} extra ${inspectedCard.name} cop${
                                  res.soldCount === 1 ? 'y' : 'ies'
                                } for +${res.goldEarned.toLocaleString()}g!`
                              );
                            } else {
                              showToast(
                                'Unequip extra copies from your saved hands first to bulk-sell.'
                              );
                            }
                          }}
                          className="text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Sell Extras (Keep Best)</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {inspectedCopies.map((copy, idx) => {
                        const isFocused = copy.uid === activeInspectedCopy.uid;
                        const isEquipped = activeDeck.cards.includes(copy.uid);
                        const sellGold = getCardSellValue(
                          inspectedCard,
                          copy.stats,
                          copy.arrows
                        );
                        const canSell = totalOwnedCopies > DECK_CAPACITY;

                        return (
                          <div
                            key={copy.uid}
                            onClick={() => {
                              sound.select();
                              setSelectedCopyUid(copy.uid);
                            }}
                            className={`rounded-xl p-2.5 border flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isFocused
                                ? 'bg-[#192644] border-amber-400/70'
                                : 'bg-[#0c1322] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs font-bold text-slate-300 flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-amber-200">
                                    {formatTetraCode(copy.stats)}
                                  </span>
                                  <span className="font-mono text-xs font-semibold text-sky-300">
                                    {copy.arrows.length}▲ ({formatArrowsCompact(copy.arrows)})
                                  </span>
                                  {idx === 0 && inspectedCopies.length > 1 && (
                                    <span className="text-[10px] font-semibold text-emerald-300">
                                      ★ Best Roll
                                    </span>
                                  )}
                                  {isEquipped && (
                                    <span className="text-[10px] font-semibold text-blue-300">
                                      In {activeDeck.name}
                                    </span>
                                  )}
                                  {copy.augmentId && (() => {
                                    const copyAug = resolveCardAugment(inspectedCard.id, copy.augmentId);
                                    if (!copyAug) return null;
                                    return (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-950/90 border border-violet-400/50 text-[10px] font-mono font-semibold text-violet-200">
                                        <Wand2 className="w-2.5 h-2.5 text-violet-300" />
                                        <span>{copyAug.name}</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Pwr {toHexDigit(copy.stats.power)} · P.Def{' '}
                                  {toHexDigit(copy.stats.pDef)} · M.Def{' '}
                                  {toHexDigit(copy.stats.mDef)}
                                </div>
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  sound.select();
                                  const res = onToggleDeckCard(copy.uid);
                                  if (!res.ok && res.message) {
                                    showToast(res.message);
                                  }
                                }}
                                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  isEquipped
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
                                }`}
                              >
                                {isEquipped ? 'Unequip' : 'Equip'}
                              </button>

                              <button
                                type="button"
                                disabled={!canSell}
                                onClick={() => {
                                  const res = onSellCardInstance(copy.uid);
                                  if (res.ok) {
                                    showToast(
                                      `Sold ${inspectedCard.name} (${formatTetraCode(
                                        copy.stats
                                      )} · ${copy.arrows.length}▲) for +${res.goldEarned.toLocaleString()}g!`
                                    );
                                  } else if (res.message) {
                                    showToast(res.message);
                                  }
                                }}
                                title={
                                  canSell
                                    ? `Sell this copy for +${sellGold}g`
                                    : `Keep at least ${DECK_CAPACITY} cards total in your collection`
                                }
                                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1 transition-colors ${
                                  canSell
                                    ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/40 cursor-pointer'
                                    : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                }`}
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>+{sellGold}g</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center space-y-4">
                  <div className="w-28 h-28 mx-auto rounded-xl border border-dashed border-slate-700 bg-[#0c1322] flex flex-col items-center justify-center">
                    <Lock className="w-7 h-7 text-slate-500 mb-1.5" />
                    <span className="text-xs font-mono text-slate-400">
                      #{String(inspectedCard.number).padStart(2, '0')}
                    </span>
                  </div>
                  {inspectedCard.rarity === 'mythic' ? (
                    <div className="rounded-xl bg-amber-950/35 border border-amber-400/40 p-3.5 space-y-1.5 text-center">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Arena Trophy Exclusive
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Mythic legends are never sold in the Shop or Booster Packs. Win them via{' '}
                        <strong className="text-amber-200">High-Tier Battle RNG (Tiers 6–10)</strong>{' '}
                        or claim them directly from{' '}
                        <strong className="text-amber-200">Tier 9–10 Bosses</strong>!
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-200">
                          Not yet unlocked in your compendium
                        </p>
                        <p className="text-xs text-slate-400">
                          Win matches against challengers in its card range, pull it from booster
                          chests, or buy a rolled copy in the Shop for{' '}
                          <span className="font-mono text-amber-300">
                            {inspectedCard.price.toLocaleString()}g
                          </span>
                          .
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedId(null);
                          onGoToShop();
                        }}
                        className="w-full min-h-[46px] rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Visit Card Emporium</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
