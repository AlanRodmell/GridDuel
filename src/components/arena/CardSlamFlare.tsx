import React from 'react';
import { Rarity } from '../../types/game';

interface CardSlamFlareProps {
  rarity: Rarity;
  isRelic?: boolean;
}

interface ShardSpec {
  angleDeg: number;
  distPx: number;
  sizePx: number;
  rotDeg: number;
}

const SHARDS_COMMON: ShardSpec[] = [
  { angleDeg: 20, distPx: 54, sizePx: 6, rotDeg: 42 },
  { angleDeg: 68, distPx: 48, sizePx: 5, rotDeg: -35 },
  { angleDeg: 118, distPx: 56, sizePx: 6, rotDeg: 58 },
  { angleDeg: 162, distPx: 52, sizePx: 5, rotDeg: -48 },
  { angleDeg: 205, distPx: 58, sizePx: 6, rotDeg: 31 },
  { angleDeg: 252, distPx: 46, sizePx: 5, rotDeg: -62 },
  { angleDeg: 298, distPx: 55, sizePx: 6, rotDeg: 47 },
  { angleDeg: 342, distPx: 50, sizePx: 5, rotDeg: -28 },
];

const SHARDS_RARE: ShardSpec[] = [
  { angleDeg: 0, distPx: 68, sizePx: 7, rotDeg: 45 },
  { angleDeg: 36, distPx: 58, sizePx: 5, rotDeg: -30 },
  { angleDeg: 72, distPx: 64, sizePx: 6, rotDeg: 60 },
  { angleDeg: 108, distPx: 60, sizePx: 5, rotDeg: -50 },
  { angleDeg: 144, distPx: 66, sizePx: 7, rotDeg: 35 },
  { angleDeg: 180, distPx: 70, sizePx: 6, rotDeg: 45 },
  { angleDeg: 216, distPx: 58, sizePx: 5, rotDeg: -40 },
  { angleDeg: 252, distPx: 64, sizePx: 6, rotDeg: 55 },
  { angleDeg: 288, distPx: 60, sizePx: 5, rotDeg: -35 },
  { angleDeg: 324, distPx: 66, sizePx: 7, rotDeg: 25 },
];

const SHARDS_EPIC: ShardSpec[] = [
  { angleDeg: 0, distPx: 82, sizePx: 7, rotDeg: 45 },
  { angleDeg: 28, distPx: 70, sizePx: 6, rotDeg: -40 },
  { angleDeg: 56, distPx: 78, sizePx: 7, rotDeg: 65 },
  { angleDeg: 85, distPx: 72, sizePx: 5, rotDeg: -55 },
  { angleDeg: 115, distPx: 84, sizePx: 8, rotDeg: 35 },
  { angleDeg: 145, distPx: 74, sizePx: 6, rotDeg: -25 },
  { angleDeg: 175, distPx: 82, sizePx: 7, rotDeg: 50 },
  { angleDeg: 205, distPx: 72, sizePx: 6, rotDeg: -60 },
  { angleDeg: 235, distPx: 80, sizePx: 7, rotDeg: 40 },
  { angleDeg: 265, distPx: 74, sizePx: 5, rotDeg: -35 },
  { angleDeg: 295, distPx: 84, sizePx: 8, rotDeg: 55 },
  { angleDeg: 328, distPx: 72, sizePx: 6, rotDeg: -45 },
];

const SHARDS_MYTHIC: ShardSpec[] = [
  { angleDeg: 0, distPx: 98, sizePx: 8, rotDeg: 45 },
  { angleDeg: 22, distPx: 84, sizePx: 6, rotDeg: -35 },
  { angleDeg: 45, distPx: 102, sizePx: 9, rotDeg: 60 },
  { angleDeg: 68, distPx: 86, sizePx: 6, rotDeg: -50 },
  { angleDeg: 90, distPx: 96, sizePx: 8, rotDeg: 45 },
  { angleDeg: 112, distPx: 84, sizePx: 6, rotDeg: -30 },
  { angleDeg: 135, distPx: 104, sizePx: 9, rotDeg: 55 },
  { angleDeg: 158, distPx: 88, sizePx: 6, rotDeg: -45 },
  { angleDeg: 180, distPx: 98, sizePx: 8, rotDeg: 45 },
  { angleDeg: 202, distPx: 84, sizePx: 6, rotDeg: -55 },
  { angleDeg: 225, distPx: 104, sizePx: 9, rotDeg: 40 },
  { angleDeg: 248, distPx: 86, sizePx: 6, rotDeg: -35 },
  { angleDeg: 270, distPx: 96, sizePx: 8, rotDeg: 45 },
  { angleDeg: 292, distPx: 84, sizePx: 6, rotDeg: -60 },
  { angleDeg: 315, distPx: 102, sizePx: 9, rotDeg: 50 },
  { angleDeg: 338, distPx: 86, sizePx: 6, rotDeg: -25 },
];

const FLARE_PALETTE: Record<
  Rarity,
  {
    coreGlow: string;
    primaryStroke: string;
    secondaryStroke: string;
    shardFill: string;
    shardGlow: string;
  }
> = {
  common: {
    coreGlow:
      'radial-gradient(circle, rgba(232, 206, 165, 0.72) 0%, rgba(168, 135, 92, 0.34) 45%, rgba(0, 0, 0, 0) 74%)',
    primaryStroke: '#dfc398',
    secondaryStroke: '#9c7e58',
    shardFill: '#cdb086',
    shardGlow: '0 0 6px rgba(223, 195, 152, 0.7)',
  },
  rare: {
    coreGlow:
      'radial-gradient(circle, rgba(186, 230, 253, 0.88) 0%, rgba(56, 189, 248, 0.48) 44%, rgba(14, 116, 144, 0) 76%)',
    primaryStroke: '#7dd3fc',
    secondaryStroke: '#0284c7',
    shardFill: '#bae6fd',
    shardGlow: '0 0 10px rgba(56, 189, 248, 0.95)',
  },
  epic: {
    coreGlow:
      'radial-gradient(circle, rgba(245, 208, 254, 0.92) 0%, rgba(192, 132, 252, 0.56) 45%, rgba(107, 33, 168, 0) 78%)',
    primaryStroke: '#e879f9',
    secondaryStroke: '#9333ea',
    shardFill: '#f0abfc',
    shardGlow: '0 0 12px rgba(217, 70, 239, 0.95)',
  },
  mythic: {
    coreGlow:
      'radial-gradient(circle, rgba(255, 251, 235, 0.98) 0%, rgba(250, 204, 21, 0.72) 38%, rgba(234, 88, 12, 0.35) 62%, rgba(0, 0, 0, 0) 82%)',
    primaryStroke: '#fef08a',
    secondaryStroke: '#f59e0b',
    shardFill: '#fde047',
    shardGlow: '0 0 14px rgba(250, 204, 21, 1)',
  },
};

/**
 * Unclipped GPU-accelerated visual impact flare erupting around a slammed card:
 * - Common: Weathered sandstone shockwave + chipped slate fragments
 * - Rare: Crystalline sapphire diamond shockwave + 4 cardinal frost lances
 * - Epic: Dual counter-expanding amethyst arcane rift rings + 8 starlight rays
 * - Mythic: Sovereign sunfire vertical pillar + 12-ray solar corona + triple golden shockwaves
 */
export const CardSlamFlare: React.FC<CardSlamFlareProps> = ({
  rarity,
  isRelic = false,
}) => {
  const pal = FLARE_PALETTE[rarity];
  const shards =
    rarity === 'mythic'
      ? SHARDS_MYTHIC
      : rarity === 'epic'
      ? SHARDS_EPIC
      : rarity === 'rare'
      ? SHARDS_RARE
      : SHARDS_COMMON;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-visible"
    >
      {/* 1. Ground Impact Radial Flash */}
      <div
        style={{ background: pal.coreGlow }}
        className="animate-slam-flash absolute -inset-[55%] rounded-full"
      />

      {/* 2. Mythic Vertical Sunfire Pillar Beam */}
      {rarity === 'mythic' && (
        <div
          style={{
            background:
              'linear-gradient(to top, rgba(254, 240, 138, 0) 0%, rgba(253, 224, 71, 0.85) 22%, rgba(255, 251, 235, 0.95) 50%, rgba(245, 158, 11, 0) 100%)',
          }}
          className="animate-slam-pillar absolute -top-[95%] bottom-[10%] w-[68%] blur-[2px]"
        />
      )}

      {/* 3. Rarity-Specific Geometric Shockwaves & Rays SVG */}
      <svg
        viewBox="-120 -120 240 240"
        className="animate-slam-ring absolute w-[240%] h-[240%] overflow-visible"
      >
        {/* Primary Shockwave Ring / Polygon */}
        {rarity === 'common' && (
          <>
            <circle
              cx="0"
              cy="0"
              r="52"
              fill="none"
              stroke={pal.primaryStroke}
              strokeWidth="4.5"
              strokeDasharray="18 8 10 6"
            />
            <circle
              cx="0"
              cy="0"
              r="38"
              fill="none"
              stroke={pal.secondaryStroke}
              strokeWidth="2.5"
            />
          </>
        )}

        {rarity === 'rare' && (
          <>
            {/* Octagonal / Diamond Crystalline Frost Shockwave + 4 Cardinal Lances */}
            <polygon
              points="0,-64 45,-45 64,0 45,45 0,64 -45,45 -64,0 -45,-45"
              fill="none"
              stroke={pal.primaryStroke}
              strokeWidth="4"
            />
            <polygon
              points="0,-48 48,0 0,48 -48,0"
              fill="none"
              stroke={pal.secondaryStroke}
              strokeWidth="2.5"
            />
            {[0, 90, 180, 270].map((deg) => (
              <polygon
                key={deg}
                points="0,-92 6,-50 0,-42 -6,-50"
                fill={pal.primaryStroke}
                transform={`rotate(${deg})`}
              />
            ))}
          </>
        )}

        {rarity === 'epic' && (
          <>
            {/* Arcane Rift Sigil Ring + 8 Starlight Spikes */}
            <circle
              cx="0"
              cy="0"
              r="68"
              fill="none"
              stroke={pal.primaryStroke}
              strokeWidth="4.5"
              strokeDasharray="24 6 6 6"
            />
            <polygon
              points="0,-58 41,-41 58,0 41,41 0,58 -41,41 -58,0 -41,-41"
              fill="none"
              stroke={pal.secondaryStroke}
              strokeWidth="3"
            />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, idx) => (
              <polygon
                key={deg}
                points={
                  idx % 2 === 0
                    ? '0,-102 5,-52 0,-44 -5,-52'
                    : '0,-84 4,-50 0,-44 -4,-50'
                }
                fill={idx % 2 === 0 ? pal.primaryStroke : pal.secondaryStroke}
                transform={`rotate(${deg})`}
              />
            ))}
          </>
        )}

        {rarity === 'mythic' && (
          <>
            {/* Sovereign Triple Sunburst Corona + 12 Solar Rays */}
            <circle
              cx="0"
              cy="0"
              r="76"
              fill="none"
              stroke={pal.primaryStroke}
              strokeWidth="5.5"
            />
            <circle
              cx="0"
              cy="0"
              r="58"
              fill="none"
              stroke={pal.secondaryStroke}
              strokeWidth="3.5"
              strokeDasharray="16 6"
            />
            {Array.from({ length: 12 }).map((_, idx) => {
              const deg = idx * 30;
              const isMajor = idx % 3 === 0;
              return (
                <polygon
                  key={deg}
                  points={
                    isMajor
                      ? '0,-114 7,-54 0,-44 -7,-54'
                      : '0,-92 4.5,-54 0,-46 -4.5,-54'
                  }
                  fill={isMajor ? '#fffbeb' : pal.primaryStroke}
                  transform={`rotate(${deg})`}
                />
              );
            })}
          </>
        )}
      </svg>

      {/* 4. Secondary Delayed Outer Shockwave for Epic / Mythic / Power Relics */}
      {(rarity === 'epic' || rarity === 'mythic' || isRelic) && (
        <svg
          viewBox="-120 -120 240 240"
          className="animate-slam-ring-delayed absolute w-[265%] h-[265%] overflow-visible"
        >
          <circle
            cx="0"
            cy="0"
            r="68"
            fill="none"
            stroke={isRelic ? '#38bdf8' : pal.primaryStroke}
            strokeWidth="3"
            strokeDasharray={isRelic ? '12 8' : undefined}
          />
        </svg>
      )}

      {/* 5. Radially Ejected Stone Chips, Crystal Shards & Arcane Sparks */}
      {shards.map((s, idx) => {
        const rad = (s.angleDeg * Math.PI) / 180;
        const tx = Math.cos(rad) * s.distPx;
        const ty = Math.sin(rad) * s.distPx;
        return (
          <span
            key={idx}
            style={
              {
                width: `${s.sizePx}px`,
                height: `${s.sizePx}px`,
                backgroundColor: isRelic && idx % 2 === 0 ? '#7dd3fc' : pal.shardFill,
                boxShadow: pal.shardGlow,
                '--tx': `${tx.toFixed(1)}px`,
                '--ty': `${ty.toFixed(1)}px`,
                '--rot': `${s.rotDeg}deg`,
              } as React.CSSProperties
            }
            className="animate-slam-shard absolute rotate-45"
          />
        );
      })}
    </div>
  );
};
