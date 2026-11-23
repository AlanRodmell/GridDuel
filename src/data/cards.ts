import {
  ArrowDir,
  AttackType,
  CardAugment,
  CardDef,
  CardRole,
  CraftableAugment,
  Rarity,
  RolledCardInstance,
  TetraStats,
} from '../types/game';

const IMG = {
  imp: './src/assets/images/card_ember_imp_1795362407315.jpg',
  squire: './src/assets/images/card_iron_squire_1795362408611.jpg',
  wolf: './src/assets/images/card_frost_wolf_1795362408372.jpg',
  golem: './src/assets/images/card_moss_golem_1795362407439.jpg',
  hawk: './src/assets/images/card_gale_hawk_1795362407788.jpg',
  wisp: './src/assets/images/card_lantern_wisp_1795362407904.jpg',
  goblin: './src/assets/images/card_goblin_sapper_1795363117714.jpg',
  slime: './src/assets/images/card_crystal_slime_1795363118177.jpg',
  sprite: './src/assets/images/card_briar_sprite_1795363117548.jpg',
  owl: './src/assets/images/card_clockwork_owl_1795363117439.jpg',
  knight: './src/assets/images/card_runic_knight_1795362407787.jpg',
  mage: './src/assets/images/card_glacial_mage_1795362407435.jpg',
  drake: './src/assets/images/card_cinder_drake_1795362406493.jpg',
  griffin: './src/assets/images/card_storm_griffin_1795362407908.jpg',
  rogue: './src/assets/images/card_shadow_rogue_1795363117580.jpg',
  serpent: './src/assets/images/card_tide_serpent_1795363117507.jpg',
  boar: './src/assets/images/card_ironclad_boar_1795363117227.jpg',
  cleric: './src/assets/images/card_sun_cleric_1795363117977.jpg',
  behemoth: './src/assets/images/card_stone_behemoth_1795362407794.jpg',
  valkyrie: './src/assets/images/card_valkyrie_lancer_1795362407499.jpg',
  gargoyle: './src/assets/images/card_obsidian_gargoyle_1795363117030.jpg',
  djinn: './src/assets/images/card_tempest_djinn_1795363117056.jpg',
  samurai: './src/assets/images/card_crimson_samurai_1795363117809.jpg',
  wyvern: './src/assets/images/card_frost_wyvern_1795363118049.jpg',
  lich: './src/assets/images/card_abyssal_lich_1795363117841.jpg',
  phoenix: './src/assets/images/card_crimson_phoenix_1795362407139.jpg',
  leviathan: './src/assets/images/card_aether_leviathan_1795362407681.jpg',
  titan: './src/assets/images/card_emerald_titan_1795363118217.jpg',
  empress: './src/assets/images/card_glacial_empress_1795363118839.jpg',
  sovereign: './src/assets/images/card_solar_sovereign_1795362408316.jpg',
  necromancer: './src/assets/images/card_necromancer_acolyte_1795419232453.jpg',
  ranger: './src/assets/images/card_elven_ranger_1795419232865.jpg',
  dwarf: './src/assets/images/card_dwarven_thunderer_1795419232969.jpg',
  archon: './src/assets/images/card_celestial_archon_1795419232449.jpg',
  voidDragon: './src/assets/images/card_void_behemoth_1795419233239.jpg',
};

const ROLE_FROM_TYPE: Record<AttackType, CardRole> = {
  P: 'Physical',
  M: 'Magical',
  X: 'Flexible',
  A: 'Assault',
};

interface RawEntry {
  id: string;
  name: string;
  rarity: Rarity;
  stats: [number, AttackType, number, number];
  arrows: ArrowDir[];
  image: string;
  artFilter?: string;
  price: number;
  accentGradient: string;
}

const RAW_CARDS: RawEntry[] = [
  // =========================================================================
  // COMMON TIER — 30 Cards (#01 to #30)
  // =========================================================================
  {
    id: 'ember-imp',
    name: 'Ember Imp',
    rarity: 'common',
    stats: [3, 'M', 1, 3],
    arrows: ['n', 'ne', 'e'],
    image: IMG.imp,
    price: 70,
    accentGradient: 'from-orange-950 via-red-950 to-slate-950',
  },
  {
    id: 'iron-squire',
    name: 'Iron Squire',
    rarity: 'common',
    stats: [3, 'P', 4, 1],
    arrows: ['n', 'e', 's'],
    image: IMG.squire,
    price: 70,
    accentGradient: 'from-slate-800 via-slate-900 to-slate-950',
  },
  {
    id: 'frost-wolf',
    name: 'Frost Wolf',
    rarity: 'common',
    stats: [4, 'P', 2, 2],
    arrows: ['nw', 'ne', 'sw', 'se'],
    image: IMG.wolf,
    price: 70,
    accentGradient: 'from-sky-950 via-slate-900 to-slate-950',
  },
  {
    id: 'moss-golem',
    name: 'Moss Golem',
    rarity: 'common',
    stats: [3, 'P', 5, 1],
    arrows: ['s', 'sw', 'w'],
    image: IMG.golem,
    price: 70,
    accentGradient: 'from-emerald-950 via-stone-900 to-slate-950',
  },
  {
    id: 'gale-hawk',
    name: 'Gale Hawk',
    rarity: 'common',
    stats: [4, 'P', 2, 3],
    arrows: ['n', 'nw', 'ne', 'w'],
    image: IMG.hawk,
    price: 70,
    accentGradient: 'from-indigo-950 via-slate-900 to-slate-950',
  },
  {
    id: 'lantern-wisp',
    name: 'Lantern Wisp',
    rarity: 'common',
    stats: [3, 'M', 1, 4],
    arrows: ['n', 's', 'ne', 'sw'],
    image: IMG.wisp,
    price: 70,
    accentGradient: 'from-amber-950 via-slate-900 to-slate-950',
  },
  {
    id: 'goblin-sapper',
    name: 'Goblin Sapper',
    rarity: 'common',
    stats: [4, 'P', 3, 2],
    arrows: ['ne', 'e', 'se', 's'],
    image: IMG.goblin,
    price: 75,
    accentGradient: 'from-amber-950 via-orange-950 to-slate-950',
  },
  {
    id: 'crystal-slime',
    name: 'Crystal Slime',
    rarity: 'common',
    stats: [2, 'M', 3, 5],
    arrows: ['w', 'nw', 'sw', 's'],
    image: IMG.slime,
    price: 75,
    accentGradient: 'from-cyan-950 via-blue-950 to-slate-950',
  },
  {
    id: 'briar-sprite',
    name: 'Briar Sprite',
    rarity: 'common',
    stats: [4, 'M', 2, 4],
    arrows: ['n', 'ne', 'sw', 'nw', 'w'],
    image: IMG.sprite,
    price: 80,
    accentGradient: 'from-emerald-950 via-slate-900 to-slate-950',
  },
  {
    id: 'clockwork-owl',
    name: 'Clockwork Owl',
    rarity: 'common',
    stats: [4, 'X', 3, 3],
    arrows: ['n', 'e', 's', 'w'],
    image: IMG.owl,
    price: 90,
    accentGradient: 'from-amber-950 via-stone-900 to-slate-950',
  },
  {
    id: 'timber-bowman',
    name: 'Timber Bowman',
    rarity: 'common',
    stats: [4, 'P', 3, 3],
    arrows: ['n', 'ne', 'nw'],
    image: IMG.ranger,
    price: 75,
    accentGradient: 'from-emerald-950 via-stone-900 to-slate-950',
  },
  {
    id: 'copper-cannoneer',
    name: 'Copper Cannoneer',
    rarity: 'common',
    stats: [5, 'P', 3, 1],
    arrows: ['e', 'se', 'w'],
    image: IMG.dwarf,
    price: 80,
    accentGradient: 'from-orange-950 via-stone-900 to-slate-950',
  },
  {
    id: 'crypt-acolyte',
    name: 'Crypt Acolyte',
    rarity: 'common',
    stats: [4, 'M', 2, 4],
    arrows: ['s', 'se', 'sw'],
    image: IMG.necromancer,
    price: 80,
    accentGradient: 'from-emerald-950 via-slate-900 to-slate-950',
  },
  {
    id: 'cinder-fiend',
    name: 'Cinder Fiend',
    rarity: 'common',
    stats: [5, 'P', 2, 2],
    arrows: ['nw', 'n', 'e'],
    image: IMG.imp,
    artFilter: 'hue-rotate-15 saturate-125',
    price: 80,
    accentGradient: 'from-red-950 via-orange-950 to-slate-950',
  },
  {
    id: 'bronze-footman',
    name: 'Bronze Footman',
    rarity: 'common',
    stats: [3, 'P', 5, 2],
    arrows: ['n', 'w', 's'],
    image: IMG.squire,
    artFilter: 'sepia-[.25] contrast-110',
    price: 80,
    accentGradient: 'from-amber-950 via-slate-900 to-slate-950',
  },
  {
    id: 'tundra-stalker',
    name: 'Tundra Stalker',
    rarity: 'common',
    stats: [5, 'P', 3, 2],
    arrows: ['n', 'e', 'sw'],
    image: IMG.wolf,
    artFilter: 'hue-rotate-30 contrast-110',
    price: 85,
    accentGradient: 'from-indigo-950 via-slate-900 to-slate-950',
  },
  {
    id: 'quarry-construct',
    name: 'Quarry Construct',
    rarity: 'common',
    stats: [4, 'P', 5, 1],
    arrows: ['e', 's', 'w'],
    image: IMG.golem,
    artFilter: 'hue-rotate-60 contrast-110',
    price: 85,
    accentGradient: 'from-stone-800 via-slate-900 to-slate-950',
  },
  {
    id: 'ridge-falcon',
    name: 'Ridge Falcon',
    rarity: 'common',
    stats: [5, 'P', 2, 3],
    arrows: ['ne', 'e', 'nw', 'w'],
    image: IMG.hawk,
    artFilter: 'hue-rotate-180 saturate-110',
    price: 85,
    accentGradient: 'from-sky-950 via-slate-900 to-slate-950',
  },
  {
    id: 'marsh-firefly',
    name: 'Marsh Firefly',
    rarity: 'common',
    stats: [3, 'M', 2, 5],
    arrows: ['nw', 'se', 's'],
    image: IMG.wisp,
    artFilter: 'hue-rotate-90 saturate-125',
    price: 80,
    accentGradient: 'from-emerald-950 via-teal-950 to-slate-950',
  },
  {
    id: 'tunnel-bomber',
    name: 'Tunnel Bomber',
    rarity: 'common',
    stats: [5, 'P', 3, 2],
    arrows: ['n', 's', 'e', 'w'],
    image: IMG.goblin,
    artFilter: 'hue-rotate-30 saturate-110',
    price: 90,
    accentGradient: 'from-stone-800 via-orange-950 to-slate-950',
  },
  {
    id: 'mire-ooze',
    name: 'Mire Ooze',
    rarity: 'common',
    stats: [3, 'M', 4, 4],
    arrows: ['n', 'se', 'sw'],
    image: IMG.slime,
    artFilter: 'hue-rotate-90 saturate-125',
    price: 85,
    accentGradient: 'from-emerald-950 via-cyan-950 to-slate-950',
  },
  {
    id: 'thorn-dryad',
    name: 'Thorn Dryad',
    rarity: 'common',
    stats: [4, 'M', 3, 4],
    arrows: ['ne', 'se', 'sw', 'nw'],
    image: IMG.sprite,
    artFilter: 'hue-rotate-60',
    price: 85,
    accentGradient: 'from-teal-950 via-emerald-950 to-slate-950',
  },
  {
    id: 'brass-sentinel',
    name: 'Brass Sentinel',
    rarity: 'common',
    stats: [4, 'P', 4, 3],
    arrows: ['n', 'ne', 'nw', 's'],
    image: IMG.owl,
    artFilter: 'hue-rotate-30 contrast-110',
    price: 85,
    accentGradient: 'from-amber-950 via-slate-900 to-slate-950',
  },
  {
    id: 'alley-cutpurse',
    name: 'Alley Cutpurse',
    rarity: 'common',
    stats: [4, 'X', 2, 3],
    arrows: ['ne', 'e', 'sw', 'w'],
    image: IMG.rogue,
    artFilter: 'sepia-[.2] brightness-95',
    price: 95,
    accentGradient: 'from-slate-800 via-stone-900 to-slate-950',
  },
  {
    id: 'reef-eel',
    name: 'Reef Eel',
    rarity: 'common',
    stats: [4, 'M', 3, 4],
    arrows: ['n', 'e', 'sw'],
    image: IMG.serpent,
    artFilter: 'hue-rotate-30',
    price: 85,
    accentGradient: 'from-cyan-950 via-slate-900 to-slate-950',
  },
  {
    id: 'razor-tusk',
    name: 'Razor Tusk',
    rarity: 'common',
    stats: [5, 'P', 4, 1],
    arrows: ['n', 'e', 'w'],
    image: IMG.boar,
    artFilter: 'brightness-95 contrast-110',
    price: 85,
    accentGradient: 'from-stone-800 via-amber-950 to-slate-950',
  },
  {
    id: 'shrine-novice',
    name: 'Shrine Novice',
    rarity: 'common',
    stats: [3, 'M', 3, 5],
    arrows: ['n', 'e', 's', 'w'],
    image: IMG.cleric,
    artFilter: 'hue-rotate-15',
    price: 85,
    accentGradient: 'from-amber-950 via-slate-900 to-slate-950',
  },
  {
    id: 'mist-archer',
    name: 'Mist Archer',
    rarity: 'common',
    stats: [4, 'X', 3, 2],
    arrows: ['nw', 'n', 'ne', 's'],
    image: IMG.ranger,
    artFilter: 'hue-rotate-60',
    price: 95,
    accentGradient: 'from-teal-950 via-slate-900 to-slate-950',
  },
  {
    id: 'slag-gunner',
    name: 'Slag Gunner',
    rarity: 'common',
    stats: [5, 'P', 4, 2],
    arrows: ['ne', 'se', 'w'],
    image: IMG.dwarf,
    artFilter: 'hue-rotate-15 contrast-110',
    price: 90,
    accentGradient: 'from-red-950 via-stone-900 to-slate-950',
  },
  {
    id: 'bone-chanter',
    name: 'Bone Chanter',
    rarity: 'common',
    stats: [4, 'M', 2, 5],
    arrows: ['n', 'se', 'sw', 'w'],
    image: IMG.necromancer,
    artFilter: 'hue-rotate-90',
    price: 90,
    accentGradient: 'from-purple-950 via-slate-900 to-slate-950',
  },

  // =========================================================================
  // RARE TIER — 30 Cards (#31 to #60)
  // =========================================================================
  {
    id: 'runic-knight',
    name: 'Runic Knight',
    rarity: 'rare',
    stats: [6, 'P', 7, 4],
    arrows: ['n', 'ne', 'e', 'se', 'w'],
    image: IMG.knight,
    price: 170,
    accentGradient: 'from-blue-950 via-slate-900 to-slate-950',
  },
  {
    id: 'glacial-mage',
    name: 'Glacial Mage',
    rarity: 'rare',
    stats: [7, 'M', 3, 7],
    arrows: ['n', 'nw', 'w', 'sw', 's'],
    image: IMG.mage,
    price: 170,
    accentGradient: 'from-cyan-950 via-blue-950 to-slate-950',
  },
  {
    id: 'cinder-drake',
    name: 'Cinder Drake',
    rarity: 'rare',
    stats: [8, 'P', 6, 4],
    arrows: ['n', 'nw', 'ne', 'e', 'w'],
    image: IMG.drake,
    price: 175,
    accentGradient: 'from-red-950 via-orange-950 to-slate-950',
  },
  {
    id: 'storm-griffin',
    name: 'Storm Griffin',
    rarity: 'rare',
    stats: [7, 'X', 6, 5],
    arrows: ['n', 'ne', 'e', 's', 'sw'],
    image: IMG.griffin,
    price: 185,
    accentGradient: 'from-amber-950 via-indigo-950 to-slate-950',
  },
  {
    id: 'shadow-rogue',
    name: 'Shadow Rogue',
    rarity: 'rare',
    stats: [6, 'X', 5, 5],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.rogue,
    price: 195,
    accentGradient: 'from-slate-800 via-indigo-950 to-slate-950',
  },
  {
    id: 'tide-serpent',
    name: 'Tide Serpent',
    rarity: 'rare',
    stats: [7, 'M', 5, 6],
    arrows: ['ne', 'e', 'se', 's', 'sw'],
    image: IMG.serpent,
    price: 180,
    accentGradient: 'from-teal-950 via-sky-950 to-slate-950',
  },
  {
    id: 'ironclad-boar',
    name: 'Ironclad Boar',
    rarity: 'rare',
    stats: [8, 'P', 8, 2],
    arrows: ['e', 'se', 's', 'w'],
    image: IMG.boar,
    price: 175,
    accentGradient: 'from-stone-800 via-amber-950 to-slate-950',
  },
  {
    id: 'sun-cleric',
    name: 'Sun Cleric',
    rarity: 'rare',
    stats: [6, 'M', 5, 8],
    arrows: ['n', 'nw', 'ne', 's', 'se', 'sw'],
    image: IMG.cleric,
    price: 180,
    accentGradient: 'from-amber-900 via-slate-900 to-slate-950',
  },
  {
    id: 'sylvan-pathfinder',
    name: 'Sylvan Pathfinder',
    rarity: 'rare',
    stats: [7, 'X', 5, 6],
    arrows: ['n', 'ne', 'e', 'nw', 'w'],
    image: IMG.ranger,
    artFilter: 'saturate-125',
    price: 185,
    accentGradient: 'from-emerald-950 via-teal-950 to-slate-950',
  },
  {
    id: 'forge-artillerist',
    name: 'Forge Artillerist',
    rarity: 'rare',
    stats: [8, 'P', 7, 4],
    arrows: ['n', 'e', 'se', 's', 'w'],
    image: IMG.dwarf,
    artFilter: 'saturate-125',
    price: 185,
    accentGradient: 'from-orange-950 via-amber-950 to-slate-950',
  },
  {
    id: 'grave-warlock',
    name: 'Grave Warlock',
    rarity: 'rare',
    stats: [8, 'M', 4, 7],
    arrows: ['n', 'ne', 'se', 'sw', 'nw'],
    image: IMG.necromancer,
    artFilter: 'saturate-125',
    price: 185,
    accentGradient: 'from-emerald-950 via-purple-950 to-slate-950',
  },
  {
    id: 'silver-paladin',
    name: 'Silver Paladin',
    rarity: 'rare',
    stats: [7, 'P', 8, 5],
    arrows: ['n', 'e', 's', 'w', 'ne'],
    image: IMG.knight,
    artFilter: 'hue-rotate-30 brightness-105',
    price: 185,
    accentGradient: 'from-indigo-950 via-slate-900 to-slate-950',
  },
  {
    id: 'rime-enchanter',
    name: 'Rime Enchanter',
    rarity: 'rare',
    stats: [7, 'M', 5, 8],
    arrows: ['nw', 'ne', 'e', 'se', 'sw'],
    image: IMG.mage,
    artFilter: 'hue-rotate-30',
    price: 185,
    accentGradient: 'from-blue-950 via-indigo-950 to-slate-950',
  },
  {
    id: 'magma-wyrm',
    name: 'Magma Wyrm',
    rarity: 'rare',
    stats: [8, 'P', 7, 4],
    arrows: ['n', 'e', 's', 'se', 'sw'],
    image: IMG.drake,
    artFilter: 'hue-rotate-15 saturate-125',
    price: 185,
    accentGradient: 'from-orange-950 via-red-950 to-slate-950',
  },
  {
    id: 'sky-skirmisher',
    name: 'Sky Skirmisher',
    rarity: 'rare',
    stats: [7, 'P', 6, 6],
    arrows: ['n', 'ne', 'nw', 'e', 'se', 'w'],
    image: IMG.griffin,
    artFilter: 'hue-rotate-30',
    price: 185,
    accentGradient: 'from-sky-950 via-amber-950 to-slate-950',
  },
  {
    id: 'nightblade-duelist',
    name: 'Nightblade Duelist',
    rarity: 'rare',
    stats: [7, 'X', 6, 5],
    arrows: ['n', 'ne', 'se', 's', 'sw', 'nw'],
    image: IMG.rogue,
    artFilter: 'hue-rotate-60 contrast-110',
    price: 195,
    accentGradient: 'from-purple-950 via-slate-900 to-slate-950',
  },
  {
    id: 'abyssal-eel',
    name: 'Abyssal Eel',
    rarity: 'rare',
    stats: [8, 'M', 4, 7],
    arrows: ['n', 'e', 's', 'w', 'sw'],
    image: IMG.serpent,
    artFilter: 'hue-rotate-60',
    price: 180,
    accentGradient: 'from-indigo-950 via-teal-950 to-slate-950',
  },
  {
    id: 'siege-tusker',
    name: 'Siege Tusker',
    rarity: 'rare',
    stats: [8, 'P', 8, 3],
    arrows: ['n', 'ne', 'nw', 's'],
    image: IMG.boar,
    artFilter: 'hue-rotate-15 saturate-125',
    price: 180,
    accentGradient: 'from-amber-950 via-stone-900 to-slate-950',
  },
  {
    id: 'radiant-bishop',
    name: 'Radiant Bishop',
    rarity: 'rare',
    stats: [6, 'M', 6, 8],
    arrows: ['n', 'e', 's', 'w', 'ne', 'nw'],
    image: IMG.cleric,
    artFilter: 'hue-rotate-30 brightness-105',
    price: 185,
    accentGradient: 'from-yellow-950 via-amber-950 to-slate-950',
  },
  {
    id: 'hellfire-gremlin',
    name: 'Hellfire Gremlin',
    rarity: 'rare',
    stats: [7, 'X', 4, 6],
    arrows: ['n', 'ne', 'e', 'se', 's', 'w'],
    image: IMG.imp,
    artFilter: 'hue-rotate-30 saturate-150',
    price: 190,
    accentGradient: 'from-red-950 via-amber-950 to-slate-950',
  },
  {
    id: 'royal-halberdier',
    name: 'Royal Halberdier',
    rarity: 'rare',
    stats: [7, 'P', 7, 5],
    arrows: ['n', 'ne', 'nw', 'e', 'w'],
    image: IMG.squire,
    artFilter: 'hue-rotate-180 contrast-110',
    price: 175,
    accentGradient: 'from-blue-950 via-slate-900 to-slate-950',
  },
  {
    id: 'alpha-direwolf',
    name: 'Alpha Direwolf',
    rarity: 'rare',
    stats: [8, 'P', 5, 5],
    arrows: ['n', 'ne', 'e', 'w', 'nw'],
    image: IMG.wolf,
    artFilter: 'hue-rotate-180 saturate-125',
    price: 180,
    accentGradient: 'from-cyan-950 via-slate-900 to-slate-950',
  },
  {
    id: 'granite-warden',
    name: 'Granite Warden',
    rarity: 'rare',
    stats: [6, 'P', 9, 4],
    arrows: ['n', 'e', 's', 'w'],
    image: IMG.golem,
    artFilter: 'hue-rotate-180 contrast-110',
    price: 180,
    accentGradient: 'from-teal-950 via-stone-900 to-slate-950',
  },
  {
    id: 'thunder-roc',
    name: 'Thunder Roc',
    rarity: 'rare',
    stats: [8, 'X', 5, 5],
    arrows: ['n', 'ne', 'nw', 'se', 'sw'],
    image: IMG.hawk,
    artFilter: 'hue-rotate-30 saturate-125',
    price: 195,
    accentGradient: 'from-amber-950 via-slate-900 to-slate-950',
  },
  {
    id: 'astral-lantern',
    name: 'Astral Lantern',
    rarity: 'rare',
    stats: [6, 'M', 5, 8],
    arrows: ['ne', 'e', 'se', 'sw', 'w', 'nw'],
    image: IMG.wisp,
    artFilter: 'hue-rotate-180 saturate-125',
    price: 180,
    accentGradient: 'from-sky-950 via-indigo-950 to-slate-950',
  },
  {
    id: 'alchemical-bomber',
    name: 'Alchemical Bomber',
    rarity: 'rare',
    stats: [7, 'X', 6, 5],
    arrows: ['n', 'e', 'se', 's', 'sw'],
    image: IMG.goblin,
    artFilter: 'hue-rotate-90 saturate-125',
    price: 190,
    accentGradient: 'from-emerald-950 via-stone-900 to-slate-950',
  },
  {
    id: 'prismatic-jelly',
    name: 'Prismatic Jelly',
    rarity: 'rare',
    stats: [6, 'X', 6, 7],
    arrows: ['n', 'ne', 'e', 's', 'sw', 'w'],
    image: IMG.slime,
    artFilter: 'hue-rotate-180 saturate-125',
    price: 190,
    accentGradient: 'from-purple-950 via-indigo-950 to-slate-950',
  },
  {
    id: 'elder-heartwood',
    name: 'Elder Heartwood',
    rarity: 'rare',
    stats: [7, 'M', 6, 6],
    arrows: ['n', 'ne', 'se', 's', 'sw', 'nw'],
    image: IMG.sprite,
    artFilter: 'hue-rotate-30 saturate-125',
    price: 185,
    accentGradient: 'from-emerald-950 via-amber-950 to-slate-950',
  },
  {
    id: 'chronos-owl',
    name: 'Chronos Owl',
    rarity: 'rare',
    stats: [7, 'X', 6, 6],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.owl,
    artFilter: 'hue-rotate-180 contrast-110',
    price: 200,
    accentGradient: 'from-cyan-950 via-slate-900 to-slate-950',
  },
  {
    id: 'moonlit-marksman',
    name: 'Moonlit Marksman',
    rarity: 'rare',
    stats: [8, 'P', 5, 6],
    arrows: ['n', 'ne', 'e', 'w', 'nw', 's'],
    image: IMG.ranger,
    artFilter: 'hue-rotate-180',
    price: 185,
    accentGradient: 'from-indigo-950 via-slate-900 to-slate-950',
  },

  // =========================================================================
  // EPIC TIER — 20 Cards (#61 to #80)
  // =========================================================================
  {
    id: 'stone-behemoth',
    name: 'Stone Behemoth',
    rarity: 'epic',
    stats: [10, 'P', 11, 5],
    arrows: ['e', 'se', 's', 'sw', 'w'],
    image: IMG.behemoth,
    price: 310,
    accentGradient: 'from-stone-800 via-orange-950 to-slate-950',
  },
  {
    id: 'valkyrie-lancer',
    name: 'Valkyrie Lancer',
    rarity: 'epic',
    stats: [10, 'X', 8, 8],
    arrows: ['n', 'nw', 'ne', 'e', 'se', 's'],
    image: IMG.valkyrie,
    price: 320,
    accentGradient: 'from-amber-900 via-slate-900 to-slate-950',
  },
  {
    id: 'obsidian-gargoyle',
    name: 'Obsidian Gargoyle',
    rarity: 'epic',
    stats: [9, 'X', 10, 7],
    arrows: ['n', 's', 'w', 'nw', 'sw', 'e'],
    image: IMG.gargoyle,
    price: 315,
    accentGradient: 'from-slate-800 via-stone-900 to-slate-950',
  },
  {
    id: 'tempest-djinn',
    name: 'Tempest Djinn',
    rarity: 'epic',
    stats: [11, 'M', 6, 10],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw'],
    image: IMG.djinn,
    price: 320,
    accentGradient: 'from-indigo-950 via-blue-950 to-slate-950',
  },
  {
    id: 'crimson-samurai',
    name: 'Crimson Samurai',
    rarity: 'epic',
    stats: [11, 'X', 9, 6],
    arrows: ['n', 'ne', 'e', 'se', 'w', 'nw'],
    image: IMG.samurai,
    price: 325,
    accentGradient: 'from-red-950 via-stone-900 to-slate-950',
  },
  {
    id: 'frost-wyvern',
    name: 'Frost Wyvern',
    rarity: 'epic',
    stats: [10, 'X', 8, 9],
    arrows: ['n', 'nw', 'ne', 'w', 'sw', 'e'],
    image: IMG.wyvern,
    price: 325,
    accentGradient: 'from-sky-950 via-cyan-950 to-slate-950',
  },
  {
    id: 'abyssal-lich',
    name: 'Abyssal Lich',
    rarity: 'epic',
    stats: [10, 'A', 7, 11],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.lich,
    price: 350,
    accentGradient: 'from-purple-950 via-slate-900 to-slate-950',
  },
  {
    id: 'void-necromancer',
    name: 'Void Necromancer',
    rarity: 'epic',
    stats: [11, 'M', 7, 10],
    arrows: ['n', 'ne', 'se', 's', 'sw', 'nw', 'w'],
    image: IMG.necromancer,
    artFilter: 'hue-rotate-60 saturate-125',
    price: 330,
    accentGradient: 'from-purple-950 via-indigo-950 to-slate-950',
  },
  {
    id: 'emerald-sharpshooter',
    name: 'Emerald Sharpshooter',
    rarity: 'epic',
    stats: [10, 'X', 8, 9],
    arrows: ['n', 'ne', 'e', 'se', 'nw', 'w'],
    image: IMG.ranger,
    artFilter: 'hue-rotate-30 saturate-125',
    price: 325,
    accentGradient: 'from-emerald-900 via-teal-950 to-slate-950',
  },
  {
    id: 'ironforge-bombardier',
    name: 'Ironforge Bombardier',
    rarity: 'epic',
    stats: [11, 'P', 10, 6],
    arrows: ['n', 'ne', 'e', 'se', 's', 'w'],
    image: IMG.dwarf,
    artFilter: 'hue-rotate-30 contrast-110',
    price: 325,
    accentGradient: 'from-amber-900 via-stone-900 to-slate-950',
  },
  {
    id: 'molten-colossus',
    name: 'Molten Colossus',
    rarity: 'epic',
    stats: [11, 'P', 11, 5],
    arrows: ['n', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.behemoth,
    artFilter: 'hue-rotate-15 saturate-150',
    price: 330,
    accentGradient: 'from-red-900 via-orange-950 to-slate-950',
  },
  {
    id: 'seraphic-dragoon',
    name: 'Seraphic Dragoon',
    rarity: 'epic',
    stats: [10, 'A', 8, 9],
    arrows: ['n', 'ne', 'e', 's', 'w', 'nw'],
    image: IMG.valkyrie,
    artFilter: 'hue-rotate-30 saturate-125',
    price: 350,
    accentGradient: 'from-amber-900 via-indigo-950 to-slate-950',
  },
  {
    id: 'cathedral-sentinel',
    name: 'Cathedral Sentinel',
    rarity: 'epic',
    stats: [9, 'X', 11, 8],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.gargoyle,
    artFilter: 'hue-rotate-180 contrast-110',
    price: 330,
    accentGradient: 'from-indigo-950 via-slate-900 to-slate-950',
  },
  {
    id: 'maelstrom-invoker',
    name: 'Maelstrom Invoker',
    rarity: 'epic',
    stats: [11, 'M', 7, 11],
    arrows: ['n', 'ne', 'e', 's', 'sw', 'w', 'nw'],
    image: IMG.djinn,
    artFilter: 'hue-rotate-60 saturate-125',
    price: 335,
    accentGradient: 'from-cyan-900 via-blue-950 to-slate-950',
  },
  {
    id: 'oni-blademaster',
    name: 'Oni Blademaster',
    rarity: 'epic',
    stats: [11, 'A', 9, 7],
    arrows: ['n', 'ne', 'e', 'se', 's', 'w', 'nw'],
    image: IMG.samurai,
    artFilter: 'hue-rotate-30 saturate-125',
    price: 355,
    accentGradient: 'from-rose-950 via-red-950 to-slate-950',
  },
  {
    id: 'aurora-drake',
    name: 'Aurora Drake',
    rarity: 'epic',
    stats: [10, 'X', 9, 9],
    arrows: ['n', 'ne', 'e', 'se', 'sw', 'w', 'nw'],
    image: IMG.wyvern,
    artFilter: 'hue-rotate-60 saturate-125',
    price: 335,
    accentGradient: 'from-teal-900 via-indigo-950 to-slate-950',
  },
  {
    id: 'soulfire-monarch',
    name: 'Soulfire Monarch',
    rarity: 'epic',
    stats: [11, 'M', 8, 11],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'nw'],
    image: IMG.lich,
    artFilter: 'hue-rotate-90 saturate-125',
    price: 340,
    accentGradient: 'from-emerald-950 via-slate-900 to-slate-950',
  },
  {
    id: 'aegis-crusader',
    name: 'Aegis Crusader',
    rarity: 'epic',
    stats: [10, 'P', 11, 8],
    arrows: ['n', 'ne', 'e', 's', 'w', 'nw'],
    image: IMG.knight,
    artFilter: 'hue-rotate-60 saturate-125',
    price: 325,
    accentGradient: 'from-amber-900 via-blue-950 to-slate-950',
  },
  {
    id: 'astral-archmage',
    name: 'Astral Archmage',
    rarity: 'epic',
    stats: [11, 'M', 7, 11],
    arrows: ['n', 'ne', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.mage,
    artFilter: 'hue-rotate-90 saturate-125',
    price: 335,
    accentGradient: 'from-violet-950 via-indigo-950 to-slate-950',
  },
  {
    id: 'eclipse-assassin',
    name: 'Eclipse Assassin',
    rarity: 'epic',
    stats: [10, 'A', 8, 8],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.rogue,
    artFilter: 'hue-rotate-180 contrast-115',
    price: 355,
    accentGradient: 'from-slate-800 via-violet-950 to-slate-950',
  },

  // =========================================================================
  // MYTHIC TIER — 10 Legendary Cards (#81 to #90)
  // =========================================================================
  {
    id: 'crimson-phoenix',
    name: 'Crimson Phoenix',
    rarity: 'mythic',
    stats: [13, 'A', 9, 12],
    arrows: ['n', 'nw', 'ne', 'e', 'se', 'w', 'sw'],
    image: IMG.phoenix,
    price: 540,
    accentGradient: 'from-red-900 via-amber-950 to-slate-950',
  },
  {
    id: 'aether-leviathan',
    name: 'Aether Leviathan',
    rarity: 'mythic',
    stats: [12, 'A', 11, 13],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.leviathan,
    price: 540,
    accentGradient: 'from-teal-950 via-blue-950 to-slate-950',
  },
  {
    id: 'emerald-titan',
    name: 'Emerald Titan',
    rarity: 'mythic',
    stats: [13, 'A', 14, 9],
    arrows: ['e', 'se', 's', 'sw', 'w', 'nw', 'n'],
    image: IMG.titan,
    price: 560,
    accentGradient: 'from-emerald-900 via-stone-900 to-slate-950',
  },
  {
    id: 'glacial-empress',
    name: 'Glacial Empress',
    rarity: 'mythic',
    stats: [12, 'A', 10, 14],
    arrows: ['n', 'nw', 'ne', 'w', 'sw', 's', 'se'],
    image: IMG.empress,
    price: 560,
    accentGradient: 'from-sky-900 via-indigo-950 to-slate-950',
  },
  {
    id: 'solar-sovereign',
    name: 'Solar Sovereign',
    rarity: 'mythic',
    stats: [14, 'A', 13, 13],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.sovereign,
    price: 620,
    accentGradient: 'from-amber-800 via-yellow-950 to-slate-950',
  },
  {
    id: 'celestial-archon',
    name: 'Celestial Archon',
    rarity: 'mythic',
    stats: [13, 'A', 12, 14],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.archon,
    price: 600,
    accentGradient: 'from-amber-700 via-indigo-950 to-slate-950',
  },
  {
    id: 'void-bahamut',
    name: 'Void Bahamut',
    rarity: 'mythic',
    stats: [14, 'A', 13, 12],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.voidDragon,
    price: 620,
    accentGradient: 'from-violet-900 via-fuchsia-950 to-slate-950',
  },
  {
    id: 'astral-phoenix',
    name: 'Astral Phoenix',
    rarity: 'mythic',
    stats: [13, 'X', 12, 13],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.phoenix,
    artFilter: 'hue-rotate-180 saturate-125',
    price: 580,
    accentGradient: 'from-cyan-900 via-blue-950 to-slate-950',
  },
  {
    id: 'abyssal-kraken',
    name: 'Abyssal Kraken',
    rarity: 'mythic',
    stats: [13, 'A', 13, 11],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.leviathan,
    artFilter: 'hue-rotate-90 saturate-125',
    price: 580,
    accentGradient: 'from-purple-900 via-indigo-950 to-slate-950',
  },
  {
    id: 'eternal-overlord',
    name: 'Eternal Overlord',
    rarity: 'mythic',
    stats: [14, 'A', 14, 14],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.sovereign,
    artFilter: 'hue-rotate-30 contrast-115 saturate-125',
    price: 680,
    accentGradient: 'from-amber-600 via-red-950 to-slate-950',
  },

  // =========================================================================
  // EXPANSION I — SPREN OF THE PRIMAL FORCES (#91 to #100)
  // =========================================================================
  {
    id: 'windspren',
    name: 'Windspren',
    rarity: 'common',
    stats: [4, 'X', 3, 4],
    arrows: ['n', 'ne', 'e', 'w'],
    image: IMG.wisp,
    artFilter: 'hue-rotate-180 saturate-150 brightness-110',
    price: 85,
    accentGradient: 'from-cyan-950 via-sky-950 to-slate-950',
  },
  {
    id: 'riverspren',
    name: 'Riverspren',
    rarity: 'common',
    stats: [3, 'M', 3, 5],
    arrows: ['n', 'e', 'se', 'sw'],
    image: IMG.slime,
    artFilter: 'hue-rotate-15 saturate-150 brightness-105',
    price: 85,
    accentGradient: 'from-sky-950 via-teal-950 to-slate-950',
  },
  {
    id: 'flamespren',
    name: 'Flamespren',
    rarity: 'common',
    stats: [5, 'M', 2, 4],
    arrows: ['n', 'nw', 'ne', 's'],
    image: IMG.wisp,
    artFilter: '-hue-rotate-30 saturate-200 contrast-110',
    price: 85,
    accentGradient: 'from-orange-950 via-red-950 to-slate-950',
  },
  {
    id: 'stonespren',
    name: 'Stonespren',
    rarity: 'rare',
    stats: [6, 'P', 9, 5],
    arrows: ['n', 'e', 's', 'w', 'se'],
    image: IMG.golem,
    artFilter: 'hue-rotate-30 saturate-125 contrast-115',
    price: 185,
    accentGradient: 'from-stone-800 via-amber-950 to-slate-950',
  },
  {
    id: 'lifespren',
    name: 'Lifespren',
    rarity: 'rare',
    stats: [6, 'M', 6, 8],
    arrows: ['n', 'ne', 'se', 'sw', 'nw'],
    image: IMG.sprite,
    artFilter: 'hue-rotate-15 saturate-150 brightness-110',
    price: 185,
    accentGradient: 'from-emerald-950 via-lime-950 to-slate-950',
  },
  {
    id: 'lightspren',
    name: 'Lightspren',
    rarity: 'rare',
    stats: [7, 'X', 5, 8],
    arrows: ['n', 'ne', 'e', 's', 'sw', 'nw'],
    image: IMG.archon,
    artFilter: '-hue-rotate-15 brightness-110 saturate-125',
    price: 195,
    accentGradient: 'from-amber-900 via-yellow-950 to-slate-950',
  },
  {
    id: 'stormspren',
    name: 'Stormspren',
    rarity: 'epic',
    stats: [11, 'M', 7, 11],
    arrows: ['n', 'ne', 'e', 'se', 'sw', 'nw'],
    image: IMG.djinn,
    artFilter: 'hue-rotate-15 saturate-150 contrast-110',
    price: 340,
    accentGradient: 'from-indigo-950 via-cyan-950 to-slate-950',
  },
  {
    id: 'darkspren',
    name: 'Darkspren',
    rarity: 'epic',
    stats: [11, 'A', 8, 10],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'nw'],
    image: IMG.lich,
    artFilter: 'hue-rotate-90 contrast-125 brightness-90',
    price: 355,
    accentGradient: 'from-slate-900 via-purple-950 to-slate-950',
  },
  {
    id: 'highspren',
    name: 'Highspren',
    rarity: 'mythic',
    stats: [13, 'A', 12, 14],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'nw'],
    image: IMG.archon,
    artFilter: 'hue-rotate-180 contrast-115 saturate-150',
    price: 620,
    accentGradient: 'from-sky-900 via-indigo-950 to-slate-950',
  },
  {
    id: 'voidspren',
    name: 'Voidspren',
    rarity: 'mythic',
    stats: [14, 'A', 13, 13],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.voidDragon,
    artFilter: 'hue-rotate-60 saturate-150 contrast-115',
    price: 650,
    accentGradient: 'from-fuchsia-950 via-rose-950 to-slate-950',
  },

  // =========================================================================
  // EXPANSION II — WILDWOOD, FEY, SPRITES & ENTS (#101 to #110)
  // =========================================================================
  {
    id: 'moonpetal-sprite',
    name: 'Moonpetal Sprite',
    rarity: 'common',
    stats: [4, 'M', 2, 5],
    arrows: ['n', 'ne', 'sw', 'nw'],
    image: IMG.sprite,
    artFilter: 'hue-rotate-180 saturate-125',
    price: 85,
    accentGradient: 'from-teal-950 via-indigo-950 to-slate-950',
  },
  {
    id: 'mossback-sapling',
    name: 'Mossback Sapling',
    rarity: 'common',
    stats: [3, 'P', 5, 3],
    arrows: ['n', 'e', 's'],
    image: IMG.golem,
    artFilter: 'saturate-125 brightness-105',
    price: 80,
    accentGradient: 'from-emerald-950 via-stone-900 to-slate-950',
  },
  {
    id: 'dewdrop-pixie',
    name: 'Dewdrop Pixie',
    rarity: 'common',
    stats: [4, 'X', 3, 4],
    arrows: ['ne', 'e', 'sw', 'w'],
    image: IMG.wisp,
    artFilter: 'hue-rotate-90 saturate-150 brightness-105',
    price: 90,
    accentGradient: 'from-emerald-950 via-cyan-950 to-slate-950',
  },
  {
    id: 'bramble-ent',
    name: 'Bramble Ent',
    rarity: 'rare',
    stats: [8, 'P', 9, 4],
    arrows: ['n', 'e', 'se', 's', 'w'],
    image: IMG.titan,
    artFilter: 'hue-rotate-30 contrast-110',
    price: 185,
    accentGradient: 'from-emerald-950 via-stone-900 to-slate-950',
  },
  {
    id: 'sylvan-feyblade',
    name: 'Sylvan Feyblade',
    rarity: 'rare',
    stats: [8, 'X', 6, 7],
    arrows: ['n', 'ne', 'e', 'sw', 'nw'],
    image: IMG.ranger,
    artFilter: '-hue-rotate-15 saturate-150',
    price: 195,
    accentGradient: 'from-emerald-900 via-teal-950 to-slate-950',
  },
  {
    id: 'glade-nymph',
    name: 'Glade Nymph',
    rarity: 'rare',
    stats: [7, 'M', 5, 8],
    arrows: ['n', 'ne', 'e', 'se', 'sw', 'nw'],
    image: IMG.sprite,
    artFilter: 'hue-rotate-90 saturate-150',
    price: 190,
    accentGradient: 'from-teal-900 via-emerald-950 to-slate-950',
  },
  {
    id: 'ancient-heartwood-ent',
    name: 'Ancient Heartwood Ent',
    rarity: 'epic',
    stats: [11, 'P', 12, 8],
    arrows: ['n', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.titan,
    artFilter: 'saturate-125 contrast-110',
    price: 335,
    accentGradient: 'from-emerald-900 via-amber-950 to-slate-950',
  },
  {
    id: 'thornbark-fey-queen',
    name: 'Thornbark Fey Queen',
    rarity: 'epic',
    stats: [10, 'A', 9, 11],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'nw'],
    image: IMG.empress,
    artFilter: 'hue-rotate-90 saturate-125',
    price: 355,
    accentGradient: 'from-emerald-900 via-violet-950 to-slate-950',
  },
  {
    id: 'verdant-archdruid',
    name: 'Verdant Archdruid',
    rarity: 'epic',
    stats: [11, 'M', 8, 11],
    arrows: ['n', 'ne', 'e', 's', 'sw', 'w', 'nw'],
    image: IMG.cleric,
    artFilter: 'hue-rotate-90 saturate-150',
    price: 345,
    accentGradient: 'from-emerald-900 via-teal-950 to-slate-950',
  },
  {
    id: 'worldtree-sovereign',
    name: 'Worldtree Sovereign',
    rarity: 'mythic',
    stats: [14, 'A', 14, 13],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.titan,
    artFilter: 'hue-rotate-60 saturate-150 brightness-105',
    price: 660,
    accentGradient: 'from-emerald-800 via-amber-950 to-slate-950',
  },

  // =========================================================================
  // EXPANSION III — CRYPT & UNDEAD LEGION (#111 to #120)
  // =========================================================================
  {
    id: 'crypt-skeleton',
    name: 'Crypt Skeleton',
    rarity: 'common',
    stats: [4, 'P', 4, 2],
    arrows: ['n', 'e', 'w'],
    image: IMG.squire,
    artFilter: 'grayscale contrast-125 brightness-90',
    price: 80,
    accentGradient: 'from-slate-800 via-zinc-900 to-slate-950',
  },
  {
    id: 'cemetery-ghoul',
    name: 'Cemetery Ghoul',
    rarity: 'common',
    stats: [5, 'P', 3, 2],
    arrows: ['n', 'ne', 'se', 'w'],
    image: IMG.goblin,
    artFilter: 'hue-rotate-90 saturate-75 contrast-125',
    price: 85,
    accentGradient: 'from-emerald-950 via-stone-900 to-slate-950',
  },
  {
    id: 'mourning-wraith',
    name: 'Mourning Wraith',
    rarity: 'common',
    stats: [4, 'M', 2, 5],
    arrows: ['nw', 'ne', 'sw', 'se'],
    image: IMG.necromancer,
    artFilter: 'hue-rotate-180 brightness-95',
    price: 85,
    accentGradient: 'from-indigo-950 via-slate-900 to-slate-950',
  },
  {
    id: 'hollow-revenant',
    name: 'Hollow Revenant',
    rarity: 'rare',
    stats: [8, 'P', 7, 5],
    arrows: ['n', 'ne', 'e', 's', 'w'],
    image: IMG.knight,
    artFilter: 'hue-rotate-90 saturate-75 contrast-125',
    price: 185,
    accentGradient: 'from-teal-950 via-slate-900 to-slate-950',
  },
  {
    id: 'wailing-banshee',
    name: 'Wailing Banshee',
    rarity: 'rare',
    stats: [8, 'M', 4, 8],
    arrows: ['n', 'nw', 'ne', 'sw', 'se'],
    image: IMG.empress,
    artFilter: 'hue-rotate-60 saturate-75 contrast-125',
    price: 190,
    accentGradient: 'from-violet-950 via-slate-900 to-slate-950',
  },
  {
    id: 'nightborn-vampire',
    name: 'Nightborn Vampire',
    rarity: 'rare',
    stats: [8, 'X', 6, 7],
    arrows: ['n', 'ne', 'e', 'se', 'sw', 'nw'],
    image: IMG.rogue,
    artFilter: '-hue-rotate-45 saturate-150 contrast-115',
    price: 195,
    accentGradient: 'from-rose-950 via-slate-900 to-slate-950',
  },
  {
    id: 'crimson-nosferatu',
    name: 'Crimson Nosferatu',
    rarity: 'epic',
    stats: [11, 'A', 9, 10],
    arrows: ['n', 'ne', 'e', 'se', 's', 'nw'],
    image: IMG.samurai,
    artFilter: '-hue-rotate-15 saturate-150 contrast-125',
    price: 350,
    accentGradient: 'from-rose-950 via-red-950 to-slate-950',
  },
  {
    id: 'dread-deathknight',
    name: 'Dread Deathknight',
    rarity: 'epic',
    stats: [12, 'P', 11, 8],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.knight,
    artFilter: 'hue-rotate-180 contrast-125 brightness-90',
    price: 345,
    accentGradient: 'from-sky-950 via-slate-900 to-slate-950',
  },
  {
    id: 'bone-behemoth',
    name: 'Bone Behemoth',
    rarity: 'epic',
    stats: [11, 'P', 12, 7],
    arrows: ['n', 'e', 'se', 's', 'sw', 'w'],
    image: IMG.behemoth,
    artFilter: 'grayscale contrast-125 brightness-95',
    price: 335,
    accentGradient: 'from-stone-800 via-slate-900 to-slate-950',
  },
  {
    id: 'skeletal-dracolich',
    name: 'Skeletal Dracolich',
    rarity: 'mythic',
    stats: [15, 'A', 13, 13],
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    image: IMG.wyvern,
    artFilter: 'hue-rotate-90 contrast-125 saturate-125',
    price: 680,
    accentGradient: 'from-violet-950 via-emerald-950 to-slate-950',
  },
];

function computeCardShopPrice(entry: RawEntry, cardNumber: number): number {
  if (entry.rarity === 'mythic') {
    // Mythic cards cannot be purchased in the shop — earned only from High-Tier RNG or Boss spoils
    return 0;
  }
  const arrowCount = entry.arrows.length;
  const type = entry.stats[1];

  if (entry.rarity === 'common') {
    const tierOffset = Math.min(29, Math.max(0, cardNumber - 1));
    const raw =
      140 +
      tierOffset * 5 +
      Math.max(0, arrowCount - 3) * 20 +
      (type === 'X' ? 35 : 0);
    return Math.round(raw / 10) * 10; // 140g – 340g
  }

  if (entry.rarity === 'rare') {
    const tierOffset = Math.min(29, Math.max(0, cardNumber - 31));
    const raw =
      950 +
      tierOffset * 26 +
      Math.max(0, arrowCount - 4) * 75 +
      (type === 'X' ? 110 : 0);
    return Math.round(raw / 10) * 10; // 950g – 1,980g
  }

  // Epic: Major prestige investment (3,800g – 6,500g)
  const tierOffset = Math.min(19, Math.max(0, cardNumber - 61));
  const raw =
    3800 +
    tierOffset * 95 +
    Math.max(0, arrowCount - 5) * 220 +
    (type === 'A' ? 450 : type === 'X' ? 200 : 0);
  return Math.round(raw / 50) * 50;
}

/**
 * Innate Legendary Augments — reserved exclusively for select Mythic cards so
 * augments feel rare and special. All other cards can be customized by crafting
 * Runes onto specific card copies at the Shop Runeforge!
 */
export const CARD_AUGMENTS: Record<string, CardAugment> = {
  // === MYTHIC LEGENDARY INNATE TRAITS ===
  'emerald-titan': {
    id: 'aug-titan-earthshaker',
    name: 'Worldtree Bastion',
    shortTag: '+2 DEF (All Allies)',
    badgeLabel: 'ALL +2 DEF',
    description: 'On Play: All friendly cards on the board gain +1 Power, +2 P.Def & +2 M.Def.',
    scope: 'all_allies',
    powerDelta: 1,
    pDefDelta: 2,
    mDefDelta: 2,
  },
  'celestial-archon': {
    id: 'aug-archon-ascension',
    name: 'Celestial Chorus',
    shortTag: '+2 ALL (All Allies)',
    badgeLabel: 'ALL +2 ALL',
    description: 'On Play: All friendly cards on the board gain +2 Power, +2 P.Def & +2 M.Def.',
    scope: 'all_allies',
    powerDelta: 2,
    pDefDelta: 2,
    mDefDelta: 2,
  },
  'void-bahamut': {
    id: 'aug-bahamut-eclipse',
    name: 'Oblivion Roar',
    shortTag: '-3 DEF (Adj. Rivals)',
    badgeLabel: 'FOE -3 DEF',
    description: 'On Play: Adjacent rival cards on the board lose -2 Power, -3 P.Def & -3 M.Def.',
    scope: 'adjacent_rivals',
    powerDelta: -2,
    pDefDelta: -3,
    mDefDelta: -3,
  },
  'astral-phoenix': {
    id: 'aug-astral-rebirth',
    name: 'Starlight Aegis',
    shortTag: '+3 DEF (Type X)',
    badgeLabel: 'X +3 ALL',
    description: 'On Play: Friendly X-type cards on the board gain +2 Power, +3 P.Def & +3 M.Def.',
    scope: 'type_X_allies',
    powerDelta: 2,
    pDefDelta: 3,
    mDefDelta: 3,
  },
  'eternal-overlord': {
    id: 'aug-overlord-dominion',
    name: 'Sovereign Dominion',
    shortTag: '+3 ALL (All Allies)',
    badgeLabel: 'ALL +3 ALL',
    description: 'On Play: All friendly cards on the board gain +3 Power, +3 P.Def & +3 M.Def.',
    scope: 'all_allies',
    powerDelta: 3,
    pDefDelta: 3,
    mDefDelta: 3,
  },
  'voidspren': {
    id: 'aug-voidspren-rift',
    name: 'Void Resonance',
    shortTag: '-3 DEF (Adj. Rivals)',
    badgeLabel: 'FOE -3 DEF',
    description: 'On Play: Adjacent rival cards on the board lose -2 Power, -3 P.Def & -3 M.Def.',
    scope: 'adjacent_rivals',
    powerDelta: -2,
    pDefDelta: -3,
    mDefDelta: -3,
  },
  'worldtree-sovereign': {
    id: 'aug-worldtree-canopy',
    name: 'Canopy Blessing',
    shortTag: '+2 ALL (All Allies)',
    badgeLabel: 'ALL +2 ALL',
    description: 'On Play: All friendly cards on the board gain +2 Power, +2 P.Def & +2 M.Def.',
    scope: 'all_allies',
    powerDelta: 2,
    pDefDelta: 2,
    mDefDelta: 2,
  },
  'skeletal-dracolich': {
    id: 'aug-dracolich-dread',
    name: 'Phylactery Dread',
    shortTag: '-3 DEF (Adj. Rivals)',
    badgeLabel: 'FOE -3 DEF',
    description: 'On Play: Adjacent rival cards on the board lose -2 Power, -3 P.Def & -3 M.Def.',
    scope: 'adjacent_rivals',
    powerDelta: -2,
    pDefDelta: -3,
    mDefDelta: -3,
  },
};

/**
 * Craftable Augment Runes — available to imbue onto any owned non-innate card copy
 * at the Shop Runeforge using Gold.
 */
export const CRAFTABLE_AUGMENTS: CraftableAugment[] = [
  // === MINOR RUNES (Early & Mid-Game Tactical Boosts) ===
  {
    id: 'rune-iron-bulwark',
    tier: 'minor',
    craftCost: 350,
    name: 'Iron Bulwark',
    shortTag: '+1 P.Def (Type P)',
    badgeLabel: 'P +1 P.DEF',
    description: 'On Play: All friendly P-type cards already on the board gain +1 P.Def.',
    scope: 'type_P_allies',
    powerDelta: 0,
    pDefDelta: 1,
    mDefDelta: 0,
  },
  {
    id: 'rune-arcane-veil',
    tier: 'minor',
    craftCost: 350,
    name: 'Arcane Veil',
    shortTag: '+1 M.Def (Type M)',
    badgeLabel: 'M +1 M.DEF',
    description: 'On Play: All friendly M-type cards already on the board gain +1 M.Def.',
    scope: 'type_M_allies',
    powerDelta: 0,
    pDefDelta: 0,
    mDefDelta: 1,
  },
  {
    id: 'rune-barkskin-aura',
    tier: 'minor',
    craftCost: 420,
    name: 'Barkskin Aura',
    shortTag: '+1 DEF (Adj. Allies)',
    badgeLabel: 'ADJ +1 DEF',
    description: 'On Play: Adjacent friendly cards on the board gain +1 P.Def & +1 M.Def.',
    scope: 'adjacent_allies',
    powerDelta: 0,
    pDefDelta: 1,
    mDefDelta: 1,
  },
  {
    id: 'rune-wither-hex',
    tier: 'minor',
    craftCost: 450,
    name: 'Wither Hex',
    shortTag: '-1 DEF (Adj. Rivals)',
    badgeLabel: 'FOE -1 DEF',
    description: 'On Play: Adjacent rival cards on the board lose -1 P.Def & -1 M.Def.',
    scope: 'adjacent_rivals',
    powerDelta: 0,
    pDefDelta: -1,
    mDefDelta: -1,
  },

  // === MAJOR RUNES (Dedicated Deck Synergies) ===
  {
    id: 'rune-vanguard-rally',
    tier: 'major',
    craftCost: 1100,
    name: 'Vanguard Rally',
    shortTag: '+1 PWR/+2 P.Def (Type P)',
    badgeLabel: 'P +1P/+2D',
    description: 'On Play: Friendly P-type cards on the board gain +1 Power & +2 P.Def.',
    scope: 'type_P_allies',
    powerDelta: 1,
    pDefDelta: 2,
    mDefDelta: 0,
  },
  {
    id: 'rune-astral-ward',
    tier: 'major',
    craftCost: 1100,
    name: 'Astral Ward',
    shortTag: '+1 PWR/+2 M.Def (Type M)',
    badgeLabel: 'M +1P/+2D',
    description: 'On Play: Friendly M-type cards on the board gain +1 Power & +2 M.Def.',
    scope: 'type_M_allies',
    powerDelta: 1,
    pDefDelta: 0,
    mDefDelta: 2,
  },
  {
    id: 'rune-tempest-matrix',
    tier: 'major',
    craftCost: 1250,
    name: 'Tempest Matrix',
    shortTag: '+1 PWR/+2 DEF (Type X)',
    badgeLabel: 'X +1P/+2D',
    description: 'On Play: Friendly X-type cards on the board gain +1 Power, +2 P.Def & +2 M.Def.',
    scope: 'type_X_allies',
    powerDelta: 1,
    pDefDelta: 2,
    mDefDelta: 2,
  },
  {
    id: 'rune-armor-sunder',
    tier: 'major',
    craftCost: 1400,
    name: 'Armor Sunder',
    shortTag: '-2 DEF (Adj. Rivals)',
    badgeLabel: 'FOE -2 DEF',
    description: 'On Play: Adjacent rival cards on the board lose -2 P.Def & -2 M.Def.',
    scope: 'adjacent_rivals',
    powerDelta: 0,
    pDefDelta: -2,
    mDefDelta: -2,
  },

  // === SOVEREIGN RUNES (Endgame Prestige Forging) ===
  {
    id: 'rune-sanctum-chorus',
    tier: 'sovereign',
    craftCost: 2800,
    name: 'Sanctum Chorus',
    shortTag: '+1 PWR/+2 DEF (All Allies)',
    badgeLabel: 'ALL +1P/+2D',
    description: 'On Play: All friendly cards on the board gain +1 Power, +2 P.Def & +2 M.Def.',
    scope: 'all_allies',
    powerDelta: 1,
    pDefDelta: 2,
    mDefDelta: 2,
  },
  {
    id: 'rune-eclipse-overdrive',
    tier: 'sovereign',
    craftCost: 3000,
    name: 'Eclipse Overdrive',
    shortTag: '+2 ALL (Type A)',
    badgeLabel: 'A +2 ALL',
    description: 'On Play: Friendly A-type cards on the board gain +2 Power, +2 P.Def & +2 M.Def.',
    scope: 'type_A_allies',
    powerDelta: 2,
    pDefDelta: 2,
    mDefDelta: 2,
  },
  {
    id: 'rune-abyssal-blight',
    tier: 'sovereign',
    craftCost: 3400,
    name: 'Abyssal Blight',
    shortTag: '-2 ALL (Adj. Rivals)',
    badgeLabel: 'FOE -2 ALL',
    description: 'On Play: Adjacent rival cards on the board lose -2 Power, -2 P.Def & -2 M.Def.',
    scope: 'adjacent_rivals',
    powerDelta: -2,
    pDefDelta: -2,
    mDefDelta: -2,
  },
];

export const CRAFTABLE_AUGMENT_MAP: Record<string, CraftableAugment> =
  Object.fromEntries(CRAFTABLE_AUGMENTS.map((a) => [a.id, a]));

export function resolveCardAugment(
  cardId: string,
  augmentId?: string
): CardAugment | undefined {
  if (augmentId && CRAFTABLE_AUGMENT_MAP[augmentId]) {
    return CRAFTABLE_AUGMENT_MAP[augmentId];
  }
  return CARD_MAP[cardId]?.augment;
}

export const CARDS: CardDef[] = RAW_CARDS.map((entry, idx) => {
  const number = idx + 1;
  return {
    id: entry.id,
    number,
    name: entry.name,
    rarity: entry.rarity,
    role: ROLE_FROM_TYPE[entry.stats[1]],
    stats: {
      power: entry.stats[0],
      type: entry.stats[1],
      pDef: entry.stats[2],
      mDef: entry.stats[3],
    },
    arrows: entry.arrows,
    augment: CARD_AUGMENTS[entry.id],
    image: entry.image,
    artFilter: entry.artFilter,
    price: computeCardShopPrice(entry, number),
    accentGradient: entry.accentGradient,
  };
});

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((card) => [card.id, card])
);

export function getCardThumbUrl(imagePath: string): string {
  if (!imagePath.includes('/thumbs/')) {
    if (imagePath.startsWith('./src/assets/images/')) {
      return imagePath.replace('./src/assets/images/', './src/assets/images/thumbs/');
    }
    if (imagePath.startsWith('/src/assets/images/')) {
      return imagePath.replace('/src/assets/images/', '/src/assets/images/thumbs/');
    }
  }
  return imagePath;
}

// 12 starter cards unlocked right away so new players can build 10-card tactical hands immediately
export const STARTER_CARD_IDS = [
  'ember-imp',
  'iron-squire',
  'frost-wolf',
  'moss-golem',
  'gale-hawk',
  'lantern-wisp',
  'goblin-sapper',
  'crystal-slime',
  'clockwork-owl',
  'copper-cannoneer',
  'timber-bowman',
  'crypt-acolyte',
];

export interface BoosterPackDef {
  id: 'tavern-pack' | 'royal-vault' | 'mythic-chest';
  name: string;
  price: number;
  cardCount: number;
  subtitle: string;
  guaranteeText: string;
  accentCardId: string;
  weights: Record<CardDef['rarity'], number>;
  guaranteedMinRarity?: 'rare' | 'epic';
}

export const BOOSTER_PACKS: BoosterPackDef[] = [
  {
    id: 'tavern-pack',
    name: 'Treno Booster',
    price: 380,
    cardCount: 3,
    subtitle: '3 standard collector cards (Commons & Rares)',
    guaranteeText: '82% Common · 18% Rare',
    accentCardId: 'clockwork-owl',
    weights: { common: 82, rare: 18, epic: 0, mythic: 0 },
  },
  {
    id: 'royal-vault',
    name: 'Lindblum Vault',
    price: 1500,
    cardCount: 3,
    subtitle: '3 guild-forged cards with a shot at Epics',
    guaranteeText: '1+ Rare or Epic guaranteed',
    accentCardId: 'runic-knight',
    weights: { common: 35, rare: 55, epic: 10, mythic: 0 },
    guaranteedMinRarity: 'rare',
  },
  {
    id: 'mythic-chest',
    name: 'Esto Gaza Reliquary',
    price: 4400,
    cardCount: 3,
    subtitle: '3 high-grade Rare & Epic sanctuary cards',
    guaranteeText: '1+ Epic guaranteed (No Mythics in packs)',
    accentCardId: 'eclipse-assassin',
    weights: { common: 0, rare: 58, epic: 42, mythic: 0 },
    guaranteedMinRarity: 'epic',
  },
];

export const MAX_COPIES_PER_CARD = 5;

export const ALL_ARROW_DIRS: ArrowDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export const RARITY_STAT_RANGE: Record<
  Rarity,
  { min: number; max: number; label: string }
> = {
  common: { min: 1, max: 6, label: '1–6' },
  rare: { min: 4, max: 9, label: '4–9' },
  epic: { min: 7, max: 12, label: '7–C' },
  mythic: { min: 10, max: 15, label: 'A–F' },
};

export const RARITY_ARROW_RANGE: Record<
  Rarity,
  { min: number; max: number; label: string }
> = {
  common: { min: 2, max: 5, label: '2–5▲' },
  rare: { min: 3, max: 6, label: '3–6▲' },
  epic: { min: 4, max: 7, label: '4–7▲' },
  mythic: { min: 5, max: 8, label: '5–8▲' },
};

export function toHexDigit(value: number): string {
  const clamped = Math.max(0, Math.min(15, Math.round(value)));
  return clamped.toString(16).toUpperCase();
}

export function formatTetraCode(stats: TetraStats): string {
  return `${toHexDigit(stats.power)}${stats.type}${toHexDigit(stats.pDef)}${toHexDigit(stats.mDef)}`;
}

export function formatArrowsCompact(arrows: ArrowDir[]): string {
  return arrows.map((d) => d.toUpperCase()).join('·');
}

export function getStatsPowerScore(stats: TetraStats, arrowCount = 0): number {
  const typeBonus = stats.type === 'A' ? 6 : stats.type === 'X' ? 3 : 0;
  return stats.power + stats.pDef + stats.mDef + typeBonus + arrowCount * 1.15;
}

export function getCardPower(card: CardDef): number {
  return getStatsPowerScore(card.stats, card.arrows.length);
}

/**
 * Rolls a card's Power, P.Def, and M.Def within its rarity tier range,
 * centered around the card's archetype baseline (+/-2) so every pulled/won copy has unique values.
 */
export function rollCardStats(card: CardDef, useBaseline = false): TetraStats {
  if (useBaseline) {
    return { ...card.stats };
  }
  const range = RARITY_STAT_RANGE[card.rarity];
  const rollOne = (baseVal: number) => {
    const low = Math.max(range.min, baseVal - 2);
    const high = Math.min(range.max, baseVal + 2);
    return low + Math.floor(Math.random() * (high - low + 1));
  };

  // Small chance for a card to roll an upgraded Flexible (X) or Assault (A) attack type!
  let rolledType: AttackType = card.stats.type;
  const typeRoll = Math.random();
  if ((card.stats.type === 'P' || card.stats.type === 'M') && typeRoll < 0.14) {
    rolledType = 'X';
  } else if (card.stats.type === 'X' && typeRoll < 0.1) {
    rolledType = 'A';
  }

  return {
    power: rollOne(card.stats.power),
    type: rolledType,
    pDef: rollOne(card.stats.pDef),
    mDef: rollOne(card.stats.mDef),
  };
}

/**
 * Rolls a randomized 8-way compass arrow configuration for a card copy within its rarity tier's arrow count range.
 * Every new roll of the same card generates a distinct directional layout and arrow count!
 */
export function rollCardArrows(card: CardDef, useBaseline = false): ArrowDir[] {
  if (useBaseline) {
    return [...card.arrows];
  }
  const range = RARITY_ARROW_RANGE[card.rarity];
  const baseCount = card.arrows.length;
  const minCount = Math.max(range.min, baseCount - 1);
  const maxCount = Math.min(range.max, baseCount + 1);
  const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

  // Shuffle all 8 directions with a gentle affinity for some of the card's archetype directions
  // while guaranteeing fresh directional combinations on new rolls
  const scored = ALL_ARROW_DIRS.map((dir) => ({
    dir,
    weight: Math.random() + (card.arrows.includes(dir) ? 0.18 : 0),
  })).sort((a, b) => b.weight - a.weight);

  const chosenSet = new Set(scored.slice(0, count).map((s) => s.dir));
  return ALL_ARROW_DIRS.filter((d) => chosenSet.has(d));
}

export function rollCardInstance(cardId: string, useBaseline = false): RolledCardInstance {
  const card = CARD_MAP[cardId] ?? CARDS[0];
  return {
    uid: `inst-${card.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    cardId: card.id,
    stats: rollCardStats(card, useBaseline),
    arrows: rollCardArrows(card, useBaseline),
  };
}

/**
 * Calculates how much Gold a rolled card instance sells for.
 * Higher stat rolls, extra arrows, and X/A attack types fetch a higher Gold price at the Emporium!
 */
export function getCardSellValue(
  card: CardDef,
  stats?: TetraStats,
  arrows?: ArrowDir[]
): number {
  const s = stats ?? card.stats;
  const a = arrows ?? card.arrows;
  const range = RARITY_STAT_RANGE[card.rarity];
  const baseMid = (range.min + range.max) * 1.5;
  const actualSum = s.power + s.pDef + s.mDef;
  const rollDiff = actualSum - baseMid;
  const arrowDiff = a.length - card.arrows.length;

  const baseSellByRarity: Record<Rarity, number> = {
    common: Math.max(45, Math.round(card.price * 0.38)),
    rare: Math.max(280, Math.round(card.price * 0.36)),
    epic: Math.max(1150, Math.round(card.price * 0.35)),
    mythic: 3200,
  };

  const perStatPoint: Record<Rarity, number> = {
    common: 6,
    rare: 28,
    epic: 95,
    mythic: 220,
  };

  const typeBonus =
    s.type === 'A' && card.stats.type !== 'A'
      ? perStatPoint[card.rarity] * 2
      : s.type === 'X' && card.stats.type !== 'X'
      ? perStatPoint[card.rarity]
      : 0;

  const arrowBonus = arrowDiff * perStatPoint[card.rarity];

  const raw =
    baseSellByRarity[card.rarity] +
    Math.round(rollDiff * perStatPoint[card.rarity]) +
    typeBonus +
    arrowBonus;
  return Math.max(25, Math.round(raw / 5) * 5);
}
