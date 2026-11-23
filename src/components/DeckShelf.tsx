import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Pencil,
  Plus,
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
import { DECK_CAPACITY, MAX_DECK_SLOTS } from '../store/useProfile';
import { DeckSlot, RolledCardInstance } from '../types/game';
import { sound } from '../utils/sound';

interface DeckShelfProps {
  decks: DeckSlot[];
  activeDeckIndex: number;
  inventory: Record<string, RolledCardInstance[]>;
  onSelectDeck: (index: number) => void;
  onCreateDeck: (name?: string, duplicateFromIndex?: number) => { ok: boolean; message?: string };
  onRenameDeck: (index: number, newName: string) => void;
  onDeleteDeck: (index: number) => { ok: boolean; message?: string };
}

export const DeckShelf: React.FC<DeckShelfProps> = ({
  decks,
  activeDeckIndex,
  inventory,
  onSelectDeck,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
}) => {
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
          <h3 className="font-[var(--font-display)] text-sm sm:text-base font-bold text-amber-200 tracking-wide">
            Saved Decks
          </h3>
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 font-mono text-[11px] font-semibold text-slate-300">
            {decks.length} / {MAX_DECK_SLOTS}
          </span>
        </div>

        <button
          type="button"
          disabled={!canAddDeck}
          onClick={() => onCreateDeck()}
          className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
            canAddDeck
              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-amber-200 cursor-pointer'
              : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Deck</span>
        </button>
      </div>

      {/* Hearthstone-Style Deck Box Shelf */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {decks.map((deck, idx) => {
          const isSelected = idx === activeDeckIndex;
          const isEditing = editingIndex === idx;

          const instances = deck.cards
            .map((uid) => instanceByUid[uid])
            .filter((inst): inst is RolledCardInstance => Boolean(inst));

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
              className={`group relative overflow-hidden rounded-2xl border p-3 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#1e2b4b] via-[#15203a] to-[#11192e] border-amber-400 shadow-[0_8px_22px_rgba(245,158,11,0.22)]'
                  : 'bg-[#0c1322] border-slate-800 hover:border-slate-600'
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
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0c1322] via-[#0c1322]/60 to-transparent" />
                </div>
              )}

              <div className="relative z-10 flex items-center gap-3">
                {/* Cover Medallion */}
                <div
                  className={`w-11 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${
                    isSelected ? 'border-amber-400' : 'border-slate-700'
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
                        className="w-full min-w-0 px-2 py-1 rounded-md bg-slate-950 border border-amber-400/70 text-xs font-semibold text-white focus:outline-none"
                      />
                      <button
                        type="submit"
                        aria-label="Save deck name"
                        className="p-1 rounded-md bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        aria-label="Cancel rename"
                        className="p-1 rounded-md bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`font-[var(--font-display)] text-sm font-bold leading-snug ${
                          isSelected ? 'text-amber-200' : 'text-slate-100'
                        }`}
                      >
                        {deck.name}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9.5px] font-bold uppercase tracking-wider shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-slate-400">
                    <span className={instances.length === DECK_CAPACITY ? 'text-emerald-300' : 'text-amber-300'}>
                      {instances.length}/{DECK_CAPACITY} Cards
                    </span>
                    <span>·</span>
                    <span className="text-sky-300">{totalArrows}▲</span>
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
                        className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-[10px] font-medium text-slate-300 hover:text-amber-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Rename</span>
                      </button>
                      {canAddDeck && (
                        <button
                          type="button"
                          onClick={() => onCreateDeck(undefined, idx)}
                          title="Duplicate deck"
                          className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-[10px] font-medium text-slate-300 hover:text-sky-200 inline-flex items-center gap-1 cursor-pointer"
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
                          className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-rose-950/80 border border-slate-700/80 hover:border-rose-500/40 text-[10px] font-medium text-slate-400 hover:text-rose-200 inline-flex items-center gap-1 cursor-pointer"
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
            className="rounded-2xl border border-dashed border-slate-700 hover:border-amber-400/60 bg-[#090f1d] hover:bg-[#10182b] p-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-200 transition-colors cursor-pointer min-h-[82px]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Saved Deck</span>
          </button>
        )}
      </div>
    </div>
  );
};
