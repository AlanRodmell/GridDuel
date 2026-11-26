import React from 'react';

/**
 * Overgrown Siegeworks & Thorny Bramble frame overlay proportioned for the 5x3 Landscape
 * Arena Battlefield (viewBox 750x630 => 25:21 aspect ratio).
 * Renders splintered oak war-stakes, rope lashings, iron brackets, and creeping thorny bramble vines.
 */

/**
 * Monumental carved-stone & gilded-bronze perimeter frame for the Arena Battlefield.
 * Uses an `evenodd` hollow stone ring (`z-30`, `pointer-events-none`, zero SVG blur filters)
 * so rich chiseled stonework, ashlar seams, corner clasps, keystones, and creeping moss
 * frame the board visibly on top of the seam without obstructing a single card socket.
 */
export const BattlefieldMonolithFrame: React.FC = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 1000 700"
    preserveAspectRatio="none"
    className="pointer-events-none absolute -inset-[7px] sm:-inset-[10px] lg:-inset-[13px] w-[calc(100%+14px)] sm:w-[calc(100%+20px)] lg:w-[calc(100%+26px)] h-[calc(100%+14px)] sm:h-[calc(100%+20px)] lg:h-[calc(100%+26px)] z-30 overflow-visible select-none"
  >
    <defs>
      <linearGradient id="monolith-stone-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#575145" />
        <stop offset="22%" stopColor="#38342c" />
        <stop offset="62%" stopColor="#21201b" />
        <stop offset="100%" stopColor="#141310" />
      </linearGradient>
      <linearGradient id="monolith-inner-lip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#12110e" />
        <stop offset="50%" stopColor="#2b2720" />
        <stop offset="100%" stopColor="#6a5c45" />
      </linearGradient>
      <linearGradient id="monolith-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f0d394" />
        <stop offset="35%" stopColor="#b9893d" />
        <stop offset="70%" stopColor="#7a5620" />
        <stop offset="100%" stopColor="#dfbe7a" />
      </linearGradient>
      <linearGradient id="monolith-bronze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7d623b" />
        <stop offset="55%" stopColor="#43321c" />
        <stop offset="100%" stopColor="#22190d" />
      </linearGradient>
      <linearGradient id="monolith-moss" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#688243" />
        <stop offset="100%" stopColor="#2d3b1d" />
      </linearGradient>
    </defs>

    {/* 1. HOLLOW CHISELED MONOLITH RING (evenodd -> 100% transparent center over cards!) */}
    <path
      fillRule="evenodd"
      d="M 14,6 L 128,4 L 142,8 L 310,5 L 462,6 L 500,2 L 538,6 L 690,5 L 858,8 L 872,4 L 986,6 L 996,16 L 994,148 L 997,164 L 994,350 L 997,536 L 994,552 L 996,684 L 986,694 L 872,696 L 858,692 L 690,695 L 538,694 L 500,698 L 462,694 L 310,695 L 142,692 L 128,696 L 14,694 L 4,684 L 6,552 L 3,536 L 6,350 L 3,164 L 6,148 L 4,16 Z M 30,28 L 970,28 L 970,672 L 30,672 Z"
      fill="url(#monolith-stone-body)"
      stroke="#090806"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />

    {/* 2. CHISELED SUNLIT OUTER BEVEL & RECESSED INNER SANCTUARY LIP */}
    <path
      d="M 16,9 L 460,8 M 540,8 L 984,9 M 8,20 L 8,325 M 8,375 L 8,680"
      fill="none"
      stroke="#9e9075"
      strokeOpacity="0.45"
      strokeWidth="1.6"
    />
    <rect
      x="29"
      y="27"
      width="942"
      height="646"
      fill="none"
      stroke="url(#monolith-inner-lip)"
      strokeWidth="2.4"
    />
    <rect
      x="25"
      y="23"
      width="950"
      height="654"
      fill="none"
      stroke="url(#monolith-gold)"
      strokeOpacity="0.62"
      strokeWidth="1.4"
    />

    {/* 3. CARVED ASHLAR STONE BLOCK JOINTS & WEATHERED CRACKS */}
    <path
      d="M 185,6 L 188,26 M 345,5 L 342,26 M 655,5 L 658,26 M 815,6 L 812,26 M 185,694 L 188,674 M 345,695 L 342,674 M 655,695 L 658,674 M 815,694 L 812,674 M 6,175 L 28,178 M 6,525 L 28,522 M 994,175 L 972,178 M 994,525 L 972,522"
      stroke="#0d0c09"
      strokeWidth="2"
      strokeOpacity="0.85"
      fill="none"
    />
    <path
      d="M 189,7 L 191,25 M 659,7 L 661,25 M 346,693 L 344,675 M 816,693 L 814,675 M 7,180 L 27,182 M 993,520 L 973,518"
      stroke="#7c705a"
      strokeWidth="1"
      strokeOpacity="0.38"
      fill="none"
    />

    {/* 4. ORNATE CAST-BRONZE & GILDED CORNER SANCTUARY CLASPS */}
    <g fill="url(#monolith-bronze)" stroke="url(#monolith-gold)" strokeWidth="1.8" strokeLinejoin="round">
      {/* Top-Left Clasp */}
      <path d="M 3,4 L 78,4 L 70,22 L 26,22 L 26,70 L 4,78 Z" />
      {/* Top-Right Clasp */}
      <path d="M 997,4 L 922,4 L 930,22 L 974,22 L 974,70 L 996,78 Z" />
      {/* Bottom-Left Clasp */}
      <path d="M 3,696 L 78,696 L 70,678 L 26,678 L 26,630 L 4,622 Z" />
      {/* Bottom-Right Clasp */}
      <path d="M 997,696 L 922,696 L 930,678 L 974,678 L 974,630 L 996,622 Z" />
    </g>

    {/* Corner Obsidian & Gold Diamond Bosses */}
    <g fill="#15120e" stroke="url(#monolith-gold)" strokeWidth="1.8">
      <polygon points="20,6 36,20 20,34 4,20" />
      <polygon points="980,6 996,20 980,34 964,20" />
      <polygon points="20,666 36,680 20,694 4,680" />
      <polygon points="980,666 996,680 980,694 964,680" />
    </g>

    {/* 5. TOP, BOTTOM & SIDE KEYSTONE MEDALLIONS */}
    <g fill="url(#monolith-bronze)" stroke="url(#monolith-gold)" strokeWidth="1.7" strokeLinejoin="round">
      {/* Top Center Keystone */}
      <polygon points="462,3 500,0 538,3 528,25 500,30 472,25" />
      {/* Bottom Center Keystone */}
      <polygon points="462,697 500,700 538,697 528,675 500,670 472,675" />
      {/* Left Mid-Rail Clasp */}
      <polygon points="2,316 26,326 30,350 26,374 2,384" />
      {/* Right Mid-Rail Clasp */}
      <polygon points="998,316 974,326 970,350 974,374 998,384" />
    </g>

    {/* Keystone Inner Gems & Corner Rivets */}
    <g fill="#efd18e">
      <polygon points="500,7 509,15 500,23 491,15" />
      <polygon points="500,677 509,685 500,693 491,685" />
      <polygon points="15,342 22,350 15,358 8,350" />
      <polygon points="985,342 992,350 985,358 978,350" />
      <circle cx="20" cy="20" r="3.2" />
      <circle cx="56" cy="13" r="2.2" />
      <circle cx="14" cy="54" r="2.2" />
      <circle cx="980" cy="20" r="3.2" />
      <circle cx="944" cy="13" r="2.2" />
      <circle cx="986" cy="54" r="2.2" />
      <circle cx="20" cy="680" r="3.2" />
      <circle cx="56" cy="687" r="2.2" />
      <circle cx="14" cy="646" r="2.2" />
      <circle cx="980" cy="680" r="3.2" />
      <circle cx="944" cy="687" r="2.2" />
      <circle cx="986" cy="646" r="2.2" />
    </g>

    {/* 6. SUBTLE CREEPING SANCTUARY MOSS & BRAMBLE TENDRILS */}
    <path
      d="M 80,10 C 108,3 136,18 168,11 M 832,689 C 864,682 892,697 920,690"
      fill="none"
      stroke="#4d6332"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    <g fill="url(#monolith-moss)" stroke="#192210" strokeWidth="0.9">
      <path d="M 104,9 C 110,2 120,3 122,9 C 115,13 108,12 104,9 Z" />
      <path d="M 142,14 C 148,20 157,19 159,13 C 152,10 146,11 142,14 Z" />
      <path d="M 874,688 C 880,681 890,682 892,688 C 885,692 878,691 874,688 Z" />
      <path d="M 844,686 C 850,693 859,692 861,686 C 854,683 848,684 844,686 Z" />
    </g>
  </svg>
);

export const BattlefieldSiegeOverlay: React.FC = () => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 750 630"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -inset-[9px] sm:-inset-[13px] lg:-inset-[17px] w-[calc(100%+18px)] sm:w-[calc(100%+26px)] lg:w-[calc(100%+34px)] h-[calc(100%+18px)] sm:h-[calc(100%+26px)] lg:h-[calc(100%+34px)] z-30 overflow-visible select-none"
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
        <filter id="siegeDrop" x="-6%" y="-6%" width="112%" height="112%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.78" />
        </filter>
      </defs>

      <g filter="url(#siegeDrop)">
        {/* TOP SPLINTERED OAK SIEGE BEAM */}
        <path
          d="M 8,16 L 52,9 L 108,14 L 136,6 L 212,12 L 294,8 L 328,15 L 408,9 L 496,13 L 524,6 L 604,12 L 678,8 L 722,14 L 744,10 L 740,25 L 676,22 L 594,25 L 502,21 L 412,25 L 322,21 L 234,24 L 138,21 L 62,25 L 14,23 Z"
          fill="url(#oakBeamH)"
          stroke="#120b06"
          strokeWidth="1.6"
        />
        <path
          d="M 56,15 L 178,17 M 242,14 L 382,16 M 446,15 L 578,17 M 622,14 L 716,16"
          stroke="#6e4e2e"
          strokeWidth="1"
          strokeOpacity="0.55"
          fill="none"
        />

        {/* BOTTOM SPLINTERED OAK SIEGE BEAM */}
        <path
          d="M 12,606 L 84,604 L 178,608 L 274,604 L 372,607 L 478,604 L 582,608 L 674,604 L 740,606 L 745,621 L 682,618 L 626,625 L 544,619 L 452,623 L 386,617 L 304,624 L 216,619 L 136,625 L 62,618 L 6,622 Z"
          fill="url(#oakBeamH)"
          stroke="#120b06"
          strokeWidth="1.6"
        />
        <path
          d="M 52,614 L 198,612 M 266,615 L 424,613 M 498,615 L 668,612"
          stroke="#6e4e2e"
          strokeWidth="1"
          strokeOpacity="0.5"
          fill="none"
        />

        {/* LEFT SPLINTERED TIMBER RAIL */}
        <path
          d="M 9,14 L 23,20 L 21,98 L 24,186 L 20,278 L 24,372 L 20,468 L 24,548 L 21,608 L 7,618 L 11,546 L 4,482 L 11,406 L 6,322 L 12,246 L 4,174 L 11,98 Z"
          fill="url(#oakBeamV)"
          stroke="#120b06"
          strokeWidth="1.6"
        />

        {/* RIGHT SPLINTERED TIMBER RAIL */}
        <path
          d="M 728,20 L 742,12 L 745,96 L 739,172 L 746,248 L 739,334 L 745,422 L 739,508 L 746,568 L 741,616 L 727,608 L 730,524 L 726,438 L 730,342 L 726,258 L 730,174 L 727,92 Z"
          fill="url(#oakBeamV)"
          stroke="#120b06"
          strokeWidth="1.6"
        />

        {/* BENT IRON CORNER STRAPS & ROPE LASHINGS */}
        <path
          d="M 4,34 L 5,8 L 38,6 L 36,19 L 19,20 L 18,36 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="13" cy="14" r="2.4" fill="#9c8265" />
        <circle cx="29" cy="12" r="2" fill="#8b7358" />
        <path
          d="M 42,7 C 45,14 45,21 42,27 M 47,8 C 50,15 49,21 47,27"
          stroke="#8b6d43"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M 712,6 L 746,8 L 745,38 L 732,36 L 731,20 L 714,19 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="737" cy="14" r="2.4" fill="#9c8265" />
        <path
          d="M 704,7 C 701,14 701,21 704,27 M 709,8 C 706,15 706,21 709,27"
          stroke="#8b6d43"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M 5,592 L 18,594 L 19,610 L 38,611 L 36,624 L 4,622 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="13" cy="616" r="2.4" fill="#9c8265" />

        <path
          d="M 732,594 L 745,592 L 746,622 L 712,624 L 714,611 L 731,610 Z"
          fill="url(#ironBracket)"
          stroke="#120d09"
          strokeWidth="1.4"
        />
        <circle cx="737" cy="616" r="2.4" fill="#9c8265" />

        {/* CREEPING THORNY BRAMBLE VINES — TOP-LEFT CLUSTER */}
        <path
          d="M -2,84 C 6,54 12,24 34,11 C 64,-3 112,20 162,11 C 194,5 224,15 248,21"
          stroke="url(#vineStem)"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 14,44 C 26,36 32,50 24,66 C 16,80 18,104 8,124"
          stroke="#394a26"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 46,10 C 53,0 66,1 68,9 C 59,14 50,14 46,10 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 102,14 C 110,22 122,22 126,14 C 116,9 107,10 102,14 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 176,10 C 184,2 196,3 199,11 C 189,15 180,14 176,10 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 15,50 C 4,46 1,36 9,31 C 16,37 18,44 15,50 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />

        {/* CREEPING THORNY BRAMBLE VINES — BOTTOM-RIGHT CLUSTER */}
        <path
          d="M 752,542 C 742,572 736,604 712,618 C 680,634 628,610 578,620 C 546,626 518,616 494,609"
          stroke="url(#vineStem)"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 692,620 C 684,630 670,629 668,620 C 677,615 686,616 692,620 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 636,616 C 628,608 616,608 612,616 C 621,621 631,620 636,616 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />
        <path
          d="M 736,564 C 747,568 750,579 742,584 C 735,578 733,570 736,564 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="1"
        />

        {/* TOP-RIGHT & BOTTOM-LEFT WILD TENDRILS */}
        <path
          d="M 642,11 C 676,4 714,18 742,42 C 749,50 746,68 738,84"
          stroke="url(#vineStem)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 674,9 C 681,1 692,2 694,9 C 686,13 678,12 674,9 Z"
          fill="url(#brambleLeaf)"
          stroke="#1a2411"
          strokeWidth="0.9"
        />
        <path
          d="M 10,554 C 4,578 16,606 46,620 C 66,628 92,621 114,614"
          stroke="url(#vineStem)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 64,621 C 71,629 82,628 85,620 C 76,616 68,617 64,621 Z"
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
    <path
      d="M 12,14 L 78,12 L 92,15 L 166,13 L 198,15 L 274,12 L 348,14 L 336,17 L 262,16 L 182,17 L 104,16 L 28,17 Z"
      fill="#4b341e"
      stroke="#160e08"
      strokeWidth="1.2"
    />
    <path
      d="M 28,18 C 58,5 88,23 122,11 C 154,1 192,25 228,11 C 262,0 296,22 332,10"
      fill="none"
      stroke="#4b5f31"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path d="M 72,11 C 78,3 88,4 90,11 C 83,14 76,14 72,11 Z" fill="#5e783d" stroke="#1b2411" strokeWidth="0.8" />
    <path d="M 142,8 C 148,1 158,2 160,9 C 153,12 146,11 142,8 Z" fill="#5e783d" stroke="#1b2411" strokeWidth="0.8" />
    <path d="M 212,16 C 218,23 228,22 230,15 C 223,12 216,13 212,16 Z" fill="#526a35" stroke="#1b2411" strokeWidth="0.8" />
    <path d="M 278,10 C 284,3 294,4 296,11 C 289,14 282,13 278,10 Z" fill="#5e783d" stroke="#1b2411" strokeWidth="0.8" />
    <polygon
      points="180,4 191,14 180,24 169,14"
      fill="#b98635"
      stroke="#1c1208"
      strokeWidth="1.5"
    />
    <circle cx="180" cy="14" r="3" fill="#f0c76e" />
  </svg>
);
