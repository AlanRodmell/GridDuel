import React from 'react';

/**
 * Overgrown Siegeworks & Thorny Bramble frame overlay for the 4x4 Arena Battlefield.
 * Renders splintered oak war-stakes, rope lashings, jagged slate shards, and creeping
 * thorny bramble vines that spill organically beyond the board perimeter.
 */
export const BattlefieldSiegeOverlay: React.FC = () => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 500 700"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -inset-[10px] sm:-inset-[14px] lg:-inset-[18px] w-[calc(100%+20px)] sm:w-[calc(100%+28px)] lg:w-[calc(100%+36px)] h-[calc(100%+20px)] sm:h-[calc(100%+28px)] lg:h-[calc(100%+36px)] z-30 overflow-visible select-none"
    >
      <defs>
        <linearGradient id="oakBeamH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c3520" />
          <stop offset="38%" stopColor="#2e1f12" />
          <stop offset="100%" stopColor="#170f09" />
        </linearGradient>
        <linearGradient id="oakBeamV" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#48321d" />
          <stop offset="45%" stopColor="#2b1d11" />
          <stop offset="100%" stopColor="#160e08" />
        </linearGradient>
        <linearGradient id="vineStem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4a5d32" />
          <stop offset="55%" stopColor="#2f3e20" />
          <stop offset="100%" stopColor="#1d2614" />
        </linearGradient>
        <linearGradient id="brambleLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6a8344" />
          <stop offset="100%" stopColor="#31421f" />
        </linearGradient>
        <linearGradient id="ironBracket" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#685b4d" />
          <stop offset="50%" stopColor="#352d26" />
          <stop offset="100%" stopColor="#1a1512" />
        </linearGradient>
        <filter id="siegeDrop" x="-8%" y="-8%" width="116%" height="116%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.78" />
        </filter>
      </defs>

      <g filter="url(#siegeDrop)">
        {/* TOP SPLINTERED OAK SIEGE BEAM (jagged outer & inner contour + axe splits) */}
        <path
          d="M 6,16 L 34,9 L 68,14 L 82,6 L 128,12 L 176,8 L 194,15 L 242,9 L 298,13 L 314,6 L 368,12 L 424,8 L 462,14 L 494,10 L 490,26 L 448,23 L 392,26 L 336,22 L 272,26 L 214,22 L 152,25 L 92,22 L 40,26 L 12,24 Z"
          fill="url(#oakBeamH)"
          stroke="#120b06"
          strokeWidth="1.6"
        />
        {/* Wood grain splits on top beam */}
        <path
          d="M 42,15 L 116,17 M 158,14 L 238,16 M 288,15 L 362,18 M 398,14 L 468,17"
          stroke="#6e4e2e"
          strokeWidth="1"
          strokeOpacity="0.55"
          fill="none"
        />

        {/* BOTTOM SPLINTERED OAK SIEGE BEAM */}
        <path
          d="M 10,676 L 56,674 L 118,678 L 184,674 L 248,677 L 316,674 L 386,678 L 444,674 L 490,676 L 495,691 L 452,688 L 418,695 L 364,689 L 302,693 L 258,687 L 204,694 L 146,689 L 94,695 L 44,688 L 5,692 Z"
          fill="url(#oakBeamH)"
          stroke="#120b06"
          strokeWidth="1.6"
        />
        <path
          d="M 38,684 L 128,682 M 176,685 L 274,683 M 322,685 L 436,682"
          stroke="#6e4e2e"
          strokeWidth="1"
          strokeOpacity="0.5"
          fill="none"
        />

        {/* LEFT SPLINTERED TIMBER RAIL */}
        <path
          d="M 9,14 L 23,20 L 21,96 L 24,182 L 20,276 L 24,368 L 20,464 L 24,566 L 21,678 L 7,688 L 11,612 L 4,548 L 11,472 L 6,388 L 12,312 L 4,244 L 11,168 L 6,88 Z"
          fill="url(#oakBeamV)"
          stroke="#120b06"
          strokeWidth="1.6"
        />

        {/* RIGHT SPLINTERED TIMBER RAIL */}
        <path
          d="M 478,20 L 492,12 L 495,94 L 489,164 L 496,238 L 489,324 L 495,412 L 489,498 L 496,582 L 491,686 L 477,678 L 480,574 L 476,478 L 480,382 L 476,288 L 480,194 L 477,98 Z"
          fill="url(#oakBeamV)"
          stroke="#120b06"
          strokeWidth="1.6"
        />

        {/* BENT IRON CORNER STRAPS & ROPE LASHINGS */}
        {/* Top-Left Iron Strap + Rope */}
        <path
          d="M 4,34 L 5,8 L 36,6 L 34,19 L 19,20 L 18,36 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="13" cy="14" r="2.4" fill="#9c8265" />
        <circle cx="28" cy="12" r="2" fill="#8b7358" />
        <circle cx="12" cy="28" r="2" fill="#8b7358" />
        <path
          d="M 38,7 C 41,14 41,21 38,27 M 43,8 C 46,15 45,21 43,27"
          stroke="#8b6d43"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Top-Right Splintered Stake + Rope */}
        <path
          d="M 464,6 L 496,8 L 495,38 L 482,36 L 481,20 L 466,19 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="487" cy="14" r="2.4" fill="#9c8265" />
        <circle cx="472" cy="13" r="2" fill="#8b7358" />
        <path
          d="M 456,7 C 453,14 453,21 456,27 M 461,8 C 458,15 458,21 461,27"
          stroke="#8b6d43"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Bottom-Left Bracket + Rope */}
        <path
          d="M 5,662 L 18,664 L 19,680 L 36,681 L 34,694 L 4,692 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="13" cy="686" r="2.4" fill="#9c8265" />
        <path
          d="M 7,654 C 14,651 20,651 25,654 M 8,659 C 14,656 20,656 25,659"
          stroke="#8b6d43"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Bottom-Right Bracket + Rope */}
        <path
          d="M 482,664 L 495,662 L 496,692 L 464,694 L 466,681 L 481,680 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="487" cy="686" r="2.4" fill="#9c8265" />

        {/* CREEPING THORNY BRAMBLE VINES — TOP-LEFT CLUSTER */}
        <path
          d="M -2,78 C 6,52 10,24 28,12 C 52,-2 88,20 124,11 C 148,5 168,15 186,22"
          stroke="url(#vineStem)"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 14,42 C 26,34 32,48 24,62 C 16,76 18,98 8,118"
          stroke="#394a26"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        {/* Thorns & Leaves Top-Left */}
        <path d="M 52,8 L 57,1 L 60,9 Z" fill="#2c391d" />
        <path d="M 96,15 L 101,22 L 92,19 Z" fill="#2c391d" />
        <path d="M 11,64 L 3,60 L 10,56 Z" fill="#2c391d" />
        <path
          d="M 38,10 C 44,0 56,1 58,9 C 50,14 42,14 38,10 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 78,14 C 86,22 96,22 100,14 C 91,9 83,10 78,14 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 134,10 C 142,2 152,3 155,11 C 146,15 138,14 134,10 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 15,48 C 4,44 1,34 9,29 C 16,35 18,42 15,48 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />

        {/* CREEPING THORNY BRAMBLE VINES — BOTTOM-RIGHT CLUSTER */}
        <path
          d="M 502,612 C 492,642 488,674 468,688 C 442,704 402,680 364,690 C 338,696 318,686 298,679"
          stroke="url(#vineStem)"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 488,648 C 474,656 470,640 478,626 C 485,612 482,588 493,568"
          stroke="#394a26"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 454,690 C 446,700 434,699 432,690 C 440,685 449,686 454,690 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 410,686 C 402,678 391,678 388,686 C 396,691 405,690 410,686 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 486,634 C 497,638 500,649 492,654 C 485,648 483,640 486,634 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />

        {/* SMALL WILD CREEPER — TOP-RIGHT & BOTTOM-LEFT ACCENTS */}
        <path
          d="M 412,11 C 438,4 468,18 492,42 C 499,50 496,68 488,84"
          stroke="url(#vineStem)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 438,9 C 444,1 454,2 456,9 C 449,13 442,12 438,9 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="0.9"
        />
        <path
          d="M 10,624 C 4,648 16,676 42,690 C 58,698 78,691 96,684"
          stroke="url(#vineStem)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 56,691 C 62,699 72,698 75,690 C 67,686 60,687 56,691 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="0.9"
        />
      </g>
    </svg>
  );
};

/**
 * Hand-crafted gnarled thorny bramble & splintered-spear horizontal divider
 * for hero titles and major war-camp headers.
 */
export const BrambleCrestDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 360 28"
    className={`w-full h-6 overflow-visible select-none ${className}`}
  >
    {/* Splintered wooden spear shaft */}
    <path
      d="M 12,14 L 78,12 L 92,15 L 166,13 L 198,15 L 274,12 L 348,14 L 336,17 L 262,16 L 182,17 L 104,16 L 28,17 Z"
      fill="#4b341e"
      stroke="#160e08"
      strokeWidth="1.2"
    />
    {/* Wrapping thorny vine */}
    <path
      d="M 28,18 C 58,5 88,23 122,11 C 154,1 192,25 228,11 C 262,0 296,22 332,10"
      fill="none"
      stroke="#4b5f31"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    {/* Bramble leaves & thorns */}
    <path d="M 72,11 C 78,3 88,4 90,11 C 83,14 76,14 72,11 Z" fill="#5e783d" stroke="#1b2411" strokeWidth="0.8" />
    <path d="M 142,8 C 148,1 158,2 160,9 C 153,12 146,11 142,8 Z" fill="#5e783d" stroke="#1b2411" strokeWidth="0.8" />
    <path d="M 212,16 C 218,23 228,22 230,15 C 223,12 216,13 212,16 Z" fill="#526a35" stroke="#1b2411" strokeWidth="0.8" />
    <path d="M 278,10 C 284,3 294,4 296,11 C 289,14 282,13 278,10 Z" fill="#5e783d" stroke="#1b2411" strokeWidth="0.8" />
    {/* Center chipped bronze shield boss */}
    <polygon
      points="180,4 191,14 180,24 169,14"
      fill="#b98635"
      stroke="#1c1208"
      strokeWidth="1.5"
    />
    <circle cx="180" cy="14" r="3" fill="#f0c76e" />
  </svg>
);
