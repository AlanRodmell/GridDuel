import React, { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Compass,
  Eye,
  Lock,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useCardPreview } from '../context/cardPreviewContext';
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
  resolveCardAugment,
  sortCardCopies,
  toHexDigit,
} from '../data/cards';
import {
  POWER_CARDS,
  POWER_CARD_MAP,
  getUnlockedPowerCardIdSet,
} from '../data/powerCards';
import { ALL_BOARD_SCALES, BOARD_SCALES } from '../engine/triadEngine';
import {
  AutoBuildStrategy,
  MAX_UNIT_CAPACITY,
  getUnitCapacityForScale,
} from '../store/useProfile';
import {
  AttackType,
  BoardScale,
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
  onSelectBoardScale: (scale: BoardScale) => void;
  onSelectDeckSlot: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
  onSetDeckPowerCard: (powerCardId: string | null) => { ok: boolean; message?: string };
  onToggleDeckCard: (
    uidOrCardId: string,
    preferredSlotIndex?: number
  ) => { ok: boolean; message?: string; slotIndex?: number };
  onClearDeck: () => void;
  onAutoBuildDeck: (
    strategy: AutoBuildStrategy,
    targetBiomes?: undefined,
    onlyEmptySlots?: boolean
  ) => void;
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
  onSelectBoardScale,
  onSelectDeckSlot,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onSetDeckPowerCard,
  onToggleDeckCard,
  onClearDeck,
  onAutoBuildDeck,
  onSellCardInstance,
  onSellExtraCopies,
  onGoToShop,
}) => {
  const { openPreview } = useCardPreview();
  const activeScale = profile.boardScale ?? '6x3';
  const unitCapacity = getUnitCapacityForScale(activeScale);
  const unlockedPowerSet = useMemo(
    () => getUnlockedPowerCardIdSet(profile.fighterWins),
    [profile.fighterWins]
  );
  const equippedPowerDef =
    activeDeck.powerSlot &&
    POWER_CARD_MAP[activeDeck.powerSlot] &&
    unlockedPowerSet.has(activeDeck.powerSlot)
      ? POWER_CARD_MAP[activeDeck.powerSlot]
      : null;
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

  // Best (highest scored) copy per cardId
  const bestCopyByCardId = useMemo(() => {
    const map: Record<string, RolledCardInstance> = {};
    for (const [cid, list] of Object.entries(profile.inventory)) {
      if (list.length > 0) {
        map[cid] = sortCardCopies(list)[0];
      }
    }
    return map;
  }, [profile.inventory]);

  // Count how many extra copies across the entire collection can be bulk-sold (excluding best, equipped, and Runeforged)
  const sellableExtrasSummary = useMemo(() => {
    const equippedUids = new Set(profile.decks.flatMap((d) => d.cards));
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
        if (equippedUids.has(inst.uid)) continue;
        if (inst.augmentId) continue;
        count += 1;
        totalGold += getCardSellValue(card, inst.stats, inst.arrows, inst.augmentId);
      }
    }
    return { count, totalGold };
  }, [profile.decks, profile.inventory]);

  const totalOwnedCopies = useMemo(() => {
    return Object.values(profile.inventory).reduce((sum, list) => sum + list.length, 0);
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
    return sortCardCopies(profile.inventory[inspectedCard.id] ?? []);
  }, [inspectedCard, profile.inventory]);

  const activeInspectedCopy: RolledCardInstance | null = useMemo(() => {
    if (inspectedCopies.length === 0) return null;
    if (selectedCopyUid) {
      const found = inspectedCopies.find((c) => c.uid === selectedCopyUid);
      if (found) return found;
    }
    return inspectedCopies[0];
  }, [inspectedCopies, selectedCopyUid]);

  const activeDeckSlots = useMemo<(RolledCardInstance | null)[]>(() => {
    const raw = activeDeck.slots ?? activeDeck.cards;
    return Array.from({ length: unitCapacity }, (_, idx) => {
      const ref = raw[idx];
      if (!ref) return null;
      if (instanceByUid[ref]) return instanceByUid[ref];
      if (bestCopyByCardId[ref]) return bestCopyByCardId[ref];
      return null;
    });
  }, [activeDeck.cards, activeDeck.slots, bestCopyByCardId, instanceByUid, unitCapacity]);

  const filledDeckCount = useMemo(
    () => activeDeckSlots.filter(Boolean).length,
    [activeDeckSlots]
  );

  const pct = Math.round((ownedUniqueCount / totalCards) * 100);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-5 lg:py-7 space-y-6">
      {/* Floating Action Toast */}
      {feedbackToast && (
        <div className="fixed bottom-20 md:bottom-8 right-4 z-50 rounded-[3px] brass-panel px-4 py-2.5 text-xs font-semibold text-[#f5d593] shadow-2xl flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#e2b053] shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Header + Tier Breakdown + Bulk Sell Extras Button */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f3dfb6] tracking-[0.06em]">
            {totalCards}-Card Compendium &amp; Rolled Vault
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#a69277] mt-1">
            <span className="font-mono tabular-nums text-[#f0c76e] font-semibold">
              {ownedUniqueCount} / {totalCards} Types ({pct}%)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#d6c5a9]">
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
              className="brass-plaque hover:border-[#e2b053] min-h-[42px] px-3.5 py-2 rounded-[3px] text-[#f5d593] font-[var(--font-display)] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              title="Sell lower-rolled duplicate copies while keeping your best roll and all equipped hand cards"
            >
              <Coins className="w-4 h-4 text-[#e2b053] shrink-0" />
              <span>
                Sell {sellableExtrasSummary.count} Extra Cop
                {sellableExtrasSummary.count === 1 ? 'y' : 'ies'} (+
                {sellableExtrasSummary.totalGold.toLocaleString()}g)
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Saved Decks Shelf & Active Deck Showcase */}
      <section className="brass-panel riveted-frame rounded-[4px] p-4 sm:p-5 space-y-5">
        <DeckShelf
          decks={profile.decks}
          activeDeckIndex={profile.activeDeckIndex}
          boardScale={activeScale}
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

        <div className="pt-4 border-t border-[#4b3a26]/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-[var(--font-display)] font-bold text-[#f3dfb6] tracking-wide">
              Active Warband: <span className="text-[#f5d593]">{activeDeck.name}</span>{' '}
              <span className="font-mono text-xs text-[#a69277]">
                ({filledDeckCount}/{unitCapacity} Units
                {equippedPowerDef ? ` + ${equippedPowerDef.code}` : ''})
              </span>
            </div>
            <div className="inline-flex items-center gap-1">
              {ALL_BOARD_SCALES.map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => onSelectBoardScale(sc)}
                  className={`px-2 py-0.5 text-[11px] font-mono font-bold cursor-pointer ${
                    sc === activeScale ? 'brass-btn' : 'iron-btn text-[#c9b79b]'
                  }`}
                >
                  {BOARD_SCALES[sc].shortLabel}
                </button>
              ))}
            </div>
            {(filledDeckCount > 0 || equippedPowerDef) && (
              <button
                type="button"
                onClick={onClearDeck}
                className="iron-btn px-2.5 py-1 font-[var(--font-display)] text-xs text-[#cbb89a] hover:text-rose-300 cursor-pointer"
              >
                Clear Slots
              </button>
            )}
          </div>

          {/* One-Tap Smart Auto-Builders */}
          <div className="flex flex-wrap items-center gap-2">
            {filledDeckCount > 0 && filledDeckCount < unitCapacity && (
              <button
                type="button"
                onClick={() => onAutoBuildDeck('power', undefined, true)}
                className="iron-btn min-h-[36px] px-3 py-1 font-[var(--font-display)] text-xs font-bold text-emerald-300 whitespace-nowrap cursor-pointer"
              >
                Fill {unitCapacity - filledDeckCount} Empty
              </button>
            )}
            <span className="font-[var(--font-display)] text-xs text-[#a69277] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#e2b053]" />
              Auto-Forge:
            </span>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('power')}
              className="iron-btn min-h-[36px] px-3 py-1 font-[var(--font-display)] text-xs whitespace-nowrap cursor-pointer"
            >
              Highest Rolled Stats
            </button>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('arrows')}
              className="iron-btn min-h-[36px] px-3 py-1 font-[var(--font-display)] text-xs whitespace-nowrap cursor-pointer"
            >
              8-Way Arrows
            </button>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('augments')}
              className="organic-tag min-h-[36px] px-3.5 py-1 bg-[#281832] hover:bg-[#351f42] text-violet-200 font-[var(--font-display)] text-xs flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Wand2 className="w-3 h-3" />
              <span>Augment Synergy</span>
            </button>
            <button
              type="button"
              onClick={() => onAutoBuildDeck('assault')}
              className="iron-btn min-h-[36px] px-3 py-1 font-[var(--font-display)] text-xs whitespace-nowrap cursor-pointer"
            >
              X &amp; A Specialists
            </button>
          </div>
        </div>

        {/* Fixed Unit Slots + Dedicated Power Relic Slot */}
        <div
          className={`basalt-recess p-3 grid ${
            unitCapacity === 10
              ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11'
              : unitCapacity === 9
              ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10'
              : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9'
          } gap-2.5 sm:gap-3`}
        >
          {activeDeckSlots.map((inst, slotIdx) => {
            if (!inst) {
              return (
                <div
                  key={`compendium-empty-${slotIdx}`}
                  className="empty-card-imprint relative aspect-[5/7] flex flex-col items-center justify-center p-2 text-center"
                >
                  <span className="absolute top-2 left-2 font-mono text-[10px] font-bold text-[#8c775c]">
                    #{slotIdx + 1}
                  </span>
                  <Plus className="w-5 h-5 text-[#7c6850] mb-1" />
                  <span className="font-[var(--font-display)] text-[10px] uppercase tracking-wider text-[#9c886c]">
                    Unit Slot
                  </span>
                </div>
              );
            }

            return (
              <div key={`compendium-slot-${slotIdx}-${inst.uid}`} className="group relative">
                <span className="organic-seal pointer-events-none absolute top-1 left-1 z-30 w-5 h-5 bg-[#19120c]/95 font-mono text-[9px] font-bold text-[#e5d2b0] flex items-center justify-center shadow">
                  {slotIdx + 1}
                </span>
                <GameCard
                  cardId={inst.cardId}
                  stats={inst.stats}
                  arrows={inst.arrows}
                  augmentId={inst.augmentId}
                  owner="player"
                  size="sm"
                  showName
                  onClick={() => {
                    sound.select();
                    onToggleDeckCard(inst.uid);
                  }}
                />
                <span className="organic-tag pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1.5 z-40 px-2 py-0.5 bg-[#7c1f1f] text-[9.5px] font-[var(--font-display)] font-bold text-white shadow-lg flex items-center gap-0.5">
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                  <span>Remove</span>
                </span>
              </div>
            );
          })}

          {/* Dedicated Power Relic Slot */}
          {unlockedPowerSet.size === 0 ? (
            <div className="empty-card-imprint relative aspect-[5/7] flex flex-col items-center justify-center p-2 text-center opacity-75">
              <span className="organic-tag absolute top-1.5 inset-x-2 bg-sky-950/85 py-[1px] font-[var(--font-display)] text-[8.5px] font-bold uppercase tracking-wider text-sky-300">
                Relic Slot
              </span>
              <Lock className="w-4 h-4 text-sky-300/70 mb-1 mt-2" />
              <span className="font-[var(--font-display)] text-[9.5px] uppercase tracking-wider text-sky-200/80">
                Clear Tier 1
              </span>
            </div>
          ) : !equippedPowerDef ? (
            <div className="empty-card-imprint relative aspect-[5/7] flex flex-col items-center justify-center p-2 text-center">
              <span className="organic-tag absolute top-1.5 inset-x-2 bg-sky-950/90 py-[1px] font-[var(--font-display)] text-[8.5px] font-bold uppercase tracking-wider text-sky-200">
                Relic Slot
              </span>
              <Sparkles className="w-4 h-4 text-sky-300 mb-1 mt-2" />
              <span className="font-[var(--font-display)] text-[9.5px] uppercase tracking-wider text-sky-200">
                Pick Relic Below
              </span>
            </div>
          ) : (
            <div className="group relative">
              <span className="organic-tag pointer-events-none absolute top-1 left-1 z-30 px-1.5 py-[1px] bg-sky-950/95 font-mono text-[8.5px] font-bold text-sky-200 shadow">
                {equippedPowerDef.code}
              </span>
              <GameCard
                cardId={equippedPowerDef.id}
                arrows={equippedPowerDef.dirs}
                owner="player"
                size="sm"
                showName
                onClick={() => {
                  sound.select();
                  onSetDeckPowerCard(null);
                }}
              />
              <span className="organic-tag pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1.5 z-40 px-2 py-0.5 bg-[#7c1f1f] text-[9.5px] font-[var(--font-display)] font-bold text-white shadow-lg flex items-center gap-0.5">
                <X className="w-2.5 h-2.5 stroke-[3]" />
                <span>Remove</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 12 Tier-Unlocked Power Relics Showcase */}
      <section className="iron-panel p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-[var(--font-display)] text-base sm:text-lg font-bold text-sky-200 tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-300" />
              <span>
                Campaign Power Relics ({unlockedPowerSet.size}/{POWER_CARDS.length} Unlocked)
              </span>
            </h2>
            <p className="font-[var(--font-serif)] text-xs sm:text-sm text-[#b7a285]">
              Conquer all 5 challengers in each Campaign Tier (Tiers 1–10) to unlock un-flippable
              directional Totems for your Dedicated Relic Slot.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {POWER_CARDS.map((pCard) => {
            const isUnlocked = unlockedPowerSet.has(pCard.id);
            const isEquipped = equippedPowerDef?.id === pCard.id;
            return (
              <div
                key={pCard.id}
                className={`flex flex-col gap-1.5 ${!isUnlocked ? 'opacity-65' : ''}`}
              >
                <div className="relative">
                  <GameCard
                    cardId={pCard.id}
                    arrows={pCard.dirs}
                    owner={isEquipped ? 'player' : 'neutral'}
                    size="sm"
                    showName
                    onClick={() => {
                      sound.select();
                      if (!isUnlocked) {
                        openPreview({
                          cardId: pCard.id,
                          arrows: pCard.dirs,
                          owner: 'neutral',
                        });
                        return;
                      }
                      const res = onSetDeckPowerCard(isEquipped ? null : pCard.id);
                      if (!res.ok && res.message) showToast(res.message);
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.select();
                      openPreview({
                        cardId: pCard.id,
                        arrows: pCard.dirs,
                        owner: isEquipped ? 'player' : 'neutral',
                      });
                    }}
                    aria-label={`Inspect ${pCard.name}`}
                    className="organic-seal absolute top-1.5 left-1.5 z-20 w-5 h-5 bg-[#141c24]/95 text-sky-200 flex items-center justify-center cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  {isEquipped ? (
                    <span className="organic-tag pointer-events-none absolute top-1.5 right-1.5 z-20 px-2 py-0.5 bg-sky-400 text-[#071521] text-[9px] font-[var(--font-display)] font-bold">
                      Equipped
                    </span>
                  ) : !isUnlocked ? (
                    <span className="organic-tag pointer-events-none absolute top-1.5 right-1.5 z-20 px-2 py-0.5 bg-[#1a130d]/95 text-[#cbb89a] text-[9px] font-mono font-bold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>T{pCard.unlockTier}</span>
                    </span>
                  ) : null}
                </div>
                <div className="text-center text-[10px] font-mono text-sky-200 truncate px-0.5">
                  {pCard.shortTag}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess overflow-x-auto max-w-full">
            {(['all', 'owned', 'duplicates', 'augments', 'locked'] as OwnershipFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  sound.select();
                  setOwnershipFilter(key);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-[2px] font-[var(--font-display)] text-xs capitalize transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === key
                    ? 'brass-btn font-bold'
                    : 'text-[#a69277] hover:text-[#f0e4cc]'
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

          <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess overflow-x-auto max-w-full">
            {(['all', 'common', 'rare', 'epic', 'mythic'] as RarityFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  sound.select();
                  setRarityFilter(key);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-[2px] font-[var(--font-display)] text-xs capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  rarityFilter === key
                    ? 'brass-plaque text-[#f5d593] font-bold'
                    : 'text-[#a69277] hover:text-[#f0e4cc]'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess overflow-x-auto max-w-full">
            {(['all', 'P', 'M', 'X', 'A'] as TypeFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  sound.select();
                  setTypeFilter(key);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  typeFilter === key
                    ? 'brass-plaque text-[#f5d593] font-bold'
                    : 'text-[#a69277] hover:text-[#f0e4cc]'
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
            className="organic-control min-h-[38px] pl-3 text-xs font-medium text-[#e5d6bc] cursor-pointer"
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
            className="organic-control min-h-[38px] pl-3 text-xs font-medium text-[#e5d6bc] cursor-pointer"
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
          <Search className="w-3.5 h-3.5 text-[#8c785f] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Find card, #01–#${totalCards}, or augment...`}
            aria-label="Search cards by name, number, or augment"
            className="organic-control w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs text-[#efe3cd] placeholder:text-[#7d6c56]"
          />
        </div>
      </div>

      {/* Compendium Card Grid */}
      {filteredCards.length === 0 ? (
        <div className="iron-panel rounded-[4px] p-10 text-center space-y-2">
          <p className="font-[var(--font-display)] text-sm font-semibold text-[#f0c76e]">
            No cards match this filter.
          </p>
          <p className="font-[var(--font-serif)] text-sm text-[#a69277]">
            Try clearing a filter or visit the Vault &amp; Forge to unlock new cards.
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
                  className="card-grid-item group relative aspect-[5/7] rounded-[4px] border border-dashed border-[#4a3b2c] bg-[#120e0b] hover:border-[#b98739] flex flex-col items-center justify-center p-3 text-center transition-transform duration-150 hover:-translate-y-1 cursor-pointer"
                >
                  <Lock className="w-6 h-6 text-[#685744] group-hover:text-[#d8a243] transition-colors mb-1.5" />
                  <span className="font-mono text-xs text-[#a69277] tabular-nums font-semibold">
                    #{String(card.number).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-xs font-medium mt-0.5 ${RARITY_TEXT_COLOR[card.rarity]} opacity-85`}
                  >
                    {RARITY_LABEL[card.rarity]} · Roll {RARITY_STAT_RANGE[card.rarity].label}
                  </span>
                  {card.augment && (
                    <span className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[2px] bg-violet-950/80 border border-violet-500/40 text-[10px] font-mono text-violet-200">
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
                    className={`organic-tag pointer-events-none absolute top-2 left-2 z-20 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums shadow ${
                      count >= MAX_COPIES_PER_CARD
                        ? 'bg-[#e2b053] text-[#170f06]'
                        : count > 1
                        ? 'brass-plaque text-[#f0c76e]'
                        : 'bg-[#19120c]/95 text-[#cbb89a]'
                    }`}
                  >
                    {count}/{MAX_COPIES_PER_CARD}
                  </span>
                  {inDeck && (
                    <span
                      title={`In ${activeDeck.name}`}
                      className="organic-tag pointer-events-none absolute top-2 right-2 z-20 px-2 h-5 bg-[#e2b053] text-[#170f06] font-mono text-[10px] font-bold flex items-center justify-center gap-0.5 shadow"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      {equippedCountForType > 1 && <span>×{equippedCountForType}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between px-0.5 text-xs text-[#9b896f]">
                  <span className={RARITY_TEXT_COLOR[card.rarity]}>
                    #{String(card.number).padStart(2, '0')} · {RARITY_LABEL[card.rarity]}
                  </span>
                  {count > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.select();
                        setInspectedId(card.id);
                        setSelectedCopyUid(bestCopy?.uid ?? null);
                      }}
                      className="font-[var(--font-display)] text-[11px] font-semibold text-[#f0c76e] hover:text-[#fde5ad] transition-colors cursor-pointer"
                    >
                      Compare {count} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card Inspector & Rolled Copy Vault Modal — Carved Reliquary Showcase */}
      {inspectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/90 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-title"
          onClick={() => setInspectedId(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[94dvh] flex flex-col rounded-t-[6px] sm:rounded-[5px] brass-panel riveted-frame shadow-[0_32px_90px_rgba(0,0,0,0.92)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-[#6d573e] mx-auto mt-2.5" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-[#4b3a26]/85">
              <div>
                <h2
                  id="inspector-title"
                  className="font-[var(--font-display)] text-xl sm:text-2xl font-bold text-[#f6e1b5] tracking-wide"
                >
                  {inspectedCopies.length > 0
                    ? `#${String(inspectedCard.number).padStart(2, '0')} ${inspectedCard.name}`
                    : `Locked Card #${String(inspectedCard.number).padStart(2, '0')}`}
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#a69277] mt-0.5">
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
                className="iron-btn min-h-[42px] min-w-[42px] flex items-center justify-center rounded-[3px] cursor-pointer"
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
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[3px] basalt-recess px-3.5 py-2.5 text-xs">
                      <span className="font-[var(--font-display)] uppercase tracking-wider text-[11px] text-[#9b886e]">
                        Element &amp; Tribe
                      </span>
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
                        <div className="rounded-[3px] bg-[#24162b]/80 border border-violet-400/50 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-violet-100">
                          <Wand2 className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-[var(--font-display)] font-bold text-violet-200">
                              {isCrafted ? 'Crafted Runeforge Augment' : 'Innate Mythic Trait'} —{' '}
                              {activeAug.name} ({activeAug.shortTag})
                            </div>
                            <p className="font-[var(--font-serif)] text-sm text-[#d4c4e0] mt-0.5">
                              {activeAug.description}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                  {/* Selected Copy Stat Breakdown */}
                  <div className="grid grid-cols-4 gap-2 text-center rounded-[3px] basalt-recess p-3">
                    <div>
                      <p className="text-[11px] text-[#9b886e]">
                        Power ({RARITY_STAT_RANGE[inspectedCard.rarity].label})
                      </p>
                      <p className="font-mono text-base font-bold tabular-nums text-[#f7e7c7] mt-0.5">
                        {toHexDigit(activeInspectedCopy.stats.power)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#9b886e]">Type</p>
                      <p className="font-mono text-base font-bold tabular-nums text-[#f0c76e] mt-0.5">
                        {activeInspectedCopy.stats.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#9b886e]">
                        P.Def ({RARITY_STAT_RANGE[inspectedCard.rarity].label})
                      </p>
                      <p className="font-mono text-base font-bold tabular-nums text-[#e5d6bc] mt-0.5">
                        {toHexDigit(activeInspectedCopy.stats.pDef)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#9b886e]">
                        M.Def ({RARITY_STAT_RANGE[inspectedCard.rarity].label})
                      </p>
                      <p className="font-mono text-base font-bold tabular-nums text-[#e5d6bc] mt-0.5">
                        {toHexDigit(activeInspectedCopy.stats.mDef)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#a69277] px-1">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#e2b053]" />
                      <span>
                        Arrows ({activeInspectedCopy.arrows.length}▲):{' '}
                        <strong className="font-mono text-[#f0c76e]">
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
                      <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#dfd0b6]">
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
                          className="font-[var(--font-display)] text-xs font-semibold text-[#f0c76e] hover:text-[#fae2a8] flex items-center gap-1 cursor-pointer"
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
                          copy.arrows,
                          copy.augmentId
                        );
                        const canSell = totalOwnedCopies > MAX_UNIT_CAPACITY;
                        const bestRef = inspectedCopies[0];
                        const statDiff =
                          copy.stats.power +
                          copy.stats.pDef +
                          copy.stats.mDef -
                          (bestRef.stats.power + bestRef.stats.pDef + bestRef.stats.mDef);
                        const arrowDiff = copy.arrows.length - bestRef.arrows.length;
                        const deltaParts: string[] = [];
                        if (statDiff !== 0) {
                          deltaParts.push(
                            `${statDiff > 0 ? `+${statDiff}` : statDiff} stat${
                              Math.abs(statDiff) === 1 ? '' : 's'
                            }`
                          );
                        }
                        if (arrowDiff !== 0) {
                          deltaParts.push(`${arrowDiff > 0 ? `+${arrowDiff}` : arrowDiff}▲`);
                        }

                        return (
                          <div
                            key={copy.uid}
                            onClick={() => {
                              sound.select();
                              setSelectedCopyUid(copy.uid);
                            }}
                            className={`rounded-[3px] p-2.5 border flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                              isFocused
                                ? 'brass-plaque border-[#cf9a42]'
                                : 'basalt-recess hover:border-[#6e522b]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-11 shrink-0">
                                <GameCard
                                  cardId={inspectedCard.id}
                                  stats={copy.stats}
                                  arrows={copy.arrows}
                                  augmentId={copy.augmentId}
                                  owner={isEquipped ? 'player' : 'neutral'}
                                  size="xs"
                                  disableLongPress
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-[#cbb89a]">
                                    #{idx + 1}
                                  </span>
                                  <span className="font-mono text-sm font-bold text-[#f0c76e]">
                                    {formatTetraCode(copy.stats)}
                                  </span>
                                  <span className="font-mono text-xs font-semibold text-[#e5d6bc]">
                                    {copy.arrows.length}▲ ({formatArrowsCompact(copy.arrows)})
                                  </span>
                                  {idx === 0 && inspectedCopies.length > 1 && (
                                    <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-950/85 border border-emerald-400/50 font-mono text-[10px] font-semibold text-emerald-300">
                                      ★ Best Roll
                                    </span>
                                  )}
                                  {idx > 0 && deltaParts.length > 0 && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-semibold ${
                                        statDiff <= 0 && arrowDiff <= 0
                                          ? 'bg-rose-950/75 border-rose-500/45 text-rose-300'
                                          : 'bg-sky-950/85 border-sky-400/45 text-sky-300'
                                      }`}
                                    >
                                      {deltaParts.join(' · ')}
                                    </span>
                                  )}
                                  {isEquipped && (
                                    <span className="text-[10px] font-semibold text-[#9bc6f5]">
                                      In {activeDeck.name}
                                    </span>
                                  )}
                                  {copy.augmentId && (() => {
                                    const copyAug = resolveCardAugment(inspectedCard.id, copy.augmentId);
                                    if (!copyAug) return null;
                                    return (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[2px] bg-violet-950/90 border border-violet-400/50 text-[10px] font-mono font-semibold text-violet-200">
                                        <Wand2 className="w-2.5 h-2.5 text-violet-300" />
                                        <span>{copyAug.name}</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="text-[11px] text-[#9b896f] mt-0.5">
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
                                className={`min-h-[34px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs font-semibold transition-colors cursor-pointer ${
                                  isEquipped
                                    ? 'iron-btn'
                                    : 'brass-btn font-bold'
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
                                    : `Keep at least ${MAX_UNIT_CAPACITY} cards total in your collection`
                                }
                                className={`min-h-[34px] px-2.5 py-1 rounded-[2px] text-xs font-mono font-semibold flex items-center gap-1 transition-colors ${
                                  canSell
                                    ? 'crimson-btn cursor-pointer'
                                    : 'basalt-recess text-[#685a49] cursor-not-allowed'
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
                  <div className="w-28 h-28 mx-auto rounded-[4px] border border-dashed border-[#4a3b2c] basalt-recess flex flex-col items-center justify-center">
                    <Lock className="w-7 h-7 text-[#6d5b46] mb-1.5" />
                    <span className="text-xs font-mono text-[#a69277]">
                      #{String(inspectedCard.number).padStart(2, '0')}
                    </span>
                  </div>
                  {inspectedCard.rarity === 'mythic' ? (
                    <div className="rounded-[3px] brass-plaque p-3.5 space-y-1.5 text-center">
                      <p className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#f0c76e]">
                        Arena Trophy Exclusive
                      </p>
                      <p className="font-[var(--font-serif)] text-sm text-[#cbb89a] leading-relaxed">
                        Mythic legends are never sold in the Vault or Booster Packs. Win them via{' '}
                        <strong className="text-[#f5d593]">High-Tier Battle RNG (Tiers 6–10)</strong>{' '}
                        or claim them directly from{' '}
                        <strong className="text-[#f5d593]">Tier 9–10 Bosses</strong>!
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p className="font-[var(--font-display)] text-sm font-semibold text-[#f3dfb6]">
                          Not yet unlocked in your compendium
                        </p>
                        <p className="font-[var(--font-serif)] text-sm text-[#b39e81]">
                          Win matches against challengers in its card range, pull it from booster
                          reliquaries, or buy a rolled copy in the Vault for{' '}
                          <span className="font-mono text-[#f0c76e]">
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
                        className="brass-btn w-full min-h-[46px] rounded-[3px] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Visit Merchant Vault</span>
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
