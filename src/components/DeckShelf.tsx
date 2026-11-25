import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  CARD_MAP,
  getCardThumbUrl,
  getStatsPowerScore,
  resolveCardAugment,
} from '../data/cards';
import { POWER_CARD_MAP } from '../data/powerCards';
import { MAX_DECK_SLOTS, getUnitCapacityForScale } from '../store/useProfile';
import { BoardScale, DeckSlot, RolledCardInstance } from '../types/game';
import { sound } from '../utils/sound';

interface DeckShelfProps {
  decks: DeckSlot[];
  activeDeckIndex: number;
  boardScale?: BoardScale;
  inventory: Record<string, RolledCardInstance[]>;
  onSelectDeck: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
}

export const DeckShelf: React.FC<DeckShelfProps> = ({
  decks,
  activeDeckIndex,
  boardScale = '6x3',
  inventory,
  onSelectDeck,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
}) => {
  const unitCapacity = getUnitCapacityForScale(boardScale);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');

  const instanceByUid = useMemo(() => {
    const map: Record<string, RolledCardInstance> = {};
    for (const list of Object.values(inventory)) {
      for (const inst of list) {
        map[inst.uid] = inst;
      }
    }
    return map;
  }, [inventory]);

  const startRename = (index: number, currentName: string) => {
    sound.select();
    setEditingIndex(index);
    setDraftName(currentName);
  };

  const commitRename = () => {
    if (editingIndex !== null && draftName.trim()) {
      onRenameDeck(editingIndex, draftName.trim());
    }
    setEditingIndex(null);
    setDraftName('');
  };

  const canAddDeck = decks.length < MAX_DECK_SLOTS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-[var(--font-display)] text-sm sm:text-base font-bold text-[#f3d492] tracking-wide">
            Saved Warbands
          </h3>
          <span className="px-2 py-0.5 rounded-[2px] basalt-recess font-mono text-[11px] font-semibold text-[#cbb89a]">
            {decks.length} / {MAX_DECK_SLOTS}
          </span>
        </div>

        <button
          type="button"
          disabled={!canAddDeck}
          onClick={() => onCreateDeck()}
          className={`min-h-[34px] px-3 py-1 rounded-[3px] font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
            canAddDeck
              ? 'brass-plaque text-[#f5d593] hover:border-[#d8a243] cursor-pointer'
              : 'basalt-recess text-[#6e5f4c] cursor-not-allowed'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Deck</span>
        </button>
      </div>

      {/* Forged Deck Box Shelf */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {decks.map((deck, idx) => {
          const isSelected = idx === activeDeckIndex;
          const isEditing = editingIndex === idx;

          const rawSlots = deck.slots ?? deck.cards;
          const instances = rawSlots
            .slice(0, unitCapacity)
            .map((uid) => (uid ? instanceByUid[uid] : undefined))
            .filter((inst): inst is RolledCardInstance => Boolean(inst));
          const relicDef = deck.powerSlot ? POWER_CARD_MAP[deck.powerSlot] ?? null : null;

          // Pick the strongest card in the deck as the deck box cover art
          const coverInst =
            [...instances].sort(
              (a, b) =>
                getStatsPowerScore(b.stats, b.arrows.length) -
                getStatsPowerScore(a.stats, a.arrows.length)
            )[0] ?? null;
          const coverCard = coverInst ? CARD_MAP[coverInst.cardId] ?? null : null;

          const totalArrows = instances.reduce((sum, c) => sum + c.arrows.length, 0);
          const augCount = instances.filter((c) =>
            Boolean(resolveCardAugment(c.cardId, c.augmentId))
          ).length;

          return (
            <div
              key={deck.id}
              onClick={() => {
                if (isEditing) return;
                sound.select();
                onSelectDeck(idx);
              }}
              className={`group relative overflow-hidden rounded-[4px] border p-3 transition-colors cursor-pointer ${
                isSelected
                  ? 'brass-panel border-[#cf9a42]'
                  : 'basalt-recess hover:border-[#6e522b]'
              }`}
            >
              {/* Subtle Cover Art Wash */}
              {coverCard && (
                <div className="pointer-events-none absolute right-0 inset-y-0 w-28 opacity-20 group-hover:opacity-30 transition-opacity">
                  <img
                    src={getCardThumbUrl(coverCard.image)}
                    alt=""
                    width={320}
                    height={320}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover object-top ${coverCard.artFilter ?? ''}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#120e0b] via-[#120e0b]/60 to-transparent" />
                </div>
              )}

              <div className="relative z-10 flex items-center gap-3">
                {/* Cover Medallion */}
                <div
                  className={`w-11 h-14 rounded-[2px] overflow-hidden border-2 shrink-0 ${
                    isSelected ? 'border-[#e0ae53]' : 'border-[#4b3b2b]'
                  }`}
                >
                  {coverCard && (
                    <img
                      src={getCardThumbUrl(coverCard.image)}
                      alt={deck.name}
                      width={320}
                      height={320}
                      loading="lazy"
                      decoding="async"
                      className={`w-full h-full object-cover object-top ${coverCard.artFilter ?? ''}`}
                    />
                  )}
                </div>

                {/* Deck Info & Inline Rename */}
                <div className="min-w-0 flex-1 space-y-1">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitRename();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        maxLength={28}
                        autoFocus
                        aria-label="Deck name"
                        className="w-full min-w-0 px-2 py-1 rounded-[2px] bg-[#0d0a08] border border-[#d4a046] text-xs font-semibold text-[#f5e7cc] focus:outline-none"
                      />
                      <button
                        type="submit"
                        aria-label="Save deck name"
                        className="p-1 rounded-[2px] brass-btn cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        aria-label="Cancel rename"
                        className="p-1 rounded-[2px] iron-btn cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`font-[var(--font-display)] text-sm font-bold leading-snug ${
                          isSelected ? 'text-[#f6dfb0]' : 'text-[#e5d6bc]'
                        }`}
                      >
                        {deck.name}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#e2b053] text-[#170f06] text-[9.5px] font-[var(--font-display)] font-bold uppercase tracking-wider shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-[#a69277]">
                    <span className={instances.length === unitCapacity ? 'text-emerald-400' : 'text-[#f0c76e]'}>
                      {instances.length}/{unitCapacity} Units
                    </span>
                    {relicDef && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5 text-sky-300">
                          <Sparkles className="w-2.5 h-2.5" />
                          {relicDef.code}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span className="text-[#e8d5b3]">{totalArrows}▲</span>
                    {augCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5 text-violet-300">
                          <Wand2 className="w-2.5 h-2.5" />
                          {augCount}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Quick Deck Actions */}
                  {!isEditing && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 pt-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => startRename(idx, deck.name)}
                        title="Rename deck"
                        className="iron-btn px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Rename</span>
                      </button>
                      {canAddDeck && (
                        <button
                          type="button"
                          onClick={() => onCreateDeck(undefined, idx)}
                          title="Duplicate deck"
                          className="iron-btn px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Copy</span>
                        </button>
                      )}
                      {decks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteDeck(idx)}
                          title="Delete deck"
                          className="iron-btn hover:border-rose-500/60 hover:text-rose-300 px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Dashed "+ New Deck" Slot */}
        {canAddDeck && (
          <button
            type="button"
            onClick={() => onCreateDeck()}
            className="rounded-[4px] border border-dashed border-[#4e3f2f] hover:border-[#c89640] bg-[#110d0a] hover:bg-[#1a140f] p-4 flex items-center justify-center gap-2 font-[var(--font-display)] text-xs font-semibold text-[#a59277] hover:text-[#f2d089] transition-colors cursor-pointer min-h-[82px]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Saved Deck</span>
          </button>
        )}
      </div>
    </div>
  );
};
