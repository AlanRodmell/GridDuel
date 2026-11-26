import React, { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Copy,
  Eraser,
  Eye,
  HelpCircle,
  Layers,
  Lock,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useCardPreview } from '../context/cardPreviewContext';
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
import {
  POWER_CARDS,
  POWER_CARD_MAP,
  getUnlockedPowerCardIdSet,
} from '../data/powerCards';
import {
  ALL_BOARD_SCALES,
  BOARD_SCALES,
  getBoardScaleSpec,
} from '../engine/triadEngine';
import {
  AutoBuildStrategy,
  MAX_DECK_SLOTS,
  MAX_UNIT_CAPACITY,
  getUnitCapacityForScale,
} from '../store/useProfile';
import {
  AttackType,
  BiomeType,
  BoardScale,
  CardDef,
  CardElement,
  CardTribe,
  DeckSlot,
  LadderFighter,
  PlayerProfile,
  Rarity,
  RolledCardInstance,
} from '../types/game';
import { sound } from '../utils/sound';
import { BiomePill, CardTraitPills } from './BiomeBadge';
import { GameCard } from './GameCard';

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  mythic: 'text-amber-300',
};

const RARITY_RANK: Record<Rarity, number> = {
  mythic: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

type VaultSortKey = 'power' | 'number' | 'arrows' | 'rarity';

function formatDeltaBadge(
  copy: RolledCardInstance,
  best: RolledCardInstance
): {
  label: string;
  className: string;
} {
  if (copy.uid === best.uid) {
    return {
      label: '★ Best Roll',
      className: 'bg-emerald-950/85 text-emerald-300',
    };
  }
  const copyTotal = copy.stats.power + copy.stats.pDef + copy.stats.mDef;
  const bestTotal = best.stats.power + best.stats.pDef + best.stats.mDef;
  const statDiff = copyTotal - bestTotal;
  const arrowDiff = copy.arrows.length - best.arrows.length;

  const parts: string[] = [];
  if (statDiff !== 0) {
    parts.push(
      `${statDiff > 0 ? `+${statDiff}` : statDiff} stat${
        Math.abs(statDiff) === 1 ? '' : 's'
      }`
    );
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
      className: 'bg-[#191410] text-[#cbb89a]',
    };
  }

  return {
    label: parts.join(' · '),
    className:
      statDiff >= 0 && arrowDiff >= 0
        ? 'bg-emerald-950/75 text-emerald-200'
        : statDiff <= 0 && arrowDiff <= 0
        ? 'bg-rose-950/75 text-rose-300'
        : 'bg-sky-950/85 text-sky-300',
  };
}

interface DeckBuilderWorkspaceProps {
  profile: PlayerProfile;
  activeDeck: DeckSlot;
  currentFighter: LadderFighter;
  gameMode: 'arena' | 'quick';
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
    targetBiomes?: BiomeType[],
    onlyEmptySlots?: boolean
  ) => void;
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
  currentFighter,
  gameMode,
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
  onStartMatch,
  onGoToGallery,
  onOpenRules,
}) => {
  const { openPreview } = useCardPreview();
  const [targetSlotIdx, setTargetSlotIdx] = useState<number | null>(null);
  const [vaultTab, setVaultTab] = useState<'units' | 'relics'>('units');
  const [isRenamingDeck, setIsRenamingDeck] = useState(false);
  const [draftDeckName, setDraftDeckName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultSort, setVaultSort] = useState<VaultSortKey>('power');
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

  const activeScale = profile.boardScale ?? '6x3';
  const scaleSpec = getBoardScaleSpec(activeScale);
  const unitCapacity = getUnitCapacityForScale(activeScale);

  const arenaBiomes = useMemo(
    () => getFighterBiomes(currentFighter.id),
    [currentFighter.id]
  );
  const rivalAvatarCard = CARD_MAP[currentFighter.avatarCardId] ?? CARD_MAP['ember-imp'];

  const unlockedPowerSet = useMemo(
    () => getUnlockedPowerCardIdSet(profile.fighterWins),
    [profile.fighterWins]
  );
  const unlockedPowerCount = unlockedPowerSet.size;
  const equippedPowerDef =
    activeDeck.powerSlot &&
    POWER_CARD_MAP[activeDeck.powerSlot] &&
    unlockedPowerSet.has(activeDeck.powerSlot)
      ? POWER_CARD_MAP[activeDeck.powerSlot]
      : null;

  const instanceByUid = useMemo(() => {
    const map: Record<string, RolledCardInstance> = {};
    for (const list of Object.values(profile.inventory)) {
      for (const inst of list) {
        map[inst.uid] = inst;
      }
    }
    return map;
  }, [profile.inventory]);

  // Fixed unit slots [0..unitCapacity-1] — null slots stay null as carved empty card imprints!
  const fixedDeckSlots = useMemo<(RolledCardInstance | null)[]>(() => {
    const raw = activeDeck.slots ?? activeDeck.cards;
    return Array.from({ length: unitCapacity }, (_, idx) => {
      const uid = raw[idx];
      if (!uid) return null;
      return instanceByUid[uid] ?? null;
    });
  }, [activeDeck.cards, activeDeck.slots, instanceByUid, unitCapacity]);

  const slotIndexByUid = useMemo(() => {
    const map = new Map<string, number>();
    fixedDeckSlots.forEach((inst, idx) => {
      if (inst) map.set(inst.uid, idx);
    });
    return map;
  }, [fixedDeckSlots]);

  const filledCount = slotIndexByUid.size;
  const emptyCount = unitCapacity - filledCount;
  const isDeckReady = filledCount === unitCapacity;

  const allEquippedUidSet = useMemo(
    () => new Set(profile.decks.flatMap((d) => d.cards)),
    [profile.decks]
  );

  const totalOwnedCopies = useMemo(
    () => Object.values(profile.inventory).reduce((sum, list) => sum + list.length, 0),
    [profile.inventory]
  );

  const totalArrows = useMemo(
    () => fixedDeckSlots.reduce((sum, c) => sum + (c ? c.arrows.length : 0), 0),
    [fixedDeckSlots]
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
      copyRank: number;
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
        const equippedRep = matchingCopies.find((c) => slotIndexByUid.has(c.uid));
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
      const refA = a.allCopies[0];
      const refB = b.allCopies[0];

      if (a.def.id !== b.def.id) {
        if (vaultSort === 'number') {
          return a.def.number - b.def.number;
        }
        if (vaultSort === 'arrows') {
          return (
            refB.arrows.length - refA.arrows.length ||
            getInstanceSortScore(refB) - getInstanceSortScore(refA) ||
            a.def.number - b.def.number
          );
        }
        if (vaultSort === 'rarity') {
          return (
            RARITY_RANK[b.def.rarity] - RARITY_RANK[a.def.rarity] ||
            getInstanceSortScore(refB) - getInstanceSortScore(refA) ||
            a.def.number - b.def.number
          );
        }
        return (
          getInstanceSortScore(refB) - getInstanceSortScore(refA) ||
          a.def.number - b.def.number
        );
      }

      return a.copyRank - b.copyRank;
    });
  }, [
    arenaBiomes,
    elementFilter,
    groupByCard,
    onlyAugments,
    onlyBiomeFavored,
    onlyDuplicates,
    profile.inventory,
    rarityFilter,
    searchQuery,
    slotIndexByUid,
    tribeFilter,
    typeFilter,
    vaultSort,
  ]);

  const handleVaultCardClick = (inst: RolledCardInstance) => {
    sound.select();
    const isAlreadyInDeck = slotIndexByUid.has(inst.uid);
    if (isAlreadyInDeck) {
      onToggleDeckCard(inst.uid);
      return;
    }

    const preferred =
      targetSlotIdx !== null && targetSlotIdx < unitCapacity ? targetSlotIdx : undefined;

    const res = onToggleDeckCard(inst.uid, preferred);
    if (!res.ok && res.message) {
      showToast(res.message);
      return;
    }
    if (targetSlotIdx !== null) {
      setTargetSlotIdx(null);
    }
  };

  const commitDeckRename = () => {
    if (draftDeckName.trim()) {
      onRenameDeck(profile.activeDeckIndex, draftDeckName.trim());
    }
    setIsRenamingDeck(false);
    setDraftDeckName('');
  };

  const compareCardDef = compareCardId ? CARD_MAP[compareCardId] ?? null : null;
  const compareCopies = useMemo(() => {
    if (!compareCardId) return [];
    return sortCardCopies(profile.inventory[compareCardId] ?? []);
  }, [compareCardId, profile.inventory]);

  const dockGridColsClass =
    unitCapacity === 10
      ? 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-11'
      : unitCapacity === 9
      ? 'grid-cols-4 sm:grid-cols-5 lg:grid-cols-10'
      : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9';

  return (
    <div className="space-y-3 lg:space-y-0 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:gap-3 lg:overflow-hidden">
      {toastMsg && (
        <div className="fixed bottom-20 md:bottom-8 right-4 z-50 brass-panel px-4 py-2.5 text-xs font-semibold text-[#f5d593] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#e2b053] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PINNED TOP DOCK: SCALE + SAVED DECKS + UNIT SLOTS + DEDICATED RELIC   */}
      {/* ===================================================================== */}
      <section className="shrink-0 brass-panel riveted-frame px-3.5 sm:px-5 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Challenger & Arena Biomes */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 card-weathered-rim overflow-hidden border-2 border-[#a83e3e] shrink-0 shadow">
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
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-[var(--font-display)] text-xs sm:text-sm font-bold text-[#f6e3be] truncate">
                  vs {currentFighter.name}
                </span>
                <span className="font-mono text-[11px] text-[#e6b85c]">
                  ({gameMode === 'quick' ? 'Skirmish' : `T${currentFighter.tierNumber}`} ·{' '}
                  {scaleSpec.shortLabel} · +{currentFighter.winGold}g)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {arenaBiomes.map((b) => (
                  <BiomePill key={b} biome={b} compact />
                ))}
              </div>
            </div>
          </div>

          {/* Saved Deck Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {profile.decks.map((d, idx) => {
              const isSel = idx === profile.activeDeckIndex;
              const rawSlots = d.slots ?? d.cards;
              const dCount = rawSlots.slice(0, unitCapacity).filter(Boolean).length;
              const hasRelic = Boolean(
                d.powerSlot && unlockedPowerSet.has(d.powerSlot)
              );
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setIsRenamingDeck(false);
                    setTargetSlotIdx(null);
                    onSelectDeckSlot(idx);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 text-xs font-[var(--font-display)] tracking-wide whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSel ? 'brass-btn font-bold' : 'iron-btn text-[#c9b79b]'
                  }`}
                >
                  <span>{d.name}</span>
                  <span
                    className={`font-mono text-[10px] ${
                      isSel
                        ? 'text-[#261808]'
                        : dCount === unitCapacity
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {dCount}/{unitCapacity}
                    {hasRelic ? '+R' : ''}
                  </span>
                </button>
              );
            })}

            {profile.decks.length < MAX_DECK_SLOTS && (
              <button
                type="button"
                onClick={() => {
                  const res = onCreateDeck();
                  if (!res.ok && res.message) showToast(res.message);
                  setTargetSlotIdx(0);
                }}
                title="Create a new custom deck"
                className="iron-btn min-h-[32px] px-2.5 py-1 text-xs font-[var(--font-display)] text-[#f0c76e] inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            )}
          </div>

          {/* Right CTA: Fill Empty Helper + Start Match */}
          <div className="flex flex-wrap items-center gap-2">
            {emptyCount > 0 && totalOwnedCopies >= unitCapacity && (
              <button
                type="button"
                onClick={() => {
                  onAutoBuildDeck('biome', arenaBiomes, true);
                  setTargetSlotIdx(null);
                }}
                title="Auto-fill only the remaining empty unit slots"
                className="iron-btn min-h-[38px] px-3 py-1.5 font-[var(--font-display)] text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fill {emptyCount} Empty</span>
              </button>
            )}

            <button
              type="button"
              disabled={!isDeckReady}
              onClick={onStartMatch}
              className="brass-btn min-h-[40px] px-5 py-2 font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {isDeckReady
                  ? equippedPowerDef
                    ? `Start ${scaleSpec.shortLabel} (${unitCapacity}+1 Relic)`
                    : `Start ${scaleSpec.shortLabel} Match`
                  : `Pick ${emptyCount} More (${filledCount}/${unitCapacity})`}
              </span>
            </button>
          </div>
        </div>

        {/* Sub-Bar: Active Deck Name + Battlefield Scale Switcher + Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#4b3a26]/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {isRenamingDeck ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitDeckRename();
                }}
                className="inline-flex items-center gap-1"
              >
                <input
                  type="text"
                  value={draftDeckName}
                  onChange={(e) => setDraftDeckName(e.target.value)}
                  maxLength={28}
                  autoFocus
                  aria-label="Rename active deck"
                  className="organic-control px-2.5 py-1 text-xs font-semibold text-[#f5e7cc]"
                />
                <button type="submit" className="brass-btn p-1 cursor-pointer" aria-label="Save">
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenamingDeck(false)}
                  className="iron-btn p-1 cursor-pointer"
                  aria-label="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <>
                <span className="font-[var(--font-display)] font-bold text-[#f5dfb2]">
                  {activeDeck.name}
                </span>
                <span className="font-mono text-[11px] text-[#b39e81]">
                  {filledCount}/{unitCapacity} units
                  {equippedPowerDef ? ` + ${equippedPowerDef.code}` : ''} · {totalArrows}▲
                </span>
                <button
                  type="button"
                  onClick={() => {
                    sound.select();
                    setDraftDeckName(activeDeck.name);
                    setIsRenamingDeck(true);
                  }}
                  title="Rename deck"
                  className="text-[#a89478] hover:text-[#f5d593] p-1 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {profile.decks.length < MAX_DECK_SLOTS && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = onCreateDeck(undefined, profile.activeDeckIndex);
                      if (res.ok) showToast(`Duplicated "${activeDeck.name}"`);
                    }}
                    title="Duplicate this deck"
                    className="text-[#a89478] hover:text-[#f5d593] p-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
                {(filledCount > 0 || equippedPowerDef) && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearDeck();
                      setTargetSlotIdx(0);
                    }}
                    title="Clear all slots to empty outlines"
                    className="inline-flex items-center gap-1 text-[#a89478] hover:text-rose-300 px-1.5 py-0.5 cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
                {profile.decks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteDeck(profile.activeDeckIndex)}
                    title="Delete this deck"
                    className="text-[#a89478] hover:text-rose-300 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Inline Battlefield Scale Game Mode Selector */}
            <div className="inline-flex items-center gap-1 mr-1">
              <span className="font-[var(--font-display)] text-[10px] uppercase tracking-wider text-[#a89478] hidden xl:inline">
                Scale:
              </span>
              {ALL_BOARD_SCALES.map((sc) => {
                const s = BOARD_SCALES[sc];
                const isCur = sc === activeScale;
                return (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => {
                      setTargetSlotIdx(null);
                      onSelectBoardScale(sc);
                    }}
                    title={s.subtitle}
                    className={`px-2 py-0.5 text-[11px] font-mono font-bold cursor-pointer ${
                      isCur ? 'brass-btn' : 'iron-btn text-[#c9b79b]'
                    }`}
                  >
                    {s.shortLabel}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onAutoBuildDeck('biome', arenaBiomes, false);
                setTargetSlotIdx(null);
              }}
              className="organic-tag px-2.5 py-1 bg-emerald-950/90 hover:bg-emerald-900/90 text-[11px] font-[var(--font-display)] font-bold text-emerald-200 cursor-pointer"
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
                onClick={() => {
                  onAutoBuildDeck(opt.id, undefined, false);
                  setTargetSlotIdx(null);
                }}
                className="iron-btn px-2 py-0.5 text-[11px] font-[var(--font-display)] font-semibold cursor-pointer"
              >
                {opt.label}
              </button>
            ))}

            <button
              type="button"
              onClick={onOpenRules}
              className="iron-btn inline-flex items-center gap-1 px-2 py-0.5 font-[var(--font-display)] text-[11px] cursor-pointer"
            >
              <HelpCircle className="w-3 h-3 text-[#d8a64c]" />
              <span>Codex</span>
            </button>
          </div>
        </div>

        {/* FIXED UNIT SLOTS + DEDICATED POWER RELIC SLOT */}
        <div className={`grid ${dockGridColsClass} gap-1.5 sm:gap-2 lg:gap-2 pt-0.5 items-start`}>
          {fixedDeckSlots.map((slotInst, slotIdx) => {
            const isTargeted = targetSlotIdx === slotIdx && vaultTab === 'units';

            if (!slotInst) {
              return (
                <button
                  key={`empty-slot-${slotIdx}`}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setVaultTab('units');
                    setTargetSlotIdx((cur) => (cur === slotIdx ? null : slotIdx));
                  }}
                  title={`Empty Unit Slot #${slotIdx + 1} — click any Unit card in your Vault below to fill`}
                  className={`empty-card-imprint ${
                    isTargeted ? 'empty-card-imprint-active' : ''
                  } group relative aspect-[5/7] w-full max-w-[118px] mx-auto flex flex-col items-center justify-center p-1.5 text-center transition-transform hover:scale-[1.02] cursor-pointer`}
                >
                  <span className="absolute top-1.5 left-1.5 font-mono text-[9.5px] font-bold text-[#8c775c]">
                    #{slotIdx + 1}
                  </span>
                  <div
                    className={`organic-seal w-6 h-6 flex items-center justify-center mb-1 transition-colors ${
                      isTargeted
                        ? 'bg-amber-600/35 text-[#f7dea2]'
                        : 'bg-[#211810] text-[#9b866a] group-hover:text-[#f0c76e]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-[var(--font-display)] text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-wider text-[#b5a184]">
                    {isTargeted ? 'Picking…' : 'Unit Slot'}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={`slot-${slotIdx}-${slotInst.uid}`}
                className="group relative w-full max-w-[118px] mx-auto"
              >
                <span className="organic-seal pointer-events-none absolute top-1 left-1 z-30 w-4 h-4 bg-[#19120c]/95 font-mono text-[8.5px] font-bold text-[#e5d2b0] flex items-center justify-center shadow">
                  {slotIdx + 1}
                </span>

                <GameCard
                  cardId={slotInst.cardId}
                  stats={slotInst.stats}
                  arrows={slotInst.arrows}
                  augmentId={slotInst.augmentId}
                  owner="player"
                  size="sm"
                  showName
                  onClick={() => {
                    sound.select();
                    onToggleDeckCard(slotInst.uid);
                  }}
                />

                <span className="organic-tag pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1 z-40 px-1.5 py-0.5 bg-[#7c1f1f] text-[9px] font-[var(--font-display)] font-bold text-white shadow-lg flex items-center gap-0.5">
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                  <span>Remove</span>
                </span>
              </div>
            );
          })}

          {/* DEDICATED POWER RELIC SLOT (Locked until at least 1 Tier is cleared!) */}
          {unlockedPowerCount === 0 ? (
            <button
              type="button"
              onClick={() => {
                sound.select();
                setVaultTab('relics');
                showToast(
                  'Conquer all 5 challengers in Tier 1 to unlock your first Power Relic!'
                );
              }}
              title="Dedicated Power Relic Slot — Locked until you clear all 5 challengers in a Campaign Tier"
              className="empty-card-imprint relative aspect-[5/7] w-full max-w-[118px] mx-auto flex flex-col items-center justify-center p-1.5 text-center opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <span className="organic-tag absolute top-1 inset-x-1.5 bg-sky-950/80 py-[1px] font-[var(--font-display)] text-[8px] font-bold uppercase tracking-wider text-sky-300/90">
                Relic Slot
              </span>
              <div className="organic-seal w-6 h-6 bg-[#141c24] text-sky-300/75 flex items-center justify-center mb-1 mt-2">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span className="font-[var(--font-display)] text-[9px] font-bold uppercase tracking-wider text-sky-200/80 leading-tight">
                Locked
              </span>
              <span className="hidden sm:block font-[var(--font-serif)] italic text-[10px] text-[#8ea2b8] leading-tight mt-0.5">
                Clear Tier 1
              </span>
            </button>
          ) : !equippedPowerDef ? (
            <button
              type="button"
              onClick={() => {
                sound.select();
                setVaultTab('relics');
              }}
              title="Dedicated Power Relic Slot — Click to equip one of your Tier-unlocked Power Relics"
              className={`empty-card-imprint ${
                vaultTab === 'relics' ? 'empty-card-imprint-active' : ''
              } group relative aspect-[5/7] w-full max-w-[118px] mx-auto flex flex-col items-center justify-center p-1.5 text-center transition-transform hover:scale-[1.02] cursor-pointer`}
            >
              <span className="organic-tag absolute top-1 inset-x-1.5 bg-sky-950/90 py-[1px] font-[var(--font-display)] text-[8px] font-bold uppercase tracking-wider text-sky-200">
                Relic Slot
              </span>
              <div className="organic-seal w-6 h-6 bg-sky-950 text-sky-300 flex items-center justify-center mb-1 mt-2 group-hover:scale-110 transition-transform">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="font-[var(--font-display)] text-[9.5px] font-bold uppercase tracking-wider text-sky-200 leading-tight">
                {vaultTab === 'relics' ? 'Pick Relic…' : 'Add Relic'}
              </span>
              <span className="hidden sm:block font-[var(--font-serif)] italic text-[10px] text-sky-300/80 leading-tight mt-0.5">
                {unlockedPowerCount}/12 Owned
              </span>
            </button>
          ) : (
            <div className="group relative w-full max-w-[118px] mx-auto">
              <span className="organic-tag pointer-events-none absolute top-1 left-1 z-30 px-1.5 py-[1px] bg-sky-950/95 font-mono text-[8px] font-bold text-sky-200 shadow">
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

              <span className="organic-tag pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1 z-40 px-1.5 py-0.5 bg-[#7c1f1f] text-[9px] font-[var(--font-display)] font-bold text-white shadow-lg flex items-center gap-0.5">
                <X className="w-2.5 h-2.5 stroke-[3]" />
                <span>Remove</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* INDEPENDENTLY SCROLLING VAULT: UNIT CARDS OR TIER POWER RELICS        */}
      {/* ===================================================================== */}
      <section className="iron-panel p-3.5 sm:p-4 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col gap-3 overflow-hidden">
        <div className="shrink-0 space-y-2 pb-2.5 border-b border-[#3e3124]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Vault Category Switcher: Units vs Tier Power Relics */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setVaultTab('units');
                }}
                className={`min-h-[34px] px-3 py-1 font-[var(--font-display)] text-xs font-bold tracking-wide cursor-pointer ${
                  vaultTab === 'units' ? 'brass-btn' : 'iron-btn text-[#cbb89a]'
                }`}
              >
                Unit Cards ({filteredEntries.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setVaultTab('relics');
                }}
                className={`min-h-[34px] px-3 py-1 font-[var(--font-display)] text-xs font-bold tracking-wide inline-flex items-center gap-1.5 cursor-pointer ${
                  vaultTab === 'relics'
                    ? 'brass-btn'
                    : 'iron-btn text-sky-200 hover:text-sky-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Power Relics ({unlockedPowerCount}/12)</span>
              </button>
            </div>

            {vaultTab === 'units' && (
              <div className="flex flex-wrap items-center gap-2">
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
                    className="brass-plaque min-h-[34px] px-2.5 py-1 text-[#f5d593] font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Coins className="w-3.5 h-3.5 text-[#e2b053] shrink-0" />
                    <span>
                      Sell {sellableExtrasSummary.count} Extra
                      {sellableExtrasSummary.count === 1 ? '' : 's'} (+
                      {sellableExtrasSummary.totalGold.toLocaleString()}g)
                    </span>
                  </button>
                )}

                <select
                  aria-label="Sort vault cards"
                  value={vaultSort}
                  onChange={(e) => {
                    sound.select();
                    setVaultSort(e.target.value as VaultSortKey);
                  }}
                  className="organic-control min-h-[34px] pl-3 text-xs font-medium text-[#f0d8a8] cursor-pointer"
                >
                  <option value="power">Sort: Highest Power</option>
                  <option value="number">Sort: Card #01–#120</option>
                  <option value="arrows">Sort: Most Arrows</option>
                  <option value="rarity">Sort: Rarity Tier</option>
                </select>

                <div className="relative w-44 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-[#8c785f] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search card or rune..."
                    className="organic-control w-full min-h-[34px] pl-8 pr-3 text-xs text-[#efe3cd] placeholder:text-[#7d6c56]"
                  />
                </div>

                <button
                  type="button"
                  onClick={onGoToGallery}
                  className="iron-btn px-2.5 py-1.5 font-[var(--font-display)] text-[11px] cursor-pointer"
                >
                  Compendium →
                </button>
              </div>
            )}
          </div>

          {vaultTab === 'units' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.select();
                    setGroupByCard(true);
                  }}
                  className={`min-h-[28px] px-2.5 py-0.5 font-[var(--font-display)] text-[11px] cursor-pointer ${
                    groupByCard ? 'brass-btn font-bold' : 'iron-btn text-[#a69277]'
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
                  className={`min-h-[28px] px-2.5 py-0.5 font-[var(--font-display)] text-[11px] cursor-pointer ${
                    !groupByCard ? 'brass-btn font-bold' : 'iron-btn text-[#a69277]'
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
                className={`min-h-[28px] px-2.5 py-0.5 font-[var(--font-display)] text-[11px] font-semibold cursor-pointer ${
                  onlyDuplicates ? 'brass-btn font-bold' : 'iron-btn text-[#dfd0b6]'
                }`}
              >
                2+ Copies
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setOnlyBiomeFavored((v) => !v);
                }}
                className={`organic-tag min-h-[28px] px-3 py-0.5 font-[var(--font-display)] text-[11px] font-semibold cursor-pointer ${
                  onlyBiomeFavored
                    ? 'bg-emerald-800 text-white'
                    : 'bg-[#1a2619] text-emerald-300 hover:bg-[#223421]'
                }`}
              >
                ▲ Favored Here
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setOnlyAugments((v) => !v);
                }}
                className={`organic-tag min-h-[28px] px-3 py-0.5 font-[var(--font-display)] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                  onlyAugments
                    ? 'bg-violet-800 text-white'
                    : 'bg-[#23162b] text-violet-300 hover:bg-[#2f1d3a]'
                }`}
              >
                <Wand2 className="w-3 h-3" />
                <span>Runes</span>
              </button>

              {(['all', 'common', 'rare', 'epic', 'mythic'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    sound.select();
                    setRarityFilter(r);
                  }}
                  className={`min-h-[28px] px-2.5 py-0.5 font-[var(--font-display)] text-[11px] capitalize cursor-pointer ${
                    rarityFilter === r
                      ? 'brass-plaque text-[#f5d593] font-bold'
                      : 'text-[#a69277] hover:text-[#f0e4cc]'
                  }`}
                >
                  {r}
                </button>
              ))}

              <select
                aria-label="Filter by attack type"
                value={typeFilter}
                onChange={(e) => {
                  sound.select();
                  setTypeFilter(e.target.value as 'all' | AttackType);
                }}
                className="organic-control min-h-[28px] pl-2.5 text-[11px] text-[#e5d6bc] cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="P">Type P</option>
                <option value="M">Type M</option>
                <option value="X">Type X</option>
                <option value="A">Type A</option>
              </select>

              <select
                aria-label="Filter by element"
                value={elementFilter}
                onChange={(e) => {
                  sound.select();
                  setElementFilter(e.target.value as 'all' | CardElement);
                }}
                className="organic-control min-h-[28px] pl-2.5 text-[11px] text-[#e5d6bc] cursor-pointer"
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
                className="organic-control min-h-[28px] pl-2.5 text-[11px] text-[#e5d6bc] cursor-pointer"
              >
                <option value="all">All Tribes</option>
                {ALL_TRIBES.map((tr) => (
                  <option key={tr} value={tr}>
                    {TRIBE_META[tr].label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="font-[var(--font-serif)] text-xs sm:text-sm text-[#cbb89a]">
              Power Relics unlock strictly by conquering all 5 challengers in each Campaign Tier
              (Tiers 1–10). Equip 1 unlocked Relic into your Dedicated Relic Slot to deploy an
              un-flippable directional Totem during battle!
            </p>
          )}
        </div>

        {/* Scrollable Grid: Either Unit Cards or 12 Power Relics */}
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1 pt-1">
          {vaultTab === 'relics' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3.5 sm:gap-4 pb-2">
              {POWER_CARDS.map((pCard) => {
                const isUnlocked = unlockedPowerSet.has(pCard.id);
                const isEquipped = equippedPowerDef?.id === pCard.id;

                return (
                  <div
                    key={pCard.id}
                    className={`card-grid-item flex flex-col gap-1.5 ${
                      !isUnlocked ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="relative">
                      <GameCard
                        cardId={pCard.id}
                        arrows={pCard.dirs}
                        owner={isEquipped ? 'player' : 'neutral'}
                        size="md"
                        showName
                        onClick={() => {
                          if (!isUnlocked) {
                            sound.select();
                            openPreview({
                              cardId: pCard.id,
                              arrows: pCard.dirs,
                              owner: 'neutral',
                            });
                            return;
                          }
                          sound.select();
                          const res = onSetDeckPowerCard(isEquipped ? null : pCard.id);
                          if (!res.ok && res.message) {
                            showToast(res.message);
                          }
                        }}
                        onDoubleClick={() => {
                          sound.select();
                          openPreview({
                            cardId: pCard.id,
                            arrows: pCard.dirs,
                            owner: isEquipped ? 'player' : 'neutral',
                          });
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
                        title="Inspect full Relic details"
                        className="organic-seal absolute top-1.5 left-1.5 z-20 w-6 h-6 bg-[#141c24]/95 text-sky-200 hover:text-white flex items-center justify-center shadow cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {isEquipped ? (
                        <span className="organic-tag pointer-events-none absolute top-1.5 right-1.5 z-20 px-2 py-0.5 bg-sky-400 text-[#071521] text-[9.5px] font-[var(--font-display)] font-bold flex items-center gap-0.5 shadow-lg">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>Equipped</span>
                        </span>
                      ) : !isUnlocked ? (
                        <span className="organic-tag pointer-events-none absolute top-1.5 right-1.5 z-20 px-2 py-0.5 bg-[#1a130d]/95 text-[#cbb89a] text-[9.5px] font-mono font-bold flex items-center gap-1 shadow">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          <span>Tier {pCard.unlockTier}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="text-center px-1 space-y-0.5">
                      <div className="text-[10.5px] font-mono font-semibold text-sky-200 truncate">
                        {pCard.shortTag}
                      </div>
                      <div className="text-[10px] text-[#a69277]">
                        {isUnlocked
                          ? isEquipped
                            ? 'Click to unequip'
                            : 'Click to equip in Relic Slot'
                          : `Clear Tier ${pCard.unlockTier} to unlock`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center space-y-2">
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
                className="iron-btn px-3.5 py-1.5 font-[var(--font-display)] text-xs cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5 sm:gap-4 pb-2">
              {filteredEntries.map(({ inst, def, allCopies, copyRank }) => {
                const slotNum = slotIndexByUid.has(inst.uid)
                  ? (slotIndexByUid.get(inst.uid) ?? 0) + 1
                  : null;
                const inDeck = slotNum !== null;
                const equippedCopiesCount = allCopies.filter((c) =>
                  slotIndexByUid.has(c.uid)
                ).length;
                const aug = resolveCardAugment(inst.cardId, inst.augmentId);
                const biomeHints = arenaBiomes
                  .map((b) => evaluateTerrainEffect(b, def))
                  .filter((ev): ev is NonNullable<typeof ev> =>
                    Boolean(ev && ev.hasEffect)
                  );
                const copyCount = allCopies.length;
                const deltaVsBest =
                  !groupByCard && copyCount > 1
                    ? formatDeltaBadge(inst, allCopies[0])
                    : null;
                const sellGold = getCardSellValue(
                  def,
                  inst.stats,
                  inst.arrows,
                  inst.augmentId
                );
                const canQuickSellInline =
                  !groupByCard &&
                  copyRank > 0 &&
                  !inDeck &&
                  !allEquippedUidSet.has(inst.uid) &&
                  totalOwnedCopies > MAX_UNIT_CAPACITY;

                return (
                  <div key={inst.uid} className="card-grid-item flex flex-col gap-1.5">
                    <div className="relative">
                      <GameCard
                        cardId={inst.cardId}
                        stats={inst.stats}
                        arrows={inst.arrows}
                        augmentId={inst.augmentId}
                        owner={inDeck ? 'player' : 'neutral'}
                        size="md"
                        showName
                        onClick={() => handleVaultCardClick(inst)}
                        onDoubleClick={() => {
                          sound.drawer(true);
                          setCompareCardId(def.id);
                        }}
                      />

                      {copyCount > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.select();
                            setCompareCardId(def.id);
                          }}
                          title={`Compare all ${copyCount} rolled copies of ${def.name}`}
                          className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 brass-plaque font-mono text-[10px] font-bold text-[#f5d593] shadow cursor-pointer"
                        >
                          {groupByCard
                            ? `×${copyCount}`
                            : `#${copyRank + 1}/${copyCount}`}
                        </button>
                      )}

                      {inDeck && (
                        <span className="organic-tag pointer-events-none absolute top-1.5 right-1.5 z-20 px-2 py-0.5 bg-[#e2b053] text-[#170f06] text-[9.5px] font-[var(--font-display)] font-bold flex items-center gap-0.5 shadow-lg">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>
                            {groupByCard && equippedCopiesCount > 1
                              ? `×${equippedCopiesCount} In Deck`
                              : `Slot #${slotNum}`}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 px-0.5">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <CardTraitPills element={def.element} tribe={def.tribe} compact />
                        {biomeHints.slice(0, 2).map((hint) => (
                          <span
                            key={hint.biome}
                            title={`${BIOME_META[hint.biome].name}: ${hint.shortTag}`}
                            className={`organic-tag inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-semibold cursor-help ${
                              hint.isPositive
                                ? 'bg-emerald-950/90 text-emerald-300'
                                : 'bg-rose-950/90 text-rose-300'
                            }`}
                          >
                            {hint.isPositive ? '▲' : '▼'} {BIOME_META[hint.biome].shortName}
                          </span>
                        ))}
                      </div>

                      {aug && (
                        <div className="flex justify-center">
                          <span className="organic-tag inline-flex items-center gap-1 px-2 py-0.5 bg-violet-950/95 text-[10px] font-mono text-violet-200 max-w-full truncate">
                            <Wand2 className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                            <span className="truncate">{aug.name}</span>
                          </span>
                        </div>
                      )}

                      {groupByCard && copyCount > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.select();
                            setCompareCardId(def.id);
                          }}
                          className="w-full min-h-[26px] iron-btn text-[10.5px] font-[var(--font-display)] font-semibold text-[#f0c76e] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Layers className="w-3 h-3 text-[#e2b053]" />
                          <span>Compare {copyCount} Rolls</span>
                        </button>
                      )}

                      {!groupByCard && deltaVsBest && (
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`organic-tag px-2 py-0.5 font-mono text-[10px] font-semibold truncate ${deltaVsBest.className}`}
                          >
                            {deltaVsBest.label}
                          </span>
                          {canQuickSellInline && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = onSellCardInstance(inst.uid);
                                if (res.ok) {
                                  showToast(
                                    `Sold ${def.name} copy for +${res.goldEarned}g!`
                                  );
                                } else if (res.message) {
                                  showToast(res.message);
                                }
                              }}
                              className="px-2 py-0.5 crimson-btn font-mono text-[10px] font-bold inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
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
        </div>
      </section>

      {/* SIDE-BY-SIDE ROLLED COPY COMPARISON MODAL */}
      {compareCardDef && compareCopies.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/90 p-0 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`Compare copies of ${compareCardDef.name}`}
          onClick={() => setCompareCardId(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92dvh] flex flex-col brass-panel riveted-frame overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-[#4b3a26]/85 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-[var(--font-display)] text-lg sm:text-xl font-bold text-[#f6e1b5] tracking-wide">
                    {compareCardDef.name} — Rolled Copies ({compareCopies.length})
                  </h3>
                  <span
                    className={`text-xs font-semibold capitalize ${RARITY_TEXT[compareCardDef.rarity]}`}
                  >
                    {compareCardDef.rarity}
                  </span>
                </div>
                <p className="font-[var(--font-serif)] text-xs sm:text-sm text-[#b39e81] mt-0.5">
                  Ranked strongest to weakest. Equip into an open slot or sell spare copies for
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
                    className="brass-plaque min-h-[38px] px-3 py-1.5 font-[var(--font-display)] text-xs font-semibold text-[#f5d593] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Coins className="w-3.5 h-3.5 text-[#e2b053]" />
                    <span>Sell Extras (Keep Best)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCompareCardId(null)}
                  aria-label="Close comparison"
                  className="iron-btn w-9 h-9 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {compareCopies.map((copy, idx) => {
                  const slotNum = slotIndexByUid.has(copy.uid)
                    ? (slotIndexByUid.get(copy.uid) ?? 0) + 1
                    : null;
                  const inActiveDeck = slotNum !== null;
                  const inOtherDeck = !inActiveDeck && allEquippedUidSet.has(copy.uid);
                  const delta = formatDeltaBadge(copy, compareCopies[0]);
                  const copyAug = resolveCardAugment(compareCardDef.id, copy.augmentId);
                  const sellGold = getCardSellValue(
                    compareCardDef,
                    copy.stats,
                    copy.arrows,
                    copy.augmentId
                  );
                  const canSell = totalOwnedCopies > MAX_UNIT_CAPACITY;

                  return (
                    <div
                      key={copy.uid}
                      className={`p-2.5 border flex flex-col gap-2.5 ${
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
                          className={`organic-tag px-2 py-0.5 font-mono text-[10px] font-semibold ${delta.className}`}
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
                          <span className="organic-tag inline-flex items-center gap-1 px-2 py-0.5 bg-violet-950/95 text-[10px] font-mono text-violet-200 max-w-full truncate">
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
                          onClick={() => handleVaultCardClick(copy)}
                          className={`min-h-[34px] px-2.5 py-1 font-[var(--font-display)] text-xs font-semibold cursor-pointer ${
                            inActiveDeck ? 'iron-btn' : 'brass-btn font-bold'
                          }`}
                        >
                          {inActiveDeck ? `Remove (Slot #${slotNum})` : 'Add to Deck'}
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
                          className={`min-h-[32px] px-2.5 py-1 font-mono text-xs font-semibold flex items-center justify-center gap-1 ${
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
