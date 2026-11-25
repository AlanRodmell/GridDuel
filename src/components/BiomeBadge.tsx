import React from 'react';
import { Droplets, Flame, Moon, Sprout, Sun, Wind } from 'lucide-react';
import { BIOME_META, ELEMENT_META, TRIBE_META } from '../data/biomes';
import { BiomeType, CardElement, CardTribe } from '../types/game';

export const BiomeIcon: React.FC<{ biome: BiomeType; className?: string }> = ({
  biome,
  className = 'w-3.5 h-3.5',
}) => {
  switch (biome) {
    case 'water':
      return <Droplets className={className} />;
    case 'marsh':
      return <Sprout className={className} />;
    case 'volcanic':
      return <Flame className={className} />;
    case 'hallowed':
      return <Sun className={className} />;
    case 'shadow':
      return <Moon className={className} />;
    case 'highland':
      return <Wind className={className} />;
  }
};

export const BiomePill: React.FC<{
  biome: BiomeType;
  compact?: boolean;
  count?: number;
}> = ({ biome, compact = false, count }) => {
  const meta = BIOME_META[biome];
  const tooltip = `${meta.name} — Favors: ${meta.favorsSummary} | Hinders: ${meta.hindersSummary}`;

  return (
    <span
      title={tooltip}
      className={`organic-tag inline-flex items-center gap-1 font-semibold cursor-help select-none ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
      } ${meta.badgeClass}`}
    >
      <BiomeIcon biome={biome} className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span>{meta.shortName}</span>
      {count !== undefined && count > 1 && (
        <span className="font-mono opacity-80">×{count}</span>
      )}
    </span>
  );
};

export const CardTraitPills: React.FC<{
  element: CardElement;
  tribe: CardTribe;
  compact?: boolean;
}> = ({ element, tribe, compact = false }) => {
  const elMeta = ELEMENT_META[element];
  const trMeta = TRIBE_META[tribe];
  const sizeClass = compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span
        className={`organic-tag inline-flex items-center font-semibold leading-none ${sizeClass} ${elMeta.badgeClass}`}
      >
        {elMeta.label}
      </span>
      <span
        className={`organic-tag inline-flex items-center font-semibold leading-none ${sizeClass} ${trMeta.badgeClass}`}
      >
        {trMeta.label}
      </span>
    </span>
  );
};
