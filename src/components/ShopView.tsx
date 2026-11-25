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
  sortCardCopies,
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
    border: 'border-[#5a4a35] hover:border-[#b58742]',
    glow: 'from-[#261d16] via-[#1a140f] to-[#120d0a]',
    badgeText: '30 Common · 30 Rare Pool · Fresh Stat & Arrow Rolls',
    accentColor: 'text-[#d9b880]',
  },
  'royal-vault': {
    border: 'border-[#6d4e78] hover:border-violet-400/80',
    glow: 'from-[#281a2e] via-[#1b141d] to-[#120d0b]',
    badgeText: 'Guaranteed Rare or Epic · Fresh Stat & Arrow Rolls',
    accentColor: 'text-violet-300',
  },
  'mythic-chest': {
    border: 'border-[#9e7334] hover:border-[#e6b85c]',
    glow: 'from-[#332212] via-[#20160e] to-[#120d0a]',
    badgeText: 'Guaranteed Epic · Rare & Epic Pool',
    accentColor: 'text-[#f0c76e]',
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

  // Only Common, Rare, and Epic cards are sold in the Vault.
  // Mythic cards are strictly earned from High-Tier RNG drops or Tier 9-10 Bosses.
  const purchasableCatalog = useMemo(
    () => CARDS.filter((c) => c.rarity !== 'mythic'),
    []
  );

  const equippedUidsSet = useMemo(
    () => new Set(profile.decks.flatMap((d) => d.cards)),
    [profile.decks]
  );

  // Calculate total extra duplicate copies (keeping best copy + all equipped copies + all Runeforged copies)
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

  const pickWeakestSellCandidate = (copies: RolledCardInstance[]): RolledCardInstance | undefined => {
    if (copies.length === 0) return undefined;
    const asc = [...sortCardCopies(copies)].reverse();
    // Prefer an un-augmented, unequipped copy first; then un-augmented; then absolute lowest
    return (
      asc.find((c) => !c.augmentId && !equippedUidsSet.has(c.uid)) ??
      asc.find((c) => !c.augmentId) ??
      asc[0]
    );
  };

  const handleSellWeakestCopy = (cardId: string) => {
    const copies = profile.inventory[cardId] ?? [];
    const targetCopy = pickWeakestSellCandidate(copies);
    if (!targetCopy) return;
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
          <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f3dfb6] tracking-[0.06em]">
            Merchant Vault &amp; Runeforge
          </h1>
          <p className="font-[var(--font-serif)] text-base text-[#b39e81] mt-1">
            Roll up to {MAX_COPIES_PER_CARD} copies per card to hunt for peak rarity stats, or sell extra copies for Gold.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {extraCopiesSummary.extraCount > 0 && (
            <button
              type="button"
              onClick={handleBulkSellExtras}
              className="brass-plaque hover:border-[#e2b053] min-h-[40px] px-3.5 py-2 rounded-[3px] text-[#f5d593] font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-[#e2b053]" />
              <span>
                Sell {extraCopiesSummary.extraCount} Extra Cop{extraCopiesSummary.extraCount > 1 ? 'ies' : 'y'} (+{extraCopiesSummary.totalGold.toLocaleString()}g)
              </span>
            </button>
          )}
          <div className="brass-plaque rounded-[3px] flex items-center gap-2 px-3.5 py-2 text-base font-mono font-bold tabular-nums text-[#f0c76e]">
            <Coins className="w-5 h-5 text-[#dca342]" />
            <span>{profile.gold.toLocaleString()} Gold</span>
          </div>
        </div>
      </div>

      {/* Shop Section Switcher: Cards & Packs vs Runeforge Crafting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-[3px] basalt-recess">
          <button
            type="button"
            onClick={() => {
              sound.select();
              setSectionTab('market');
            }}
            className={`min-h-[40px] px-4 py-1.5 rounded-[2px] font-[var(--font-display)] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              sectionTab === 'market'
                ? 'brass-btn font-bold'
                : 'text-[#b39e81] hover:text-[#f3dfb6]'
            }`}
          >
            <PackageOpen className="w-4 h-4" />
            <span>Reliquaries &amp; Singles</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sound.select();
              setSectionTab('runeforge');
            }}
            className={`min-h-[40px] px-4 py-1.5 rounded-[2px] font-[var(--font-display)] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              sectionTab === 'runeforge'
                ? 'bg-gradient-to-b from-[#6e3a8c] via-[#53286b] to-[#39194d] border border-violet-300/70 text-[#f5e7ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-violet-300 hover:text-violet-100'
            }`}
          >
            <Hammer className="w-4 h-4" />
            <span>Runeforge Anvil</span>
            <span
              className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] font-bold ${
                sectionTab === 'runeforge'
                  ? 'bg-black/30 text-white'
                  : 'bg-[#211529] text-violet-200 border border-violet-500/40'
              }`}
            >
              {craftedCopyCount} Forged
            </span>
          </button>
        </div>

        <p className="font-[var(--font-serif)] italic text-sm text-[#a69277]">
          {sectionTab === 'runeforge'
            ? 'Imbue permanent battlefield augments onto your favorite card copies.'
            : 'Augments are rare — only 5 Mythic Legends carry innate traits. Craft custom runes at the Runeforge!'}
        </p>
      </div>

      {/* Action Toast Feedback */}
      {statusToast && (
        <div className="rounded-[3px] bg-emerald-950/90 border border-emerald-500/55 px-4 py-2.5 text-xs font-medium text-emerald-200 flex items-center justify-between shadow-lg">
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
      {/* RUNEFORGE — AUGMENT CRAFTING ANVIL                                */}
      {/* ================================================================= */}
      {sectionTab === 'runeforge' && (
        <section className="space-y-5">
          <div className="brass-panel riveted-frame rounded-[4px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#f3d492] font-[var(--font-display)] text-base font-bold tracking-wide">
                <Wand2 className="w-4 h-4 text-violet-300" />
                <span>Arcane Runeforge Anvil</span>
              </div>
              <p className="font-[var(--font-serif)] text-sm text-[#cbb89a] leading-relaxed">
                Select any owned card copy and imbue it with a battlefield Augment Rune using Gold.
                Each copy holds <strong className="text-[#f3dfb6]">1 crafted rune</strong> and can be re-forged anytime.
                <span className="text-[#f0c76e]">
                  {' '}
                  (The 5 Mythic Legendaries keep their innate traits permanently.)
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] shrink-0">
              <span className="px-2 py-1 rounded-[2px] bg-emerald-950/80 border border-emerald-500/45 text-emerald-200 font-mono">
                Minor · 350–450g
              </span>
              <span className="px-2 py-1 rounded-[2px] bg-sky-950/80 border border-sky-500/45 text-sky-200 font-mono">
                Major · 1.1k–1.4k
              </span>
              <span className="px-2 py-1 rounded-[2px] brass-plaque text-[#f0c76e] font-mono">
                Sovereign · 2.8k–3.4k
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Step 1: Select Owned Card Copy */}
            <div className="lg:col-span-4 iron-panel rounded-[4px] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
                  1. Choose Card Copy
                </h2>
                <span className="text-[11px] font-mono text-[#9b896f]">
                  {visibleForgeCopies.length} shown
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
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
                    className={`flex-1 min-h-[32px] px-2 py-1 rounded-[2px] font-[var(--font-display)] text-[11px] transition-colors cursor-pointer ${
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
                <div className="basalt-recess rounded-[3px] p-6 text-center font-[var(--font-serif)] text-sm text-[#9b896f]">
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
                        className={`w-full rounded-[3px] p-2 border flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
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
                              <span className="px-1.5 py-0.2 rounded-[2px] bg-[#162944] border border-[#4d84c4] text-[#bcd9f7] font-semibold">
                                In Hand
                              </span>
                            )}
                          </div>
                          {instRune ? (
                            <div className="inline-flex items-center gap-1 text-[10px] font-mono text-violet-200 bg-violet-950/80 border border-violet-500/40 rounded-[2px] px-1.5 py-0.5 max-w-full">
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
            <div className="lg:col-span-4 iron-panel rounded-[4px] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-violet-300">
                  2. Select Augment Rune
                </h2>
                <span className="text-[11px] font-mono text-[#9b896f]">
                  {visibleRunes.length} runes
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
                {(['all', 'minor', 'major', 'sovereign'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      sound.select();
                      setForgeRuneTier(tier);
                    }}
                    className={`flex-1 min-h-[32px] px-2 py-1 rounded-[2px] font-[var(--font-display)] text-[11px] capitalize transition-colors cursor-pointer ${
                      forgeRuneTier === tier
                        ? 'bg-[#5c2d78] border border-violet-300/60 text-white font-bold'
                        : 'text-[#a69277] hover:text-[#f0e4cc]'
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
                      className={`w-full rounded-[3px] p-3 border text-left space-y-1.5 transition-colors cursor-pointer ${
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
                          className={`px-1.5 py-0.5 rounded-[2px] border text-[9.5px] font-bold uppercase tracking-wider ${tierMeta.badgeClass}`}
                        >
                          {tierMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-violet-950/90 border border-violet-500/40 font-mono text-[10px] font-semibold text-violet-200">
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
            <div className="lg:col-span-4 brass-panel riveted-frame rounded-[4px] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#f3d492] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#e2b053]" />
                  <span>3. Forging Anvil</span>
                </h2>
                {currentCraftedRune && (
                  <span className="text-[10px] font-mono text-violet-200 px-2 py-0.5 rounded-[2px] bg-violet-950/80 border border-violet-400/40">
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

                  <div className="basalt-recess rounded-[3px] p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9b896f]">Target Copy</span>
                      <span className="font-semibold text-[#f3e5cb]">
                        {activeForgeCard.name}{' '}
                        <span className="font-mono text-[#f0c76e]">
                          ({formatTetraCode(activeForgeCopy.stats)} · {activeForgeCopy.arrows.length}▲)
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

                    return (
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={handleForgeImbue}
                        className={`w-full min-h-[46px] px-4 py-2.5 rounded-[3px] font-bold text-sm flex items-center justify-center gap-2 transition-all ${
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
                    );
                  })()}
                </>
              ) : (
                <div className="basalt-recess rounded-[3px] p-8 text-center font-[var(--font-serif)] text-sm text-[#9b896f]">
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
      <div className="iron-panel rounded-[4px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[#cbb89a]">
          <span>
            <strong className="text-[#f3e5cb]">Common (Rolls {RARITY_STAT_RANGE.common.label}):</strong>{' '}
            <span className="font-mono text-[#f0c76e]">140g–340g</span>
          </span>
          <span aria-hidden="true" className="text-[#5e4d3a]">·</span>
          <span>
            <strong className="text-sky-300">Rare (Rolls {RARITY_STAT_RANGE.rare.label}):</strong>{' '}
            <span className="font-mono text-[#f0c76e]">950g–1,980g</span>
          </span>
          <span aria-hidden="true" className="text-[#5e4d3a]">·</span>
          <span>
            <strong className="text-violet-300">Epic (Rolls {RARITY_STAT_RANGE.epic.label}):</strong>{' '}
            <span className="font-mono text-[#f0c76e]">3,800g–6,500g</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[#f0c76e] font-medium">
          <Crown className="w-4 h-4 text-[#dca342] shrink-0" />
          <span>
            <strong>Mythics (Rolls A–F)</strong> are combat-only trophies!
          </span>
        </div>
      </div>

      {/* 3 Tactile Illustrated Booster Reliquaries */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="font-[var(--font-display)] text-sm font-bold tracking-wide text-[#f3dfb6]">
            Sealed Booster Reliquaries (3 Rolled Cards Each · Common to Epic)
          </h2>
          <span className="font-[var(--font-serif)] italic text-sm text-[#a69277]">
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
                className={`group relative overflow-hidden rounded-[4px] riveted-frame border bg-gradient-to-br ${style.glow} ${style.border} p-5 flex flex-col justify-between gap-5 shadow-[0_14px_32px_rgba(0,0,0,0.6)] transition-all duration-200 hover:-translate-y-1`}
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
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#140f0b]" />
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
                      <h3 className="font-[var(--font-display)] text-lg font-bold text-[#f6e3be] truncate">
                        {pack.name}
                      </h3>
                    </div>
                    <p className={`text-xs font-medium ${style.accentColor}`}>
                      {pack.guaranteeText}
                    </p>
                    <p className="font-[var(--font-serif)] text-sm text-[#a69277]">{style.badgeText}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => handleOpenPack(pack.id, pack.name)}
                  className={`relative z-10 w-full min-h-[44px] px-4 py-2.5 rounded-[3px] font-bold text-sm flex items-center justify-center gap-2 ${
                    canAfford
                      ? 'brass-btn cursor-pointer'
                      : 'basalt-recess text-[#6e5f4c] font-[var(--font-display)] cursor-not-allowed'
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

      {/* Single Card Market */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-display)] text-sm font-bold tracking-wide text-[#f3dfb6]">
              Direct Card Vault ({marketCards.length} of {purchasableCatalog.length} shown)
            </h2>
            <p className="font-[var(--font-serif)] text-sm text-[#a69277] mt-0.5">
              Each purchase rolls random stats within the card&apos;s rarity tier (max {MAX_COPIES_PER_CARD} copies per card)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ownership & Augment Filter */}
            <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
              <button
                type="button"
                onClick={() => setOwnershipFilter('all')}
                className={`min-h-[34px] px-3 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === 'all'
                    ? 'brass-plaque text-[#f5d593] font-bold'
                    : 'text-[#a69277] hover:text-[#f0e4cc]'
                }`}
              >
                All ({purchasableCatalog.length})
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('unowned')}
                className={`min-h-[34px] px-3 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === 'unowned'
                    ? 'brass-btn font-bold'
                    : 'text-[#a69277] hover:text-[#f0e4cc]'
                }`}
              >
                Unowned
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('duplicates')}
                className={`min-h-[34px] px-3 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === 'duplicates'
                    ? 'brass-btn font-bold'
                    : 'text-[#a69277] hover:text-[#f0e4cc]'
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
                className="min-h-[34px] px-3 py-1 rounded-[2px] font-[var(--font-display)] text-xs font-semibold text-violet-300 hover:text-white hover:bg-[#3e1f52] transition-colors whitespace-nowrap cursor-pointer"
              >
                ✦ Craft Augments →
              </button>
            </div>

            {/* Rarity Filter */}
            <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess overflow-x-auto max-w-full">
              {(['all', 'common', 'rare', 'epic'] as ShopRarityFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRarityFilter(r)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs capitalize transition-colors whitespace-nowrap cursor-pointer ${
                    rarityFilter === r
                      ? 'brass-plaque text-[#f5d593] font-bold'
                      : 'text-[#a69277] hover:text-[#f0e4cc]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Attack Type Filter */}
            <div className="inline-flex items-center gap-1 p-1 rounded-[3px] basalt-recess">
              {(['all', 'P', 'M', 'X', 'A'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-[2px] font-[var(--font-display)] text-xs transition-colors whitespace-nowrap cursor-pointer ${
                    typeFilter === t
                      ? 'brass-plaque text-[#f5d593] font-bold'
                      : 'text-[#a69277] hover:text-[#f0e4cc]'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {marketCards.length === 0 ? (
          <div className="iron-panel rounded-[4px] p-8 text-center">
            <p className="font-[var(--font-display)] text-sm font-semibold text-[#f0c76e]">
              No purchasable cards match this filter.
            </p>
            <p className="font-[var(--font-serif)] text-sm text-[#a69277] mt-1">
              Reset your rarity or ownership filter to browse all {purchasableCatalog.length} shop cards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
            {marketCards.map((card) => {
              const sortedCopies = sortCardCopies(profile.inventory[card.id] ?? []);
              const ownedCount = sortedCopies.length;
              const bestCopy = sortedCopies[0];
              const weakestCopy = pickWeakestSellCandidate(sortedCopies);
              const isMaxCopies = ownedCount >= MAX_COPIES_PER_CARD;
              const canAfford = profile.gold >= card.price && !isMaxCopies;
              const wasJustBought = justBoughtRoll?.cardId === card.id;
              const rangeLabel = RARITY_STAT_RANGE[card.rarity].label;
              const arrowRangeLabel = RARITY_ARROW_RANGE[card.rarity].label;

              return (
                <div
                  key={card.id}
                  className="card-grid-item iron-panel rounded-[4px] hover:border-[#7a5d34] p-2.5 flex flex-col gap-2 transition-colors"
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
                      className={`absolute top-1.5 right-1.5 z-30 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono font-bold border shadow ${
                        isMaxCopies
                          ? 'bg-[#e2b053] border-[#f8df9d] text-[#170f06]'
                          : ownedCount > 0
                          ? 'brass-plaque text-[#f0c76e]'
                          : 'bg-[#15100c]/90 border-[#433526] text-[#9b896f]'
                      }`}
                    >
                      {ownedCount}/{MAX_COPIES_PER_CARD}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] px-0.5">
                    <span className={`capitalize font-medium ${RARITY_COLOR[card.rarity]}`}>
                      #{String(card.number).padStart(2, '0')} · {card.rarity}
                    </span>
                    <span className="font-mono text-[10.5px] text-[#9b896f]">
                      Rolls {rangeLabel} · {arrowRangeLabel}
                    </span>
                  </div>

                  {bestCopy?.augmentId && CRAFTABLE_AUGMENT_MAP[bestCopy.augmentId] && (
                    <div
                      title={CRAFTABLE_AUGMENT_MAP[bestCopy.augmentId].description}
                      className="rounded-[2px] bg-violet-950/65 border border-violet-500/40 px-2 py-1 text-[10px] text-violet-200 flex items-center gap-1 truncate"
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
                    className={`w-full min-h-[40px] rounded-[3px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all mt-auto ${
                      wasJustBought
                        ? 'bg-emerald-600 text-[#0d0a08] font-bold'
                        : isMaxCopies
                        ? 'basalt-recess text-[#6e5f4c] cursor-not-allowed'
                        : canAfford
                        ? 'iron-btn text-[#f0c76e] hover:border-[#e2b053] cursor-pointer'
                        : 'basalt-recess text-[#685a49] cursor-not-allowed'
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
                      className="w-full min-h-[32px] rounded-[3px] basalt-recess hover:border-rose-500/50 text-[11px] font-medium text-[#9b896f] hover:text-rose-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>
                        Sell {ownedCount > 1 ? 'Lowest' : 'Copy'} ({formatTetraCode(weakestCopy.stats)}·{weakestCopy.arrows.length}▲) +{getCardSellValue(card, weakestCopy.stats, weakestCopy.arrows, weakestCopy.augmentId)}g
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

      {/* Booster Pack Interactive Reveal Modal — Carved Reliquary */}
      {packModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/92 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pack-modal-title"
        >
          <div className="w-full max-w-4xl max-h-[94dvh] flex flex-col rounded-t-[6px] sm:rounded-[5px] brass-panel riveted-frame shadow-[0_28px_80px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="sm:hidden w-10 h-1 rounded-full bg-[#6d573e] mx-auto mt-2.5" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-[#4b3a26]/85">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#e2b053]" />
                <h2
                  id="pack-modal-title"
                  className="font-[var(--font-display)] text-xl font-bold text-[#f6e1b5] tracking-wide"
                >
                  {packModal.packName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPackModal(null)}
                aria-label="Close pack reveal"
                className="iron-btn min-h-[40px] min-w-[40px] flex items-center justify-center rounded-[3px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
              <p className="font-[var(--font-serif)] text-base text-[#cbb89a] text-center">
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
                            <p className="text-[11px] text-[#cbb89a]">
                              {item.wasOverflowSold ? (
                                <span className="font-mono text-[#f0c76e]">
                                  5/5 Full · Sold +{item.overflowGold}g
                                </span>
                              ) : item.isNewUnlock ? (
                                <span className="text-emerald-400 font-semibold">
                                  New Unlock (1/{MAX_COPIES_PER_CARD})
                                </span>
                              ) : (
                                <span className="text-[#e8d5b3] font-medium">
                                  Copy #{item.copyNumber}/{MAX_COPIES_PER_CARD} Saved
                                </span>
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="font-[var(--font-serif)] italic text-sm text-[#e2b053]">
                            Tap to reveal
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#4b3a26]/85 bg-[#120d0a] flex items-center gap-3">
              {!packModal.revealed.every(Boolean) ? (
                <button
                  type="button"
                  onClick={revealAll}
                  className="brass-btn w-full min-h-[44px] rounded-[3px] font-bold text-sm cursor-pointer"
                >
                  Reveal All 3 Cards
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPackModal(null)}
                  className="brass-btn w-full min-h-[44px] rounded-[3px] font-bold text-sm cursor-pointer"
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
