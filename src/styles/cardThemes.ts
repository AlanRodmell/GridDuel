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
      'linear-gradient(145deg, #dce4ee 0%, #7d8b9f 30%, #bcc7d6 66%, #5c677a 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #252d3e 0%, #141925 64%, #0c0f17 100%)',
    outerGlow: '0 8px 22px rgba(148, 163, 184, 0.24)',
    hairline: 'rgba(203, 213, 225, 0.44)',
    archBorder: 'rgba(226, 232, 240, 0.72)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(148, 163, 184, 0.32), rgba(15, 23, 42, 0.92))',
    orbRingGradient: 'linear-gradient(145deg, #e2e8f0 0%, #64748b 50%, #cbd5e1 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #262f42 0%, #10141f 100%)',
    titleColor: '#e6edf6',
    subtitleColor: '#a6b4c8',
    labelColor: '#b7c3d4',
    arrowActive: '#e2e8f0',
    arrowGlow: 'drop-shadow(0 0 4px rgba(226, 232, 240, 0.85))',
    arrowInactive: 'rgba(148, 163, 184, 0.24)',
    badgeClass: 'bg-slate-900/90 text-slate-200 border-slate-400/50',
    foilVia: 'via-slate-100/25',
  },
  rare: {
    tierLabel: 'RARE',
    bezelGradient:
      'linear-gradient(145deg, #c7ecff 0%, #2b6be6 32%, #7dd3fc 68%, #1d4299 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #122d57 0%, #09172e 64%, #060e1d 100%)',
    outerGlow: '0 10px 26px rgba(56, 189, 248, 0.34)',
    hairline: 'rgba(125, 211, 252, 0.52)',
    archBorder: 'rgba(125, 211, 252, 0.86)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(56, 189, 248, 0.34), rgba(7, 19, 40, 0.94))',
    orbRingGradient: 'linear-gradient(145deg, #d6f1ff 0%, #0284c7 50%, #7dd3fc 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #14325e 0%, #071326 100%)',
    titleColor: '#cfefff',
    subtitleColor: '#8ad4f9',
    labelColor: '#9ad8f8',
    arrowActive: '#8ce0ff',
    arrowGlow: 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.95))',
    arrowInactive: 'rgba(56, 189, 248, 0.24)',
    badgeClass: 'bg-sky-950/90 text-sky-200 border-sky-400/60',
    foilVia: 'via-sky-200/30',
  },
  epic: {
    tierLabel: 'EPIC',
    bezelGradient:
      'linear-gradient(145deg, #f5c2ff 0%, #8638e5 32%, #d8b4fe 68%, #5b1b99 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #31144f 0%, #190a2a 64%, #10061b 100%)',
    outerGlow: '0 11px 30px rgba(168, 85, 247, 0.42)',
    hairline: 'rgba(216, 180, 254, 0.56)',
    archBorder: 'rgba(232, 148, 255, 0.86)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(192, 132, 252, 0.34), rgba(20, 8, 36, 0.94))',
    orbRingGradient: 'linear-gradient(145deg, #fae8ff 0%, #9333ea 50%, #e879f9 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #371657 0%, #150823 100%)',
    titleColor: '#f5e4ff',
    subtitleColor: '#d9b4ff',
    labelColor: '#dfc0ff',
    arrowActive: '#eed8ff',
    arrowGlow: 'drop-shadow(0 0 6px rgba(192, 132, 252, 0.95))',
    arrowInactive: 'rgba(192, 132, 252, 0.24)',
    badgeClass: 'bg-violet-950/90 text-violet-200 border-violet-400/70',
    foilVia: 'via-fuchsia-200/35',
  },
  mythic: {
    tierLabel: 'LEGENDARY',
    bezelGradient:
      'linear-gradient(145deg, #fff3b0 0%, #c68c28 30%, #f8d878 66%, #9b6715 100%)',
    surfaceGradient:
      'radial-gradient(ellipse 95% 70% at 50% 34%, #3c1426 0%, #200a15 64%, #13060d 100%)',
    outerGlow: '0 12px 34px rgba(245, 185, 66, 0.48)',
    hairline: 'rgba(245, 201, 105, 0.62)',
    archBorder: 'rgba(253, 224, 120, 0.92)',
    archBackdrop:
      'radial-gradient(circle at 50% 72%, rgba(217, 119, 6, 0.42), rgba(28, 10, 18, 0.94))',
    orbRingGradient: 'linear-gradient(145deg, #fef08a 0%, #b47b1e 50%, #fde047 100%)',
    orbFill: 'radial-gradient(circle at 50% 30%, #411629 0%, #190811 100%)',
    titleColor: '#fce49b',
    subtitleColor: '#e9c476',
    labelColor: '#ebd08d',
    arrowActive: '#fde047',
    arrowGlow: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.98))',
    arrowInactive: 'rgba(245, 201, 105, 0.25)',
    badgeClass: 'bg-amber-950/90 text-amber-200 border-amber-400/80',
    foilVia: 'via-amber-100/40',
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
