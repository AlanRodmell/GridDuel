import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Coins,
  Crown,
  HardDrive,
  Home,
  LayoutGrid,
  LogOut,
  MousePointerClick,
  Music,
  Settings,
  ShoppingBag,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CardPreviewProvider } from './components/CardPreviewContext';
import { HomeView, PlayLaunchIntent } from './components/HomeView';
import { useProfile } from './store/useProfile';
import { MusicThemeId, music } from './utils/music';
import { sound } from './utils/sound';

const ArenaView = lazy(() =>
  import('./components/ArenaView').then((m) => ({ default: m.ArenaView }))
);
const GalleryView = lazy(() =>
  import('./components/GalleryView').then((m) => ({ default: m.GalleryView }))
);
const ShopView = lazy(() =>
  import('./components/ShopView').then((m) => ({ default: m.ShopView }))
);
const RulesModal = lazy(() =>
  import('./components/RulesModal').then((m) => ({ default: m.RulesModal }))
);
const MusicModal = lazy(() =>
  import('./components/MusicModal').then((m) => ({ default: m.MusicModal }))
);
const SaveVaultModal = lazy(() =>
  import('./components/SaveVaultModal').then((m) => ({ default: m.SaveVaultModal }))
);

type TabId = 'home' | 'gallery' | 'shop';

function StageLoadingFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="brass-plaque riveted-frame px-5 py-3 font-[var(--font-display)] text-xs uppercase tracking-[0.18em] text-[#f0c76e]">
        Unfurling War Table…
      </div>
    </div>
  );
}

export default function App() {
  const {
    profile,
    activeDeck,
    ownedUniqueCount,
    totalCards,
    toggleSound,
    toggleClickToPlace,
    setBoardScale,
    selectDeckSlot,
    createDeck,
    renameDeck,
    deleteDeck,
    setDeckPowerCard,
    toggleDeckCard,
    clearActiveDeck,
    autoBuildActiveDeck,
    buyCard,
    openBoosterPack,
    craftAugmentOnCopy,
    recordMatchOutcome,
    claimSpoilCard,
    sellCardInstance,
    sellExtraCopies,
    exportSaveJson,
    importSaveJson,
    resetProfile,
  } = useProfile();

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [battleFlowActive, setBattleFlowActive] = useState(false);
  const [playIntent, setPlayIntent] = useState<PlayLaunchIntent>('arena');
  const [playLaunchNonce, setPlayLaunchNonce] = useState(0);
  const [isMatchActive, setIsMatchActive] = useState(false);

  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  const [exitMatchConfirmOpen, setExitMatchConfirmOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [saveVaultOpen, setSaveVaultOpen] = useState(false);

  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.36);
  const [activeMusicTheme, setActiveMusicTheme] = useState<MusicThemeId>('tavern');
  const [battleOnlyMusic, setBattleOnlyMusic] = useState(false);
  const [adaptiveMusic, setAdaptiveMusic] = useState(true);

  const desktopOptionsRef = useRef<HTMLDivElement | null>(null);
  const mobileOptionsRef = useRef<HTMLDivElement | null>(null);

  const lockViewportForMatch =
    activeTab === 'home' && battleFlowActive && isMatchActive;

  // Automatic Menu <-> Battle score switching when Adaptive Mode is ON:
  // - Menus, Compendium, Forge & Match Setup -> 'tavern' (Celtic Flute/Fiddle/Lute Menu Loop)
  // - Active Live Battle ('playing') -> 'wardrums' (Sanctuary War Drums Loop)
  useEffect(() => {
    if (!adaptiveMusic || musicModalOpen) return;
    const targetTheme: MusicThemeId = lockViewportForMatch ? 'wardrums' : 'tavern';
    setActiveMusicTheme(targetTheme);
  }, [adaptiveMusic, lockViewportForMatch, musicModalOpen]);

  // Sync music engine volume, active theme, and playback state
  useEffect(() => {
    music.setVolume(musicVolume);
    music.setTheme(activeMusicTheme);
    const shouldPlayNow =
      musicEnabled && (!battleOnlyMusic || lockViewportForMatch || musicModalOpen);
    music.setEnabled(shouldPlayNow);
  }, [
    activeMusicTheme,
    battleOnlyMusic,
    lockViewportForMatch,
    musicEnabled,
    musicModalOpen,
    musicVolume,
  ]);

  useEffect(() => {
    if (!isMatchActive) {
      setExitMatchConfirmOpen(false);
    }
  }, [isMatchActive]);

  // Close cogwheel options or exit confirmation popover on outside click or Escape
  useEffect(() => {
    if (!optionsMenuOpen && !mobileOptionsOpen && !exitMatchConfirmOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        (optionsMenuOpen || exitMatchConfirmOpen) &&
        desktopOptionsRef.current &&
        target &&
        !desktopOptionsRef.current.contains(target)
      ) {
        setOptionsMenuOpen(false);
        setExitMatchConfirmOpen(false);
      }
      if (
        mobileOptionsOpen &&
        mobileOptionsRef.current &&
        target &&
        !mobileOptionsRef.current.contains(target)
      ) {
        setMobileOptionsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOptionsMenuOpen(false);
        setMobileOptionsOpen(false);
        setExitMatchConfirmOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [exitMatchConfirmOpen, mobileOptionsOpen, optionsMenuOpen]);

  // Global desktop keyboard shortcuts: R = Field Codex, M = Mute/Unmute SFX
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRulesOpen((prev) => {
          sound.drawer(!prev);
          return !prev;
        });
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleSound();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [toggleSound]);

  const handleToggleMusic = useCallback((enabled: boolean) => {
    setMusicEnabled(enabled);
  }, []);

  const handleChangeMusicVolume = useCallback((vol: number) => {
    setMusicVolume(vol);
    music.setVolume(vol);
  }, []);

  const handleSelectMusicTheme = useCallback((theme: MusicThemeId) => {
    setActiveMusicTheme(theme);
    music.setTheme(theme);
  }, []);

  const handleMatchThemeChange = useCallback(
    (theme: MusicThemeId) => {
      if (!adaptiveMusic) return;
      // Map ArenaView's 'duel'/'boss' callbacks onto our studio 'wardrums' battle score
      // unless the user uploaded a custom file for 'duel'/'boss'.
      const resolvedTheme: MusicThemeId =
        theme === 'tavern'
          ? 'tavern'
          : music.hasCustomTrack(theme)
          ? theme
          : 'wardrums';
      setActiveMusicTheme(resolvedTheme);
      music.setTheme(resolvedTheme);
    },
    [adaptiveMusic]
  );

  const confirmExitActiveMatch = () => {
    sound.drawer(false);
    setExitMatchConfirmOpen(false);
    setOptionsMenuOpen(false);
    setMobileOptionsOpen(false);
    setIsMatchActive(false);
    setBattleFlowActive(false);
    setActiveTab('home');
    if (adaptiveMusic) {
      setActiveMusicTheme('tavern');
      music.setTheme('tavern');
    }
  };

  const handleNavHome = () => {
    setOptionsMenuOpen(false);
    setMobileOptionsOpen(false);
    if (activeTab === 'home') {
      if (isMatchActive) {
        sound.latch(true);
        setExitMatchConfirmOpen(true);
        return;
      }
      sound.nav();
      if (battleFlowActive) {
        setBattleFlowActive(false);
      }
      return;
    }
    sound.nav();
    setActiveTab('home');
  };

  const switchSecondaryTab = (tab: 'gallery' | 'shop') => {
    sound.nav();
    setOptionsMenuOpen(false);
    setMobileOptionsOpen(false);
    setActiveTab(tab);
    setIsMatchActive(false);
    if (adaptiveMusic) {
      setActiveMusicTheme('tavern');
      music.setTheme('tavern');
    }
  };

  const launchPlayFlow = (intent: PlayLaunchIntent) => {
    sound.nav();
    setPlayIntent(intent);
    setPlayLaunchNonce((n) => n + 1);
    setBattleFlowActive(true);
    setActiveTab('home');
  };

  const renderOptionsMenuItems = (closeMenu: () => void) => (
    <div className="w-56 brass-panel p-2 space-y-1 shadow-[0_18px_48px_rgba(0,0,0,0.92)]">
      <div className="px-2.5 py-1 border-b border-[#4b3a26]/70 flex items-center justify-between">
        <span className="font-[var(--font-display)] text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#e7c47a]">
          Options &amp; Codex
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          sound.drawer(true);
          closeMenu();
          setRulesOpen(true);
        }}
        className="w-full min-h-[36px] px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-[var(--font-display)] tracking-wide text-[#dfd0b6] hover:text-[#f7dea2] hover:bg-[#2a1e13] transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-[#d8a64c] shrink-0" />
          <span>Field Codex</span>
        </span>
        <span className="font-mono text-[10px] text-[#8c7961]">R</span>
      </button>

      <button
        type="button"
        onClick={() => {
          sound.drawer(true);
          closeMenu();
          setMusicModalOpen(true);
        }}
        className="w-full min-h-[36px] px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-[var(--font-display)] tracking-wide text-[#dfd0b6] hover:text-[#f7dea2] hover:bg-[#2a1e13] transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2.5">
          <Music className="w-4 h-4 text-[#d8a64c] shrink-0" />
          <span>Soundtrack</span>
        </span>
        <span
          className={`font-mono text-[10px] font-bold ${
            musicEnabled ? 'text-emerald-300' : 'text-[#8c7961]'
          }`}
        >
          {musicEnabled ? (battleOnlyMusic ? 'BATTLE' : 'ON') : 'OFF'}
        </span>
      </button>

      <button
        type="button"
        onClick={toggleSound}
        className="w-full min-h-[36px] px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-[var(--font-display)] tracking-wide text-[#dfd0b6] hover:text-[#f7dea2] hover:bg-[#2a1e13] transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2.5">
          {profile.soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[#d8a64c] shrink-0" />
          ) : (
            <VolumeX className="w-4 h-4 text-[#8c7961] shrink-0" />
          )}
          <span>Sound FX</span>
        </span>
        <span
          className={`font-mono text-[10px] font-bold ${
            profile.soundEnabled ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {profile.soundEnabled ? 'ON' : 'MUTE'}
        </span>
      </button>

      <button
        type="button"
        onClick={toggleClickToPlace}
        title="Accessibility: Click Card then Click Tile to deploy"
        className="w-full min-h-[36px] px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-[var(--font-display)] tracking-wide text-[#dfd0b6] hover:text-[#f7dea2] hover:bg-[#2a1e13] transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2.5">
          <MousePointerClick
            className={`w-4 h-4 shrink-0 ${
              profile.clickToPlace ? 'text-[#f0c76e]' : 'text-[#8c7961]'
            }`}
          />
          <span>Click-to-Place</span>
        </span>
        <span
          className={`font-mono text-[10px] font-bold ${
            profile.clickToPlace ? 'text-amber-300' : 'text-[#8c7961]'
          }`}
        >
          {profile.clickToPlace ? 'ON' : 'DRAG'}
        </span>
      </button>

      <div className="border-t border-[#4b3a26]/70 pt-1">
        <button
          type="button"
          onClick={() => {
            sound.drawer(true);
            closeMenu();
            setSaveVaultOpen(true);
          }}
          className="w-full min-h-[36px] px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-[var(--font-display)] tracking-wide text-[#dfd0b6] hover:text-[#f7dea2] hover:bg-[#2a1e13] transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-[#d8a64c] shrink-0" />
            <span>Save Vault</span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <CardPreviewProvider>
      <div className="h-dvh w-screen overflow-hidden flex flex-col md:flex-row campaign-stage text-[#efe3cd]">
        {/* DESKTOP SLIM ICON RAIL: HOME | COMPENDIUM | VAULT & FORGE + COGWHEEL MENU */}
        <aside
          aria-label="Application navigation"
          className="hidden md:flex flex-col items-center justify-between w-[74px] shrink-0 h-full war-rail border-r px-2 py-3.5 select-none z-30"
        >
          {/* Top Crest + Gold Treasury + 3 Primary Icon Buttons */}
          <div className="w-full flex flex-col items-center space-y-3">
            <button
              type="button"
              onClick={() => {
                sound.nav();
                if (!isMatchActive) setBattleFlowActive(false);
                setActiveTab('home');
              }}
              title="GridDuel — Home & Battle"
              aria-label="GridDuel Home"
              className="w-10 h-10 brass-btn flex items-center justify-center cursor-pointer"
            >
              <Crown className="w-5 h-5" />
            </button>

            {/* Compact Gold Treasury Badge */}
            <div
              title={`Treasury: ${profile.gold.toLocaleString()} Gold (${profile.wins}W · ${profile.losses}L)`}
              className="w-full brass-plaque py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 text-center"
            >
              <Coins className="w-3.5 h-3.5 text-[#d9a242]" />
              <span className="font-mono text-[10.5px] font-bold tabular-nums text-[#f0c76e] leading-none">
                {profile.gold >= 10000
                  ? `${(profile.gold / 1000).toFixed(1)}k`
                  : profile.gold.toLocaleString()}
              </span>
            </div>

            <div className="ornate-divider w-full" />

            {/* 3 Primary Navigation Icons: Home, Compendium, Vault & Forge */}
            <nav className="w-full space-y-2">
              <button
                type="button"
                onClick={handleNavHome}
                title="Home & Battle"
                aria-label="Home and Battle"
                aria-current={activeTab === 'home' ? 'page' : undefined}
                className={`relative w-full py-2.5 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'home'
                    ? 'brass-btn font-bold'
                    : 'iron-btn text-[#b9a588] hover:text-[#f5dfb2]'
                }`}
              >
                <Home className="w-4 h-4" />
                <span className="font-[var(--font-display)] text-[9px] uppercase tracking-wider leading-none">
                  Home
                </span>
                {isMatchActive && (
                  <span
                    title="Match in progress"
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => switchSecondaryTab('gallery')}
                title={`Compendium (${ownedUniqueCount}/${totalCards} Cards)`}
                aria-label="Compendium"
                aria-current={activeTab === 'gallery' ? 'page' : undefined}
                className={`w-full py-2.5 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'gallery'
                    ? 'brass-btn font-bold'
                    : 'iron-btn text-[#b9a588] hover:text-[#f5dfb2]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="font-[var(--font-display)] text-[8.5px] uppercase tracking-wider leading-none">
                  Cards
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchSecondaryTab('shop')}
                title="Vault & Runeforge"
                aria-label="Vault and Runeforge"
                aria-current={activeTab === 'shop' ? 'page' : undefined}
                className={`w-full py-2.5 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'shop'
                    ? 'brass-btn font-bold'
                    : 'iron-btn text-[#b9a588] hover:text-[#f5dfb2]'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="font-[var(--font-display)] text-[8.5px] uppercase tracking-wider leading-none">
                  Forge
                </span>
              </button>
            </nav>
          </div>

          {/* Bottom-Left Exit Match + Cogwheel Options Stack */}
          <div ref={desktopOptionsRef} className="relative w-full flex flex-col items-center gap-2 pt-2">
            <div className="ornate-divider w-full mb-0.5" />

            {(isMatchActive || (activeTab === 'home' && battleFlowActive)) && (
              <button
                type="button"
                onClick={() => {
                  setOptionsMenuOpen(false);
                  if (isMatchActive) {
                    setExitMatchConfirmOpen((prev) => {
                      sound.latch(!prev);
                      return !prev;
                    });
                  } else {
                    sound.drawer(false);
                    setBattleFlowActive(false);
                  }
                }}
                aria-label={isMatchActive ? 'Exit current match' : 'Exit battle setup'}
                title={isMatchActive ? 'Exit Match' : 'Back to Home'}
                className={`w-full py-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  exitMatchConfirmOpen
                    ? 'crimson-btn font-bold'
                    : isMatchActive
                    ? 'crimson-btn text-rose-100 hover:brightness-110'
                    : 'iron-btn text-[#d8b892] hover:text-rose-200'
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span className="font-[var(--font-display)] text-[8.5px] uppercase tracking-wider leading-none">
                  Exit
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setExitMatchConfirmOpen(false);
                setOptionsMenuOpen((prev) => {
                  sound.latch(!prev);
                  return !prev;
                });
              }}
              aria-expanded={optionsMenuOpen}
              aria-label="Open options menu"
              title="Options, Audio & Save Vault"
              className={`relative w-11 h-11 flex items-center justify-center transition-all cursor-pointer ${
                optionsMenuOpen
                  ? 'brass-btn'
                  : 'iron-btn text-[#cbb89a] hover:text-[#f5dfb2]'
              }`}
            >
              <Settings
                className={`w-5 h-5 transition-transform duration-200 ${
                  optionsMenuOpen ? 'rotate-45' : ''
                }`}
              />
              {musicEnabled && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>

            {exitMatchConfirmOpen && isMatchActive && (
              <div className="absolute bottom-0 left-[calc(100%+10px)] z-50 w-56 brass-panel p-3 space-y-2.5 shadow-[0_18px_48px_rgba(0,0,0,0.94)] animate-preview-pop">
                <div className="space-y-1">
                  <div className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-rose-300">
                    Exit Current Match?
                  </div>
                  <p className="font-[var(--font-serif)] text-xs text-[#cbb89a] leading-snug">
                    Abandon this duel and return to the Home war table?
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmExitActiveMatch}
                    className="flex-1 min-h-[34px] px-2.5 py-1 crimson-btn font-[var(--font-display)] text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Exit Match
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sound.select();
                      setExitMatchConfirmOpen(false);
                    }}
                    className="min-h-[34px] px-2.5 py-1 iron-btn font-[var(--font-display)] text-[11px] text-[#dfd0b6] cursor-pointer"
                  >
                    Stay
                  </button>
                </div>
              </div>
            )}

            {optionsMenuOpen && (
              <div className="absolute bottom-0 left-[calc(100%+10px)] z-50 animate-preview-pop">
                {renderOptionsMenuItems(() => setOptionsMenuOpen(false))}
              </div>
            )}
          </div>
        </aside>

        {/* COMPACT MOBILE HEADER (< md): ICON TABS + COGWHEEL MENU */}
        {!lockViewportForMatch && (
          <header className="md:hidden shrink-0 h-[52px] war-rail border-b px-3 flex items-center justify-between gap-2 z-30">
            <button
              type="button"
              onClick={handleNavHome}
              className="font-[var(--font-display)] text-base font-bold tracking-widest text-[#f2d394] cursor-pointer"
            >
              GridDuel
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleNavHome}
                aria-label="Home and Battle"
                title="Home & Battle"
                className={`w-8 h-8 flex items-center justify-center cursor-pointer ${
                  activeTab === 'home' ? 'brass-btn' : 'iron-btn text-[#c9b89c]'
                }`}
              >
                <Home className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => switchSecondaryTab('gallery')}
                aria-label="Compendium"
                title="Compendium"
                className={`w-8 h-8 flex items-center justify-center cursor-pointer ${
                  activeTab === 'gallery' ? 'brass-btn' : 'iron-btn text-[#c9b89c]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => switchSecondaryTab('shop')}
                aria-label="Vault and Runeforge"
                title="Vault & Runeforge"
                className={`w-8 h-8 flex items-center justify-center cursor-pointer ${
                  activeTab === 'shop' ? 'brass-btn' : 'iron-btn text-[#c9b89c]'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
              </button>

              <span className="inline-flex items-center gap-1 px-2 py-1 brass-plaque text-[#f0c76e] font-mono text-xs font-bold">
                <Coins className="w-3 h-3 text-[#d9a242]" />
                {profile.gold.toLocaleString()}
              </span>

              <div ref={mobileOptionsRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOptionsOpen((prev) => {
                      sound.latch(!prev);
                      return !prev;
                    });
                  }}
                  aria-expanded={mobileOptionsOpen}
                  aria-label="Open options menu"
                  className={`w-8 h-8 flex items-center justify-center cursor-pointer ${
                    mobileOptionsOpen ? 'brass-btn' : 'iron-btn text-[#c9b89c]'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                </button>

                {mobileOptionsOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 animate-preview-pop">
                    {renderOptionsMenuItems(() => setMobileOptionsOpen(false))}
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* MAIN FULL-BLEED VIEWPORT STAGE */}
        <main
          className={`flex-1 min-w-0 h-full ${
            lockViewportForMatch ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {activeTab === 'home' && !battleFlowActive && (
            <HomeView
              profile={profile}
              ownedUniqueCount={ownedUniqueCount}
              totalCards={totalCards}
              onSelectBoardScale={setBoardScale}
              onStartFlow={launchPlayFlow}
            />
          )}
          {activeTab === 'home' && battleFlowActive && (
            <Suspense fallback={<StageLoadingFallback />}>
              <ArenaView
                profile={profile}
                activeDeck={activeDeck}
                initialIntent={playIntent}
                launchNonce={playLaunchNonce}
                onSelectBoardScale={setBoardScale}
                onSelectDeckSlot={selectDeckSlot}
                onCreateDeck={createDeck}
                onRenameDeck={renameDeck}
                onDeleteDeck={deleteDeck}
                onSetDeckPowerCard={setDeckPowerCard}
                onToggleDeckCard={toggleDeckCard}
                onClearDeck={clearActiveDeck}
                onAutoBuildDeck={autoBuildActiveDeck}
                onRecordMatch={recordMatchOutcome}
                onClaimSpoil={claimSpoilCard}
                onSellCardInstance={sellCardInstance}
                onSellExtraCopies={sellExtraCopies}
                onGoHome={() => {
                  setIsMatchActive(false);
                  setBattleFlowActive(false);
                }}
                onGoToGallery={() => switchSecondaryTab('gallery')}
                onOpenRules={() => {
                  sound.drawer(true);
                  setRulesOpen(true);
                }}
                onToggleSound={toggleSound}
                onToggleClickToPlace={toggleClickToPlace}
                onMatchActiveChange={setIsMatchActive}
                onMatchThemeChange={handleMatchThemeChange}
              />
            </Suspense>
          )}
          {activeTab === 'gallery' && (
            <Suspense fallback={<StageLoadingFallback />}>
              <GalleryView
                profile={profile}
                activeDeck={activeDeck}
                ownedUniqueCount={ownedUniqueCount}
                totalCards={totalCards}
                onSelectBoardScale={setBoardScale}
                onSelectDeckSlot={selectDeckSlot}
                onCreateDeck={createDeck}
                onRenameDeck={renameDeck}
                onDeleteDeck={deleteDeck}
                onSetDeckPowerCard={setDeckPowerCard}
                onToggleDeckCard={toggleDeckCard}
                onClearDeck={clearActiveDeck}
                onAutoBuildDeck={autoBuildActiveDeck}
                onSellCardInstance={sellCardInstance}
                onSellExtraCopies={sellExtraCopies}
                onGoToShop={() => switchSecondaryTab('shop')}
              />
            </Suspense>
          )}
          {activeTab === 'shop' && (
            <Suspense fallback={<StageLoadingFallback />}>
              <ShopView
                profile={profile}
                activeDeck={activeDeck}
                onBuyCard={buyCard}
                onOpenPack={openBoosterPack}
                onCraftAugment={craftAugmentOnCopy}
                onSellCardInstance={sellCardInstance}
                onSellExtraCopies={sellExtraCopies}
              />
            </Suspense>
          )}
        </main>

        {rulesOpen && (
          <Suspense fallback={null}>
            <RulesModal
              open={rulesOpen}
              onClose={() => {
                sound.drawer(false);
                setRulesOpen(false);
              }}
            />
          </Suspense>
        )}
        {musicModalOpen && (
          <Suspense fallback={null}>
            <MusicModal
              open={musicModalOpen}
              onClose={() => {
                sound.drawer(false);
                setMusicModalOpen(false);
              }}
              musicEnabled={musicEnabled}
              onToggleMusic={handleToggleMusic}
              battleOnly={battleOnlyMusic}
              onToggleBattleOnly={setBattleOnlyMusic}
              musicVolume={musicVolume}
              onChangeVolume={handleChangeMusicVolume}
              activeTheme={activeMusicTheme}
              onSelectTheme={handleSelectMusicTheme}
              adaptiveMode={adaptiveMusic}
              onToggleAdaptive={setAdaptiveMusic}
            />
          </Suspense>
        )}
        {saveVaultOpen && (
          <Suspense fallback={null}>
            <SaveVaultModal
              open={saveVaultOpen}
              onClose={() => {
                sound.drawer(false);
                setSaveVaultOpen(false);
              }}
              profile={profile}
              ownedUniqueCount={ownedUniqueCount}
              totalCards={totalCards}
              onExportSave={exportSaveJson}
              onImportSave={importSaveJson}
              onResetProfile={resetProfile}
            />
          </Suspense>
        )}
      </div>
    </CardPreviewProvider>
  );
}
