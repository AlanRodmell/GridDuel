import React from 'react';
import { Map, Wand2, X } from 'lucide-react';
import { ALL_BIOMES, BIOME_META } from '../data/biomes';
import { BiomeIcon } from './BiomeBadge';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#060403]/88 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[88dvh] flex flex-col rounded-t-[6px] sm:rounded-[5px] brass-panel riveted-frame shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-[#6d573e] mx-auto mt-2.5" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#4b3a26]/85">
          <h2
            id="rules-modal-title"
            className="font-[var(--font-display)] text-lg font-bold text-[#f6e1b5] tracking-wider"
          >
            GridDuel Field &amp; Combat Codex
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="iron-btn min-h-[40px] min-w-[40px] flex items-center justify-center rounded-[3px] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 font-[var(--font-serif)] text-[15.5px] text-[#cbb89a] leading-relaxed">
          {/* 1. Open 4x4 Battlefield & 7-Card Hands */}
          <section className="space-y-1.5">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
              1. Open 4×4 Battlefield &amp; 7-Card Hands
            </h3>
            <p>
              Each duel is played on a fully open <strong className="text-[#f3dfb6]">4×4 grid (16 playable tiles)</strong>{' '}
              seeded with <strong className="text-[#f3dfb6]">4 tactical Biome tiles</strong> based on the arena region. You and
              your rival each play <strong className="text-[#f3dfb6]">7 cards</strong> (14 total, leaving 2 tiles open at match
              end), so you can always maneuver around hostile terrain or plant specialists onto
              favorable ground. Control the most cards (Blue vs Crimson) after all 14 cards are
              played to win!
            </p>
          </section>

          {/* 2. Biome Terrain & Elemental/Tribal Matchups */}
          <section className="space-y-2 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5" />
              <span>2. Biome Terrain Tiles (Avoid or Capitalize)</span>
            </h3>
            <p>
              Every card carries an <strong className="text-[#f3dfb6]">Element</strong> (Fire, Water, Nature, Storm, Light,
              Shadow, Steel) and a <strong className="text-[#f3dfb6]">Tribe</strong> (Mortal, Fey, Undead, Construct, Beast).
              Deploying onto a Biome tile immediately applies its stat boost or penalty before
              clashes resolve—hover any biome tile on the board to inspect its exact matchup:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans text-xs pt-1">
              {ALL_BIOMES.map((biomeId) => {
                const b = BIOME_META[biomeId];
                return (
                  <div
                    key={biomeId}
                    className="rounded-[3px] basalt-recess p-2.5 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span
                        className={`w-5 h-5 rounded-[2px] border flex items-center justify-center shrink-0 ${b.badgeClass}`}
                      >
                        <BiomeIcon biome={biomeId} className="w-3 h-3" />
                      </span>
                      <span className={`font-[var(--font-display)] ${b.accentTextClass}`}>
                        {b.name}
                      </span>
                    </div>
                    <div className="text-emerald-300">▲ {b.favorsSummary}</div>
                    <div className="text-rose-300">▼ {b.hindersSummary}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Card Arrows & Captures */}
          <section className="space-y-1.5 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
              3. Arrows, Clashes &amp; Combos
            </h3>
            <p>
              Every rolled card copy has its own blazing orange arrows around its 8 edges and
              corners:
            </p>
            <ul className="space-y-1.5 list-disc pl-5 text-[#cbb89a]">
              <li>
                <strong className="text-[#f3dfb6]">Unopposed Capture:</strong> Point an arrow at an
                adjacent rival card that has <em>no arrow pointing back</em> to capture it
                instantly without a battle.
              </li>
              <li>
                <strong className="text-[#f3dfb6]">Arrow Clash:</strong> When your card’s arrow
                points at a rival card that points an arrow <em>back at yours</em>, a Card Clash
                erupts using their effective (rolled + terrain + augmented) stats.
              </li>
              <li>
                <strong className="text-[#f3dfb6]">Combo Chain:</strong> Any card won in an Arrow
                Clash immediately captures all adjacent enemy cards that <em>its</em> arrows point
                toward!
              </li>
            </ul>
          </section>

          {/* 4. Battlefield Augments & Runeforge Crafting */}
          <section className="space-y-1.5 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              <span>4. Battlefield Augments &amp; Runeforge</span>
            </h3>
            <p>
              Augments are rare battlefield powers that trigger when a card is placed on the 4×4
              grid. Only <strong className="text-[#f3dfb6]">5 Mythic Legendaries</strong> carry innate traits—for every other
              card, visit the <strong className="text-[#f3dfb6]">Runeforge</strong> tab in the <strong className="text-[#f3dfb6]">Vault &amp; Forge</strong> to spend
              Gold and imbue a custom Rune onto your best card copies.
            </p>
          </section>

          {/* 5. The 4-Character Stat Code */}
          <section className="space-y-2 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
              5. Rolled Hex Stat Codes (Max 5 Copies)
            </h3>
            <p>
              Every card copy rolls hexadecimal stats (
              <span className="font-mono text-sm text-[#f0c76e]">0–9, A–F</span>) within its rarity tier and
              an 8-way arrow layout. Hover any of the 4 circular orbs on a card to see its exact
              stat label:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-sans text-xs pt-1">
              <div className="rounded-[3px] basalt-recess p-3">
                <div className="font-[var(--font-display)] font-semibold text-[#f3dfb6]">1st · Attack Power</div>
                <p className="text-[#a69277] mt-0.5">
                  Your offensive strength when initiating or defending an Arrow Clash.
                </p>
              </div>
              <div className="rounded-[3px] basalt-recess p-3">
                <div className="font-[var(--font-display)] font-semibold text-[#f3dfb6]">2nd · Attack Type (P / M / X / A)</div>
                <p className="text-[#a69277] mt-0.5">
                  <strong className="text-[#f0c76e]">P</strong> hits Physical Def (3rd) ·{' '}
                  <strong className="text-sky-300">M</strong> hits Magical Def (4th) ·{' '}
                  <strong className="text-emerald-300">X</strong> hits their lowest defense ·{' '}
                  <strong className="text-rose-300">A</strong> attacks their lowest stat with your
                  highest stat.
                </p>
              </div>
              <div className="rounded-[3px] basalt-recess p-3">
                <div className="font-[var(--font-display)] font-semibold text-[#f3dfb6]">3rd · Physical Defense</div>
                <p className="text-[#a69277] mt-0.5">
                  Guards against <strong className="text-[#f0c76e]">P</strong> (Physical) attacks.
                </p>
              </div>
              <div className="rounded-[3px] basalt-recess p-3">
                <div className="font-[var(--font-display)] font-semibold text-[#f3dfb6]">4th · Magical Defense</div>
                <p className="text-[#a69277] mt-0.5">
                  Guards against <strong className="text-sky-300">M</strong> (Magical) attacks.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="px-5 py-3.5 border-t border-[#4b3a26]/85 bg-[#120d0a]">
          <button
            type="button"
            onClick={onClose}
            className="brass-btn w-full min-h-[44px] rounded-[3px] font-bold text-sm cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
