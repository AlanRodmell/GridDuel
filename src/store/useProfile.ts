import { useCallback, useEffect, useMemo, useState } from 'react';
import { evaluateTerrainEffect } from '../data/biomes';
import {
  BOOSTER_PACKS,
  CARD_MAP,
  CARDS,
  CRAFTABLE_AUGMENT_MAP,
  MAX_COPIES_PER_CARD,
  STARTER_CARD_IDS,
  getCardSellValue,
  getStatsPowerScore,
  resolveCardAugment,
  rollCardArrows,
  rollCardInstance,
  sortCardCopies,
} from '../data/cards';
import {
  BiomeType,
  CardDef,
  DeckSlot,
  HandCard,
  PlayerProfile,
  Rarity,
  RolledCardInstance,
} from '../types/game';
import { sound } from '../utils/sound';

const STORAGE_KEY = 'aether_triad_profile_v1';
export const DECK_CAPACITY = 7;
export const MAX_DECK_SLOTS = 9;

function createStarterInventory(): Record<string, RolledCardInstance[]> {
  const inv: Record<string, RolledCardInstance[]> = {};
  for (const id of STARTER_CARD_IDS) {
    if (CARD_MAP[id]) {
      // Guarantee starter cards never roll below baseline stats or lose arrows
      inv[id] = [
        rollCardInstance(id, {
          minStatDelta: 0,
          maxStatDelta: 1,
          minArrowDelta: 0,
          maxArrowDelta: 1,
          typeUpgradeMultiplier: 1,
        }),
      ];
    }
  }
  return inv;
}

function syncOwnedCounts(
  inventory: Record<string, RolledCardInstance[]>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [cardId, list] of Object.entries(inventory)) {
    if (Array.isArray(list) && list.length > 0) {
      counts[cardId] = Math.min(MAX_COPIES_PER_CARD, list.length);
    }
  }
  return counts;
}

function buildDefaultDecksFromInventory(
  inventory: Record<string, RolledCardInstance[]>
): DeckSlot[] {
  const allInstances = Object.values(inventory).flat();

  const byPower = [...allInstances].sort(
    (a, b) =>
      getStatsPowerScore(b.stats, b.arrows.length) -
      getStatsPowerScore(a.stats, a.arrows.length)
  );
  const byArrows = [...allInstances].sort(
    (a, b) =>
      b.arrows.length - a.arrows.length ||
      getStatsPowerScore(b.stats, b.arrows.length) -
        getStatsPowerScore(a.stats, a.arrows.length)
  );
  const byMagic = [...allInstances].sort(
    (a, b) =>
      b.stats.mDef +
      (b.stats.type === 'M' ? 4 : 0) -
      (a.stats.mDef + (a.stats.type === 'M' ? 4 : 0))
  );

  const makeFullDeck = (id: string, name: string, ordered: RolledCardInstance[]): DeckSlot => {
    const cards = ordered.slice(0, DECK_CAPACITY).map((c) => c.uid);
    const slots: (string | null)[] = Array.from(
      { length: DECK_CAPACITY },
      (_, idx) => cards[idx] ?? null
    );
    return { id, name, cards, slots };
  };

  return [
    makeFullDeck('deck-1', 'Assault Hand', byPower),
    makeFullDeck('deck-2', '8-Way Web', byArrows),
    makeFullDeck('deck-3', 'Arcane Guard', byMagic),
  ];
}

const DEFAULT_INVENTORY = createStarterInventory();
const DEFAULT_OWNED = syncOwnedCounts(DEFAULT_INVENTORY);

const DEFAULT_PROFILE: PlayerProfile = {
  gold: 100,
  owned: DEFAULT_OWNED,
  inventory: DEFAULT_INVENTORY,
  decks: buildDefaultDecksFromInventory(DEFAULT_INVENTORY),
  activeDeckIndex: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  totalFlips: 0,
  cardWins: {},
  fighterWins: {},
  soundEnabled: true,
  clickToPlace: false,
};

/**
 * Normalizes a deck's 7 fixed slots [0..6], preserving exact slot indices and null gaps
 * without ever silently backfilling random unchosen cards!
 */
function normalizeDeckSlots(
  rawSlots: (string | null)[] | undefined,
  rawCards: string[],
  inventory: Record<string, RolledCardInstance[]>,
  backfillIfLegacyFull = false
): { slots: (string | null)[]; cards: string[] } {
  const allInstances = Object.values(inventory).flat();
  const byUid = new Map<string, RolledCardInstance>();
  for (const inst of allInstances) {
    byUid.set(inst.uid, inst);
  }

  const used = new Set<string>();
  const source: (string | null | undefined)[] = Array.isArray(rawSlots)
    ? rawSlots.slice(0, DECK_CAPACITY)
    : rawCards.slice(0, DECK_CAPACITY);

  const slots: (string | null)[] = Array.from({ length: DECK_CAPACITY }, (_, idx) => {
    const ref = source[idx];
    if (!ref) return null;
    if (byUid.has(ref) && !used.has(ref)) {
      used.add(ref);
      return ref;
    }
    const copies = (inventory[ref] ?? []).filter((c) => !used.has(c.uid));
    if (copies.length > 0) {
      const best = sortCardCopies(copies)[0];
      used.add(best.uid);
      return best.uid;
    }
    return null;
  });

  if (backfillIfLegacyFull && !Array.isArray(rawSlots) && used.size < DECK_CAPACITY) {
    const remaining = sortCardCopies(allInstances.filter((c) => !used.has(c.uid)));
    let rIdx = 0;
    for (let i = 0; i < DECK_CAPACITY && rIdx < remaining.length; i++) {
      if (slots[i] === null) {
        slots[i] = remaining[rIdx].uid;
        used.add(remaining[rIdx].uid);
        rIdx++;
      }
    }
  }

  return {
    slots,
    cards: slots.filter((s): s is string => Boolean(s)),
  };
}

function parseAndSanitizeProfile(raw: string): PlayerProfile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerProfile> & { deck?: string[] };
    if (!parsed || typeof parsed !== 'object') return null;

    const rawOwned: Record<string, number> = {
      ...DEFAULT_OWNED,
      ...(parsed.owned ?? {}),
    };

    const inventory: Record<string, RolledCardInstance[]> = {};

    if (parsed.inventory && typeof parsed.inventory === 'object') {
      for (const [cardId, list] of Object.entries(parsed.inventory)) {
        const cardDef = CARD_MAP[cardId];
        if (!cardDef || !Array.isArray(list)) continue;
        const seenArrowSigs = new Set<string>();
        const validCopies = list
          .filter((item) => item && typeof item.uid === 'string' && item.stats)
          .slice(0, MAX_COPIES_PER_CARD)
          .map((item) => {
            let arrows = Array.isArray(item.arrows) ? [...item.arrows] : rollCardArrows(cardDef, false);
            const sig = [...arrows].sort().join(',');
            if (seenArrowSigs.has(sig)) {
              for (let attempt = 0; attempt < 5; attempt++) {
                const candidate = rollCardArrows(cardDef, false);
                const cSig = [...candidate].sort().join(',');
                if (!seenArrowSigs.has(cSig)) {
                  arrows = candidate;
                  break;
                }
              }
            }
            seenArrowSigs.add([...arrows].sort().join(','));
            const validAugmentId =
              typeof item.augmentId === 'string' && CRAFTABLE_AUGMENT_MAP[item.augmentId]
                ? item.augmentId
                : undefined;
            return {
              uid: item.uid,
              cardId,
              stats: item.stats,
              arrows,
              ...(validAugmentId ? { augmentId: validAugmentId } : {}),
            };
          });
        if (validCopies.length > 0) {
          inventory[cardId] = sortCardCopies(validCopies);
        }
      }
    }

    // Ensure every card marked owned in legacy `owned` has matching rolled instances up to MAX_COPIES_PER_CARD
    for (const [cardId, count] of Object.entries(rawOwned)) {
      if (!CARD_MAP[cardId] || count <= 0) continue;
      const clampedCount = Math.min(MAX_COPIES_PER_CARD, count);
      const existing = inventory[cardId] ?? [];
      if (existing.length < clampedCount) {
        const needed = clampedCount - existing.length;
        const added: RolledCardInstance[] = [];
        for (let i = 0; i < needed; i++) {
          added.push(rollCardInstance(cardId, false));
        }
        inventory[cardId] = sortCardCopies([...existing, ...added]);
      }
    }

    const owned = syncOwnedCounts(inventory);

    let decks: DeckSlot[];
    if (Array.isArray(parsed.decks) && parsed.decks.length >= 1) {
      decks = parsed.decks.slice(0, MAX_DECK_SLOTS).map((d, idx) => {
        const norm = normalizeDeckSlots(
          Array.isArray(d.slots) ? d.slots : undefined,
          Array.isArray(d.cards) ? d.cards : [],
          inventory,
          !Array.isArray(d.slots)
        );
        return {
          id: d.id || `deck-${idx + 1}`,
          name: (d.name && d.name.trim()) || `Deck ${idx + 1}`,
          cards: norm.cards,
          slots: norm.slots,
        };
      });
    } else {
      const defaults = buildDefaultDecksFromInventory(inventory);
      if (Array.isArray(parsed.deck) && parsed.deck.length > 0) {
        const norm = normalizeDeckSlots(undefined, parsed.deck, inventory, true);
        defaults[0].cards = norm.cards;
        defaults[0].slots = norm.slots;
      }
      decks = defaults;
    }

    const activeDeckIndex =
      typeof parsed.activeDeckIndex === 'number' &&
      parsed.activeDeckIndex >= 0 &&
      parsed.activeDeckIndex < decks.length
        ? parsed.activeDeckIndex
        : 0;

    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      gold: typeof parsed.gold === 'number' && Number.isFinite(parsed.gold) ? Math.max(0, Math.floor(parsed.gold)) : DEFAULT_PROFILE.gold,
      owned,
      inventory,
      decks,
      activeDeckIndex,
      fighterWins: parsed.fighterWins ?? {},
      clickToPlace: Boolean(parsed.clickToPlace),
    };
  } catch {
    return null;
  }
}

function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return parseAndSanitizeProfile(raw) ?? DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export interface PackRevealItem {
  card: CardDef;
  instance: RolledCardInstance;
  isNewUnlock: boolean;
  wasOverflowSold: boolean;
  overflowGold: number;
  copyNumber: number;
}

export type AutoBuildStrategy = 'power' | 'arrows' | 'assault' | 'augments' | 'biome';

function rollCardByWeights(weights: Record<Rarity, number>, minRarity?: Rarity): CardDef {
  // Mythics are strictly excluded from shop booster packs (earned only via High-Tier RNG or Bosses)
  const rarityOrder: Rarity[] = ['common', 'rare', 'epic'];
  const minIdx = minRarity ? Math.max(0, rarityOrder.indexOf(minRarity)) : 0;
  const allowedRarities = rarityOrder.slice(minIdx);

  const totalW = allowedRarities.reduce((sum, r) => sum + weights[r], 0);
  let roll = Math.random() * totalW;
  let chosenRarity: Rarity = allowedRarities[0];
  for (const r of allowedRarities) {
    roll -= weights[r];
    if (roll <= 0) {
      chosenRarity = r;
      break;
    }
  }
  const pool = CARDS.filter((c) => c.rarity === chosenRarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function useProfile() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());

  useEffect(() => {
    sound.enabled = profile.soundEnabled;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  const activeDeck = profile.decks[profile.activeDeckIndex] ?? profile.decks[0];

  const instanceMap = useMemo(() => {
    const map: Record<string, RolledCardInstance> = {};
    for (const list of Object.values(profile.inventory)) {
      for (const inst of list) {
        map[inst.uid] = inst;
      }
    }
    return map;
  }, [profile.inventory]);

  const getInstance = useCallback(
    (uidOrCardId: string): RolledCardInstance | null => {
      if (instanceMap[uidOrCardId]) return instanceMap[uidOrCardId];
      const copies = profile.inventory[uidOrCardId];
      if (copies && copies.length > 0) {
        return [...copies].sort(
          (a, b) =>
            getStatsPowerScore(b.stats, b.arrows.length) -
            getStatsPowerScore(a.stats, a.arrows.length)
        )[0];
      }
      return null;
    },
    [instanceMap, profile.inventory]
  );

  const toggleSound = useCallback(() => {
    setProfile((prev) => {
      const next = !prev.soundEnabled;
      sound.enabled = next;
      return { ...prev, soundEnabled: next };
    });
  }, []);

  const toggleClickToPlace = useCallback(() => {
    setProfile((prev) => ({
      ...prev,
      clickToPlace: !prev.clickToPlace,
    }));
    sound.select();
  }, []);

  const selectDeckSlot = useCallback((index: number) => {
    setProfile((prev) => {
      if (index < 0 || index >= prev.decks.length) return prev;
      return { ...prev, activeDeckIndex: index };
    });
  }, []);

  /**
   * Creates a new Hearthstone-style saved deck slot (up to MAX_DECK_SLOTS = 9).
   * If duplicateFromIndex is given, copies that deck's card list; otherwise seeds with strongest owned copies.
   */
  const createDeck = useCallback(
    (customName?: string, duplicateFromIndex?: number): { ok: boolean; message?: string } => {
      let result: { ok: boolean; message?: string } = { ok: true };
      setProfile((prev) => {
        if (prev.decks.length >= MAX_DECK_SLOTS) {
          result = {
            ok: false,
            message: `Maximum of ${MAX_DECK_SLOTS} saved decks reached. Delete one to create a new deck.`,
          };
          return prev;
        }

        const sourceDeck =
          typeof duplicateFromIndex === 'number' ? prev.decks[duplicateFromIndex] : null;
        let slots: (string | null)[];
        let cards: string[];
        if (sourceDeck) {
          const norm = normalizeDeckSlots(sourceDeck.slots, sourceDeck.cards, prev.inventory);
          slots = norm.slots;
          cards = norm.cards;
        } else {
          // New custom decks start with 7 clean empty slots ready to fill!
          slots = Array.from({ length: DECK_CAPACITY }, () => null);
          cards = [];
        }

        const nextNum = prev.decks.length + 1;
        const baseName =
          customName?.trim() ||
          (sourceDeck ? `${sourceDeck.name} Copy` : `Custom Deck ${nextNum}`);
        const newDeck: DeckSlot = {
          id: `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name: baseName.slice(0, 28),
          cards,
          slots,
        };

        const nextDecks = [...prev.decks, newDeck];
        return {
          ...prev,
          decks: nextDecks,
          activeDeckIndex: nextDecks.length - 1,
        };
      });
      if (result.ok) sound.select();
      return result;
    },
    []
  );

  const renameDeck = useCallback((index: number, rawName: string) => {
    const trimmed = rawName.trim().slice(0, 28);
    if (!trimmed) return;
    setProfile((prev) => {
      if (index < 0 || index >= prev.decks.length) return prev;
      const nextDecks = prev.decks.map((d, i) =>
        i === index ? { ...d, name: trimmed } : d
      );
      return { ...prev, decks: nextDecks };
    });
  }, []);

  const deleteDeck = useCallback((index: number): { ok: boolean; message?: string } => {
    let result: { ok: boolean; message?: string } = { ok: true };
    setProfile((prev) => {
      if (prev.decks.length <= 1) {
        result = { ok: false, message: 'Keep at least 1 saved deck.' };
        return prev;
      }
      if (index < 0 || index >= prev.decks.length) {
        result = { ok: false, message: 'Deck not found.' };
        return prev;
      }
      const nextDecks = prev.decks.filter((_, i) => i !== index);
      let nextActive = prev.activeDeckIndex;
      if (nextActive >= nextDecks.length) {
        nextActive = nextDecks.length - 1;
      } else if (index < nextActive) {
        nextActive = Math.max(0, nextActive - 1);
      }
      return {
        ...prev,
        decks: nextDecks,
        activeDeckIndex: nextActive,
      };
    });
    if (result.ok) sound.select();
    return result;
  }, []);

  /**
   * Equips or unequips a specific rolled card instance (by uid) or cardId across the active deck's
   * 7 fixed slots [0..6].
   * - Removing a card sets its exact slot to `null` (leaving a dashed empty card outline without shifting other cards!).
   * - Adding a card places it into `preferredSlotIndex` (if provided) or the first empty `null` slot.
   * - If all 7 slots are full and no `preferredSlotIndex` is targeted, never reorders or ejects cards behind your back!
   */
  const toggleDeckCard = useCallback(
    (uidOrCardId: string, preferredSlotIndex?: number): { ok: boolean; message?: string; slotIndex?: number } => {
      let result: { ok: boolean; message?: string; slotIndex?: number } = { ok: true };
      setProfile((prev) => {
        const allInstances = Object.values(prev.inventory).flat();
        const byUid = new Map(allInstances.map((i) => [i.uid, i]));

        const idx = prev.activeDeckIndex;
        const current = prev.decks[idx];
        const norm = normalizeDeckSlots(current.slots, current.cards, prev.inventory);
        const nextSlots = [...norm.slots];

        let targetInst = byUid.get(uidOrCardId) ?? null;

        if (!targetInst) {
          const copies = prev.inventory[uidOrCardId] ?? [];
          if (copies.length === 0) {
            result = { ok: false, message: 'Unlock this card first.' };
            return prev;
          }
          const unequipped = sortCardCopies(
            copies.filter((c) => !nextSlots.includes(c.uid))
          )[0];
          targetInst = unequipped ?? copies[0];
        }

        const existingSlotIdx = nextSlots.indexOf(targetInst.uid);

        if (existingSlotIdx !== -1) {
          // Remove in place — leaves a clean `null` gap at `existingSlotIdx` without moving any other slot!
          nextSlots[existingSlotIdx] = null;
          result = { ok: true, slotIndex: existingSlotIdx };
        } else if (
          typeof preferredSlotIndex === 'number' &&
          preferredSlotIndex >= 0 &&
          preferredSlotIndex < DECK_CAPACITY
        ) {
          nextSlots[preferredSlotIndex] = targetInst.uid;
          result = { ok: true, slotIndex: preferredSlotIndex };
        } else {
          const firstEmptyIdx = nextSlots.findIndex((s) => s === null);
          if (firstEmptyIdx === -1) {
            result = {
              ok: false,
              message: 'Deck full (7/7) — click a card in your deck above to open a slot.',
            };
            return prev;
          }
          nextSlots[firstEmptyIdx] = targetInst.uid;
          result = { ok: true, slotIndex: firstEmptyIdx };
        }

        const nextCards = nextSlots.filter((s): s is string => Boolean(s));
        const nextDecks = prev.decks.map((d, i) =>
          i === idx ? { ...d, slots: nextSlots, cards: nextCards } : d
        );
        return { ...prev, decks: nextDecks };
      });
      return result;
    },
    []
  );

  const clearActiveDeck = useCallback(() => {
    setProfile((prev) => {
      const emptySlots: (string | null)[] = Array.from({ length: DECK_CAPACITY }, () => null);
      const nextDecks = prev.decks.map((d, i) =>
        i === prev.activeDeckIndex ? { ...d, slots: emptySlots, cards: [] } : d
      );
      return { ...prev, decks: nextDecks };
    });
    sound.select();
  }, []);

  const autoBuildActiveDeck = useCallback(
    (strategy: AutoBuildStrategy, targetBiomes?: BiomeType[], onlyEmptySlots = false) => {
      setProfile((prev) => {
        const allInstances = Object.values(prev.inventory).flat();
        let ordered: RolledCardInstance[];

        if (strategy === 'biome' && targetBiomes && targetBiomes.length > 0) {
          const biomeFit = (inst: RolledCardInstance) => {
            const def = CARD_MAP[inst.cardId];
            if (!def) return 0;
            let terrainSum = 0;
            for (const b of targetBiomes) {
              const ev = evaluateTerrainEffect(b, def);
              if (ev && ev.hasEffect) {
                terrainSum += ev.isPositive ? ev.netScore * 4.5 : ev.netScore * 3.5;
              }
            }
            const augBonus = resolveCardAugment(inst.cardId, inst.augmentId) ? 5 : 0;
            return terrainSum + getStatsPowerScore(inst.stats, inst.arrows.length) + augBonus;
          };
          ordered = [...allInstances].sort((a, b) => biomeFit(b) - biomeFit(a));
        } else if (strategy === 'power') {
          ordered = [...allInstances].sort(
            (a, b) =>
              getStatsPowerScore(b.stats, b.arrows.length) -
                getStatsPowerScore(a.stats, a.arrows.length) ||
              b.arrows.length - a.arrows.length
          );
        } else if (strategy === 'arrows') {
          ordered = [...allInstances].sort(
            (a, b) =>
              b.arrows.length - a.arrows.length ||
              getStatsPowerScore(b.stats, b.arrows.length) -
                getStatsPowerScore(a.stats, a.arrows.length)
          );
        } else if (strategy === 'augments') {
          ordered = [...allInstances].sort((a, b) => {
            const aAug = resolveCardAugment(a.cardId, a.augmentId) ? 16 : 0;
            const bAug = resolveCardAugment(b.cardId, b.augmentId) ? 16 : 0;
            return (
              bAug +
              getStatsPowerScore(b.stats, b.arrows.length) -
              (aAug + getStatsPowerScore(a.stats, a.arrows.length))
            );
          });
        } else {
          const typeScore = (t: RolledCardInstance['stats']['type']) =>
            t === 'A' ? 30 : t === 'X' ? 18 : 0;
          ordered = [...allInstances].sort(
            (a, b) =>
              typeScore(b.stats.type) +
              getStatsPowerScore(b.stats, b.arrows.length) -
              (typeScore(a.stats.type) + getStatsPowerScore(a.stats, a.arrows.length))
          );
        }

        const current = prev.decks[prev.activeDeckIndex];
        let nextSlots: (string | null)[];

        if (onlyEmptySlots && current) {
          const norm = normalizeDeckSlots(current.slots, current.cards, prev.inventory);
          nextSlots = [...norm.slots];
          const used = new Set(norm.cards);
          const candidates = ordered.filter((c) => !used.has(c.uid));
          let cIdx = 0;
          for (let i = 0; i < DECK_CAPACITY && cIdx < candidates.length; i++) {
            if (nextSlots[i] === null) {
              nextSlots[i] = candidates[cIdx].uid;
              cIdx++;
            }
          }
        } else {
          const picked = ordered.slice(0, DECK_CAPACITY).map((c) => c.uid);
          nextSlots = Array.from({ length: DECK_CAPACITY }, (_, idx) => picked[idx] ?? null);
        }

        const nextCards = nextSlots.filter((s): s is string => Boolean(s));
        const nextDecks = prev.decks.map((d, i) =>
          i === prev.activeDeckIndex ? { ...d, slots: nextSlots, cards: nextCards } : d
        );
        return { ...prev, decks: nextDecks };
      });
      sound.select();
    },
    []
  );

  /**
   * Buys a new rolled copy of a card in the Shop (up to MAX_COPIES_PER_CARD = 5 copies).
   * Returns the newly rolled instance so the UI can show its rolled stats & arrows!
   */
  const buyCard = useCallback((cardId: string): RolledCardInstance | null => {
    const card = CARD_MAP[cardId];
    if (!card || card.rarity === 'mythic' || card.price <= 0) return null;
    const currentCopies = profile.inventory[cardId] ?? [];
    if (profile.gold < card.price || currentCopies.length >= MAX_COPIES_PER_CARD) {
      return null;
    }

    // Ensure new roll has a fresh arrow layout compared to existing owned copies when possible
    let rolled = rollCardInstance(cardId, false);
    const existingArrowSigs = new Set(
      currentCopies.map((c) => [...c.arrows].sort().join(','))
    );
    for (let attempt = 0; attempt < 6; attempt++) {
      const sig = [...rolled.arrows].sort().join(',');
      if (!existingArrowSigs.has(sig)) break;
      rolled = {
        ...rolled,
        arrows: rollCardArrows(card, false),
      };
    }

    setProfile((prev) => {
      const existing = prev.inventory[cardId] ?? [];
      if (prev.gold < card.price || existing.length >= MAX_COPIES_PER_CARD) return prev;
      const nextInv = {
        ...prev.inventory,
        [cardId]: sortCardCopies([...existing, rolled]),
      };
      return {
        ...prev,
        gold: prev.gold - card.price,
        inventory: nextInv,
        owned: syncOwnedCounts(nextInv),
      };
    });
    sound.coin();
    return rolled;
  }, [profile.gold, profile.inventory]);

  /**
   * Sells a specific rolled card instance for Gold.
   * Prevents selling if it is the player's last remaining 7 cards total across the entire collection.
   */
  const sellCardInstance = useCallback(
    (
      instanceUid: string
    ): { ok: boolean; goldEarned: number; cardName?: string; message?: string } => {
      const target = instanceMap[instanceUid];
      if (!target) {
        return { ok: false, goldEarned: 0, message: 'Card copy not found.' };
      }
      const totalOwnedInstances = Object.values(profile.inventory).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      if (totalOwnedInstances <= DECK_CAPACITY) {
        return {
          ok: false,
          goldEarned: 0,
          message: `You must keep at least ${DECK_CAPACITY} cards in your collection for 5×3 battle.`,
        };
      }

      const card = CARD_MAP[target.cardId];
      if (!card) return { ok: false, goldEarned: 0 };
      const goldEarned = getCardSellValue(card, target.stats, target.arrows, target.augmentId);

      setProfile((prev) => {
        const copies = prev.inventory[target.cardId] ?? [];
        if (!copies.some((c) => c.uid === instanceUid)) return prev;

        const nextCopies = sortCardCopies(copies.filter((c) => c.uid !== instanceUid));
        const nextInv = { ...prev.inventory };
        if (nextCopies.length > 0) {
          nextInv[target.cardId] = nextCopies;
        } else {
          delete nextInv[target.cardId];
        }

        const nextDecks = prev.decks.map((d) => {
          const rawSlots = (d.slots ?? d.cards).map((s) => (s === instanceUid ? null : s));
          const norm = normalizeDeckSlots(rawSlots, d.cards, nextInv);
          return {
            ...d,
            slots: norm.slots,
            cards: norm.cards,
          };
        });

        return {
          ...prev,
          gold: prev.gold + goldEarned,
          inventory: nextInv,
          owned: syncOwnedCounts(nextInv),
          decks: nextDecks,
        };
      });

      sound.coin();
      return { ok: true, goldEarned, cardName: card.name };
    },
    [instanceMap, profile.inventory]
  );

  /**
   * Bulk-sells all extra copies across the collection (or for a specific cardId),
   * keeping the highest-scored copy, all equipped copies, AND any copy with a crafted Runeforge augment.
   */
  const sellExtraCopies = useCallback(
    (
      specificCardId?: string
    ): { soldCount: number; goldEarned: number } => {
      const equippedUids = new Set(profile.decks.flatMap((d) => d.cards));
      const cardIdsToCheck = specificCardId
        ? [specificCardId]
        : Object.keys(profile.inventory);

      let soldCount = 0;
      let goldEarned = 0;
      const uidsToSell = new Set<string>();

      for (const cid of cardIdsToCheck) {
        const copies = profile.inventory[cid] ?? [];
        if (copies.length <= 1) continue;
        const card = CARD_MAP[cid];
        if (!card) continue;

        const sorted = sortCardCopies(copies);
        const bestUid = sorted[0].uid;

        for (const inst of sorted) {
          if (inst.uid === bestUid) continue;
          if (equippedUids.has(inst.uid)) continue;
          if (inst.augmentId) continue; // Protect Runeforged copies from bulk-sell!
          uidsToSell.add(inst.uid);
          soldCount += 1;
          goldEarned += getCardSellValue(card, inst.stats, inst.arrows, inst.augmentId);
        }
      }

      if (soldCount === 0) {
        return { soldCount: 0, goldEarned: 0 };
      }

      setProfile((prev) => {
        const nextInv: Record<string, RolledCardInstance[]> = {};
        for (const [cid, list] of Object.entries(prev.inventory)) {
          const filtered = sortCardCopies(list.filter((inst) => !uidsToSell.has(inst.uid)));
          if (filtered.length > 0) {
            nextInv[cid] = filtered;
          }
        }
        return {
          ...prev,
          gold: prev.gold + goldEarned,
          inventory: nextInv,
          owned: syncOwnedCounts(nextInv),
        };
      });

      sound.coin();
      return { soldCount, goldEarned };
    },
    [profile.decks, profile.inventory]
  );

  const openBoosterPack = useCallback(
    (packId: 'tavern-pack' | 'royal-vault' | 'mythic-chest'): PackRevealItem[] | null => {
      const pack = BOOSTER_PACKS.find((p) => p.id === packId);
      if (!pack || profile.gold < pack.price) return null;

      const pulls: CardDef[] = [];
      for (let i = 0; i < pack.cardCount; i++) {
        const minRarity =
          i === pack.cardCount - 1 && pack.guaranteedMinRarity
            ? pack.guaranteedMinRarity
            : undefined;
        pulls.push(rollCardByWeights(pack.weights, minRarity));
      }

      const nextInv: Record<string, RolledCardInstance[]> = {};
      for (const [cid, list] of Object.entries(profile.inventory)) {
        nextInv[cid] = [...list];
      }

      let overflowTotal = 0;
      const revealItems: PackRevealItem[] = pulls.map((card) => {
        const existing = nextInv[card.id] ?? [];
        const existingSigs = new Set(existing.map((c) => [...c.arrows].sort().join(',')));
        let instance = rollCardInstance(card.id, false);
        for (let attempt = 0; attempt < 6; attempt++) {
          const sig = [...instance.arrows].sort().join(',');
          if (!existingSigs.has(sig)) break;
          instance = { ...instance, arrows: rollCardArrows(card, false) };
        }
        const isNewUnlock = existing.length === 0;

        if (existing.length >= MAX_COPIES_PER_CARD) {
          const overflowGold = getCardSellValue(card, instance.stats, instance.arrows, instance.augmentId);
          overflowTotal += overflowGold;
          return {
            card,
            instance,
            isNewUnlock: false,
            wasOverflowSold: true,
            overflowGold,
            copyNumber: MAX_COPIES_PER_CARD,
          };
        }

        const updated = sortCardCopies([...existing, instance]);
        nextInv[card.id] = updated;
        return {
          card,
          instance,
          isNewUnlock,
          wasOverflowSold: false,
          overflowGold: 0,
          copyNumber: updated.length,
        };
      });

      setProfile((prev) => ({
        ...prev,
        gold: prev.gold - pack.price + overflowTotal,
        inventory: nextInv,
        owned: syncOwnedCounts(nextInv),
      }));
      sound.packOpen();
      return revealItems;
    },
    [profile.gold, profile.inventory]
  );

  const recordMatchOutcome = useCallback(
    (params: {
      fighterId: string;
      winner: 'player' | 'rival' | 'draw';
      goldEarned: number;
      flipsMade: number;
      usedCardIds: string[];
    }) => {
      setProfile((prev) => {
        const nextStreak = params.winner === 'player' ? prev.streak + 1 : 0;
        const nextCardWins = { ...prev.cardWins };
        const nextFighterWins = { ...(prev.fighterWins ?? {}) };
        if (params.winner === 'player') {
          for (const id of params.usedCardIds) {
            nextCardWins[id] = (nextCardWins[id] ?? 0) + 1;
          }
          nextFighterWins[params.fighterId] = (nextFighterWins[params.fighterId] ?? 0) + 1;
        }
        return {
          ...prev,
          gold: prev.gold + params.goldEarned,
          wins: prev.wins + (params.winner === 'player' ? 1 : 0),
          losses: prev.losses + (params.winner === 'rival' ? 1 : 0),
          draws: prev.draws + (params.winner === 'draw' ? 1 : 0),
          streak: nextStreak,
          bestStreak: Math.max(prev.bestStreak, nextStreak),
          totalFlips: prev.totalFlips + params.flipsMade,
          cardWins: nextCardWins,
          fighterWins: nextFighterWins,
        };
      });
    },
    []
  );

  /**
   * Claims a specific rolled HandCard spoil from a defeated rival (or RNG Mythic drop).
   * Adds the exact rolled instance (including any Boss Runeforge augment!) to your inventory,
   * or auto-sells for Gold if already at 5/5 copies!
   */
  const claimSpoilCard = useCallback(
    (
      spoilCard: HandCard
    ): { isNew: boolean; wasOverflow: boolean; bonusGold: number; copyCount: number } => {
      const card = CARD_MAP[spoilCard.cardId];
      if (!card) {
        return { isNew: false, wasOverflow: false, bonusGold: 0, copyCount: 0 };
      }

      const existing = profile.inventory[card.id] ?? [];
      const isNew = existing.length === 0;
      const wasOverflow = existing.length >= MAX_COPIES_PER_CARD;
      const bonusGold = wasOverflow
        ? getCardSellValue(card, spoilCard.stats, spoilCard.arrows, spoilCard.augmentId)
        : 0;

      const newInstance: RolledCardInstance = {
        uid: `inst-${card.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        cardId: card.id,
        stats: { ...spoilCard.stats },
        arrows: [...spoilCard.arrows],
        ...(spoilCard.augmentId ? { augmentId: spoilCard.augmentId } : {}),
      };

      setProfile((prev) => {
        const cur = prev.inventory[card.id] ?? [];
        if (cur.length >= MAX_COPIES_PER_CARD) {
          return {
            ...prev,
            gold: prev.gold + bonusGold,
          };
        }
        const nextInv = {
          ...prev.inventory,
          [card.id]: sortCardCopies([...cur, newInstance]),
        };
        return {
          ...prev,
          inventory: nextInv,
          owned: syncOwnedCounts(nextInv),
        };
      });

      sound.packReveal(card.rarity === 'epic' || card.rarity === 'mythic' || isNew);
      return {
        isNew,
        wasOverflow,
        bonusGold,
        copyCount: wasOverflow ? MAX_COPIES_PER_CARD : existing.length + 1,
      };
    },
    [profile.inventory]
  );

  /**
   * Crafts and imbues a chosen Augment Rune onto a specific owned card copy using Gold.
   * Replaces any previously crafted augment on that copy; innate Mythic traits are preserved.
   */
  const craftAugmentOnCopy = useCallback(
    (
      instanceUid: string,
      augmentId: string
    ): {
      ok: boolean;
      message?: string;
      cardName?: string;
      runeName?: string;
      cost?: number;
      replaced?: boolean;
    } => {
      const rune = CRAFTABLE_AUGMENT_MAP[augmentId];
      if (!rune) {
        return { ok: false, message: 'Unknown augment rune.' };
      }

      const targetInst = instanceMap[instanceUid];
      if (!targetInst) {
        return { ok: false, message: 'Card copy not found in your collection.' };
      }

      const cardDef = CARD_MAP[targetInst.cardId];
      if (!cardDef) {
        return { ok: false, message: 'Card definition not found.' };
      }

      if (cardDef.augment) {
        return {
          ok: false,
          message: `${cardDef.name} already carries an innate Mythic Legendary trait (${cardDef.augment.name}).`,
        };
      }

      if (targetInst.augmentId === rune.id) {
        return {
          ok: false,
          message: `This copy already has ${rune.name} imbued.`,
        };
      }

      if (profile.gold < rune.craftCost) {
        return {
          ok: false,
          message: `Need ${rune.craftCost.toLocaleString()}g to forge ${rune.name}.`,
        };
      }

      const replaced = Boolean(targetInst.augmentId);

      setProfile((prev) => {
        if (prev.gold < rune.craftCost) return prev;
        const list = prev.inventory[targetInst.cardId] ?? [];
        const updatedList = sortCardCopies(
          list.map((inst) =>
            inst.uid === instanceUid ? { ...inst, augmentId: rune.id } : inst
          )
        );
        return {
          ...prev,
          gold: prev.gold - rune.craftCost,
          inventory: {
            ...prev.inventory,
            [targetInst.cardId]: updatedList,
          },
        };
      });

      sound.packReveal(rune.tier === 'sovereign' || rune.tier === 'major');
      return {
        ok: true,
        cardName: cardDef.name,
        runeName: rune.name,
        cost: rune.craftCost,
        replaced,
      };
    },
    [instanceMap, profile.gold]
  );

  const exportSaveJson = useCallback((): string => {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile,
      },
      null,
      2
    );
  }, [profile]);

  const importSaveJson = useCallback(
    (rawJson: string): { ok: boolean; message: string } => {
      try {
        const wrapper = JSON.parse(rawJson) as { profile?: unknown } & Record<string, unknown>;
        const candidateRaw =
          wrapper && typeof wrapper === 'object' && wrapper.profile && typeof wrapper.profile === 'object'
            ? JSON.stringify(wrapper.profile)
            : rawJson;
        const sanitized = parseAndSanitizeProfile(candidateRaw);
        if (!sanitized || Object.keys(sanitized.inventory).length === 0) {
          return { ok: false, message: 'Invalid or empty GridDuel save file.' };
        }
        setProfile(sanitized);
        sound.victory();
        return {
          ok: true,
          message: `Restored campaign (${sanitized.wins}W–${sanitized.losses}L · ${sanitized.gold.toLocaleString()}g).`,
        };
      } catch {
        return { ok: false, message: 'Could not parse save JSON file.' };
      }
    },
    []
  );

  const resetProfile = useCallback(() => {
    const freshInv = createStarterInventory();
    const freshProfile: PlayerProfile = {
      ...DEFAULT_PROFILE,
      owned: syncOwnedCounts(freshInv),
      inventory: freshInv,
      decks: buildDefaultDecksFromInventory(freshInv),
      activeDeckIndex: 0,
      soundEnabled: profile.soundEnabled,
      clickToPlace: Boolean(profile.clickToPlace),
    };
    setProfile(freshProfile);
    sound.select();
  }, [profile.clickToPlace, profile.soundEnabled]);

  const ownedUniqueCount = CARDS.filter((c) => (profile.owned[c.id] ?? 0) > 0).length;
  const totalCopiesCount = Object.values(profile.inventory).reduce(
    (sum, list) => sum + list.length,
    0
  );

  return {
    profile,
    activeDeck,
    instanceMap,
    getInstance,
    ownedUniqueCount,
    totalCopiesCount,
    totalCards: CARDS.length,
    toggleSound,
    toggleClickToPlace,
    selectDeckSlot,
    createDeck,
    renameDeck,
    deleteDeck,
    toggleDeckCard,
    clearActiveDeck,
    autoBuildActiveDeck,
    buyCard,
    sellCardInstance,
    sellExtraCopies,
    openBoosterPack,
    craftAugmentOnCopy,
    recordMatchOutcome,
    claimSpoilCard,
    exportSaveJson,
    importSaveJson,
    resetProfile,
  };
}
