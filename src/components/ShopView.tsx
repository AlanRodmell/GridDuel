import React, { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Crown,
  Dices,
  Hammer,
  PackageOpen,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  BOOSTER_PACKS,
  CARD_MAP,
  CARDS,
  CRAFTABLE_AUGMENT_MAP,
  CRAFTABLE_AUGMENTS,
  formatArrowsCompact,
  formatTetraCode,
  getCardSellValue,
  getCardThumbUrl,
  getStatsPowerScore,
  MAX_COPIES_PER_CARD,
  RARITY_ARROW_RANGE,
  RARITY_STAT_RANGE,
} from '../data/cards';
import { PackRevealItem } from '../store/useProfile';
import {
  AttackType,
  AugmentTier,
  DeckSlot,
  PlayerProfile,
  Rarity,
  RolledCardInstance,
} from '../types/game';
import { sound } from '../utils/sound';
import { GameCard } from './GameCard';

type PackTierId = 'tavern-pack' | 'royal-vault' | 'mythic-chest';
type ShopRarityFilter = 'all' | 'common' | 'rare' | 'epic';
type ShopSectionTab = 'market' | 'runeforge';
type ForgeCopyFilter = 'deck' | 'all' | 'crafted';

interface ShopViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  onBuyCard: (cardId: string) => RolledCardInstance | null;
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
    border: 'border-sky-500/40 hover:border-sky-400/75',
    glow: 'from-[#16233d] via-[#10192d] to-[#0c1322]',
    badgeText: '30 Common · 30 Rare Pool · Fresh Stat & Arrow Rolls',
    accentColor: 'text-sky-300',
  },
  'royal-vault': {
    border: 'border-violet-500/50 hover:border-violet-400/85',
    glow: 'from-[#22193f] via-[#14182e] to-[#0c1322]',
    badgeText: 'Guaranteed Rare or Epic · Fresh Stat & Arrow Rolls',
    accentColor: 'text-violet-300',
  },
  'mythic-chest': {
    border: 'border-amber-400/65 hover:border-amber-300',
    glow: 'from-[#2c1f14] via-[#19182c] to-[#0c1322]',
    badgeText: 'Guaranteed Epic · Rare & Epic Pool',
    accentColor: 'text-amber-300',
  },
};

export const ShopView: React.FC<ShopViewProps> = ({
  profile,
  activeDeck,
  onBuyCard,
  onOpenPack,
  onCraftAugment,
  onSellCardInstance,
  onSellExtraCopies,
}) => {
  const [sectionTab, setSectionTab] = useState<ShopSectionTab>('market');
  const [ownershipFilter, setOwnershipFilter] = useState<
    'all' | 'unowned' | 'duplicates'
  >('all');
  const [rarityFilter, setRarityFilter] = useState<ShopRarityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AttackType>('all');
  const [forgeCopyFilter, setForgeCopyFilter] = useState<ForgeCopyFilter>('deck');
  const [forgeRuneTier, setForgeRuneTier] = useState<'all' | AugmentTier>('all');
  const [selectedForgeUid, setSelectedForgeUid] = useState<string | null>(null);
  const [selectedRuneId, setSelectedRuneId] = useState<string>(CRAFTABLE_AUGMENTS[0].id);
  const [justBoughtRoll, setJustBoughtRoll] = useState<{
    cardId: string;
    code: string;
    arrowCount: number;
  } | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [packModal, setPackModal] = useState<{
    packId: PackTierId;
    packName: string;
    items: PackRevealItem[];
    revealed: boolean[];
  } | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

  // All owned card copies eligible for Runeforge crafting (excludes the 5 Mythics with innate legendary traits)
  const activeDeckUidSet = useMemo(() => new Set(activeDeck.cards), [activeDeck.cards]);

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
    if (forgeCopyFilter === 'deck') {
      return forgeableCopies.filter((c) => activeDeckUidSet.has(c.uid));
    }
    if (forgeCopyFilter === 'crafted') {
      return forgeableCopies.filter((c) => Boolean(c.augmentId));
    }
    return forgeableCopies;
  }, [activeDeckUidSet, forgeCopyFilter, forgeableCopies]);

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

  // Only Common, Rare, and Epic cards (80 cards total) are sold in the Shop.
  // Mythic cards (#81-#90) are strictly earned from High-Tier RNG drops or Tier 9-10 Bosses.
  const purchasableCatalog = useMemo(
    () => CARDS.filter((c) => c.rarity !== 'mythic'),
    []
  );

  // Calculate total extra duplicate copies (keeping best copy + active deck copies)
  const extraCopiesSummary = useMemo(() => {
    const activeDeckSet = new Set(
      profile.decks[profile.activeDeckIndex]?.cards ?? []
    );
    let extraCount = 0;
    let totalGold = 0;

    for (const card of CARDS) {
      const copies = profile.inventory[card.id] ?? [];
      if (copies.length <= 1) continue;
      copies.forEach((inst, idx) => {
        if (idx === 0 || activeDeckSet.has(inst.uid)) return;
        extraCount += 1;
        totalGold += getCardSellValue(card, inst.stats, inst.arrows);
      });
    }
    return { extraCount, totalGold };
  }, [profile.activeDeckIndex, profile.decks, profile.inventory]);

  const marketCards = useMemo(() => {
    return purchasableCatalog.filter((c) => {
      const count = profile.inventory[c.id]?.length ?? profile.owned[c.id] ?? 0;
      if (ownershipFilter === 'unowned' && count > 0) return false;
      if (ownershipFilter === 'duplicates' && count < 2) return false;
      if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false;
      if (typeFilter !== 'all' && c.stats.type !== typeFilter) return false;
      return true;
    });
  }, [ownershipFilter, profile.inventory, profile.owned, purchasableCatalog, rarityFilter, typeFilter]);

  const handleOpenPack = (packId: PackTierId, packName: string) => {
    const items = onOpenPack(packId);
    if (!items) return;
    setPackModal({
      packId,
      packName,
      items,
      revealed: items.map(() => false),
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

  const handleDirectBuy = (cardId: string) => {
    const rolled = onBuyCard(cardId);
    if (rolled) {
      const code = formatTetraCode(rolled.stats);
      const card = CARD_MAP[cardId];
      setJustBoughtRoll({ cardId, code, arrowCount: rolled.arrows.length });
      showToast(
        `Rolled ${card?.name ?? 'Card'}: [${code}] with ${rolled.arrows.length}▲ (${formatArrowsCompact(
          rolled.arrows
        )})!`
      );
      window.setTimeout(() => {
        setJustBoughtRoll((cur) => (cur?.cardId === cardId ? null : cur));
      }, 1900);
    }
  };

  const handleSellWeakestCopy = (cardId: string) => {
    const copies = profile.inventory[cardId] ?? [];
    if (copies.length === 0) return;
    // Sell the lowest-rolled copy (last in sorted inventory array)
    const targetCopy = copies[copies.length - 1];
    const res = onSellCardInstance(targetCopy.uid);
    if (res.ok) {
      showToast(
        `Sold ${res.cardName} (${formatTetraCode(targetCopy.stats)} · ${targetCopy.arrows.length}▲) for +${res.goldEarned}g`
      );
    } else if (res.message) {
      showToast(res.message);
    }
  };

  const handleBulkSellExtras = () => {
    const res = onSellExtraCopies();
    if (res.soldCount > 0) {
      showToast(
        `Sold ${res.soldCount} duplicate card${res.soldCount > 1 ? 's' : ''} for +${res.goldEarned.toLocaleString()}g!`
      );
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-5 lg:py-7 space-y-7">
      {/* Shop Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">
            Grand Card Emporium
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Roll up to {MAX_COPIES_PER_CARD} copies per card to hunt for peak rarity stats, or sell extra copies for Gold.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {extraCopiesSummary.extraCount > 0 && (
            <button
              type="button"
              onClick={handleBulkSellExtras}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-amber-300" />
              <span>
                Sell {extraCopiesSummary.extraCount} Extra Cop{extraCopiesSummary.extraCount > 1 ? 'ies' : 'y'} (+{extraCopiesSummary.totalGold.toLocaleString()}g)
              </span>
            </button>
          )}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#11192c] border border-amber-500/30 text-base font-mono font-bold tabular-nums text-amber-300">
            <Coins className="w-5 h-5" />
            <span>{profile.gold.toLocaleString()} Gold</span>
          </div>
        </div>
      </div>

      {/* Shop Section Switcher: Cards & Packs vs Runeforge Crafting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#10182a] border border-slate-800">
          <button
            type="button"
            onClick={() => {
              sound.select();
              setSectionTab('market');
            }}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              sectionTab === 'market'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <PackageOpen className="w-4 h-4" />
            <span>Packs &amp; Singles</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sound.select();
              setSectionTab('runeforge');
            }}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              sectionTab === 'runeforge'
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow'
                : 'text-violet-200 hover:text-white'
            }`}
          >
            <Hammer className="w-4 h-4" />
            <span>Runeforge · Craft Augments</span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                sectionTab === 'runeforge'
                  ? 'bg-black/25 text-white'
                  : 'bg-violet-950 text-violet-200 border border-violet-500/40'
              }`}
            >
              {craftedCopyCount} Forged
            </span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          {sectionTab === 'runeforge'
            ? 'Imbue permanent battlefield augments onto your favorite card copies.'
            : 'Augments are rare — only 5 Mythic Legends carry innate traits. Craft custom runes in the Runeforge!'}
        </p>
      </div>

      {/* Action Toast Feedback */}
      {statusToast && (
        <div className="rounded-xl bg-emerald-950/90 border border-emerald-400/50 px-4 py-2.5 text-xs font-medium text-emerald-200 flex items-center justify-between shadow-lg">
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
      {/* RUNEFORGE — AUGMENT CRAFTING WORKBENCH                            */}
      {/* ================================================================= */}
      {sectionTab === 'runeforge' && (
        <section className="space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-[#1a1333] via-[#14182e] to-[#23152a] border border-violet-500/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-violet-200 font-[var(--font-display)] text-base font-bold">
                <Wand2 className="w-4 h-4 text-violet-300" />
                <span>Arcane Runeforge</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Select any owned card copy and imbue it with a battlefield Augment Rune using Gold.
                Each copy holds <strong>1 crafted rune</strong> and can be re-forged anytime.
                <span className="text-amber-300">
                  {' '}
                  (The 5 Mythic Legendaries keep their innate traits permanently.)
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] shrink-0">
              <span className="px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 font-mono">
                Minor · 350–450g
              </span>
              <span className="px-2 py-1 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-200 font-mono">
                Major · 1.1k–1.4k
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-200 font-mono">
                Sovereign · 2.8k–3.4k
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Step 1: Select Owned Card Copy */}
            <div className="lg:col-span-4 rounded-2xl bg-[#10182a] border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  1. Choose Card Copy
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {visibleForgeCopies.length} shown
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0b1120] border border-slate-800">
                {(
                  [
                    { id: 'deck', label: `Active Hand` },
                    { id: 'all', label: `All (${forgeableCopies.length})` },
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
                    className={`flex-1 min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      forgeCopyFilter === f.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {visibleForgeCopies.length === 0 ? (
                <div className="rounded-xl bg-[#0b1120] border border-slate-800 p-6 text-center text-xs text-slate-400">
                  {forgeCopyFilter === 'crafted'
                    ? 'No cards have crafted augments yet. Pick a card from Active Hand or All to forge your first rune!'
                    : 'No forgeable copies in this filter.'}
                </div>
              ) : (
                <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1">
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
                        className={`w-full rounded-xl p-2 border flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#1a2544] border-amber-400/80 shadow'
                            : 'bg-[#0b1120] border-slate-800/90 hover:border-slate-700'
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
                            <span className="text-xs font-semibold text-slate-100 leading-snug">
                              {def.name}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-amber-300 shrink-0">
                              {formatTetraCode(inst.stats)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className={`capitalize font-medium ${RARITY_COLOR[def.rarity]}`}>
                              {def.rarity}
                            </span>
                            <span className="text-slate-500">·</span>
                            <span className="font-mono text-slate-300">
                              {inst.arrows.length}▲
                            </span>
                            {inDeck && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-950/90 border border-blue-500/40 text-blue-200 font-semibold">
                                In Hand
                              </span>
                            )}
                          </div>
                          {instRune ? (
                            <div className="inline-flex items-center gap-1 text-[10px] font-mono text-violet-200 bg-violet-950/80 border border-violet-500/40 rounded px-1.5 py-0.5 max-w-full">
                              <Wand2 className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                              <span className="truncate">{instRune.name}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500">No augment socketed</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Select Craftable Augment Rune */}
            <div className="lg:col-span-4 rounded-2xl bg-[#10182a] border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-violet-300">
                  2. Select Augment Rune
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {visibleRunes.length} runes
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0b1120] border border-slate-800">
                {(['all', 'minor', 'major', 'sovereign'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      sound.select();
                      setForgeRuneTier(tier);
                    }}
                    className={`flex-1 min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                      forgeRuneTier === tier
                        ? 'bg-violet-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>

              <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1">
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
                      className={`w-full rounded-xl p-3 border text-left space-y-1.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#20183c] border-violet-400/85 shadow'
                          : 'bg-[#0b1120] border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Wand2 className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {rune.name}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-xs font-bold shrink-0 flex items-center gap-1 ${
                            isAlreadyOnCopy
                              ? 'text-emerald-300'
                              : canAfford
                              ? 'text-amber-300'
                              : 'text-slate-500'
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
                          className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold uppercase tracking-wider ${tierMeta.badgeClass}`}
                        >
                          {tierMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-violet-950/90 border border-violet-500/40 font-mono text-[10px] font-semibold text-violet-200">
                          {rune.shortTag}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-snug">
                        {rune.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Live Tarot Forging Preview & Craft Button */}
            <div className="lg:col-span-4 rounded-2xl bg-gradient-to-b from-[#171935] via-[#11172a] to-[#0b1120] border border-violet-400/40 p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>3. Forging Preview</span>
                </h2>
                {currentCraftedRune && (
                  <span className="text-[10px] font-mono text-violet-200 px-2 py-0.5 rounded bg-violet-950/80 border border-violet-400/40">
                    Re-forge Slot
                  </span>
                )}
              </div>

              {activeForgeCopy && activeForgeCard ? (
                <>
                  <div className="max-w-[316px] mx-auto">
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

                  <div className="rounded-xl bg-[#0b1120] border border-slate-800 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Target Copy</span>
                      <span className="font-semibold text-slate-100">
                        {activeForgeCard.name}{' '}
                        <span className="font-mono text-amber-300">
                          ({formatTetraCode(activeForgeCopy.stats)} · {activeForgeCopy.arrows.length}▲)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Current Augment</span>
                      <span className="text-violet-200 font-medium">
                        {currentCraftedRune ? currentCraftedRune.name : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">New Augment</span>
                      <span className="text-emerald-300 font-semibold">{activeRune.name}</span>
                    </div>
                  </div>

                  {(() => {
                    const isSameRune = activeForgeCopy.augmentId === activeRune.id;
                    const canAfford = profile.gold >= activeRune.craftCost;
                    const isDisabled = isSameRune || !canAfford;

                    return (
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={handleForgeImbue}
                        className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                          isSameRune
                            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 cursor-not-allowed'
                            : canAfford
                            ? 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 hover:brightness-110 active:scale-[0.98] text-white shadow-[0_6px_20px_rgba(168,85,247,0.38)] cursor-pointer'
                            : 'bg-slate-800/90 text-slate-500 cursor-not-allowed'
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
                    );
                  })()}
                </>
              ) : (
                <div className="rounded-xl bg-[#0b1120] border border-slate-800 p-8 text-center text-xs text-slate-400">
                  Select an owned card copy on the left to preview and craft an augment.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {sectionTab === 'market' && (
      <>
      {/* Rarity Tier Pricing, Stat Roll Ranges & Mythic Combat Exclusivity Notice */}
      <div className="rounded-2xl bg-gradient-to-r from-[#131d36] via-[#171d33] to-[#231829] border border-amber-500/30 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-300">
          <span>
            <strong className="text-slate-200">Common (Rolls {RARITY_STAT_RANGE.common.label}):</strong>{' '}
            <span className="font-mono text-amber-300">140g–340g</span>
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>
            <strong className="text-sky-300">Rare (Rolls {RARITY_STAT_RANGE.rare.label}):</strong>{' '}
            <span className="font-mono text-amber-300">950g–1,980g</span>
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>
            <strong className="text-violet-300">Epic (Rolls {RARITY_STAT_RANGE.epic.label}):</strong>{' '}
            <span className="font-mono text-amber-300">3,800g–6,500g</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-amber-200 font-medium">
          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Mythics (Rolls A–F)</strong> are combat-only trophies!
          </span>
        </div>
      </div>

      {/* 3 Tactile Illustrated Booster Chests */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-sm font-semibold text-slate-200">
            Sealed Booster Reliquaries (3 Rolled Cards Each · Common to Epic)
          </h2>
          <span className="text-xs text-slate-400">
            Collect up to {MAX_COPIES_PER_CARD} copies per card · 6th copy auto-sells for Gold
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BOOSTER_PACKS.map((pack) => {
            const canAfford = profile.gold >= pack.price;
            const style = PACK_STYLE[pack.id];
            const accentCard = CARD_MAP[pack.accentCardId];

            return (
              <div
                key={pack.id}
                className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${style.glow} ${style.border} p-5 flex flex-col justify-between gap-5 shadow-[0_14px_32px_rgba(0,0,0,0.45)] transition-all duration-200 hover:-translate-y-1`}
              >
                {accentCard && (
                  <div className="pointer-events-none absolute -right-6 -top-6 w-36 h-36 rounded-full overflow-hidden opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-transform">
                    <img
                      src={getCardThumbUrl(accentCard.image)}
                      alt=""
                      width={320}
                      height={320}
                      loading="lazy"
                      decoding="async"
                      className={`w-full h-full object-cover ${accentCard.artFilter ?? ''}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#0c1322]" />
                  </div>
                )}

                <div className="relative z-10 flex items-start gap-3.5">
                  <div className="w-16 shrink-0">
                    <GameCard
                      cardId={pack.accentCardId}
                      owner="neutral"
                      size="xs"
                      showArrows={false}
                    />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <PackageOpen className={`w-4 h-4 shrink-0 ${style.accentColor}`} />
                      <h3 className="font-[var(--font-display)] text-lg font-bold text-slate-100 truncate">
                        {pack.name}
                      </h3>
                    </div>
                    <p className={`text-xs font-medium ${style.accentColor}`}>
                      {pack.guaranteeText}
                    </p>
                    <p className="text-xs text-slate-400">{style.badgeText}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => handleOpenPack(pack.id, pack.name)}
                  className={`relative z-10 w-full min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    canAfford
                      ? 'bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] text-slate-950 shadow-[0_4px_14px_rgba(245,158,11,0.3)] cursor-pointer'
                      : 'bg-slate-800/90 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span className="font-mono tabular-nums">
                    Open Pack · {pack.price.toLocaleString()}g
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Single Card Market across the 80 Purchasable Cards (Common, Rare, Epic) */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Direct Card Market ({marketCards.length} of {purchasableCatalog.length} shown)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Each purchase rolls random stats within the card&apos;s rarity tier (max {MAX_COPIES_PER_CARD} copies per card)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ownership & Augment Filter */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10182a] border border-slate-800">
              <button
                type="button"
                onClick={() => setOwnershipFilter('all')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === 'all'
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                All ({purchasableCatalog.length})
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('unowned')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === 'unowned'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Unowned
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('duplicates')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === 'duplicates'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                2+ Copies
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setSectionTab('runeforge');
                }}
                className="min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold text-violet-200 hover:text-white hover:bg-violet-600/40 transition-colors whitespace-nowrap cursor-pointer"
              >
                ✦ Craft Augments →
              </button>
            </div>

            {/* Rarity Filter (Common, Rare, Epic only) */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10182a] border border-slate-800 overflow-x-auto max-w-full">
              {(['all', 'common', 'rare', 'epic'] as ShopRarityFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRarityFilter(r)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap cursor-pointer ${
                    rarityFilter === r
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Attack Type Filter */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10182a] border border-slate-800">
              {(['all', 'P', 'M', 'X', 'A'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    typeFilter === t
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {marketCards.length === 0 ? (
          <div className="rounded-2xl bg-[#10182a] border border-slate-800 p-8 text-center">
            <p className="text-sm font-medium text-amber-200">
              No purchasable cards match this filter.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Reset your rarity or ownership filter to browse all {purchasableCatalog.length} shop cards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
            {marketCards.map((card) => {
              const copies = profile.inventory[card.id] ?? [];
              const ownedCount = copies.length;
              const bestCopy = copies[0];
              const weakestCopy = copies[copies.length - 1];
              const isMaxCopies = ownedCount >= MAX_COPIES_PER_CARD;
              const canAfford = profile.gold >= card.price && !isMaxCopies;
              const wasJustBought = justBoughtRoll?.cardId === card.id;
              const rangeLabel = RARITY_STAT_RANGE[card.rarity].label;
              const arrowRangeLabel = RARITY_ARROW_RANGE[card.rarity].label;

              return (
                <div
                  key={card.id}
                  className="card-grid-item rounded-xl bg-[#10182a] border border-slate-800/90 hover:border-slate-700 p-2.5 flex flex-col gap-2 transition-colors"
                >
                  <div className="relative">
                    <GameCard
                      cardId={card.id}
                      stats={bestCopy?.stats}
                      arrows={bestCopy?.arrows}
                      augmentId={bestCopy?.augmentId}
                      owner="neutral"
                      size="md"
                      showName
                    />
                    <span
                      className={`absolute top-1.5 right-1.5 z-30 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border shadow ${
                        isMaxCopies
                          ? 'bg-amber-500/95 border-amber-300 text-slate-950'
                          : ownedCount > 0
                          ? 'bg-slate-950/90 border-slate-600 text-slate-200'
                          : 'bg-slate-950/85 border-slate-700 text-slate-400'
                      }`}
                    >
                      {ownedCount}/{MAX_COPIES_PER_CARD}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] px-0.5">
                    <span className={`capitalize font-medium ${RARITY_COLOR[card.rarity]}`}>
                      #{String(card.number).padStart(2, '0')} · {rangeLabel} / {arrowRangeLabel}
                    </span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {bestCopy
                        ? `${formatTetraCode(bestCopy.stats)}·${bestCopy.arrows.length}▲`
                        : `${formatTetraCode(card.stats)}·${card.arrows.length}▲`}
                    </span>
                  </div>

                  {bestCopy?.augmentId && CRAFTABLE_AUGMENT_MAP[bestCopy.augmentId] && (
                    <div
                      title={CRAFTABLE_AUGMENT_MAP[bestCopy.augmentId].description}
                      className="rounded-lg bg-violet-950/60 border border-violet-500/35 px-2 py-1 text-[10px] text-violet-200 flex items-center gap-1 truncate"
                    >
                      <Wand2 className="w-3 h-3 text-violet-300 shrink-0" />
                      <span className="truncate">
                        {CRAFTABLE_AUGMENT_MAP[bestCopy.augmentId].shortTag}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => handleDirectBuy(card.id)}
                    className={`w-full min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all mt-auto ${
                      wasJustBought
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : isMaxCopies
                        ? 'bg-slate-900/90 text-slate-500 border border-slate-800 cursor-not-allowed'
                        : canAfford
                        ? 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 cursor-pointer'
                        : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {wasJustBought ? (
                      <span>
                        Rolled {justBoughtRoll?.code} · {justBoughtRoll?.arrowCount}▲!
                      </span>
                    ) : isMaxCopies ? (
                      <span>Max {MAX_COPIES_PER_CARD}/{MAX_COPIES_PER_CARD} Copies</span>
                    ) : (
                      <>
                        {ownedCount > 0 ? (
                          <Dices className="w-3.5 h-3.5" />
                        ) : (
                          <Coins className="w-3.5 h-3.5" />
                        )}
                        <span className="font-mono tabular-nums">
                          {ownedCount > 0 ? 'Roll Copy · ' : ''}
                          {card.price.toLocaleString()}g
                        </span>
                      </>
                    )}
                  </button>

                  {weakestCopy && (
                    <button
                      type="button"
                      onClick={() => handleSellWeakestCopy(card.id)}
                      title={`Sell copy (${formatTetraCode(weakestCopy.stats)} · ${weakestCopy.arrows.length}▲)`}
                      className="w-full min-h-[32px] rounded-lg bg-slate-900/90 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-[11px] font-medium text-slate-400 hover:text-rose-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>
                        Sell {ownedCount > 1 ? 'Lowest' : 'Copy'} ({formatTetraCode(weakestCopy.stats)}·{weakestCopy.arrows.length}▲) +{getCardSellValue(card, weakestCopy.stats, weakestCopy.arrows)}g
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      </>
      )}

      {/* Booster Pack Interactive Reveal Modal — Spacious Full-Card Showcase */}
      {packModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#04070f]/90 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pack-modal-title"
        >
          <div className="w-full max-w-4xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-gradient-to-b from-[#17213a] to-[#0f1628] border border-amber-400/45 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden">
            <div className="sm:hidden w-10 h-1 rounded-full bg-slate-600 mx-auto mt-2.5" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/90">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h2
                  id="pack-modal-title"
                  className="font-[var(--font-display)] text-xl font-bold text-amber-200"
                >
                  {packModal.packName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPackModal(null)}
                aria-label="Close pack reveal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
              <p className="text-xs sm:text-sm text-slate-300 text-center">
                {packModal.revealed.every(Boolean)
                  ? 'All 3 rolled cards processed into your collection!'
                  : 'Tap each sealed card to flip and reveal its rolled stats & arrows'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
                {packModal.items.map((item, idx) => {
                  const isFlipped = packModal.revealed[idx];
                  return (
                    <div key={`${item.instance.uid}-${idx}`} className="space-y-2.5 text-center max-w-[260px] sm:max-w-none mx-auto w-full">
                      <GameCard
                        cardId={item.card.id}
                        stats={item.instance.stats}
                        arrows={item.instance.arrows}
                        faceDown={!isFlipped}
                        owner="neutral"
                        size="lg"
                        showName={isFlipped}
                        flipKey={isFlipped ? idx + 100 : undefined}
                        onClick={() => revealIndex(idx)}
                      />
                      <div className="min-h-[38px]">
                        {isFlipped ? (
                          <>
                            <p
                              className={`text-xs font-semibold capitalize ${
                                RARITY_COLOR[item.card.rarity]
                              }`}
                            >
                              {formatTetraCode(item.instance.stats)} · {item.instance.arrows.length}▲
                            </p>
                            <p className="text-[11px] text-slate-300">
                              {item.wasOverflowSold ? (
                                <span className="font-mono text-amber-300">
                                  5/5 Full · Sold +{item.overflowGold}g
                                </span>
                              ) : item.isNewUnlock ? (
                                <span className="text-emerald-300 font-semibold">
                                  New Unlock (1/{MAX_COPIES_PER_CARD})
                                </span>
                              ) : (
                                <span className="text-sky-300 font-medium">
                                  Copy #{item.copyNumber}/{MAX_COPIES_PER_CARD} Saved
                                </span>
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-amber-300/80 font-medium">Tap to reveal</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-800 bg-[#0d1424] flex items-center gap-3">
              {!packModal.revealed.every(Boolean) ? (
                <button
                  type="button"
                  onClick={revealAll}
                  className="w-full min-h-[44px] rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm transition-all cursor-pointer"
                >
                  Reveal All 3 Cards
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPackModal(null)}
                  className="w-full min-h-[44px] rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm transition-all cursor-pointer"
                >
                  Collect Cards
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
