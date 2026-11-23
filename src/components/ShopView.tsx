import React, { useMemo, useState } from 'react';
import { Coins, Crown, Dices, PackageOpen, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import {
  BOOSTER_PACKS,
  CARD_MAP,
  CARDS,
  formatArrowsCompact,
  formatTetraCode,
  getCardSellValue,
  MAX_COPIES_PER_CARD,
  RARITY_ARROW_RANGE,
  RARITY_STAT_RANGE,
} from '../data/cards';
import { PackRevealItem } from '../store/useProfile';
import { AttackType, PlayerProfile, Rarity, RolledCardInstance } from '../types/game';
import { sound } from '../utils/sound';
import { GameCard } from './GameCard';

type PackTierId = 'tavern-pack' | 'royal-vault' | 'mythic-chest';
type ShopRarityFilter = 'all' | 'common' | 'rare' | 'epic';

interface ShopViewProps {
  profile: PlayerProfile;
  onBuyCard: (cardId: string) => RolledCardInstance | null;
  onOpenPack: (packId: PackTierId) => PackRevealItem[] | null;
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
  onBuyCard,
  onOpenPack,
  onSellCardInstance,
  onSellExtraCopies,
}) => {
  const [ownershipFilter, setOwnershipFilter] = useState<
    'all' | 'unowned' | 'duplicates' | 'augments'
  >('all');
  const [rarityFilter, setRarityFilter] = useState<ShopRarityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AttackType>('all');
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
      if (ownershipFilter === 'augments' && !c.augment) return false;
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
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-7">
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
            <strong>Mythics (#81–#90 · Rolls A–F)</strong> are combat-only trophies!
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
                  <div className="pointer-events-none absolute -right-6 -top-6 w-36 h-36 rounded-full overflow-hidden opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-all">
                    <img
                      src={accentCard.image}
                      alt=""
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
                onClick={() => setOwnershipFilter('augments')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  ownershipFilter === 'augments'
                    ? 'bg-violet-500 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                ★ Augments
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
              Reset your rarity or ownership filter to browse all 80 shop cards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
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
                  className="rounded-xl bg-[#10182a] border border-slate-800/90 hover:border-slate-700 p-2.5 flex flex-col gap-2 transition-colors"
                >
                  <div className="relative">
                    <GameCard
                      cardId={card.id}
                      stats={bestCopy?.stats}
                      arrows={bestCopy?.arrows}
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

                  {card.augment && (
                    <div
                      title={card.augment.description}
                      className="rounded-lg bg-violet-950/60 border border-violet-500/35 px-2 py-1 text-[10px] text-violet-200 flex items-center gap-1 truncate"
                    >
                      <Wand2 className="w-3 h-3 text-violet-300 shrink-0" />
                      <span className="truncate">{card.augment.shortTag}</span>
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

      {/* Booster Pack Interactive Reveal Modal */}
      {packModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pack-modal-title"
        >
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-gradient-to-b from-[#17213a] to-[#0f1628] border border-amber-400/45 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden">
            <div className="sm:hidden w-10 h-1 rounded-full bg-slate-600 mx-auto mt-2.5" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/90">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h2
                  id="pack-modal-title"
                  className="font-[var(--font-display)] text-lg font-bold text-amber-200"
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

            <div className="px-3.5 sm:px-5 py-5 space-y-4">
              <p className="text-xs text-slate-300 text-center">
                {packModal.revealed.every(Boolean)
                  ? 'All 3 rolled cards processed into your collection!'
                  : 'Tap each sealed card to flip and reveal its rolled stats & arrows'}
              </p>

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                {packModal.items.map((item, idx) => {
                  const isFlipped = packModal.revealed[idx];
                  return (
                    <div key={`${item.instance.uid}-${idx}`} className="space-y-2 text-center">
                      <GameCard
                        cardId={item.card.id}
                        stats={item.instance.stats}
                        arrows={item.instance.arrows}
                        faceDown={!isFlipped}
                        owner="neutral"
                        size="md"
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
