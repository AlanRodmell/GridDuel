import { AttackType, Rarity } from '../types/game';

export interface CardRarityTheme {
  tierLabel: string;
  bezelGradient: string;
  surfaceGradient: string;
  outerGlow: string;
  hairline: string;
  archBorder: string;
  archBackdrop: string;
  orbRingGradient: string;
  orbFill: string;
  titleColor: string;
  subtitleColor: string;
  labelColor: string;
  arrowActive: string;
  arrowGlow: string;
  arrowInactive: string;
  badgeClass: string;
  foilVia: string;
}

export const CARD_RARITY_THEMES: Record<Rarity, CardRarityTheme> = {
  common: {
    tierLabel: 'COMMON',
    bezelGradient:
      'linear-gradient(142deg, #b8af9e 0%, #5c5449 28%, #988e7c 64%, #3f3930 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #26221c 0%, #171410 64%, #0d0b09 100%)',
    outerGlow: '0 8px 20px rgba(0, 0, 0, 0.65)',
    hairline: 'rgba(189, 177, 154, 0.42)',
    archBorder: 'rgba(204, 192, 168, 0.68)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(148, 135, 112, 0.28), rgba(18, 15, 12, 0.94))',
    orbRingGradient: 'linear-gradient(145deg, #d6ccb8 0%, #5c5346 50%, #b5aa94 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #2b251e 0%, #120f0c 100%)',
    titleColor: '#ebe3d3',
    subtitleColor: '#b5a892',
    labelColor: '#bfb29c',
    arrowActive: '#e2dcd0',
    arrowGlow: 'drop-shadow(0 0 4px rgba(226, 220, 208, 0.85))',
    arrowInactive: 'rgba(168, 156, 136, 0.22)',
    badgeClass: 'bg-stone-900/90 text-stone-200 border-stone-400/50',
    foilVia: 'via-amber-100/20',
  },
  rare: {
    tierLabel: 'RARE',
    bezelGradient:
      'linear-gradient(142deg, #9ec9d8 0%, #2a5973 30%, #6ba3ba 66%, #1b3b4f 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #152b38 0%, #0b1821 64%, #070e14 100%)',
    outerGlow: '0 10px 24px rgba(22, 78, 99, 0.42)',
    hairline: 'rgba(136, 196, 218, 0.48)',
    archBorder: 'rgba(142, 204, 226, 0.78)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(56, 152, 184, 0.3), rgba(8, 18, 26, 0.94))',
    orbRingGradient: 'linear-gradient(145deg, #c2e3ee 0%, #1d6382 50%, #6eb0ca 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #163040 0%, #08131a 100%)',
    titleColor: '#d4eef7',
    subtitleColor: '#8ec7dc',
    labelColor: '#9ed0e2',
    arrowActive: '#8ce0ff',
    arrowGlow: 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.95))',
    arrowInactive: 'rgba(125, 196, 220, 0.22)',
    badgeClass: 'bg-sky-950/90 text-sky-200 border-sky-400/60',
    foilVia: 'via-sky-200/25',
  },
  epic: {
    tierLabel: 'EPIC',
    bezelGradient:
      'linear-gradient(142deg, #d8addf 0%, #692f7d 30%, #b37cc2 66%, #421952 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #2d163b 0%, #180b21 64%, #0f0615 100%)',
    outerGlow: '0 11px 28px rgba(107, 33, 138, 0.44)',
    hairline: 'rgba(206, 162, 224, 0.5)',
    archBorder: 'rgba(216, 152, 232, 0.8)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(168, 98, 196, 0.32), rgba(18, 8, 28, 0.94))',
    orbRingGradient: 'linear-gradient(145deg, #edd5f5 0%, #783091 50%, #c783d9 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #331742 0%, #14081c 100%)',
    titleColor: '#f2e0f7',
    subtitleColor: '#cfa6de',
    labelColor: '#d6b4e3',
    arrowActive: '#eed8ff',
    arrowGlow: 'drop-shadow(0 0 6px rgba(192, 132, 252, 0.95))',
    arrowInactive: 'rgba(192, 142, 214, 0.22)',
    badgeClass: 'bg-violet-950/90 text-violet-200 border-violet-400/70',
    foilVia: 'via-fuchsia-200/30',
  },
  mythic: {
    tierLabel: 'LEGENDARY',
    bezelGradient:
      'linear-gradient(142deg, #f5dca0 0%, #a87220 30%, #e0b75e 66%, #754b10 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #361614 0%, #1e0b0a 64%, #120605 100%)',
    outerGlow: '0 12px 32px rgba(204, 138, 38, 0.46)',
    hairline: 'rgba(232, 186, 94, 0.58)',
    archBorder: 'rgba(242, 204, 108, 0.88)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(196, 112, 24, 0.38), rgba(24, 10, 10, 0.94))',
    orbRingGradient: 'linear-gradient(145deg, #f7e4a6 0%, #9c6719 50%, #e8c058 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #3b1815 0%, #170807 100%)',
    titleColor: '#f8df95',
    subtitleColor: '#e2bd6e',
    labelColor: '#e6c67e',
    arrowActive: '#fde047',
    arrowGlow: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.98))',
    arrowInactive: 'rgba(232, 186, 94, 0.24)',
    badgeClass: 'bg-amber-950/90 text-amber-200 border-amber-400/80',
    foilVia: 'via-amber-100/35',
  },
};

export const ATTACK_TYPE_RULES: Record<
  AttackType,
  { title: string; rule: string; flavor: string; colorClass: string }
> = {
  P: {
    title: 'Physical Vanguard',
    rule: 'Strikes opposing P.Def directly in head-to-head grid clashes.',
    flavor: '“Steel holds the line where spells falter.”',
    colorClass: 'text-amber-300',
  },
  M: {
    title: 'Arcane Weaver',
    rule: 'Strikes opposing M.Def with focused elemental force in clashes.',
    flavor: '“Wards shatter before disciplined will.”',
    colorClass: 'text-sky-300',
  },
  X: {
    title: 'Flexible Tactician',
    rule: 'Automatically targets the lower of an opponent’s P.Def or M.Def.',
    flavor: '“Every bastion hides a seam waiting to split.”',
    colorClass: 'text-emerald-300',
  },
  A: {
    title: 'Sovereign Assault',
    rule: 'Targets the lowest of all three opposing stats during battle clashes.',
    flavor: '“A kingdom is only as wide as its arrows.”',
    colorClass: 'text-rose-300',
  },
};
