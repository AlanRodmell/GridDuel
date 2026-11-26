export type Rarity = 'common' | 'rare' | 'epic' | 'mythic';

export type CardRole = 'Physical' | 'Magical' | 'Flexible' | 'Assault';

export type AttackType = 'P' | 'M' | 'X' | 'A';

export type ArrowDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export type Owner = 'player' | 'rival';

export type CardElement =
  | 'fire'
  | 'water'
  | 'nature'
  | 'storm'
  | 'light'
  | 'shadow'
  | 'neutral';

export type CardTribe =
  | 'mortal'
  | 'elf'
  | 'fey'
  | 'dragon'
  | 'undead'
  | 'construct'
  | 'beast';

export type BiomeType =
  | 'water'
  | 'marsh'
  | 'volcanic'
  | 'hallowed'
  | 'shadow'
  | 'highland';

export type BoardScale = '6x3' | '7x3';

export interface PowerTargetOffset {
  dr: number;
  dc: number;
}

export interface PowerCardDef {
  id: string;
  number: number; // 1 to 12
  code: string; // P01 to P12
  name: string;
  unlockTier: number; // 1 to 10 (cleared all 5 fighters in tier)
  rarity: Rarity;
  element: CardElement;
  dirs: ArrowDir[];
  offsets: PowerTargetOffset[];
  patternLabel: string;
  badgeLabel: string;
  shortTag: string;
  description: string;
  allyDelta: { power: number; pDef: number; mDef: number };
  rivalDelta: { power: number; pDef: number; mDef: number };
  image: string;
  artFilter?: string;
  accentGradient: string;
}

export interface TetraStats {
  power: number;   // 0 - 15 (0-9, A-F in hex)
  type: AttackType; // P (Physical), M (Magical), X (Flexible), A (Assault)
  pDef: number;    // 0 - 15
  mDef: number;    // 0 - 15
}

export type AugmentTargetScope =
  | 'all_allies'
  | 'adjacent_allies'
  | 'type_P_allies'
  | 'type_M_allies'
  | 'type_X_allies'
  | 'type_A_allies'
  | 'adjacent_rivals';

export type AugmentTier = 'minor' | 'major' | 'sovereign';

export interface CardAugment {
  id: string;
  name: string;
  shortTag: string; // e.g. "+2 DEF (Type X)"
  badgeLabel: string; // Compact badge on card e.g. "AUG: X+2D"
  description: string;
  scope: AugmentTargetScope;
  powerDelta: number;
  pDefDelta: number;
  mDefDelta: number;
}

export interface CraftableAugment extends CardAugment {
  tier: AugmentTier;
  craftCost: number;
}

export interface CardDef {
  id: string;
  number: number;
  name: string;
  rarity: Rarity;
  role: CardRole;
  element: CardElement;
  tribe: CardTribe;
  stats: TetraStats;
  arrows: ArrowDir[]; // Base archetype arrows (each rolled copy rolls its own arrow layout)
  augment?: CardAugment; // Optional battlefield augment triggered when placed on the board
  image: string;
  artFilter?: string; // Optional CSS filter/transform for unique visual mood across the card catalog
  price: number;
  accentGradient: string;
}

export interface LadderFighter {
  id: string;
  tierNumber: number; // 1 to 10
  orderInTier: number; // 1 to 5
  name: string;
  title: string;
  specialty: string;
  avatarCardId: string;
  signatureCardIds: string[]; // 1-2 signature cards guaranteed or heavily weighted in their hand
  minCardNumber: number; // Inclusive 1-90 card pool start
  maxCardNumber: number; // Inclusive 1-90 card pool end
  winGold: number;
  firstWinBonusGold: number;
  drawGold: number;
  lossGold: number;
  aiSkill: number; // 0.15 (novice) to 0.98 (grandmaster)
  mythicDropChance?: number; // 0 to 1 probability of an RNG Mythic Reliquary drop on victory
  isBoss?: boolean;
}

export interface LadderTier {
  tierNumber: number; // 1 to 10
  name: string;
  regionSubtitle: string;
  cardRangeLabel: string;
  requiredWinsToUnlockNext: number;
  accentColor: string;
  biomes: BiomeType[];
  fighters: LadderFighter[];
}

export interface RolledCardInstance {
  uid: string;
  cardId: string;
  stats: TetraStats;
  arrows: ArrowDir[];
  augmentId?: string; // Optional crafted augment rune imbued at the Shop Runeforge
}

export interface DeckSlot {
  id: string;
  name: string;
  cards: string[]; // Non-null equipped RolledCardInstance uids (up to 10)
  slots?: (string | null)[]; // Fixed unit slot positions [0..9]; null = empty slot outline
  powerSlot?: string | null; // Dedicated Power Relic card ID (unlocked by clearing Tiers 1–10)
}

export interface HandCard {
  uid: string;
  cardId: string;
  stats: TetraStats;
  arrows: ArrowDir[];
  augmentId?: string;
  isPowerCard?: boolean;
}

export interface PlacedCard {
  uid: string;
  cardId: string;
  owner: Owner;
  stats: TetraStats;
  baseStats: TetraStats; // Original rolled stats before terrain, augments & relic auras
  arrows: ArrowDir[];
  augmentId?: string;
  isRelic?: boolean;
  justPlaced?: boolean;
  lastFlippedAt?: number;
  augmentDelta?: {
    power: number;
    pDef: number;
    mDef: number;
  };
  terrainMod?: {
    biome: BiomeType;
    powerDelta: number;
    pDefDelta: number;
    mDefDelta: number;
    label: string;
    isPositive: boolean;
  };
  relicAuraMod?: {
    powerDelta: number;
    pDefDelta: number;
    mDefDelta: number;
    label: string;
    isPositive: boolean;
  };
  lastAugmented?: {
    label: string;
    isBuff: boolean;
    timestamp: number;
  };
}

export interface BoardCell {
  row: number;
  col: number;
  blocked: boolean;
  terrain: BiomeType | null;
  card: PlacedCard | null;
}

export type FlipReason = 'unopposed' | 'clash' | 'combo';

export interface ClashDetail {
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  attackType: AttackType;
  attackerVal: number;
  defenderVal: number;
  attackerRoll: number;
  defenderRoll: number;
  attackerWon: boolean;
  targetRow: number;
  targetCol: number;
}

export interface FlipEvent {
  row: number;
  col: number;
  reason: FlipReason;
  wave: number;
}

export interface AugmentEvent {
  row: number;
  col: number;
  targetCardName: string;
  label: string;
  isBuff: boolean;
}

export interface MoveResolution {
  nextBoard: BoardCell[][];
  flips: FlipEvent[];
  clashes: ClashDetail[];
  augments: AugmentEvent[];
}

export type MatchPhase = 'setup' | 'playing' | 'finished';

export interface MatchSummary {
  fighterId: string;
  boardScale?: BoardScale;
  winner: Owner | 'draw';
  playerScore: number;
  rivalScore: number;
  isPerfect: boolean;
  isFirstVictory: boolean;
  newlyUnlockedPowerIds?: string[];
  baseGold: number;
  firstWinBonus: number;
  dominanceBonus: number;
  comboBonus: number;
  totalGold: number;
  rivalHandCards: HandCard[];
  bonusMythicDrop: HandCard | null;
  spoilClaimedUid: string | null;
  spoilClaimedCardId: string | null;
  spoilWasOverflow: boolean;
  spoilBonusGold: number;
}

export interface PlayerProfile {
  gold: number;
  owned: Record<string, number>;
  discovered?: Record<string, boolean>;
  inventory: Record<string, RolledCardInstance[]>;
  decks: DeckSlot[];
  activeDeckIndex: number;
  boardScale?: BoardScale;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  totalFlips: number;
  perfectWins?: number;
  totalCombos?: number;
  totalGoldEarned?: number;
  totalGoldSpent?: number;
  packsOpened?: number;
  cardsForged?: number;
  runesCrafted?: number;
  cardsSold?: number;
  cardWins: Record<string, number>;
  fighterWins: Record<string, number>;
  soundEnabled: boolean;
  clickToPlace?: boolean;
}
