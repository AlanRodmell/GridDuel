import { GoogleGenAI } from '@google/genai';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_DIR, 'src/assets/images');
const THUMBS_DIR = path.join(IMAGES_DIR, 'thumbs');
const CARDS_FILE = path.join(ROOT_DIR, 'src/data/cards.ts');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const MODEL_ID = 'gemini-2.5-flash-image';
const TARGET_SIZE = 1024;
const THUMB_SIZE = 320;
const VALID_TYPES = new Set(['P', 'M', 'X', 'A']);
const VALID_ARROWS = new Set(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);

const STYLE_REFERENCE_FILES = [
  'card_cinder_drake_1795362406493.jpg',
  'card_abyssal_lich_1795363117841.jpg',
];

const NEW_CARDS = [
  {
    id: 'malboro-stalker',
    imgKey: 'malboro',
    fileSlug: 'malboro_stalker',
    name: 'Malboro Stalker',
    rarity: 'common',
    stats: [5, 'M', 4, 5], // 5M45
    arrows: ['n', 'ne', 'sw', 'w'],
    price: 85,
    accentGradient: 'from-emerald-950 via-lime-950 to-slate-950',
    artPrompt:
      'A grotesque dark-fantasy swamp plant-beast monster inspired by classic JRPG Malboro creatures: bulbous mossy-emerald flesh covered in gnarled roots and writhing thorny tendrils, clusters of eerie glowing amber eyes along its crown, and a wide fanged maw exhaling swirling bioluminescent chartreuse toxic mist in a misty shadowed bog.',
  },
  {
    id: 'tonberry-shade',
    imgKey: 'tonberry',
    fileSlug: 'tonberry_shade',
    name: 'Tonberry Shade',
    rarity: 'rare',
    stats: [8, 'X', 5, 7], // 8X57
    arrows: ['n', 'ne', 'e', 'sw', 'w'],
    price: 190,
    accentGradient: 'from-teal-950 via-emerald-950 to-slate-950',
    augment: {
      id: 'aug-tonberry-grudge',
      name: 'Lantern Grudge',
      shortTag: '-2 DEF (Adj. Rivals)',
      badgeLabel: 'FOE -2 DEF',
      description:
        'On Play: Adjacent rival cards on the board lose -1 Power, -2 P.Def & -2 M.Def.',
      scope: 'adjacent_rivals',
      powerDelta: -1,
      pDefDelta: -2,
      mDefDelta: -2,
    },
    artPrompt:
      'An eerie dark-fantasy hooded spirit-stalker creature inspired by classic JRPG Tonberry monsters: compact amphibious silhouette wrapped in a weathered tattered olive-brown cloak, two piercing glowing golden eyes beneath a deep cowl, holding a blazing runic spirit lantern aloft in one clawed hand and a gleaming forged dagger in the other, standing on ancient mossy dungeon stone.',
  },
  {
    id: 'voltaic-chimera',
    imgKey: 'chimera',
    fileSlug: 'voltaic_chimera',
    name: 'Voltaic Chimera',
    rarity: 'rare',
    stats: [9, 'P', 7, 5], // 9P75
    arrows: ['n', 'nw', 'ne', 'e', 'se', 'w'],
    price: 185,
    accentGradient: 'from-indigo-950 via-cyan-950 to-slate-950',
    artPrompt:
      'A ferocious dark-fantasy three-headed storm chimera beast perched atop a jagged mountain crag: a roaring horned tempest lion main body with dark bronze-iron scales, a crackling azure-scaled dragon head beside it, and a coiling viper tail, with violent arcs of electric cyan-white lightning illuminating storm clouds behind it.',
  },
  {
    id: 'onyx-cavalier',
    imgKey: 'cavalier',
    fileSlug: 'onyx_cavalier',
    name: 'Onyx Cavalier',
    rarity: 'epic',
    stats: [11, 'A', 10, 8], // BAA8
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'nw'],
    price: 345,
    accentGradient: 'from-violet-950 via-slate-900 to-slate-950',
    augment: {
      id: 'aug-cavalier-cleave',
      name: 'Rift Zantetsu',
      shortTag: '+2 PWR/+1 DEF (Type A)',
      badgeLabel: 'A +2P/+1D',
      description:
        'On Play: Friendly A-type cards on the board gain +2 Power, +1 P.Def & +1 M.Def.',
      scope: 'type_A_allies',
      powerDelta: 2,
      pDefDelta: 1,
      mDefDelta: 1,
    },
    artPrompt:
      'A towering dark-fantasy spectral knight summon inspired by Odin: ornate horned obsidian plate armor with tattered crimson-violet cape, mounted astride an armored six-legged shadow warhorse, raising a colossal silver-violet greatsword crackling with arcane dimensional rift lightning amidst swirling battle ash and faint glowing runes.',
  },
  {
    id: 'sanctum-colossus',
    imgKey: 'colossus',
    fileSlug: 'sanctum_colossus',
    name: 'Sanctum Colossus',
    rarity: 'mythic',
    stats: [14, 'A', 15, 13], // EAFD
    arrows: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
    price: 640,
    accentGradient: 'from-amber-700 via-yellow-950 to-slate-950',
    augment: {
      id: 'aug-colossus-bastion',
      name: 'Divine Judgement',
      shortTag: '+2 PWR/+3 DEF (All Allies)',
      badgeLabel: 'ALL +2P/+3D',
      description:
        'On Play: All friendly cards on the board gain +2 Power, +3 P.Def & +3 M.Def.',
      scope: 'all_allies',
      powerDelta: 2,
      pDefDelta: 3,
      mDefDelta: 3,
    },
    artPrompt:
      'A colossal legendary holy fortress-summon golem inspired by Alexander: an ancient gothic cathedral shaped into a towering gilded stone and gold-filigree titan with luminous radiant wings of golden light, a crowned spire helm, and brilliant divine judgement beams glowing from its runic chest core, rising above dark storm clouds.',
  },
];

function validateCardDef(card) {
  const [power, type, pDef, mDef] = card.stats;
  for (const [label, val] of [
    ['power', power],
    ['pDef', pDef],
    ['mDef', mDef],
  ]) {
    if (!Number.isInteger(val) || val < 0 || val > 15) {
      throw new Error(`Invalid ${label} (${val}) on card "${card.id}": must be integer 0–15.`);
    }
  }
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid attack type "${type}" on card "${card.id}".`);
  }
  if (!Array.isArray(card.arrows) || card.arrows.length === 0) {
    throw new Error(`Card "${card.id}" must have at least one directional arrow.`);
  }
  const uniqueArrows = new Set(card.arrows);
  if (uniqueArrows.size !== card.arrows.length) {
    throw new Error(`Card "${card.id}" contains duplicate arrows.`);
  }
  for (const dir of card.arrows) {
    if (!VALID_ARROWS.has(dir)) {
      throw new Error(`Invalid arrow direction "${dir}" on card "${card.id}".`);
    }
  }
}

function loadStyleReferences() {
  return STYLE_REFERENCE_FILES.map((filename) => {
    const filePath = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing style reference image: ${filePath}`);
    }
    const bytes = fs.readFileSync(filePath);
    return {
      filename,
      part: {
        inlineData: {
          mimeType: 'image/jpeg',
          data: bytes.toString('base64'),
        },
      },
    };
  });
}

function saveAsNormalizedJpeg(buffer, mimeType, outputPath) {
  const ext = mimeType?.includes('png')
    ? '.png'
    : mimeType?.includes('webp')
    ? '.webp'
    : '.jpg';
  const tmpPath = path.join(
    os.tmpdir(),
    `gridduel_gen_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
  );
  fs.writeFileSync(tmpPath, buffer);

  try {
    if (process.platform === 'darwin') {
      execFileSync(
        'sips',
        [
          '-s',
          'format',
          'jpeg',
          '-s',
          'formatOptions',
          '90',
          '-z',
          String(TARGET_SIZE),
          String(TARGET_SIZE),
          tmpPath,
          '--out',
          outputPath,
        ],
        { stdio: 'pipe' }
      );
      fs.mkdirSync(THUMBS_DIR, { recursive: true });
      const thumbPath = path.join(THUMBS_DIR, path.basename(outputPath));
      execFileSync(
        'sips',
        [
          '-s',
          'format',
          'jpeg',
          '-s',
          'formatOptions',
          '82',
          '-z',
          String(THUMB_SIZE),
          String(THUMB_SIZE),
          outputPath,
          '--out',
          thumbPath,
        ],
        { stdio: 'pipe' }
      );
    } else {
      fs.copyFileSync(tmpPath, outputPath);
    }
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

async function generatePortrait(ai, styleRefs, card) {
  const prompt = [
    'Use the attached fantasy trading card illustrations strictly as style, lighting, brushwork, color-grading, and framing references.',
    'Generate a brand new, original square (1:1) dark-fantasy painterly digital oil illustration matching that exact rich tabletop RPG trading-card aesthetic: centered commanding full-body or heroic portrait of a single fantasy monster/summon, dramatic chiaroscuro rim lighting, luminous arcane/elemental energy effects, richly textured brushwork, and a dark atmospheric environment background.',
    'CRITICAL CONSTRAINTS: Full-bleed square illustration ONLY. Absolutely NO card borders, NO frames, NO text, NO letters, NO numbers, NO logos, NO arrows, NO watermarks, and NO UI elements.',
    `SUBJECT: ${card.artPrompt}`,
  ].join('\n\n');

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [
      {
        role: 'user',
        parts: [...styleRefs.map((r) => r.part), { text: prompt }],
      },
    ],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: '1:1',
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    const textReply = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join(' ');
    throw new Error(
      `Model did not return image data for "${card.name}". Response text: ${textReply || '(none)'}`
    );
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}

function formatImgLine(card, filename) {
  return `  ${card.imgKey}: '/src/assets/images/${filename}',`;
}

function formatRawEntry(card) {
  const [power, type, pDef, mDef] = card.stats;
  const arrowsStr = card.arrows.map((d) => `'${d}'`).join(', ');
  return [
    '  {',
    `    id: '${card.id}',`,
    `    name: '${card.name}',`,
    `    rarity: '${card.rarity}',`,
    `    stats: [${power}, '${type}', ${pDef}, ${mDef}],`,
    `    arrows: [${arrowsStr}],`,
    `    image: IMG.${card.imgKey},`,
    `    price: ${card.price},`,
    `    accentGradient: '${card.accentGradient}',`,
    '  },',
  ].join('\n');
}

function formatAugmentEntry(card) {
  const a = card.augment;
  return [
    `  '${card.id}': {`,
    `    id: '${a.id}',`,
    `    name: '${a.name}',`,
    `    shortTag: '${a.shortTag}',`,
    `    badgeLabel: '${a.badgeLabel}',`,
    `    description: '${a.description}',`,
    `    scope: '${a.scope}',`,
    `    powerDelta: ${a.powerDelta},`,
    `    pDefDelta: ${a.pDefDelta},`,
    `    mDefDelta: ${a.mDefDelta},`,
    '  },',
  ].join('\n');
}

function appendCardsToDataFile(generatedItems) {
  if (generatedItems.length === 0) {
    console.log('No new card entries to append to src/data/cards.ts.');
    return;
  }

  let source = fs.readFileSync(CARDS_FILE, 'utf8');

  // 1. Append image keys into `const IMG = { ... };`
  const imgBlockEndRegex = /(const IMG = \{[\s\S]*?)(\n\};)/;
  if (!imgBlockEndRegex.test(source)) {
    throw new Error('Could not locate `const IMG = { ... };` block in src/data/cards.ts');
  }
  const imgLines = generatedItems
    .map(({ card, filename }) => formatImgLine(card, filename))
    .join('\n');
  source = source.replace(imgBlockEndRegex, `$1\n${imgLines}$2`);

  // 2. Append RawEntry items to the end of `const RAW_CARDS: RawEntry[] = [ ... ];`
  const rawCardsEndRegex = /(const RAW_CARDS: RawEntry\[\] = \[[\s\S]*?)(\n\];)/;
  if (!rawCardsEndRegex.test(source)) {
    throw new Error('Could not locate `const RAW_CARDS: RawEntry[] = [ ... ];` in src/data/cards.ts');
  }
  const rawEntriesBlock = [
    '',
    '  // =========================================================================',
    '  // EXPANSION — Generated Tetra Master Summon & Monster Cards',
    '  // =========================================================================',
    ...generatedItems.map(({ card }) => formatRawEntry(card)),
  ].join('\n');
  source = source.replace(rawCardsEndRegex, `$1\n${rawEntriesBlock}$2`);

  // 3. Append any CARD_AUGMENTS entries
  const withAugments = generatedItems.filter(({ card }) => Boolean(card.augment));
  if (withAugments.length > 0) {
    const augEndRegex = /(export const CARD_AUGMENTS: Record<string, CardAugment> = \{[\s\S]*?)(\n\};)/;
    if (!augEndRegex.test(source)) {
      throw new Error('Could not locate `CARD_AUGMENTS` in src/data/cards.ts');
    }
    const augBlock = [
      '',
      '  // === GENERATED EXPANSION AUGMENTS ===',
      ...withAugments.map(({ card }) => formatAugmentEntry(card)),
    ].join('\n');
    source = source.replace(augEndRegex, `$1\n${augBlock}$2`);
  }

  fs.writeFileSync(CARDS_FILE, source, 'utf8');
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is missing or still set to the placeholder in .env. Please add a valid key.'
    );
  }

  for (const card of NEW_CARDS) {
    validateCardDef(card);
  }

  const existingSource = fs.readFileSync(CARDS_FILE, 'utf8');
  const cardsToGenerate = NEW_CARDS.filter((card) => {
    const exists = existingSource.includes(`id: '${card.id}'`);
    if (exists) {
      console.log(`Skipping "${card.name}" (${card.id}) — already in src/data/cards.ts.`);
    }
    return !exists;
  });

  if (cardsToGenerate.length === 0) {
    console.log('All 5 cards already exist in src/data/cards.ts. Nothing to do.');
    return;
  }

  const styleRefs = loadStyleReferences();
  console.log(
    `Loaded ${styleRefs.length} style references: ${styleRefs.map((r) => r.filename).join(', ')}`
  );

  const ai = new GoogleGenAI({ apiKey });
  const generatedItems = [];

  for (const card of cardsToGenerate) {
    const hexCode = `${card.stats[0].toString(16).toUpperCase()}${card.stats[1]}${card.stats[2].toString(16).toUpperCase()}${card.stats[3].toString(16).toUpperCase()}`;
    console.log(
      `Generating "${card.name}" [${card.rarity.toUpperCase()} | ${hexCode} | ${card.arrows.length} arrows] via ${MODEL_ID}...`
    );

    const { buffer, mimeType } = await generatePortrait(ai, styleRefs, card);
    const filename = `card_${card.fileSlug}_${Date.now()}.jpg`;
    const outputPath = path.join(IMAGES_DIR, filename);

    saveAsNormalizedJpeg(buffer, mimeType, outputPath);
    console.log(`  Saved -> src/assets/images/${filename}`);

    generatedItems.push({ card, filename, outputPath });
  }

  appendCardsToDataFile(generatedItems);
  console.log(`\nSuccessfully appended ${generatedItems.length} new cards to src/data/cards.ts!`);
}

main().catch((err) => {
  console.error('\nFailed to generate cards:', err?.message || err);
  process.exit(1);
});
