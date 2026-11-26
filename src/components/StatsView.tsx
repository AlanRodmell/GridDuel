import React, { useMemo } from 'react';
import {
  Award,
  BarChart3,
  Coins,
  Crown,
  Flame,
  Hammer,
  PackageOpen,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import { ALL_ELEMENTS, ALL_TRIBES, ELEMENT_META, TRIBE_META } from '../data/biomes';
import {
  CARD_MAP,
  CARDS,
  formatTetraCode,
  getCardSellValue,
  getCardThumbUrl,
  getInstanceSortScore,
  resolveCardAugment,
  sortCardCopies,
} from '../data/cards';
import { ALL_FIGHTERS, FIGHTER_MAP, LADDER_TIERS, getTierProgress } from '../data/ladder';
import {
  POWER_CARDS,
  getUnlockedPowerCardIdSet,
  isCampaignTierCleared,
} from '../data/powerCards';
import { getUnitCapacityForScale } from '../store/useProfile';
import { AttackType, DeckSlot, PlayerProfile, Rarity, RolledCardInstance } from '../types/game';
import { CardTraitPills } from './BiomeBadge';
import { GameCard } from './GameCard';

const ATTACK_TYPE_META: { type: AttackType; label: string }[] = [
  { type: 'P', label: 'P · Physical' },
  { type: 'M', label: 'M · Magical' },
  { type: 'X', label: 'X · Flexible' },
  { type: 'A', label: 'A · Assault' },
];

interface StatsViewProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
}

const RARITY_BADGE: Record<Rarity, { label: string; color: string; barColor: string }> = {
  common: { label: 'Common', color: 'text-slate-300', barColor: 'bg-slate-400' },
  rare: { label: 'Rare', color: 'text-sky-300', barColor: 'bg-sky-400' },
  epic: { label: 'Epic', color: 'text-violet-300', barColor: 'bg-violet-400' },
  mythic: { label: 'Mythic', color: 'text-amber-300', barColor: 'bg-amber-400' },
};

export const StatsView: React.FC<StatsViewProps> = ({ profile, activeDeck }) => {
  const totalMatches = profile.wins + profile.losses + profile.draws;
  const winRate =
    totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;
  const avgFlipsPerMatch =
    totalMatches > 0 ? (profile.totalFlips / totalMatches).toFixed(1) : '0.0';

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

  const discoveredCount = useMemo(
    () => CARDS.filter((c) => discoveredSet.has(c.id)).length,
    [discoveredSet]
  );

  // Aggregate Vault inventory metrics
  const vaultMetrics = useMemo(() => {
    const allCopies: RolledCardInstance[] = [];
    const byRarity: Record<Rarity, number> = {
      common: 0,
      rare: 0,
      epic: 0,
      mythic: 0,
    };
    const byElement: Record<string, number> = {};
    const byTribe: Record<string, number> = {};
    let totalMeltValue = 0;
    let runeforgedCount = 0;
    let crownJewel: RolledCardInstance | null = null;
    let crownScore = -1;

    for (const [cid, list] of Object.entries(profile.inventory)) {
      const def = CARD_MAP[cid];
      if (!def || list.length === 0) continue;
      for (const inst of list) {
        allCopies.push(inst);
        byRarity[def.rarity] += 1;
        byElement[def.element] = (byElement[def.element] ?? 0) + 1;
        byTribe[def.tribe] = (byTribe[def.tribe] ?? 0) + 1;
        totalMeltValue += getCardSellValue(def, inst.stats, inst.arrows, inst.augmentId);
        if (inst.augmentId) runeforgedCount += 1;

        const score =
          RARITY_BADGE[def.rarity] === RARITY_BADGE.mythic
            ? getInstanceSortScore(inst) + 100
            : getInstanceSortScore(inst);
        if (score > crownScore) {
          crownScore = score;
          crownJewel = inst;
        }
      }
    }

    const topElements = ALL_ELEMENTS.map((el) => ({
      el,
      label: ELEMENT_META[el].label,
      count: byElement[el] ?? 0,
    }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topTribes = ALL_TRIBES.map((tr) => ({
      tr,
      label: TRIBE_META[tr].label,
      count: byTribe[tr] ?? 0,
    }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalCopies: allCopies.length,
      uniqueOwned: Object.values(profile.inventory).filter((l) => l.length > 0).length,
      byRarity,
      topElements,
      topTribes,
      totalMeltValue,
      runeforgedCount,
      crownJewel,
    };
  }, [profile.inventory]);

  // Active Warband directional arrow coverage & avg stat total
  const warbandAnalytics = useMemo(() => {
    const scale = profile.boardScale ?? '6x3';
    const cap = getUnitCapacityForScale(scale);
    const instanceByUid: Record<string, RolledCardInstance> = {};
    for (const list of Object.values(profile.inventory)) {
      for (const inst of list) instanceByUid[inst.uid] = inst;
    }

    const rawSlots = (activeDeck.slots ?? activeDeck.cards).slice(0, cap);
    const units = rawSlots
      .map((ref) => (ref ? instanceByUid[ref] ?? null : null))
      .filter((u): u is RolledCardInstance => Boolean(u));

    const typeCounts: Record<AttackType, number> = { P: 0, M: 0, X: 0, A: 0 };

    let statSum = 0;
    let arrowSum = 0;
    for (const u of units) {
      statSum += u.stats.power + u.stats.pDef + u.stats.mDef;
      arrowSum += u.arrows.length;
      typeCounts[u.stats.type] = (typeCounts[u.stats.type] ?? 0) + 1;
    }

    return {
      equippedCount: units.length,
      capacity: cap,
      avgStatSum: units.length > 0 ? (statSum / units.length).toFixed(1) : '0.0',
      avgArrows: units.length > 0 ? (arrowSum / units.length).toFixed(1) : '0.0',
      typeCounts,
    };
  }, [activeDeck.cards, activeDeck.slots, profile.boardScale, profile.inventory]);

  // Top 5 most victorious Unit cards (only discovered/played cards)
  const topChampions = useMemo(() => {
    return Object.entries(profile.cardWins ?? {})
      .filter(([cid, w]) => w > 0 && CARD_MAP[cid] && discoveredSet.has(cid))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cid, wins]) => {
        const card = CARD_MAP[cid]!;
        const bestCopy = sortCardCopies(profile.inventory[cid] ?? [])[0] ?? null;
        return { card, wins, bestCopy };
      });
  }, [discoveredSet, profile.cardWins, profile.inventory]);

  // Campaign & Boss metrics
  const campaignStats = useMemo(() => {
    const fWins = profile.fighterWins ?? {};
    const conqueredChallengers = ALL_FIGHTERS.filter((f) => (fWins[f.id] ?? 0) > 0).length;
    const bossesSlain = ALL_FIGHTERS.filter(
      (f) => f.isBoss && (fWins[f.id] ?? 0) > 0
    ).length;
    const clearedTiers = LADDER_TIERS.filter((t) =>
      isCampaignTierCleared(t.tierNumber, fWins)
    ).length;
    const unlockedRelics = getUnlockedPowerCardIdSet(fWins).size;

    let favoriteRival: { name: string; title: string; wins: number } | null = null;
    for (const [fid, w] of Object.entries(fWins)) {
      if (w <= 0) continue;
      const fighter = FIGHTER_MAP[fid];
      if (!fighter) continue;
      if (!favoriteRival || w > favoriteRival.wins) {
        favoriteRival = { name: fighter.name, title: fighter.title, wins: w };
      }
    }

    return {
      conqueredChallengers,
      bossesSlain,
      clearedTiers,
      unlockedRelics,
      favoriteRival,
    };
  }, [profile.fighterWins]);

  const netWorth = profile.gold + vaultMetrics.totalMeltValue;
  const maxChampionWins = topChampions[0]?.wins ?? 1;

  return (
    <div className="w-full max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-7 space-y-6">
      {/* Header Banner */}
      <header className="brass-panel riveted-frame p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-[var(--font-display)] font-bold uppercase tracking-[0.18em] text-[#e7bd67]">
            <BarChart3 className="w-3.5 h-3.5 text-[#e2b053]" />
            <span>Commander&apos;s War Ledger</span>
          </div>
          <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-bold text-[#f6e1b5] tracking-[0.06em]">
            Battle Chronicle &amp; Vault Stats
          </h1>
          <p className="font-[var(--font-serif)] text-sm sm:text-base text-[#c8b496]">
            Lifetime duel records, sanctuary conquests, champion performance, and warband readiness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="brass-plaque px-3.5 py-2 text-right">
            <div className="font-[var(--font-display)] text-[10px] uppercase tracking-wider text-[#b8a282]">
              Sanctuary Net Worth
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-[#f0c76e] flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-[#dca342]" />
              <span>{netWorth.toLocaleString()}g</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 1. TOP COMBAT KPI PLAQUES                                         */}
      {/* ================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Duel Record & Win Rate */}
        <div className="iron-panel riveted-frame p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#b8a282]">
            <span className="font-[var(--font-display)] uppercase tracking-wider font-bold flex items-center gap-1.5 text-[#f2dfb7]">
              <Swords className="w-4 h-4 text-[#e2b053]" />
              <span>Battle Record</span>
            </span>
            <span className="font-mono font-bold text-[#f0c76e]">{totalMatches} Duels</span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div className="font-mono text-2xl font-bold tabular-nums">
              <span className="text-emerald-400">{profile.wins}W</span>
              <span className="text-[#695742] mx-1.5">·</span>
              <span className="text-rose-400">{profile.losses}L</span>
              {profile.draws > 0 && (
                <>
                  <span className="text-[#695742] mx-1.5">·</span>
                  <span className="text-[#cbb89a]">{profile.draws}D</span>
                </>
              )}
            </div>
            <span className="font-mono text-sm font-bold text-emerald-300">{winRate}% Win</span>
          </div>

          <div className="h-2 w-full rounded-full bg-[#120d09] overflow-hidden border border-[#3d2e1e]">
            <div
              style={{ width: `${winRate}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
            />
          </div>
        </div>

        {/* Win Streaks & Perfect Sweeps */}
        <div className="iron-panel riveted-frame p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#b8a282]">
            <span className="font-[var(--font-display)] uppercase tracking-wider font-bold flex items-center gap-1.5 text-[#f2dfb7]">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Streaks &amp; Dominance</span>
            </span>
            <span className="font-mono text-[#cbb89a]">
              {profile.perfectWins ?? 0} Perfect Sweeps
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="basalt-recess px-3 py-2">
              <div className="text-[10.5px] text-[#9b896f]">Current Streak</div>
              <div className="font-mono text-xl font-bold text-[#f5d593]">
                {profile.streak} {profile.streak === 1 ? 'Win' : 'Wins'}
              </div>
            </div>
            <div className="basalt-recess px-3 py-2">
              <div className="text-[10.5px] text-[#9b896f]">All-Time Best</div>
              <div className="font-mono text-xl font-bold text-amber-300">
                {profile.bestStreak} {profile.bestStreak === 1 ? 'Win' : 'Wins'}
              </div>
            </div>
          </div>
        </div>

        {/* Battlefield Captures & Combos */}
        <div className="iron-panel riveted-frame p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#b8a282]">
            <span className="font-[var(--font-display)] uppercase tracking-wider font-bold flex items-center gap-1.5 text-[#f2dfb7]">
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Tactical Captures</span>
            </span>
            <span className="font-mono text-[#cbb89a]">{avgFlipsPerMatch} Flips / Duel</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="basalt-recess px-3 py-2">
              <div className="text-[10.5px] text-[#9b896f]">Enemy Flips</div>
              <div className="font-mono text-xl font-bold text-[#f3e5cb]">
                {profile.totalFlips.toLocaleString()}
              </div>
            </div>
            <div className="basalt-recess px-3 py-2">
              <div className="text-[10.5px] text-[#9b896f]">Chain Combos</div>
              <div className="font-mono text-xl font-bold text-sky-300">
                {(profile.totalCombos ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Campaign & Relic Unlocks */}
        <div className="iron-panel riveted-frame p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#b8a282]">
            <span className="font-[var(--font-display)] uppercase tracking-wider font-bold flex items-center gap-1.5 text-[#f2dfb7]">
              <Crown className="w-4 h-4 text-[#e2b053]" />
              <span>Sanctuary Conquest</span>
            </span>
            <span className="font-mono text-sky-300">
              {campaignStats.unlockedRelics}/{POWER_CARDS.length} Relics
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="basalt-recess px-3 py-2">
              <div className="text-[10.5px] text-[#9b896f]">Rivals Conquered</div>
              <div className="font-mono text-xl font-bold text-[#f0c76e]">
                {campaignStats.conqueredChallengers}/{ALL_FIGHTERS.length}
              </div>
            </div>
            <div className="basalt-recess px-3 py-2">
              <div className="text-[10.5px] text-[#9b896f]">Bosses Slain</div>
              <div className="font-mono text-xl font-bold text-violet-300">
                {campaignStats.bossesSlain}/{LADDER_TIERS.length}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. HALL OF CHAMPIONS + CROWN JEWEL & WARBAND COMPASS COVERAGE     */}
      {/* ================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Most Victorious Champions */}
        <div className="lg:col-span-7 brass-panel riveted-frame p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#e2b053]" />
              <h2 className="font-[var(--font-display)] text-sm sm:text-base font-bold uppercase tracking-wider text-[#f6e1b5]">
                Hall of Champions — Most Victorious Cards
              </h2>
            </div>
            {campaignStats.favoriteRival && (
              <span className="organic-tag px-2.5 py-1 bg-[#1b130c] text-[11px] font-mono text-[#dfcca9]">
                Top Sparring Rival: <strong>{campaignStats.favoriteRival.name}</strong> (
                {campaignStats.favoriteRival.wins}W)
              </span>
            )}
          </div>

          {topChampions.length === 0 ? (
            <div className="basalt-recess p-8 text-center font-[var(--font-serif)] text-sm text-[#a69277]">
              Win your first Arena or Quick Duel to immortalize your victorious cards in the Hall of
              Champions!
            </div>
          ) : (
            <div className="space-y-2.5">
              {topChampions.map(({ card, wins, bestCopy }, idx) => {
                const barWidth = Math.max(8, Math.round((wins / maxChampionWins) * 100));
                return (
                  <div
                    key={card.id}
                    className="basalt-recess p-3 flex items-center gap-3 border border-[#3e2f20]"
                  >
                    <span className="w-6 text-center font-mono text-xs font-bold text-[#e2b053] shrink-0">
                      #{idx + 1}
                    </span>
                    <img
                      src={getCardThumbUrl(card.image)}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      className={`w-11 h-11 rounded-[3px] object-cover border border-[#5a432b] shrink-0 ${
                        card.artFilter ?? ''
                      }`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-[#f5e7cd] truncate">
                            {card.name}
                          </span>
                          {bestCopy && (
                            <span className="font-mono text-[11px] text-[#f0c76e] shrink-0">
                              [{formatTetraCode(bestCopy.stats)} · {bestCopy.arrows.length}▲]
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs font-bold text-emerald-300 shrink-0">
                          {wins} {wins === 1 ? 'Victory' : 'Victories'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-[#120d09] overflow-hidden">
                          <div
                            style={{ width: `${barWidth}%` }}
                            className="h-full bg-gradient-to-r from-[#b9832f] to-[#f2cb72]"
                          />
                        </div>
                        <CardTraitPills element={card.element} tribe={card.tribe} compact />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Crown Jewel Roll + Active Warband 8-Way Compass Coverage */}
        <div className="lg:col-span-5 iron-panel riveted-frame p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#e2b053]" />
              <h2 className="font-[var(--font-display)] text-sm font-bold uppercase tracking-wider text-[#f3dfb6]">
                Vault Crown Jewel &amp; Warband Vectors
              </h2>
            </div>
          </div>

          {vaultMetrics.crownJewel && CARD_MAP[vaultMetrics.crownJewel.cardId] && (
            <div className="basalt-recess p-3.5 flex items-center gap-4">
              <div className="w-20 shrink-0">
                <GameCard
                  cardId={vaultMetrics.crownJewel.cardId}
                  stats={vaultMetrics.crownJewel.stats}
                  arrows={vaultMetrics.crownJewel.arrows}
                  augmentId={vaultMetrics.crownJewel.augmentId}
                  owner="neutral"
                  size="sm"
                  disableLongPress
                />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-[10.5px] font-[var(--font-display)] uppercase tracking-wider text-[#e2b053]">
                  Highest-Power Rolled Copy
                </div>
                <div className="font-[var(--font-display)] text-base font-bold text-[#f6e1b5] truncate">
                  {CARD_MAP[vaultMetrics.crownJewel.cardId].name}
                </div>
                <div className="font-mono text-xs text-[#f0c76e]">
                  [{formatTetraCode(vaultMetrics.crownJewel.stats)}] ·{' '}
                  {vaultMetrics.crownJewel.arrows.length}▲
                </div>
                {(() => {
                  const aug = resolveCardAugment(
                    vaultMetrics.crownJewel.cardId,
                    vaultMetrics.crownJewel.augmentId
                  );
                  return aug ? (
                    <div className="inline-flex items-center gap-1 text-[11px] font-mono text-violet-300">
                      <Wand2 className="w-3 h-3" />
                      <span>{aug.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* Active Warband Combat Type Composition */}
          <div className="basalt-recess p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-[var(--font-display)] font-bold text-[#e8d5b3] flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-[#e2b053]" />
                <span>{activeDeck.name} — Combat Mix</span>
              </span>
              <span className="font-mono text-[11px] text-[#cbb89a]">
                Avg {warbandAnalytics.avgStatSum} Stat · {warbandAnalytics.avgArrows}▲
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ATTACK_TYPE_META.map(({ type, label }) => {
                const count = warbandAnalytics.typeCounts[type] ?? 0;
                const pct =
                  warbandAnalytics.equippedCount > 0
                    ? Math.round((count / warbandAnalytics.equippedCount) * 100)
                    : 0;
                return (
                  <div
                    key={type}
                    className="p-2 bg-[#120d09] border border-[#36281a] rounded-[3px] space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-[#f0c76e]">{label}</span>
                      <span className="text-[#cbb89a]">{count}</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[#241b12] overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-[#e2b053]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 3. CAMPAIGN TIER MASTERY + VAULT & FORGE LEDGER                   */}
      {/* ================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 10-Tier Sanctuary Mastery Matrix */}
        <div className="lg:col-span-7 iron-panel riveted-frame p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#e2b053]" />
              <h2 className="font-[var(--font-display)] text-sm font-bold uppercase tracking-wider text-[#f3dfb6]">
                10-Tier Sanctuary Mastery
              </h2>
            </div>
            <span className="font-mono text-xs text-[#f0c76e]">
              {campaignStats.clearedTiers}/{LADDER_TIERS.length} Tiers Fully Cleared
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {LADDER_TIERS.map((tier) => {
              const prog = getTierProgress(tier.tierNumber, profile.fighterWins ?? {});
              const cleared = prog.defeated >= prog.total;
              const pct = Math.round((prog.defeated / prog.total) * 100);
              return (
                <div
                  key={tier.tierNumber}
                  className={`p-3 border space-y-1.5 ${
                    cleared
                      ? 'brass-plaque border-[#cfa052]/70'
                      : 'basalt-recess border-[#3a2c1e]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-[var(--font-display)] font-bold text-[#f3e5cb] truncate">
                      {tier.name}
                    </span>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        cleared ? 'text-emerald-300' : 'text-[#cbb89a]'
                      }`}
                    >
                      {prog.defeated}/{prog.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#120d09] overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${
                        cleared
                          ? 'bg-gradient-to-r from-emerald-500 to-amber-300'
                          : 'bg-[#cfa052]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vault Composition & Artisan Forge Economy */}
        <div className="lg:col-span-5 iron-panel riveted-frame p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#e2b053]" />
              <h2 className="font-[var(--font-display)] text-sm font-bold uppercase tracking-wider text-[#f3dfb6]">
                Vault &amp; Forge Economy
              </h2>
            </div>
            <span className="font-mono text-xs text-[#f0c76e]">
              {discoveredCount} Blueprints Discovered
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="basalt-recess p-3 space-y-0.5">
              <div className="text-[#9b896f] flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#e2b053]" />
                <span>Vault Melt Value</span>
              </div>
              <div className="font-mono text-base font-bold text-[#f0c76e]">
                {vaultMetrics.totalMeltValue.toLocaleString()}g
              </div>
            </div>

            <div className="basalt-recess p-3 space-y-0.5">
              <div className="text-[#9b896f] flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-violet-300" />
                <span>Runeforged Copies</span>
              </div>
              <div className="font-mono text-base font-bold text-violet-200">
                {vaultMetrics.runeforgedCount} Imbued
              </div>
            </div>

            <div className="basalt-recess p-3 space-y-0.5">
              <div className="text-[#9b896f] flex items-center gap-1">
                <Hammer className="w-3 h-3 text-orange-300" />
                <span>Cards Forged</span>
              </div>
              <div className="font-mono text-base font-bold text-[#f3e5cb]">
                {(profile.cardsForged ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="basalt-recess p-3 space-y-0.5">
              <div className="text-[#9b896f] flex items-center gap-1">
                <PackageOpen className="w-3 h-3 text-amber-300" />
                <span>Reliquaries Cracked</span>
              </div>
              <div className="font-mono text-base font-bold text-[#f3e5cb]">
                {(profile.packsOpened ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Owned Copies by Rarity */}
          <div className="basalt-recess p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-[var(--font-display)] font-bold text-[#e8d5b3]">
                Owned Rolled Copies by Tier
              </span>
              <span className="font-mono text-[#cbb89a]">
                {vaultMetrics.totalCopies} Total
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(['common', 'rare', 'epic', 'mythic'] as Rarity[]).map((r) => (
                <div key={r} className="p-2 bg-[#120d09] border border-[#36281a] rounded-[3px]">
                  <div className={`text-[10.5px] font-semibold ${RARITY_BADGE[r].color}`}>
                    {RARITY_BADGE[r].label}
                  </div>
                  <div className="font-mono text-sm font-bold text-[#f5e7cd] mt-0.5">
                    {vaultMetrics.byRarity[r]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Elements & Tribes in Vault */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="basalt-recess p-3 space-y-1.5">
              <div className="font-[var(--font-display)] font-bold text-[11px] uppercase tracking-wider text-[#cbb89a]">
                Top Elements
              </div>
              {vaultMetrics.topElements.map((item) => (
                <div key={item.el} className="flex items-center justify-between font-mono">
                  <span className="text-[#e8d5b3] truncate">{item.label}</span>
                  <span className="text-[#f0c76e] font-bold">×{item.count}</span>
                </div>
              ))}
            </div>
            <div className="basalt-recess p-3 space-y-1.5">
              <div className="font-[var(--font-display)] font-bold text-[11px] uppercase tracking-wider text-[#cbb89a]">
                Top Tribes
              </div>
              {vaultMetrics.topTribes.map((item) => (
                <div key={item.tr} className="flex items-center justify-between font-mono">
                  <span className="text-[#e8d5b3] truncate">{item.label}</span>
                  <span className="text-[#f0c76e] font-bold">×{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
