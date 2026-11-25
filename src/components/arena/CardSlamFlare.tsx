import React from 'react';
import { Rarity } from '../../types/game';

interface CardSlamFlareProps {
  rarity: Rarity;
  isRelic?: boolean;
}

interface GlowSpec {
  rimShadow: string;
  innerWash: string;
  outerAtmosphere: string;
  streakHoriz?: string;
  streakVert?: string;
  streakDiag?: string;
  durationClass: string;
}

const GLOW_BY_RARITY: Record<Rarity, GlowSpec> = {
  common: {
    rimShadow:
      '0 0 22px 6px rgba(238, 205, 152, 0.72), 0 0 46px 14px rgba(176, 132, 76, 0.36)',
    innerWash:
      'radial-gradient(ellipse 68% 72% at 50% 50%, rgba(255, 238, 206, 0.78) 0%, rgba(216, 174, 114, 0.42) 45%, rgba(140, 102, 58, 0) 76%)',
    outerAtmosphere:
      'radial-gradient(ellipse 72% 72% at 50% 50%, rgba(226, 186, 128, 0.38) 0%, rgba(168, 125, 72, 0.16) 52%, rgba(0, 0, 0, 0) 78%)',
    streakHoriz:
      'radial-gradient(ellipse 50% 9% at 50% 50%, rgba(255, 241, 214, 0.65) 0%, rgba(222, 178, 115, 0.25) 55%, rgba(0, 0, 0, 0) 100%)',
    durationClass: 'animate-flare-glow-common',
  },
  rare: {
    rimShadow:
      '0 0 28px 9px rgba(125, 211, 252, 0.88), 0 0 64px 22px rgba(14, 165, 233, 0.52), 0 0 96px 34px rgba(29, 78, 216, 0.28)',
    innerWash:
      'radial-gradient(ellipse 70% 74% at 50% 50%, rgba(224, 247, 255, 0.92) 0%, rgba(56, 189, 248, 0.62) 44%, rgba(2, 132, 199, 0) 78%)',
    outerAtmosphere:
      'radial-gradient(ellipse 76% 76% at 50% 50%, rgba(56, 189, 248, 0.52) 0%, rgba(29, 78, 216, 0.24) 54%, rgba(0, 0, 0, 0) 80%)',
    streakHoriz:
      'radial-gradient(ellipse 50% 8% at 50% 50%, rgba(240, 251, 255, 0.92) 0%, rgba(56, 189, 248, 0.52) 50%, rgba(14, 165, 233, 0) 100%)',
    streakVert:
      'radial-gradient(ellipse 8% 50% at 50% 50%, rgba(224, 247, 255, 0.82) 0%, rgba(56, 189, 248, 0.4) 50%, rgba(14, 165, 233, 0) 100%)',
    durationClass: 'animate-flare-glow-rare',
  },
  epic: {
    rimShadow:
      '0 0 34px 12px rgba(232, 121, 249, 0.92), 0 0 78px 28px rgba(168, 85, 247, 0.62), 0 0 124px 44px rgba(107, 33, 168, 0.36)',
    innerWash:
      'radial-gradient(ellipse 72% 76% at 50% 50%, rgba(253, 242, 255, 0.96) 0%, rgba(217, 70, 239, 0.68) 44%, rgba(126, 34, 206, 0) 78%)',
    outerAtmosphere:
      'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(192, 132, 252, 0.62) 0%, rgba(126, 34, 206, 0.32) 55%, rgba(0, 0, 0, 0) 82%)',
    streakHoriz:
      'radial-gradient(ellipse 50% 9% at 50% 50%, rgba(255, 245, 255, 0.96) 0%, rgba(232, 121, 249, 0.65) 48%, rgba(147, 51, 234, 0) 100%)',
    streakVert:
      'radial-gradient(ellipse 9% 50% at 50% 50%, rgba(253, 242, 255, 0.88) 0%, rgba(192, 132, 252, 0.52) 48%, rgba(147, 51, 234, 0) 100%)',
    streakDiag:
      'radial-gradient(ellipse 46% 6% at 50% 50%, rgba(250, 232, 255, 0.78) 0%, rgba(217, 70, 239, 0.42) 50%, rgba(126, 34, 206, 0) 100%)',
    durationClass: 'animate-flare-glow-epic',
  },
  mythic: {
    rimShadow:
      '0 0 40px 15px rgba(254, 240, 138, 0.98), 0 0 92px 36px rgba(245, 158, 11, 0.72), 0 0 150px 56px rgba(217, 119, 6, 0.42)',
    innerWash:
      'radial-gradient(ellipse 74% 78% at 50% 50%, rgba(255, 254, 245, 1) 0%, rgba(253, 224, 71, 0.78) 42%, rgba(234, 88, 12, 0) 80%)',
    outerAtmosphere:
      'radial-gradient(ellipse 84% 84% at 50% 50%, rgba(250, 204, 21, 0.72) 0%, rgba(234, 88, 12, 0.38) 54%, rgba(0, 0, 0, 0) 84%)',
    streakHoriz:
      'radial-gradient(ellipse 50% 10% at 50% 50%, rgba(255, 255, 250, 1) 0%, rgba(253, 224, 71, 0.78) 48%, rgba(245, 158, 11, 0) 100%)',
    streakVert:
      'radial-gradient(ellipse 10% 50% at 50% 50%, rgba(255, 255, 250, 0.96) 0%, rgba(253, 224, 71, 0.68) 48%, rgba(245, 158, 11, 0) 100%)',
    streakDiag:
      'radial-gradient(ellipse 48% 7% at 50% 50%, rgba(255, 251, 235, 0.92) 0%, rgba(251, 191, 36, 0.56) 50%, rgba(217, 119, 6, 0) 100%)',
    durationClass: 'animate-flare-glow-mythic',
  },
};

/**
 * Soft, screen-blended optical flare glow that blooms from beneath and around a placed card:
 * - Zero wireframe shapes — pure incandescent rim-light, atmospheric radial bloom, and feathered optical flare streaks.
 * - Scaled in intensity, reach, and lingering warmth by Rarity ('common' | 'rare' | 'epic' | 'mythic').
 */
export const CardSlamFlare: React.FC<CardSlamFlareProps> = ({
  rarity,
  isRelic = false,
}) => {
  const g = GLOW_BY_RARITY[rarity];

  return (
    <>
      {/* 1. Under-Card Luminous Rim Halo & Wide Stone Illumination (Behind Card: z-0) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-visible mix-blend-screen ${g.durationClass}`}
      >
        {/* Soft Wide Atmospheric Light Pool Illuminating Neighboring Tiles */}
        <div
          style={{ background: g.outerAtmosphere }}
          className={`absolute ${
            rarity === 'mythic'
              ? '-inset-[105%]'
              : rarity === 'epic'
              ? '-inset-[88%]'
              : rarity === 'rare'
              ? '-inset-[72%]'
              : '-inset-[52%]'
          } blur-xl`}
        />

        {/* Optional Celestial Cyan Undertone for Power Relic Totems */}
        {isRelic && (
          <div
            style={{
              background:
                'radial-gradient(ellipse 76% 76% at 50% 50%, rgba(125, 211, 252, 0.62) 0%, rgba(14, 165, 233, 0.28) 52%, rgba(0, 0, 0, 0) 82%)',
            }}
            className="absolute -inset-[82%] blur-lg"
          />
        )}

        {/* Intense Card-Silhouette Rim Bloom Seeping Out From Under the Slab */}
        <div
          style={{ boxShadow: g.rimShadow }}
          className="absolute inset-[2%] rounded-[6px]"
        />
      </div>

      {/* 2. Over-Edge Optical Lens-Flare Wash & Feathered Light Streaks (Above Card: z-30) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible mix-blend-screen"
      >
        {/* Soft Incandescent Core Bloom */}
        <div
          style={{ background: g.innerWash }}
          className="animate-flare-core absolute -inset-[42%] blur-md"
        />

        {/* Feathered Horizontal Optical Anamorphic Flare Streak */}
        {g.streakHoriz && (
          <div
            style={{ background: g.streakHoriz }}
            className={`animate-flare-streak absolute ${
              rarity === 'mythic'
                ? 'w-[310%] h-[95%]'
                : rarity === 'epic'
                ? 'w-[265%] h-[85%]'
                : rarity === 'rare'
                ? 'w-[230%] h-[78%]'
                : 'w-[185%] h-[65%]'
            } blur-[2px]`}
          />
        )}

        {/* Feathered Vertical Optical Flare Streak (Rare / Epic / Mythic) */}
        {g.streakVert && (
          <div
            style={{ background: g.streakVert }}
            className={`animate-flare-streak absolute ${
              rarity === 'mythic'
                ? 'w-[95%] h-[270%]'
                : rarity === 'epic'
                ? 'w-[85%] h-[235%]'
                : 'w-[75%] h-[195%]'
            } blur-[2px]`}
          />
        )}

        {/* Feathered Diagonal Star-Bloom Streaks (Epic / Mythic) */}
        {g.streakDiag && (
          <>
            <div
              style={{ background: g.streakDiag }}
              className={`animate-flare-streak-diag-a absolute ${
                rarity === 'mythic' ? 'w-[265%] h-[85%]' : 'w-[220%] h-[75%]'
              } blur-[2px]`}
            />
            <div
              style={{ background: g.streakDiag }}
              className={`animate-flare-streak-diag-b absolute ${
                rarity === 'mythic' ? 'w-[265%] h-[85%]' : 'w-[220%] h-[75%]'
              } blur-[2px]`}
            />
          </>
        )}
      </div>
    </>
  );
};
