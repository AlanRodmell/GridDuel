import React from 'react';
import { Wand2, X } from 'lucide-react';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#11192c] border border-slate-700/70 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-600 mx-auto mt-2.5" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2
            id="rules-modal-title"
            className="font-[var(--font-display)] text-lg font-bold text-amber-200 tracking-wide"
          >
            Tetra Master &amp; Augment Guide
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 text-sm text-slate-300 leading-relaxed">
          {/* 1. The 4x4 Board & 7-Card Hands */}
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold text-amber-300 tracking-wide">
              1. The 4×4 Tactical Board &amp; 7-Card Hands
            </h3>
            <p>
              Each duel is played on a <strong>4×4 grid (16 tiles)</strong> with{' '}
              <strong>2 randomly placed sealed obsidian tiles</strong> and 14 open sockets. You and
              your rival each bring a hand of <strong>7 cards</strong> and take turns filling every
              open socket on the board. Control the most cards (Blue vs Crimson) when all 14 cards
              are played to win!
            </p>
          </section>

          {/* 2. Card Arrows & Captures */}
          <section className="space-y-1.5 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-semibold text-amber-300 tracking-wide">
              2. Arrows, Clashes &amp; Combos
            </h3>
            <p>
              Every rolled card copy has its own golden arrows around its 8 edges and corners:
            </p>
            <ul className="space-y-1.5 list-disc pl-5 text-slate-300">
              <li>
                <strong className="text-slate-100">Unopposed Capture:</strong> Point an arrow at an
                adjacent rival card that has <em>no arrow pointing back</em> to capture it
                instantly without a battle.
              </li>
              <li>
                <strong className="text-slate-100">Arrow Clash:</strong> When your card’s arrow
                points at a rival card that points an arrow <em>back at yours</em>, a Card Clash
                erupts using the 4-character stat code.
              </li>
              <li>
                <strong className="text-slate-100">Combo Chain:</strong> Any card won in an Arrow
                Clash immediately captures all adjacent enemy cards that <em>its</em> arrows point
                toward!
              </li>
            </ul>
          </section>

          {/* 3. Battlefield Augments & Runeforge Crafting */}
          <section className="space-y-1.5 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-semibold text-violet-300 tracking-wide flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              <span>3. Battlefield Augments &amp; Shop Runeforge</span>
            </h3>
            <p>
              Augments are rare battlefield powers that trigger when a card is placed on the 4×4
              grid. Only <strong>5 Mythic Legendaries</strong> carry innate traits—for every other
              card, visit the <strong>Runeforge</strong> tab in the <strong>Shop</strong> to spend
              Gold and imbue a custom Rune onto your best card copies:
            </p>
            <ul className="space-y-1.5 list-disc pl-5 text-slate-300">
              <li>
                <strong className="text-emerald-300">Minor &amp; Major Type Synergies:</strong>{' '}
                Imbue runes like <em>Iron Bulwark</em>, <em>Astral Ward</em>, or{' '}
                <em>Tempest Matrix</em> to fortify friendly <strong>P, M, X, or A-type</strong>{' '}
                allies already on the board.
              </li>
              <li>
                <strong className="text-sky-300">Adjacent Phalanx &amp; Sanctum Auras:</strong>{' '}
                Buff adjacent allies or your entire side of the board when deployed.
              </li>
              <li>
                <strong className="text-rose-300">Rival Sunder Hexes:</strong> Forge{' '}
                <em>Wither Hex</em>, <em>Armor Sunder</em>, or <em>Abyssal Blight</em> to weaken
                adjacent rival cards right before your arrows clash against them!
              </li>
            </ul>
          </section>

          {/* 4. The 4-Character Stat Code & Multi-Copy Rolling */}
          <section className="space-y-2 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-semibold text-amber-300 tracking-wide">
              4. Rolled Stat Codes &amp; Arrow Configurations (Max 5 Copies)
            </h3>
            <p>
              Every time you win, buy, or pull a card, it rolls unique hexadecimal stats (
              <span className="font-mono text-amber-200">0–9, A–F</span>) within its rarity tier AND
              a unique <strong>8-way arrow layout</strong>. Collect up to <strong>5 copies</strong>{' '}
              per card and sell extra rolls for Gold!
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
              <div className="rounded-xl bg-[#0c1322] border border-slate-800 p-3">
                <div className="font-semibold text-slate-100">1st · Attack Power</div>
                <p className="text-slate-400 mt-0.5">
                  Your offensive strength when initiating or defending an Arrow Clash.
                </p>
              </div>
              <div className="rounded-xl bg-[#0c1322] border border-slate-800 p-3">
                <div className="font-semibold text-slate-100">2nd · Attack Type (P / M / X / A)</div>
                <p className="text-slate-400 mt-0.5">
                  <strong className="text-amber-300">P</strong> hits Physical Def (3rd) ·{' '}
                  <strong className="text-sky-300">M</strong> hits Magical Def (4th) ·{' '}
                  <strong className="text-emerald-300">X</strong> hits their lowest defense ·{' '}
                  <strong className="text-rose-300">A</strong> attacks their lowest stat with your
                  highest stat.
                </p>
              </div>
              <div className="rounded-xl bg-[#0c1322] border border-slate-800 p-3">
                <div className="font-semibold text-slate-100">3rd · Physical Defense</div>
                <p className="text-slate-400 mt-0.5">
                  Guards against <strong className="text-amber-300">P</strong> (Physical) attacks.
                </p>
              </div>
              <div className="rounded-xl bg-[#0c1322] border border-slate-800 p-3">
                <div className="font-semibold text-slate-100">4th · Magical Defense</div>
                <p className="text-slate-400 mt-0.5">
                  Guards against <strong className="text-sky-300">M</strong> (Magical) attacks.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-800 bg-[#0d1424]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
