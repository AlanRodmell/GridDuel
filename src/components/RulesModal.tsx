import React from 'react';
import { Map, Sparkles, Wand2, X } from 'lucide-react';
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
          {/* 1. Selectable Battlefield Scales & Right-Hand Fan */}
          <section className="space-y-1.5">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
              1. Two Battlefield Scales &amp; Right-Hand Fan
            </h3>
            <p>
              Choose your preferred battlefield scale before any Arena or Quick match:{' '}
              <strong className="text-[#f3dfb6]">6×3 Skirmish</strong> (18 tiles · 8 Units + 1 Relic) or{' '}
              <strong className="text-[#f3dfb6]">7×3 Vanguard</strong> (21 tiles · 9 Units + 1 Relic).
              Drag cards from your right-hand fan onto any open socket, or click any card in your
              hand to inspect its full stats, Biome matchups, and Relic aura specifics. Control the
              most Unit cards (Blue vs Crimson) when all hands are played to win!
            </p>
          </section>

          {/* 2. Tier-Unlocked Power Relic Totems */}
          <section className="space-y-1.5 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>2. Power Relic Totems (12 Tier-Clear Rewards)</span>
            </h3>
            <p>
              Conquering all <strong className="text-[#f3dfb6]">5 challengers</strong> in each Campaign Tier
              (Tiers 1–10) unlocks <strong className="text-[#f3dfb6]">12 unique Power Relics (P01–P12)</strong>{' '}
              and opens your deck’s <strong className="text-[#f3dfb6]">Dedicated Relic Slot</strong>. When
              placed onto an open board socket, a Power Relic anchors as an{' '}
              <strong className="text-[#f3dfb6]">un-flippable Totem</strong> that blocks space and projects a
              persistent directional buff/debuff aura onto its target tiles—empowering units already
              there <em>and</em> any units deployed or flipped onto those tiles later in the match!
            </p>
          </section>

          {/* 3. Biome Terrain & Elemental/Tribal Matchups */}
          <section className="space-y-2 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5" />
              <span>3. Biome Terrain Tiles (Avoid or Capitalize)</span>
            </h3>
            <p>
              Every Unit card carries an <strong className="text-[#f3dfb6]">Element</strong> and a{' '}
              <strong className="text-[#f3dfb6]">Tribe</strong>. Deploying onto a Biome tile immediately
              applies its stat boost or penalty before clashes resolve:
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
                        className={`organic-seal w-5 h-5 flex items-center justify-center shrink-0 ${b.badgeClass}`}
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

          {/* 4. Card Arrows & Captures */}
          <section className="space-y-1.5 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#e6b85c]">
              4. Arrows, Clashes &amp; Combos
            </h3>
            <ul className="space-y-1.5 list-disc pl-5 text-[#cbb89a]">
              <li>
                <strong className="text-[#f3dfb6]">Unopposed Capture:</strong> Point an orange unit
                arrow at an adjacent rival unit card that has <em>no arrow pointing back</em> to
                capture it instantly without a battle.
              </li>
              <li>
                <strong className="text-[#f3dfb6]">Arrow Clash:</strong> When your unit’s arrow
                points at a rival unit that points an arrow <em>back at yours</em>, a Clash erupts
                using effective stats (rolled + Biome + Runes + Power Relic auras).
              </li>
              <li>
                <strong className="text-[#f3dfb6]">Combo Chain:</strong> Any unit won in an Arrow
                Clash immediately captures all adjacent enemy unit cards that <em>its</em> arrows
                point toward!
              </li>
            </ul>
          </section>

          {/* 5. Battlefield Augments & Hex Stat Codes */}
          <section className="space-y-2 border-t border-[#4b3a26]/70 pt-4">
            <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              <span>5. Runeforge Augments &amp; Hex Stat Codes</span>
            </h3>
            <p>
              Visit the <strong className="text-[#f3dfb6]">Runeforge</strong> in the Vault &amp; Forge to
              imbue custom Runes onto your best rolled Unit copies. Every Unit copy rolls 4 hex
              values (<span className="font-mono text-sm text-[#f0c76e]">ATK · TYPE (P/M/X/A) · P.DEF · M.DEF</span>)
              from <span className="font-mono text-sm text-[#f0c76e]">0–F</span>.
            </p>
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
