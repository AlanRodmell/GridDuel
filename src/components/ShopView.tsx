import React, { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Crown,
  Dices,
  Flame,
  Hammer,
  PackageOpen,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { ELEMENT_META, TRIBE_META } from '../data/biomes';
import {
  BOOSTER_PACKS,
  CARD_MAP,
  CARDS,
  CRAFTABLE_AUGMENT_MAP,
  CRAFTABLE_AUGMENTS,
  formatTetraCode,
  getCardSellValue,
  getCardThumbUrl,
  getStatsPowerScore,
  RARITY_ARROW_RANGE,
  RARITY_STAT_RANGE,
  sortCardCopies,
} from '../data/cards';
import {
  ForgeableRarity,
  getRandomForgeCost,
  PackRevealItem,
  RandomForgeResult,
} from '../store/useProfile';
import {
  AttackType,
  AugmentTier,
  DeckSlot,
  PlayerProfile,
  Rarity,
  RolledCardInstance,
} from '../types/game';
import { sound } from '../utils/sound';
import { CardTraitPills } from './BiomeBadge';
import { GameCard } from './GameCard';

type PackTierId = 'tavern-pack' | 'royal-vault' | 'mythic-chest';
type ShopRarityFilter = 'all' | 'common' | 'rare' | 'epic';
type ShopSectionTab = 'foundry' | 'runeforge';
type ForgeCopyFilter = 'deck' | 'all' | 'crafted';

interface ShopViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  onBuyCard: (cardId: string) => RolledCardInstance | null;
  onForgeRandomCard: (
    rarity: ForgeableRarity,
    targetType?: 'all' | AttackType
  ) => RandomForgeResult | null;
  onOpenPack: (packId: PackTierId) => PackRevealItem[] | null;
  onCraftAugment: (
    instanceUid: string,
    augmentId: string
  ) => {
    ok: boolean;
    message?: string;
    cardName?: string;
    runeName?: string;
    cost?: number;
    replaced?: boolean;
  };
  onSellCardInstance: (instanceUid: string) => {
    ok: boolean;
    goldEarned: number;
    cardName?: string;
    message?: string;
  };
  onSellExtraCopies: (specificCardId?: string) => {
    soldCount: number;
    goldEarned: number;
  };
}

const RUNE_TIER_BADGE: Record<AugmentTier, { label: string; badgeClass: string }> = {
  minor: {
    label: 'Minor Rune',
    badgeClass: 'bg-emerald-950/90 text-emerald-200 border-emerald-400/50',
  },
  major: {
    label: 'Major Rune',
    badgeClass: 'bg-sky-950/90 text-sky-200 border-sky-400/60',
  },
  sovereign: {
    label: 'Sovereign Rune',
    badgeClass: 'bg-amber-950/90 text-amber-200 border-amber-400/75',
  },
};

const RARITY_COLOR: Record<Rarity, string> = {
  common: 'text-slate-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  mythic: 'text-amber-300',
};

const PACK_STYLE: Record<
  PackTierId,
  { border: string; glow: string; badgeText: string; accentColor: string }
> = {
  'tavern-pack': {
    border: 'border-[#63482d] hover:border-[#c69143]',
    glow: 'from-[#281b11] via-[#1a120c] to-[#110c08]',
    badgeText: 'Common & Rare Rolls · Sell or Keep Anytime',
    accentColor: 'text-[#dfb97a]',
  },
  'royal-vault': {
    border: 'border-[#6f4b80] hover:border-violet-400/80',
    glow: 'from-[#291830] via-[#1a111f] to-[#110b14]',
    badgeText: '1+ Rare or Epic Guaranteed',
    accentColor: 'text-violet-300',
  },
  'mythic-chest': {
    border: 'border-[#a4742f] hover:border-[#eec063]',
    glow: 'from-[#36220f] via-[#21150b] to-[#120c08]',
    badgeText: '1+ Epic Guaranteed · High Sanctuary Pool',
    accentColor: 'text-[#f3cb74]',
  },
};

const TYPE_FOCUS_LABEL: Record<'all' | AttackType, string> = {
  all: 'Any Type (Base Cost)',
  P: 'Type P · Physical (+15%)',
  M: 'Type M · Magical (+15%)',
  X: 'Type X · Flexible (+18%)',
  A: 'Type A · Assault (+22%)',
};

const RANDOM_CRUCIBLE_TIERS: Array<{
  rarity: ForgeableRarity;
  title: string;
  subtitle: string;
  accentText: string;
  borderClass: string;
  bgClass: string;
}> = [
  {
    rarity: 'common',
    title: 'Common Crucible',
    subtitle: 'Rolls 0–5 · 1–6▲',
    accentText: 'text-slate-200',
    borderClass: 'border-[#5a4a38] hover:border-[#cfa052]',
    bgClass: 'from-[#221a14] via-[#17120d] to-[#100c09]',
  },
  {
    rarity: 'rare',
    title: 'Rare Crucible',
    subtitle: 'Rolls 4–8 · 2–7▲',
    accentText: 'text-sky-300',
    borderClass: 'border-sky-500/45 hover:border-sky-300/80',
    bgClass: 'from-[#162230] via-[#111822] to-[#0c1016]',
  },
  {
    rarity: 'epic',
    title: 'Epic Crucible',
    subtitle: 'Rolls 7–B · 3–8▲',
    accentText: 'text-violet-300',
    borderClass: 'border-violet-500/50 hover:border-violet-300/85',
    bgClass: 'from-[#261733] via-[#191022] to-[#100b15]',
  },
];

export const ShopView: React.FC<ShopViewProps> = ({
  profile,
  activeDeck,
  onBuyCard,
  onForgeRandomCard,
  onOpenPack,
  onCraftAugment,
  onSellCardInstance,
  onSellExtraCopies,
}) => {
  const [sectionTab, setSectionTab] = useState<ShopSectionTab>('foundry');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<
    'all' | 'unowned' | 'owned' | 'duplicates'
  >('all');
  const [rarityFilter, setRarityFilter] = useState<ShopRarityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AttackType>('all');
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(CARDS[0]?.id ?? '');
  const [focusedCopyUid, setFocusedCopyUid] = useState<string | null>(null);
  const [randomForgeType, setRandomForgeType] = useState<'all' | AttackType>('all');
  const [randomForgeModal, setRandomForgeModal] = useState<{
    result: RandomForgeResult;
    targetType: 'all' | AttackType;
    soldGold?: number;
  } | null>(null);

  const [forgeCopyFilter, setForgeCopyFilter] = useState<ForgeCopyFilter>('all');
  const [forgeRuneTier, setForgeRuneTier] = useState<'all' | AugmentTier>('all');
  const [selectedForgeUid, setSelectedForgeUid] = useState<string | null>(null);
  const [selectedRuneId, setSelectedRuneId] = useState<string>(CRAFTABLE_AUGMENTS[0].id);

  const [justBoughtRoll, setJustBoughtRoll] = useState<{
    cardId: string;
    uid: string;
    code: string;
    arrowCount: number;
  } | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [packModal, setPackModal] = useState<{
    packId: PackTierId;
    packName: string;
    items: PackRevealItem[];
    revealed: boolean[];
    soldGoldByUid: Record<string, number>;
  } | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((cur) => (cur === msg ? null : cur));
    }, 3400);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = (cardId: string): boolean => {
    if (!normalizedQuery) return true;
    const def = CARD_MAP[cardId];
    if (!def) return false;
    const elLabel = ELEMENT_META[def.element]?.label.toLowerCase() ?? def.element;
    const trLabel = TRIBE_META[def.tribe]?.label.toLowerCase() ?? def.tribe;
    const numStr = `#${String(def.number).padStart(2, '0')}`;
    return (
      def.name.toLowerCase().includes(normalizedQuery) ||
      elLabel.includes(normalizedQuery) ||
      trLabel.includes(normalizedQuery) ||
      def.rarity.includes(normalizedQuery) ||
      numStr.includes(normalizedQuery)
    );
  };

  const activeDeckUidSet = useMemo(() => new Set(activeDeck.cards), [activeDeck.cards]);
  const equippedUidsSet = useMemo(
    () => new Set(profile.decks.flatMap((d) => d.cards)),
    [profile.decks]
  );

  // Owned copies eligible for Runeforge crafting (excludes Mythics with permanent innate augments)
  const forgeableCopies = useMemo(() => {
    const all = Object.values(profile.inventory)
      .flat()
      .filter((inst) => {
        const def = CARD_MAP[inst.cardId];
        return Boolean(def && !def.augment);
      });

    return all.sort((a, b) => {
      const aDeck = activeDeckUidSet.has(a.uid) ? 1 : 0;
      const bDeck = activeDeckUidSet.has(b.uid) ? 1 : 0;
      if (aDeck !== bDeck) return bDeck - aDeck;
      const aAug = a.augmentId ? 1 : 0;
      const bAug = b.augmentId ? 1 : 0;
      if (aAug !== bAug) return bAug - aAug;
      return (
        getStatsPowerScore(b.stats, b.arrows.length) -
        getStatsPowerScore(a.stats, a.arrows.length)
      );
    });
  }, [activeDeckUidSet, profile.inventory]);

  const craftedCopyCount = useMemo(
    () => forgeableCopies.filter((c) => Boolean(c.augmentId)).length,
    [forgeableCopies]
  );

  const visibleForgeCopies = useMemo(() => {
    return forgeableCopies.filter((c) => {
      if (forgeCopyFilter === 'deck' && !activeDeckUidSet.has(c.uid)) return false;
      if (forgeCopyFilter === 'crafted' && !c.augmentId) return false;
      if (normalizedQuery && !matchesSearch(c.cardId)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeckUidSet, forgeCopyFilter, forgeableCopies, normalizedQuery]);

  const activeForgeCopy = useMemo(() => {
    if (selectedForgeUid) {
      const exact = forgeableCopies.find((c) => c.uid === selectedForgeUid);
      if (exact) return exact;
    }
    return visibleForgeCopies[0] ?? forgeableCopies[0] ?? null;
  }, [forgeableCopies, selectedForgeUid, visibleForgeCopies]);

  const activeForgeCard = activeForgeCopy ? CARD_MAP[activeForgeCopy.cardId] ?? null : null;
  const activeRune = CRAFTABLE_AUGMENT_MAP[selectedRuneId] ?? CRAFTABLE_AUGMENTS[0];
  const currentCraftedRune = activeForgeCopy?.augmentId
    ? CRAFTABLE_AUGMENT_MAP[activeForgeCopy.augmentId] ?? null
    : null;

  const visibleRunes = useMemo(() => {
    if (forgeRuneTier === 'all') return CRAFTABLE_AUGMENTS;
    return CRAFTABLE_AUGMENTS.filter((r) => r.tier === forgeRuneTier);
  }, [forgeRuneTier]);

  const discoveredSet = useMemo(() => {
    const set = new Set<string>();
    if (profile.discovered) {
      for (const [cid, val] of Object.entries(profile.discovered)) {
        if (val) set.add(cid);
      }
    }
    for (const [cid, list] of Object.entries(profile.inventory)) {
      if (list.length > 0) set.add(cid);
    }
    for (const [cid, count] of Object.entries(profile.owned)) {
      if (count > 0) set.add(cid);
    }
    return set;
  }, [profile.discovered, profile.inventory, profile.owned]);

  // Purchasable Blueprints (Common, Rare, Epic; Mythics are Boss/Arena drops)
  const purchasableCatalog = useMemo(
    () => CARDS.filter((c) => c.rarity !== 'mythic'),
    []
  );

  // Only discovered blueprints appear in the Registry so Unknown cards stay a mystery!
  const discoveredBlueprints = useMemo(
    () => purchasableCatalog.filter((c) => discoveredSet.has(c.id)),
    [discoveredSet, purchasableCatalog]
  );

  const undiscoveredBlueprintCount = Math.max(
    0,
    purchasableCatalog.length - discoveredBlueprints.length
  );

  // Pool stats for Mystery Crucible (Random Card Forge per Rarity & Combat Type)
  const randomCruciblePools = useMemo(() => {
    const map = {} as Record<
      ForgeableRarity,
      { total: number; undiscovered: number; cost: number }
    >;
    for (const r of ['common', 'rare', 'epic'] as ForgeableRarity[]) {
      const pool = purchasableCatalog.filter(
        (c) =>
          c.rarity === r &&
          (randomForgeType === 'all' || c.stats.type === randomForgeType)
      );
      const undiscovered = pool.filter((c) => !discoveredSet.has(c.id)).length;
      map[r] = {
        total: pool.length,
        undiscovered,
        cost: getRandomForgeCost(r, randomForgeType),
      };
    }
    return map;
  }, [discoveredSet, purchasableCatalog, randomForgeType]);

  const extraCopiesSummary = useMemo(() => {
    let extraCount = 0;
    let totalGold = 0;

    for (const card of CARDS) {
      const copies = profile.inventory[card.id] ?? [];
      if (copies.length <= 1) continue;
      const sorted = sortCardCopies(copies);
      const bestUid = sorted[0].uid;
      for (const inst of sorted) {
        if (inst.uid === bestUid) continue;
        if (equippedUidsSet.has(inst.uid)) continue;
        if (inst.augmentId) continue;
        extraCount += 1;
        totalGold += getCardSellValue(card, inst.stats, inst.arrows, inst.augmentId);
      }
    }
    return { extraCount, totalGold };
  }, [equippedUidsSet, profile.inventory]);

  const marketCards = useMemo(() => {
    return discoveredBlueprints.filter((c) => {
      const count = profile.inventory[c.id]?.length ?? 0;
      if (ownershipFilter === 'unowned' && count > 0) return false;
      if (ownershipFilter === 'owned' && count === 0) return false;
      if (ownershipFilter === 'duplicates' && count < 2) return false;
      if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false;
      if (typeFilter !== 'all' && c.stats.type !== typeFilter) return false;
      if (normalizedQuery && !matchesSearch(c.id)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    discoveredBlueprints,
    normalizedQuery,
    ownershipFilter,
    profile.inventory,
    rarityFilter,
    typeFilter,
  ]);

  const selectedBlueprint = useMemo(() => {
    const inFiltered = marketCards.find((c) => c.id === selectedBlueprintId);
    if (inFiltered) return inFiltered;
    const exact = discoveredBlueprints.find((c) => c.id === selectedBlueprintId);
    if (exact && !normalizedQuery) return exact;
    return marketCards[0] ?? discoveredBlueprints[0];
  }, [discoveredBlueprints, marketCards, normalizedQuery, selectedBlueprintId]);

  const selectedBlueprintCopies = useMemo(() => {
    if (!selectedBlueprint) return [];
    return sortCardCopies(profile.inventory[selectedBlueprint.id] ?? []);
  }, [profile.inventory, selectedBlueprint]);

  const pedestalPreviewCopy = useMemo(() => {
    if (!selectedBlueprintCopies.length) return null;
    if (focusedCopyUid) {
      const exact = selectedBlueprintCopies.find((c) => c.uid === focusedCopyUid);
      if (exact) return exact;
    }
    return selectedBlueprintCopies[0];
  }, [focusedCopyUid, selectedBlueprintCopies]);

  const handleForgeImbue = () => {
    if (!activeForgeCopy || !activeRune) return;
    const res = onCraftAugment(activeForgeCopy.uid, activeRune.id);
    if (res.ok) {
      showToast(
        `${res.replaced ? 'Re-forged' : 'Imbued'} ${res.cardName} with ${res.runeName} (-${res.cost?.toLocaleString()}g)!`
      );
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleOpenPack = (packId: PackTierId, packName: string) => {
    const items = onOpenPack(packId);
    if (!items) return;
    setPackModal({
      packId,
      packName,
      items,
      revealed: items.map(() => false),
      soldGoldByUid: {},
    });
  };

  const revealIndex = (idx: number) => {
    if (!packModal || packModal.revealed[idx]) return;
    const item = packModal.items[idx];
    sound.packReveal(
      item.card.rarity === 'epic' ||
        item.card.rarity === 'mythic' ||
        item.isNewUnlock
    );
    setPackModal({
      ...packModal,
      revealed: packModal.revealed.map((v, i) => (i === idx ? true : v)),
    });
  };

  const revealAll = () => {
    if (!packModal) return;
    const hasHigh = packModal.items.some(
      (it) =>
        it.card.rarity === 'epic' ||
        it.card.rarity === 'mythic' ||
        it.isNewUnlock
    );
    sound.packReveal(hasHigh);
    setPackModal({
      ...packModal,
      revealed: packModal.items.map(() => true),
    });
  };

  const handleSellPackItem = (item: PackRevealItem) => {
    if (!packModal || packModal.soldGoldByUid[item.instance.uid] !== undefined) return;
    const res = onSellCardInstance(item.instance.uid);
    if (res.ok) {
      setPackModal((prev) =>
        prev
          ? {
              ...prev,
              soldGoldByUid: {
                ...prev.soldGoldByUid,
                [item.instance.uid]: res.goldEarned,
              },
            }
          : null
      );
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleSellAllPackItems = () => {
    if (!packModal) return;
    const nextSold = { ...packModal.soldGoldByUid };
    for (const item of packModal.items) {
      if (nextSold[item.instance.uid] !== undefined) continue;
      const res = onSellCardInstance(item.instance.uid);
      if (res.ok) {
        nextSold[item.instance.uid] = res.goldEarned;
      }
    }
    setPackModal((prev) => (prev ? { ...prev, soldGoldByUid: nextSold } : null));
  };

  const handleDirectBuy = (cardId: string) => {
    const rolled = onBuyCard(cardId);
    if (rolled) {
      const code = formatTetraCode(rolled.stats);
      const card = CARD_MAP[cardId];
      setSelectedBlueprintId(cardId);
      setFocusedCopyUid(rolled.uid);
      setJustBoughtRoll({
        cardId,
        uid: rolled.uid,
        code,
        arrowCount: rolled.arrows.length,
      });
      showToast(
        `Forged ${card?.name ?? 'Card'}: [${code}] with ${rolled.arrows.length}▲!`
      );
      window.setTimeout(() => {
        setJustBoughtRoll((cur) => (cur?.uid === rolled.uid ? null : cur));
      }, 2200);
    }
  };

  const handleForgeRandom = (
    rarity: ForgeableRarity,
    targetType: 'all' | AttackType = randomForgeType
  ) => {
    const res = onForgeRandomCard(rarity, targetType);
    if (!res) return;
    setSelectedBlueprintId(res.card.id);
    setFocusedCopyUid(res.instance.uid);
    setRandomForgeModal({
      result: res,
      targetType,
    });
  };

  const handleSellRandomForgedCard = () => {
    if (!randomForgeModal || randomForgeModal.soldGold !== undefined) return;
    const res = onSellCardInstance(randomForgeModal.result.instance.uid);
    if (res.ok) {
      setRandomForgeModal((prev) =>
        prev ? { ...prev, soldGold: res.goldEarned } : null
      );
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleSellSingleCopy = (inst: RolledCardInstance) => {
    const res = onSellCardInstance(inst.uid);
    if (res.ok) {
      showToast(
        `Smelted ${res.cardName} (${formatTetraCode(inst.stats)} · ${inst.arrows.length}▲) for +${res.goldEarned}g!`
      );
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleBulkSellExtras = (specificCardId?: string) => {
    const res = onSellExtraCopies(specificCardId);
    if (res.soldCount > 0) {
      showToast(
        `Smelted ${res.soldCount} duplicate cop${res.soldCount > 1 ? 'ies' : 'y'} for +${res.goldEarned.toLocaleString()}g!`
      );
    } else {
      showToast('No unequipped, un-forged duplicate copies to bulk-smelt.');
    }
  };

  return (
    <div className="relative w-full min-h-full overflow-x-hidden">
      {/* Distinct Sanctuary Crucible & Runeforge Hearth Atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 60% 42% at 22% 8%, rgba(217, 94, 24, 0.14), transparent 70%), radial-gradient(ellipse 55% 45% at 84% 16%, rgba(139, 61, 214, 0.15), transparent 72%), linear-gradient(180deg, rgba(18,11,9,0.55) 0%, rgba(11,8,7,0.88) 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[1660px] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-6 space-y-5">
        {/* ================================================================= */}
        {/* FORGE SANCTUARY WORKBENCH HEADER + SEARCH BAR + TREASURY          */}
        {/* ================================================================= */}
        <header className="brass-panel riveted-frame p-4 sm:p-5 space-y-4 shadow-[0_18px_42px_rgba(0,0,0,0.75)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-[11px] font-[var(--font-display)] font-bold uppercase tracking-[0.18em] text-orange-300/90">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Artisan Crucible &amp; Arcane Anvil</span>
              </div>
              <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f6e1b5] tracking-[0.06em]">
                Sanctuary Forge
              </h1>
              <p className="font-[var(--font-serif)] text-sm sm:text-base text-[#c8b496]">
                Commission fresh stat &amp; arrow rolls, crack sealed reliquaries, smelt unwanted
                rolls for Gold anytime, or socket Augment Runes on the Anvil.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {extraCopiesSummary.extraCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleBulkSellExtras()}
                  className="iron-btn hover:border-[#e2b053] min-h-[40px] px-3.5 py-2 text-[#f5d593] font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5 text-[#e2b053]" />
                  <span>
                    Smelt {extraCopiesSummary.extraCount} Extra
                    {extraCopiesSummary.extraCount > 1 ? 's' : ''} (+
                    {extraCopiesSummary.totalGold.toLocaleString()}g)
                  </span>
                </button>
              )}
              <div className="brass-plaque flex items-center gap-2 px-4 py-2 text-base font-mono font-bold tabular-nums text-[#f0c76e]">
                <Coins className="w-5 h-5 text-[#dca342]" />
                <span>{profile.gold.toLocaleString()} Gold</span>
              </div>
            </div>
          </div>

          {/* Unified Workbench Station Tabs + Instant Card Name Search */}
          <div className="pt-3 border-t border-[#4b3a26]/75 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 p-1 basalt-recess self-start">
              <button
                type="button"
                onClick={() => {
                  sound.nav();
                  setSectionTab('foundry');
                }}
                className={`min-h-[38px] px-4 py-1.5 font-[var(--font-display)] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  sectionTab === 'foundry'
                    ? 'brass-btn font-bold'
                    : 'text-[#cbb89a] hover:text-[#f6e1b5]'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>Card Foundry &amp; Reliquaries</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.nav();
                  setSectionTab('runeforge');
                }}
                className={`min-h-[38px] px-4 py-1.5 font-[var(--font-display)] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  sectionTab === 'runeforge'
                    ? 'bg-gradient-to-b from-[#6e3a8c] via-[#53286b] to-[#39194d] border border-violet-300/70 text-[#f5e7ff] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'text-violet-300 hover:text-violet-100'
                }`}
              >
                <Hammer className="w-4 h-4" />
                <span>Runeforge Anvil</span>
                <span
                  className={`organic-tag px-2 py-0.5 font-mono text-[10px] font-bold ${
                    sectionTab === 'runeforge'
                      ? 'bg-black/35 text-white'
                      : 'bg-[#211529] text-violet-200'
                  }`}
                >
                  {craftedCopyCount} Forged
                </span>
              </button>
            </div>

            {/* Live Card Name / Tribe / Element Search Input */}
            <div className="relative w-full md:w-80 lg:w-96">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b59e7d]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search card by name, tribe, or element…"
                aria-label="Search card by name, tribe, or element"
                className="organic-control w-full min-h-[38px] pl-9 pr-8 py-1.5 bg-[#120d09] border border-[#523d28] focus:border-[#e2b053] focus:outline-none text-sm text-[#f3e5cb] placeholder:text-[#84725a]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    sound.select();
                    setSearchQuery('');
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[#b59e7d] hover:text-[#f6e1b5] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Status Toast */}
        {statusToast && (
          <div className="organic-control bg-emerald-950/92 border border-emerald-500/55 px-4 py-2.5 text-xs font-medium text-emerald-200 flex items-center justify-between shadow-lg">
            <span>{statusToast}</span>
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="text-emerald-300 hover:text-white ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODE 1: CARD FOUNDRY WORKBENCH + SEALED RELIQUARIES               */}
        {/* ================================================================= */}
        {sectionTab === 'foundry' && (
          <div className="space-y-5">
            {/* Compact Sealed Reliquary Forge Shelf */}
            <section className="iron-panel p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PackageOpen className="w-4 h-4 text-[#e2b053]" />
                  <h2 className="font-[var(--font-display)] text-xs sm:text-sm font-bold uppercase tracking-[0.12em] text-[#f3dfb6]">
                    Sealed Reliquary Chests (3 Fresh Rolls · Keep or Sell on Reveal)
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#e8c680]">
                  <Crown className="w-3.5 h-3.5 text-[#dca342]" />
                  <span>Mythics (A–F) drop exclusively from Tier 6–10 Arena Bosses</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {BOOSTER_PACKS.map((pack) => {
                  const canAfford = profile.gold >= pack.price;
                  const style = PACK_STYLE[pack.id];
                  const accentCard = CARD_MAP[pack.accentCardId];

                  return (
                    <div
                      key={pack.id}
                      className={`group relative overflow-hidden riveted-frame border bg-gradient-to-br ${style.glow} ${style.border} p-3.5 flex items-center justify-between gap-3 shadow-[0_10px_24px_rgba(0,0,0,0.55)] transition-all`}
                    >
                      {accentCard && (
                        <div className="pointer-events-none absolute -right-4 -top-4 w-28 h-28 rounded-full overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
                          <img
                            src={getCardThumbUrl(accentCard.image)}
                            alt=""
                            width={160}
                            height={160}
                            loading="lazy"
                            decoding="async"
                            className={`w-full h-full object-cover ${accentCard.artFilter ?? ''}`}
                          />
                        </div>
                      )}

                      <div className="relative z-10 flex items-center gap-3 min-w-0">
                        <div className="w-11 shrink-0 hidden sm:block">
                          <GameCard
                            cardId={pack.accentCardId}
                            owner="neutral"
                            size="xs"
                            showArrows={false}
                            disableLongPress
                          />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <h3 className="font-[var(--font-display)] text-sm sm:text-base font-bold text-[#f6e3be] truncate">
                            {pack.name}
                          </h3>
                          <p className={`text-[11px] font-semibold ${style.accentColor} truncate`}>
                            {pack.guaranteeText}
                          </p>
                          <p className="font-[var(--font-serif)] text-xs text-[#b5a084] truncate">
                            {style.badgeText}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleOpenPack(pack.id, pack.name)}
                        className={`relative z-10 shrink-0 min-h-[38px] px-3.5 py-2 font-bold text-xs flex items-center gap-1.5 ${
                          canAfford
                            ? 'brass-btn cursor-pointer'
                            : 'basalt-recess text-[#6e5f4c] font-[var(--font-display)] cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">
                          {pack.price.toLocaleString()}g
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* MYSTERY CRUCIBLE — RANDOM CARD FORGE (Per Rarity & Combat Type, Uncovers Unknowns!) */}
            <section className="brass-panel riveted-frame p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Dices className="w-4 h-4 text-[#f0c76e]" />
                    <h2 className="font-[var(--font-display)] text-xs sm:text-sm font-bold uppercase tracking-[0.12em] text-[#f6e1b5]">
                      Mystery Crucible — Random Card Forge
                    </h2>
                  </div>
                  <p className="font-[var(--font-serif)] text-xs sm:text-sm text-[#c8b496]">
                    Forge a random card by Rarity Tier and optional Attack Type to uncover hidden
                    blueprints without spoiling what awaits.
                  </p>
                </div>

                {/* Attack Type Focus Selector (Adjusts Crucible Cost) */}
                <div className="flex flex-wrap items-center gap-1 p-1 basalt-recess self-start lg:self-auto">
                  {(['all', 'P', 'M', 'X', 'A'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        sound.select();
                        setRandomForgeType(t);
                      }}
                      title={TYPE_FOCUS_LABEL[t]}
                      className={`min-h-[32px] px-2.5 py-1 font-[var(--font-display)] text-xs transition-colors cursor-pointer ${
                        randomForgeType === t
                          ? 'brass-btn font-bold'
                          : 'text-[#cbb89a] hover:text-[#f6e1b5]'
                      }`}
                    >
                      {t === 'all' ? 'Any Type' : `Type ${t}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {RANDOM_CRUCIBLE_TIERS.map((tier) => {
                  const poolInfo = randomCruciblePools[tier.rarity];
                  const hasCards = poolInfo.total > 0;
                  const canAfford = hasCards && profile.gold >= poolInfo.cost;

                  return (
                    <div
                      key={tier.rarity}
                      className={`riveted-frame border bg-gradient-to-br ${tier.bgClass} ${tier.borderClass} p-3.5 flex items-center justify-between gap-3 shadow-[0_10px_24px_rgba(0,0,0,0.5)] transition-all`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`font-[var(--font-display)] text-sm sm:text-base font-bold ${tier.accentText} truncate`}
                          >
                            {tier.title}
                          </h3>
                          {randomForgeType !== 'all' && (
                            <span className="organic-tag px-1.5 py-0.5 bg-black/45 font-mono text-[10px] font-bold text-[#f0c76e]">
                              Type {randomForgeType}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-[#cbb89a]">{tier.subtitle}</p>
                        <p className="text-[11px] text-[#a89478]">
                          {!hasCards ? (
                            <span className="text-amber-300/90">
                              Innate Type A starts at Epic tier
                            </span>
                          ) : poolInfo.undiscovered > 0 ? (
                            <span className="text-emerald-300 font-semibold">
                              Uncharted blueprints await
                            </span>
                          ) : (
                            <span>All blueprints discovered · Fresh roll</span>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleForgeRandom(tier.rarity, randomForgeType)}
                        className={`shrink-0 min-h-[40px] px-3.5 py-2 font-bold text-xs flex items-center gap-1.5 ${
                          canAfford
                            ? 'brass-btn cursor-pointer'
                            : 'basalt-recess text-[#6e5f4c] font-[var(--font-display)] cursor-not-allowed'
                        }`}
                      >
                        {!hasCards ? (
                          <span>Epic Only</span>
                        ) : (
                          <>
                            <Dices className="w-3.5 h-3.5" />
                            <span className="font-mono tabular-nums">
                              {poolInfo.cost.toLocaleString()}g
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3-STATION ARTISAN FOUNDRY WORKBENCH (Blueprint Ledger | Crucible Pedestal | Copy Smelter) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* STATION 1: Blueprint Registry Ledger (Discovered Only!) */}
              <div className="lg:col-span-5 iron-panel p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
                    1. Discovered Blueprints
                  </h2>
                  <span className="text-[11px] font-mono text-[#9b896f]">
                    {marketCards.length} shown
                  </span>
                </div>

                {/* Compact Filter Controls */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 p-1 basalt-recess">
                    {(
                      [
                        { id: 'all', label: 'Discovered' },
                        { id: 'owned', label: 'In Vault' },
                        { id: 'duplicates', label: '2+ Copies' },
                        { id: 'unowned', label: '0 Copies' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          sound.select();
                          setOwnershipFilter(f.id);
                        }}
                        className={`flex-1 min-h-[30px] px-2 py-0.5 font-[var(--font-display)] text-[11px] transition-colors cursor-pointer ${
                          ownershipFilter === f.id
                            ? 'brass-btn font-bold'
                            : 'text-[#a69277] hover:text-[#f0e4cc]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 p-1 basalt-recess flex-1">
                      {(['all', 'common', 'rare', 'epic'] as ShopRarityFilter[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            sound.select();
                            setRarityFilter(r);
                          }}
                          className={`flex-1 min-h-[28px] px-2 py-0.5 font-[var(--font-display)] text-[10.5px] capitalize transition-colors cursor-pointer ${
                            rarityFilter === r
                              ? 'brass-plaque text-[#f5d593] font-bold'
                              : 'text-[#a69277] hover:text-[#f0e4cc]'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 p-1 basalt-recess">
                      {(['all', 'P', 'M', 'X', 'A'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            sound.select();
                            setTypeFilter(t);
                          }}
                          className={`min-h-[28px] px-2 py-0.5 font-[var(--font-display)] text-[10.5px] transition-colors cursor-pointer ${
                            typeFilter === t
                              ? 'brass-plaque text-[#f5d593] font-bold'
                              : 'text-[#a69277] hover:text-[#f0e4cc]'
                          }`}
                        >
                          {t === 'all' ? 'Any' : t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {marketCards.length === 0 ? (
                  <div className="basalt-recess p-6 text-center space-y-2">
                    <p className="font-[var(--font-display)] text-xs font-bold text-[#f0c76e]">
                      No blueprints match “{searchQuery || 'current filters'}”.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        sound.select();
                        setSearchQuery('');
                        setOwnershipFilter('all');
                        setRarityFilter('all');
                        setTypeFilter('all');
                      }}
                      className="iron-btn px-3 py-1.5 text-xs font-[var(--font-display)] text-[#efe3cd] cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[520px] overflow-y-auto space-y-1.5 pr-1">
                    {marketCards.map((card) => {
                      const copies = sortCardCopies(profile.inventory[card.id] ?? []);
                      const ownedCount = copies.length;
                      const best = copies[0];
                      const isSelected = selectedBlueprint?.id === card.id;
                      const canAfford = profile.gold >= card.price;

                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            sound.select();
                            setSelectedBlueprintId(card.id);
                            setFocusedCopyUid(best?.uid ?? null);
                          }}
                          className={`w-full p-2 border flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'brass-plaque border-[#dca342]'
                              : 'basalt-recess hover:border-[#6e522b]'
                          }`}
                        >
                          <img
                            src={getCardThumbUrl(card.image)}
                            alt=""
                            width={44}
                            height={44}
                            loading="lazy"
                            decoding="async"
                            className={`w-11 h-11 object-cover rounded-[3px] border border-[#564028] shrink-0 ${
                              card.artFilter ?? ''
                            }`}
                          />

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-[var(--font-display)] text-xs sm:text-[13px] font-bold text-[#f5e7cd] truncate">
                                <span className="font-mono text-[10.5px] text-[#9b896f] mr-1">
                                  #{String(card.number).padStart(2, '0')}
                                </span>
                                {card.name}
                              </span>
                              <span
                                className={`font-mono text-xs font-bold shrink-0 ${
                                  canAfford ? 'text-[#f0c76e]' : 'text-[#776651]'
                                }`}
                              >
                                {card.price.toLocaleString()}g
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`capitalize font-semibold ${RARITY_COLOR[card.rarity]}`}
                                >
                                  {card.rarity}
                                </span>
                                <span className="text-[#5e4d3a]">·</span>
                                <span className="font-mono text-[#cbb89a]">
                                  Base {formatTetraCode(card.stats)}
                                </span>
                              </div>

                              {ownedCount > 0 ? (
                                <span className="organic-tag px-2 py-0.5 bg-[#1d2b1f] text-emerald-300 font-mono font-bold text-[10px]">
                                  ×{ownedCount} Owned
                                  {best ? ` · Best ${formatTetraCode(best.stats)}` : ''}
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#8d7a61] italic">Unowned</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STATION 2: Crucible Pedestal & Roll Press */}
              <div className="lg:col-span-4 brass-panel riveted-frame p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#f3d492] flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span>2. Crucible Pedestal</span>
                  </h2>
                  {selectedBlueprint && (
                    <span
                      className={`text-xs font-semibold capitalize ${
                        RARITY_COLOR[selectedBlueprint.rarity]
                      }`}
                    >
                      #{String(selectedBlueprint.number).padStart(2, '0')} ·{' '}
                      {selectedBlueprint.rarity}
                    </span>
                  )}
                </div>

                {selectedBlueprint ? (
                  <>
                    <div className="max-w-[292px] mx-auto">
                      <GameCard
                        cardId={selectedBlueprint.id}
                        stats={pedestalPreviewCopy?.stats}
                        arrows={pedestalPreviewCopy?.arrows}
                        augmentId={pedestalPreviewCopy?.augmentId}
                        owner={
                          pedestalPreviewCopy && activeDeckUidSet.has(pedestalPreviewCopy.uid)
                            ? 'player'
                            : 'neutral'
                        }
                        variant="tarot"
                        size="lg"
                        disableLongPress
                      />
                    </div>

                    <div className="basalt-recess p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTraitPills
                          element={selectedBlueprint.element}
                          tribe={selectedBlueprint.tribe}
                        />
                        <span className="font-mono text-[11px] text-[#d6c3a5]">
                          Rolls {RARITY_STAT_RANGE[selectedBlueprint.rarity].label} ·{' '}
                          {RARITY_ARROW_RANGE[selectedBlueprint.rarity].label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#3b2c1e]/80">
                        <span className="text-[#9b896f]">
                          {pedestalPreviewCopy ? 'Displayed Roll' : 'Blueprint Baseline'}
                        </span>
                        <span className="font-mono font-bold text-[#f0c76e]">
                          {pedestalPreviewCopy
                            ? `${formatTetraCode(pedestalPreviewCopy.stats)} · ${
                                pedestalPreviewCopy.arrows.length
                              }▲`
                            : `${formatTetraCode(selectedBlueprint.stats)} · ${
                                selectedBlueprint.arrows.length
                              }▲`}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={profile.gold < selectedBlueprint.price}
                        onClick={() => handleDirectBuy(selectedBlueprint.id)}
                        className={`w-full min-h-[46px] px-4 py-2.5 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                          justBoughtRoll?.cardId === selectedBlueprint.id
                            ? 'bg-emerald-600 text-[#0d0a08] font-[var(--font-display)]'
                            : profile.gold >= selectedBlueprint.price
                            ? 'brass-btn cursor-pointer'
                            : 'basalt-recess text-[#6e5f4c] font-[var(--font-display)] cursor-not-allowed'
                        }`}
                      >
                        {justBoughtRoll?.cardId === selectedBlueprint.id ? (
                          <span>
                            Forged [{justBoughtRoll.code}] · {justBoughtRoll.arrowCount}▲!
                          </span>
                        ) : (
                          <>
                            <Dices className="w-4 h-4" />
                            <span>
                              Commission Fresh Roll · {selectedBlueprint.price.toLocaleString()}g
                            </span>
                          </>
                        )}
                      </button>

                      {pedestalPreviewCopy && !selectedBlueprint.augment && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.nav();
                            setSelectedForgeUid(pedestalPreviewCopy.uid);
                            setSectionTab('runeforge');
                          }}
                          className="w-full min-h-[38px] px-3 py-1.5 iron-btn text-xs font-[var(--font-display)] font-semibold text-violet-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Wand2 className="w-3.5 h-3.5 text-violet-300" />
                          <span>Imbue Selected Copy at Runeforge Anvil →</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              {/* STATION 3: Owned Copies Vault & Smelter */}
              <div className="lg:col-span-3 iron-panel p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
                    3. Owned Rolls &amp; Smelter
                  </h2>
                  <span className="font-mono text-[11px] text-[#cbb89a]">
                    ×{selectedBlueprintCopies.length} owned
                  </span>
                </div>

                {selectedBlueprintCopies.length > 1 && selectedBlueprint && (
                  <button
                    type="button"
                    onClick={() => handleBulkSellExtras(selectedBlueprint.id)}
                    className="w-full min-h-[34px] px-3 py-1.5 brass-plaque hover:border-[#e2b053] text-[11px] font-[var(--font-display)] font-semibold text-[#f5d593] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Coins className="w-3.5 h-3.5 text-[#e2b053]" />
                    <span>Smelt Extras (Keep Best)</span>
                  </button>
                )}

                {selectedBlueprintCopies.length === 0 ? (
                  <div className="basalt-recess p-6 text-center font-[var(--font-serif)] text-sm text-[#9b896f]">
                    You don&apos;t own any rolled copies of{' '}
                    <strong className="text-[#e6d3b3]">{selectedBlueprint?.name}</strong> yet.
                    Commission a fresh roll on the Crucible Pedestal!
                  </div>
                ) : (
                  <div className="max-h-[470px] overflow-y-auto space-y-2 pr-1">
                    {selectedBlueprintCopies.map((inst, idx) => {
                      if (!selectedBlueprint) return null;
                      const isFocused = pedestalPreviewCopy?.uid === inst.uid;
                      const inDeck = activeDeckUidSet.has(inst.uid);
                      const instRune = inst.augmentId
                        ? CRAFTABLE_AUGMENT_MAP[inst.augmentId]
                        : null;
                      const sellVal = getCardSellValue(
                        selectedBlueprint,
                        inst.stats,
                        inst.arrows,
                        inst.augmentId
                      );

                      return (
                        <div
                          key={inst.uid}
                          onClick={() => {
                            sound.select();
                            setFocusedCopyUid(inst.uid);
                          }}
                          className={`p-2.5 border space-y-2 transition-colors cursor-pointer ${
                            isFocused
                              ? 'brass-plaque border-[#d8a243]'
                              : 'basalt-recess hover:border-[#6e522b]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10.5px] font-bold text-[#a89478]">
                                #{idx + 1}
                              </span>
                              <span className="font-mono text-xs font-bold text-[#f0c76e]">
                                {formatTetraCode(inst.stats)}
                              </span>
                              <span className="font-mono text-[11px] text-[#dfd0b6]">
                                · {inst.arrows.length}▲
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {idx === 0 && (
                                <span className="organic-tag px-1.5 py-0.5 bg-emerald-950/90 text-emerald-300 font-mono text-[9.5px] font-bold">
                                  Best
                                </span>
                              )}
                              {inDeck && (
                                <span className="organic-tag px-1.5 py-0.5 bg-[#162944] text-[#bcd9f7] font-mono text-[9.5px] font-bold">
                                  In Hand
                                </span>
                              )}
                            </div>
                          </div>

                          {instRune && (
                            <div className="organic-tag inline-flex items-center gap-1 px-2 py-0.5 bg-violet-950/90 text-[10px] font-mono text-violet-200 max-w-full">
                              <Wand2 className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                              <span className="truncate">{instRune.name}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSellSingleCopy(inst);
                              }}
                              className="flex-1 min-h-[30px] px-2.5 py-1 crimson-btn text-[11px] font-[var(--font-display)] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Sell +{sellVal}g</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODE 2: RUNEFORGE — AUGMENT CRAFTING ANVIL                        */}
        {/* ================================================================= */}
        {sectionTab === 'runeforge' && (
          <section className="space-y-5">
            <div className="iron-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#f3d492] font-[var(--font-display)] text-base font-bold tracking-wide">
                  <Wand2 className="w-4 h-4 text-violet-300" />
                  <span>Arcane Runeforge Anvil</span>
                </div>
                <p className="font-[var(--font-serif)] text-sm text-[#cbb89a] leading-relaxed">
                  Select any owned card copy and imbue it with a permanent battlefield Augment Rune.
                  Use the search bar above to jump straight to any card by name.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] shrink-0">
                <span className="organic-tag px-2.5 py-1 bg-emerald-950/90 text-emerald-200 font-mono">
                  Minor · 350–450g
                </span>
                <span className="organic-tag px-2.5 py-1 bg-sky-950/90 text-sky-200 font-mono">
                  Major · 1.1k–1.4k
                </span>
                <span className="px-2.5 py-1 brass-plaque text-[#f0c76e] font-mono">
                  Sovereign · 2.8k–3.4k
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Step 1: Select Owned Card Copy */}
              <div className="lg:col-span-4 iron-panel p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
                    1. Choose Card Copy
                  </h2>
                  <span className="text-[11px] font-mono text-[#9b896f]">
                    {visibleForgeCopies.length} shown
                  </span>
                </div>

                <div className="flex items-center gap-1 p-1 basalt-recess">
                  {(
                    [
                      { id: 'all', label: `All (${forgeableCopies.length})` },
                      { id: 'deck', label: `Active Hand` },
                      { id: 'crafted', label: `Forged (${craftedCopyCount})` },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        sound.select();
                        setForgeCopyFilter(f.id);
                      }}
                      className={`flex-1 min-h-[32px] px-2 py-1 font-[var(--font-display)] text-[11px] transition-colors cursor-pointer ${
                        forgeCopyFilter === f.id
                          ? 'brass-btn font-bold'
                          : 'text-[#a69277] hover:text-[#f0e4cc]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {visibleForgeCopies.length === 0 ? (
                  <div className="basalt-recess p-6 text-center font-[var(--font-serif)] text-sm text-[#9b896f]">
                    {normalizedQuery
                      ? `No owned forgeable copies match “${searchQuery}”.`
                      : forgeCopyFilter === 'crafted'
                      ? 'No cards have crafted augments yet. Pick a card from All or Active Hand to forge your first rune!'
                      : 'No forgeable copies in this filter.'}
                  </div>
                ) : (
                  <div className="max-h-[480px] overflow-y-auto space-y-1.5 pr-1">
                    {visibleForgeCopies.map((inst) => {
                      const def = CARD_MAP[inst.cardId];
                      if (!def) return null;
                      const isSelected = activeForgeCopy?.uid === inst.uid;
                      const inDeck = activeDeckUidSet.has(inst.uid);
                      const instRune = inst.augmentId
                        ? CRAFTABLE_AUGMENT_MAP[inst.augmentId]
                        : null;

                      return (
                        <button
                          key={inst.uid}
                          type="button"
                          onClick={() => {
                            sound.select();
                            setSelectedForgeUid(inst.uid);
                          }}
                          className={`w-full p-2 border flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'brass-plaque border-[#d8a243]'
                              : 'basalt-recess hover:border-[#6e522b]'
                          }`}
                        >
                          <div className="w-12 shrink-0">
                            <GameCard
                              cardId={inst.cardId}
                              stats={inst.stats}
                              arrows={inst.arrows}
                              augmentId={inst.augmentId}
                              owner={inDeck ? 'player' : 'neutral'}
                              size="xs"
                              disableLongPress
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-start justify-between gap-1.5">
                              <span className="font-[var(--font-display)] text-xs font-bold text-[#f3e5cb] leading-snug">
                                {def.name}
                              </span>
                              <span className="font-mono text-[11px] font-bold text-[#f0c76e] shrink-0">
                                {formatTetraCode(inst.stats)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className={`capitalize font-medium ${RARITY_COLOR[def.rarity]}`}>
                                {def.rarity}
                              </span>
                              <span className="text-[#5e4d3a]">·</span>
                              <span className="font-mono text-[#cbb89a]">
                                {inst.arrows.length}▲
                              </span>
                              {inDeck && (
                                <span className="organic-tag px-1.5 py-0.2 bg-[#162944] text-[#bcd9f7] font-semibold">
                                  In Hand
                                </span>
                              )}
                            </div>
                            {instRune ? (
                              <div className="organic-tag inline-flex items-center gap-1 text-[10px] font-mono text-violet-200 bg-violet-950/85 px-1.5 py-0.5 max-w-full">
                                <Wand2 className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                                <span className="truncate">{instRune.name}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-[#7d6c56]">No augment socketed</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2: Select Craftable Augment Rune */}
              <div className="lg:col-span-4 iron-panel p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-violet-300">
                    2. Select Augment Rune
                  </h2>
                  <span className="text-[11px] font-mono text-[#9b896f]">
                    {visibleRunes.length} runes
                  </span>
                </div>

                <div className="flex items-center gap-1 p-1 basalt-recess">
                  {(['all', 'minor', 'major', 'sovereign'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => {
                        sound.select();
                        setForgeRuneTier(tier);
                      }}
                      className={`flex-1 min-h-[32px] px-2 py-1 font-[var(--font-display)] text-[11px] capitalize transition-colors cursor-pointer ${
                        forgeRuneTier === tier
                          ? 'bg-[#5c2d78] border border-violet-300/60 text-white font-bold'
                          : 'text-[#a69277] hover:text-[#f0e4cc]'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>

                <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
                  {visibleRunes.map((rune) => {
                    const isSelected = activeRune.id === rune.id;
                    const isAlreadyOnCopy = activeForgeCopy?.augmentId === rune.id;
                    const canAfford = profile.gold >= rune.craftCost;
                    const tierMeta = RUNE_TIER_BADGE[rune.tier];

                    return (
                      <button
                        key={rune.id}
                        type="button"
                        onClick={() => {
                          sound.select();
                          setSelectedRuneId(rune.id);
                        }}
                        className={`w-full p-3 border text-left space-y-1.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#261830] border-violet-400/80 shadow'
                            : 'basalt-recess hover:border-[#6e522b]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Wand2 className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                            <span className="font-[var(--font-display)] text-xs font-bold text-[#f3e5cb] truncate">
                              {rune.name}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-xs font-bold shrink-0 flex items-center gap-1 ${
                              isAlreadyOnCopy
                                ? 'text-emerald-400'
                                : canAfford
                                ? 'text-[#f0c76e]'
                                : 'text-[#6e5f4c]'
                            }`}
                          >
                            {isAlreadyOnCopy ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Socketed</span>
                              </>
                            ) : (
                              <>
                                <Coins className="w-3 h-3" />
                                <span>{rune.craftCost.toLocaleString()}g</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`organic-tag px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${tierMeta.badgeClass}`}
                          >
                            {tierMeta.label}
                          </span>
                          <span className="organic-tag px-2 py-0.5 bg-violet-950/95 font-mono text-[10px] font-semibold text-violet-200">
                            {rune.shortTag}
                          </span>
                        </div>

                        <p className="font-[var(--font-serif)] text-[13.5px] text-[#cbb89a] leading-snug">
                          {rune.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Live Tarot Forging Preview & Craft Button */}
              <div className="lg:col-span-4 brass-panel riveted-frame p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#f3d492] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#e2b053]" />
                    <span>3. Forging Anvil</span>
                  </h2>
                  {currentCraftedRune && (
                    <span className="organic-tag text-[10px] font-mono text-violet-200 px-2 py-0.5 bg-violet-950/85">
                      Re-forge Slot
                    </span>
                  )}
                </div>

                {activeForgeCopy && activeForgeCard ? (
                  <>
                    <div className="max-w-[300px] mx-auto">
                      <GameCard
                        cardId={activeForgeCopy.cardId}
                        stats={activeForgeCopy.stats}
                        arrows={activeForgeCopy.arrows}
                        augmentId={activeRune.id}
                        owner="neutral"
                        variant="tarot"
                        size="lg"
                        disableLongPress
                      />
                    </div>

                    <div className="basalt-recess p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#9b896f]">Target Copy</span>
                        <span className="font-semibold text-[#f3e5cb]">
                          {activeForgeCard.name}{' '}
                          <span className="font-mono text-[#f0c76e]">
                            ({formatTetraCode(activeForgeCopy.stats)} ·{' '}
                            {activeForgeCopy.arrows.length}▲)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#9b896f]">Current Augment</span>
                        <span className="text-violet-200 font-medium">
                          {currentCraftedRune ? currentCraftedRune.name : 'None'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#9b896f]">New Augment</span>
                        <span className="text-emerald-400 font-semibold">{activeRune.name}</span>
                      </div>
                    </div>

                    {(() => {
                      const isSameRune = activeForgeCopy.augmentId === activeRune.id;
                      const canAfford = profile.gold >= activeRune.craftCost;
                      const isDisabled = isSameRune || !canAfford;
                      const sellVal = getCardSellValue(
                        activeForgeCard,
                        activeForgeCopy.stats,
                        activeForgeCopy.arrows,
                        activeForgeCopy.augmentId
                      );

                      return (
                        <div className="space-y-2">
                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={handleForgeImbue}
                            className={`w-full min-h-[46px] px-4 py-2.5 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                              isSameRune
                                ? 'bg-emerald-950/75 border border-emerald-500/45 text-emerald-300 font-[var(--font-display)] cursor-not-allowed'
                                : canAfford
                                ? 'brass-btn cursor-pointer'
                                : 'basalt-recess text-[#6e5f4c] font-[var(--font-display)] cursor-not-allowed'
                            }`}
                          >
                            {isSameRune ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Already Socketed</span>
                              </>
                            ) : (
                              <>
                                <Hammer className="w-4 h-4" />
                                <span>
                                  {currentCraftedRune ? 'Re-forge' : 'Imbue'} {activeRune.name} ·{' '}
                                  {activeRune.craftCost.toLocaleString()}g
                                </span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSellSingleCopy(activeForgeCopy)}
                            className="w-full min-h-[34px] px-3 py-1.5 basalt-recess hover:border-rose-500/50 text-xs font-[var(--font-display)] text-[#b8a386] hover:text-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Smelt This Copy for +{sellVal}g</span>
                          </button>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="basalt-recess p-8 text-center font-[var(--font-serif)] text-sm text-[#9b896f]">
                    Select an owned card copy on the left to preview and craft an augment.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* =================================================================== */}
      {/* RANDOM CRUCIBLE FORGE REVEAL MODAL (Keep or Sell Right Away!)       */}
      {/* =================================================================== */}
      {randomForgeModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/92 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="random-forge-modal-title"
          onClick={() => {
            sound.drawer(false);
            setRandomForgeModal(null);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[94dvh] flex flex-col brass-panel riveted-frame shadow-[0_28px_80px_rgba(0,0,0,0.92)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-[#4b3a26]/85">
              <div className="flex items-center gap-2">
                <Dices className="w-5 h-5 text-[#e2b053]" />
                <h2
                  id="random-forge-modal-title"
                  className="font-[var(--font-display)] text-base sm:text-lg font-bold text-[#f6e1b5] tracking-wide"
                >
                  Mystery Crucible Forged!
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  sound.drawer(false);
                  setRandomForgeModal(null);
                }}
                aria-label="Close Crucible reveal"
                className="iron-btn min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const { result, targetType, soldGold } = randomForgeModal;
              const isSold = soldGold !== undefined;
              const sellValue = getCardSellValue(
                result.card,
                result.instance.stats,
                result.instance.arrows,
                result.instance.augmentId
              );
              const nextCost = getRandomForgeCost(
                result.card.rarity as ForgeableRarity,
                targetType
              );
              const canRollAgain = profile.gold >= nextCost;

              return (
                <>
                  <div className="overflow-y-auto px-5 py-5 space-y-4 text-center">
                    {result.isNewDiscovery ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-400/60 text-xs font-[var(--font-display)] font-bold text-emerald-300">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>★ New Blueprint Discovered!</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e1610] border border-[#5a452d] text-xs font-mono text-[#d8c4a4]">
                        <span>Copy #{result.copyNumber} Added to Vault</span>
                      </div>
                    )}

                    <div
                      className={`relative max-w-[265px] mx-auto transition-opacity ${
                        isSold ? 'opacity-55' : ''
                      }`}
                    >
                      <GameCard
                        key={result.instance.uid}
                        cardId={result.card.id}
                        stats={result.instance.stats}
                        arrows={result.instance.arrows}
                        owner="neutral"
                        variant="tarot"
                        size="lg"
                        flipKey={1}
                      />
                      {isSold && (
                        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                          <span className="brass-plaque px-3.5 py-1.5 font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#f5d593] shadow-xl">
                            Sold +{soldGold}g
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="basalt-recess p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <CardTraitPills
                          element={result.card.element}
                          tribe={result.card.tribe}
                        />
                        <span className="font-mono font-bold text-[#f0c76e]">
                          {formatTetraCode(result.instance.stats)} ·{' '}
                          {result.instance.arrows.length}▲
                        </span>
                      </div>
                    </div>

                    {isSold ? (
                      <div className="min-h-[38px] px-3 py-2 basalt-recess font-[var(--font-display)] text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>
                          Converted to +{soldGold}g (Blueprint stays unlocked in Compendium!)
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSellRandomForgedCard}
                        className="w-full min-h-[38px] px-3.5 py-2 iron-btn hover:border-[#e2b053] text-xs font-[var(--font-display)] font-bold text-[#f0c76e] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Coins className="w-4 h-4 text-[#dca342]" />
                        <span>Sell Roll for +{sellValue}g</span>
                      </button>
                    )}
                  </div>

                  <div className="px-5 py-3.5 border-t border-[#4b3a26]/85 bg-[#120d0a] flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                      type="button"
                      disabled={!canRollAgain}
                      onClick={() =>
                        handleForgeRandom(
                          result.card.rarity as ForgeableRarity,
                          targetType
                        )
                      }
                      className={`w-full sm:w-auto min-h-[42px] px-4 text-xs font-bold flex items-center justify-center gap-1.5 ${
                        canRollAgain
                          ? 'iron-btn hover:border-[#e2b053] text-[#f5d593] font-[var(--font-display)] cursor-pointer'
                          : 'basalt-recess text-[#6e5f4c] font-[var(--font-display)] cursor-not-allowed'
                      }`}
                    >
                      <Dices className="w-3.5 h-3.5" />
                      <span>
                        Forge Another ({nextCost.toLocaleString()}g)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.drawer(false);
                        setRandomForgeModal(null);
                      }}
                      className="brass-btn w-full flex-1 min-h-[42px] font-bold text-sm cursor-pointer"
                    >
                      {isSold ? 'Done' : 'Keep in Vault'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BOOSTER RELIQUARY COLLECT & SELL MODAL (Never Auto-Sold!)           */}
      {/* =================================================================== */}
      {packModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/92 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pack-modal-title"
        >
          <div className="w-full max-w-4xl max-h-[94dvh] flex flex-col brass-panel riveted-frame shadow-[0_28px_80px_rgba(0,0,0,0.92)] overflow-hidden">
            <div className="sm:hidden w-10 h-1 rounded-full bg-[#6d573e] mx-auto mt-2.5" />

            <div className="flex flex-wrap items-center justify-between gap-2 px-5 sm:px-6 py-4 border-b border-[#4b3a26]/85">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#e2b053]" />
                <h2
                  id="pack-modal-title"
                  className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-[#f6e1b5] tracking-wide"
                >
                  {packModal.packName}
                </h2>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="brass-plaque px-3 py-1 font-mono text-xs sm:text-sm font-bold text-[#f0c76e] inline-flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-[#dca342]" />
                  <span>{profile.gold.toLocaleString()}g</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    sound.drawer(false);
                    setPackModal(null);
                  }}
                  aria-label="Close pack reveal"
                  className="iron-btn min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
              <p className="font-[var(--font-serif)] text-sm sm:text-base text-[#cbb89a] text-center">
                {packModal.revealed.every(Boolean)
                  ? 'Every pulled card is saved to your Vault — keep the rolls you want or sell any card for Gold below!'
                  : 'Tap each sealed card to flip and reveal its rolled stats & arrows'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
                {packModal.items.map((item, idx) => {
                  const isFlipped = packModal.revealed[idx];
                  const soldGold = packModal.soldGoldByUid[item.instance.uid];
                  const isSold = soldGold !== undefined;
                  const sellValue = getCardSellValue(
                    item.card,
                    item.instance.stats,
                    item.instance.arrows,
                    item.instance.augmentId
                  );

                  return (
                    <div
                      key={`${item.instance.uid}-${idx}`}
                      className="space-y-2.5 text-center max-w-[260px] sm:max-w-none mx-auto w-full flex flex-col"
                    >
                      <div className={`relative transition-opacity ${isSold ? 'opacity-55' : ''}`}>
                        <GameCard
                          cardId={item.card.id}
                          stats={item.instance.stats}
                          arrows={item.instance.arrows}
                          faceDown={!isFlipped}
                          owner="neutral"
                          size="lg"
                          showName={isFlipped}
                          flipKey={isFlipped ? idx + 100 : undefined}
                          onClick={!isFlipped ? () => revealIndex(idx) : undefined}
                        />
                        {isSold && (
                          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                            <span className="brass-plaque px-3 py-1.5 font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#f5d593] shadow-xl">
                              Sold +{soldGold}g
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="min-h-[68px] flex flex-col justify-between gap-2">
                        {isFlipped ? (
                          <>
                            <div>
                              <p
                                className={`text-xs font-semibold capitalize ${
                                  RARITY_COLOR[item.card.rarity]
                                }`}
                              >
                                {formatTetraCode(item.instance.stats)} ·{' '}
                                {item.instance.arrows.length}▲
                              </p>
                              <p className="text-[11px] text-[#cbb89a]">
                                {isSold ? (
                                  <span className="font-mono text-[#f0c76e]">
                                    Converted to +{soldGold} Gold
                                  </span>
                                ) : item.isNewUnlock ? (
                                  <span className="text-emerald-400 font-semibold">
                                    ★ New Unlock!
                                  </span>
                                ) : (
                                  <span className="text-[#e8d5b3] font-medium">
                                    Copy #{item.copyNumber} in Vault
                                  </span>
                                )}
                              </p>
                            </div>

                            {isSold ? (
                              <div className="min-h-[34px] px-3 py-1.5 basalt-recess font-[var(--font-display)] text-[11px] font-semibold text-[#a89478] flex items-center justify-center gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>+{soldGold}g Added</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSellPackItem(item)}
                                className="w-full min-h-[34px] px-3 py-1.5 iron-btn hover:border-[#e2b053] text-xs font-[var(--font-display)] font-bold text-[#f0c76e] flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Coins className="w-3.5 h-3.5 text-[#dca342]" />
                                <span>Sell for +{sellValue}g</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="font-[var(--font-serif)] italic text-sm text-[#e2b053] pt-2">
                            Tap to reveal
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#4b3a26]/85 bg-[#120d0a] flex flex-col sm:flex-row items-center gap-2.5">
              {!packModal.revealed.every(Boolean) ? (
                <button
                  type="button"
                  onClick={revealAll}
                  className="brass-btn w-full min-h-[44px] font-bold text-sm cursor-pointer"
                >
                  Reveal All 3 Cards
                </button>
              ) : (
                <>
                  {(() => {
                    const unsoldItems = packModal.items.filter(
                      (it) => packModal.soldGoldByUid[it.instance.uid] === undefined
                    );
                    const unsoldTotalGold = unsoldItems.reduce(
                      (sum, it) =>
                        sum +
                        getCardSellValue(
                          it.card,
                          it.instance.stats,
                          it.instance.arrows,
                          it.instance.augmentId
                        ),
                      0
                    );

                    return unsoldItems.length > 0 ? (
                      <button
                        type="button"
                        onClick={handleSellAllPackItems}
                        className="iron-btn hover:border-[#e2b053] w-full sm:w-auto min-h-[44px] px-4 font-[var(--font-display)] font-semibold text-xs sm:text-sm text-[#f0c76e] flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Coins className="w-4 h-4 text-[#dca342]" />
                        <span>
                          Sell {unsoldItems.length === 3 ? 'All 3' : `${unsoldItems.length} Remaining`}{' '}
                          (+{unsoldTotalGold}g)
                        </span>
                      </button>
                    ) : null;
                  })()}

                  <button
                    type="button"
                    onClick={() => {
                      sound.drawer(false);
                      setPackModal(null);
                    }}
                    className="brass-btn w-full flex-1 min-h-[44px] font-bold text-sm cursor-pointer"
                  >
                    {Object.keys(packModal.soldGoldByUid).length === packModal.items.length
                      ? 'Done'
                      : 'Keep Remaining & Close'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
