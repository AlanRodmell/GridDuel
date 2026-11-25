import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Coins,
  Crown,
  HardDrive,
  Home,
  LayoutGrid,
  Music,
  ShoppingBag,
  Swords,
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

type TabId = 'home' | 'arena' | 'gallery' | 'shop';

function StageLoadingFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="brass-plaque riveted-frame rounded-[4px] px-5 py-3 font-[var(--font-display)] text-xs uppercase tracking-[0.18em] text-[#f0c76e]">
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
    selectDeckSlot,
    createDeck,
    renameDeck,
    deleteDeck,
    toggleDeckCard,
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
  const [playIntent, setPlayIntent] = useState<PlayLaunchIntent>('choose');
  const [playLaunchNonce, setPlayLaunchNonce] = useState(0);
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [saveVaultOpen, setSaveVaultOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.55);
  const [activeMusicTheme, setActiveMusicTheme] = useState<MusicThemeId>('tavern');
  const [adaptiveMusic, setAdaptiveMusic] = useState(true);

  const lockViewportForMatch = activeTab === 'arena' && isMatchActive;

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
        sound.select();
        setRulesOpen((prev) => !prev);
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
    music.setEnabled(enabled);
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
      setActiveMusicTheme(theme);
      music.setTheme(theme);
    },
    [adaptiveMusic]
  );

  const switchTab = (tab: TabId) => {
    sound.select();
    setActiveTab(tab);
    if (tab !== 'arena') {
      setIsMatchActive(false);
    }
    if (adaptiveMusic && tab !== 'arena') {
      setActiveMusicTheme('tavern');
      music.setTheme('tavern');
    }
  };

  const launchPlayFlow = (intent: PlayLaunchIntent) => {
    setPlayIntent(intent);
    setPlayLaunchNonce((n) => n + 1);
    setActiveTab('arena');
  };

  return (
    <CardPreviewProvider>
      <div className="h-dvh w-screen overflow-hidden flex flex-col md:flex-row campaign-stage text-[#efe3cd]">
        {/* DESKTOP LEFT APPLICATION RAIL (Weathered Oak & Wrought Iron) */}
        <aside
          aria-label="Application navigation"
          className="hidden md:flex flex-col justify-between w-[76px] xl:w-[232px] shrink-0 h-full war-rail border-r px-2.5 xl:px-3.5 py-4 select-none z-30"
        >
          {/* Top Brand + Player Economy */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => switchTab('home')}
              className="w-full flex items-center justify-center xl:justify-start gap-2.5 px-1.5 py-1.5 rounded-[3px] hover:bg-[#231a13]/70 transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 rounded-[3px] bg-gradient-to-b from-[#e4b660] via-[#b8822e] to-[#7c5216] text-[#170f06] border border-[#f2d089]/75 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,244,210,0.6),0_4px_12px_rgba(0,0,0,0.6)] shrink-0">
                <Crown className="w-5 h-5" />
              </span>
              <div className="hidden xl:block text-left min-w-0">
                <div className="font-[var(--font-display)] text-lg font-bold tracking-[0.1em] text-[#f2d394] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  GridDuel
                </div>
                <div className="text-[10px] font-[var(--font-display)] uppercase tracking-[0.18em] text-[#9c886c] mt-1">
                  War Table
                </div>
              </div>
            </button>

            {/* Stamped Brass Gold & Record Plaque */}
            <div className="brass-plaque riveted-frame rounded-[3px] p-2.5 xl:px-3.5 xl:py-2.5 space-y-1.5">
              <div
                title={`${profile.gold.toLocaleString()} Gold`}
                className="flex flex-col xl:flex-row items-center justify-between gap-1"
              >
                <span className="inline-flex items-center gap-1.5 text-[#f0c76e] font-mono text-xs xl:text-sm font-bold tabular-nums">
                  <Coins className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-[#d9a242] shrink-0" />
                  <span>{profile.gold.toLocaleString()}</span>
                </span>
                <span className="hidden xl:inline font-[var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-[#a99373]">
                  Treasury
                </span>
              </div>
              <div className="hidden xl:flex items-center justify-between text-[11px] text-[#a99373] pt-1.5 border-t border-[#4b3a27]/70">
                <span className="font-[var(--font-display)] uppercase tracking-wider text-[10px]">
                  Record
                </span>
                <span className="font-mono font-semibold">
                  <span className="text-emerald-400">{profile.wins}W</span>
                  <span className="text-[#5e4d3b]"> · </span>
                  <span className="text-rose-400">{profile.losses}L</span>
                </span>
              </div>
            </div>

            <div className="ornate-divider" />

            {/* Primary Navigation Links */}
            <nav className="space-y-1.5">
              <button
                type="button"
                onClick={() => switchTab('home')}
                title="Campaign"
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-[13px] font-[var(--font-display)] font-semibold tracking-wider transition-all cursor-pointer border ${
                  activeTab === 'home'
                    ? 'bg-gradient-to-r from-[#2e2114] via-[#241a11] to-[#1a130d] border-[#8c6731] border-l-2 border-l-[#e5b864] text-[#f5d799] shadow-[inset_0_1px_0_rgba(245,212,145,0.14),0_4px_12px_rgba(0,0,0,0.45)]'
                    : 'bg-transparent border-transparent text-[#a59277] hover:text-[#efe3cd] hover:bg-[#221a13]/75 hover:border-[#3d3023]'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline">Campaign</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.select();
                  launchPlayFlow('choose');
                }}
                title="Play Arena"
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-[13px] font-[var(--font-display)] font-semibold tracking-wider transition-all cursor-pointer border ${
                  activeTab === 'arena'
                    ? 'bg-gradient-to-r from-[#2e2114] via-[#241a11] to-[#1a130d] border-[#8c6731] border-l-2 border-l-[#e5b864] text-[#f5d799] shadow-[inset_0_1px_0_rgba(245,212,145,0.14),0_4px_12px_rgba(0,0,0,0.45)]'
                    : 'bg-transparent border-transparent text-[#a59277] hover:text-[#efe3cd] hover:bg-[#221a13]/75 hover:border-[#3d3023]'
                }`}
              >
                <Swords className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline flex-1 text-left">Battle</span>
                {isMatchActive && (
                  <span className="hidden xl:inline-flex px-1.5 py-0.5 rounded-[2px] bg-emerald-950/90 border border-emerald-500/50 text-[10px] font-mono text-emerald-300">
                    LIVE
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => switchTab('gallery')}
                title={`Compendium (${ownedUniqueCount}/${totalCards})`}
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-[13px] font-[var(--font-display)] font-semibold tracking-wider transition-all cursor-pointer border ${
                  activeTab === 'gallery'
                    ? 'bg-gradient-to-r from-[#2e2114] via-[#241a11] to-[#1a130d] border-[#8c6731] border-l-2 border-l-[#e5b864] text-[#f5d799] shadow-[inset_0_1px_0_rgba(245,212,145,0.14),0_4px_12px_rgba(0,0,0,0.45)]'
                    : 'bg-transparent border-transparent text-[#a59277] hover:text-[#efe3cd] hover:bg-[#221a13]/75 hover:border-[#3d3023]'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline flex-1 text-left">Compendium</span>
                <span className="hidden xl:inline font-mono text-[11px] text-[#9b896e]">
                  {ownedUniqueCount}/{totalCards}
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchTab('shop')}
                title="Merchant & Runeforge"
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-[13px] font-[var(--font-display)] font-semibold tracking-wider transition-all cursor-pointer border ${
                  activeTab === 'shop'
                    ? 'bg-gradient-to-r from-[#2e2114] via-[#241a11] to-[#1a130d] border-[#8c6731] border-l-2 border-l-[#e5b864] text-[#f5d799] shadow-[inset_0_1px_0_rgba(245,212,145,0.14),0_4px_12px_rgba(0,0,0,0.45)]'
                    : 'bg-transparent border-transparent text-[#a59277] hover:text-[#efe3cd] hover:bg-[#221a13]/75 hover:border-[#3d3023]'
                }`}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline">Vault &amp; Forge</span>
              </button>
            </nav>
          </div>

          {/* Bottom Utility Controls */}
          <div className="space-y-1.5 pt-3">
            <div className="ornate-divider mb-2.5" />
            <button
              type="button"
              onClick={() => {
                sound.select();
                setRulesOpen(true);
              }}
              title="Field & Biome Codex (Shortcut: R)"
              className="w-full min-h-[38px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-xs font-[var(--font-display)] tracking-wide text-[#cbbba0] hover:text-[#f4d494] hover:bg-[#221a13]/80 border border-transparent hover:border-[#423426] transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#d8a64c] shrink-0" />
              <span className="hidden xl:inline flex-1 text-left">Field Codex</span>
              <span className="hidden xl:inline text-[10px] font-mono text-[#7c6b56]">R</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                setMusicModalOpen(true);
              }}
              title="Soundtrack & Music"
              className={`w-full min-h-[38px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-xs font-[var(--font-display)] tracking-wide border transition-colors cursor-pointer ${
                musicEnabled
                  ? 'text-[#f2d28f] bg-[#2a1f13] border-[#6e5025] hover:bg-[#332617]'
                  : 'text-[#9e8c72] border-transparent hover:text-[#efe3cd] hover:bg-[#221a13]/80 hover:border-[#423426]'
              }`}
            >
              <span className="relative shrink-0">
                <Music className="w-4 h-4" />
                {musicEnabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </span>
              <span className="hidden xl:inline flex-1 text-left">Soundtrack</span>
              <span className="hidden xl:inline text-[10px] font-mono text-[#a69275]">
                {musicEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              title={
                profile.soundEnabled
                  ? 'Mute sound effects (Shortcut: M)'
                  : 'Enable sound effects (Shortcut: M)'
              }
              className="w-full min-h-[38px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-xs font-[var(--font-display)] tracking-wide text-[#9e8c72] hover:text-[#efe3cd] hover:bg-[#221a13]/80 border border-transparent hover:border-[#423426] transition-colors cursor-pointer"
            >
              {profile.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#d8a64c] shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 shrink-0" />
              )}
              <span className="hidden xl:inline flex-1 text-left">Sound FX</span>
              <span className="hidden xl:inline text-[10px] font-mono text-[#82715b]">
                {profile.soundEnabled ? 'ON' : 'MUTE'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                setSaveVaultOpen(true);
              }}
              title="Campaign Save Backup & Reset"
              className="w-full min-h-[38px] px-2.5 xl:px-3 py-2 rounded-[3px] flex items-center justify-center xl:justify-start gap-3 text-xs font-[var(--font-display)] tracking-wide text-[#9e8c72] hover:text-[#f4d494] hover:bg-[#221a13]/80 border border-transparent hover:border-[#423426] transition-colors cursor-pointer"
            >
              <HardDrive className="w-4 h-4 text-[#d8a64c] shrink-0" />
              <span className="hidden xl:inline flex-1 text-left">Save Vault</span>
            </button>
          </div>
        </aside>

        {/* COMPACT FALLBACK HEADER FOR NARROW WINDOWS (< md) */}
        {!lockViewportForMatch && (
          <header className="md:hidden shrink-0 h-[52px] war-rail border-b px-3 flex items-center justify-between gap-2 z-30">
            <button
              type="button"
              onClick={() => switchTab('home')}
              className="font-[var(--font-display)] text-base font-bold tracking-widest text-[#f2d394] cursor-pointer"
            >
              GridDuel
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => launchPlayFlow('choose')}
                className={`px-2 py-1 rounded-[3px] text-xs font-[var(--font-display)] font-semibold cursor-pointer ${
                  activeTab === 'arena' ? 'brass-btn' : 'text-[#c9b89c]'
                }`}
              >
                Battle
              </button>
              <button
                type="button"
                onClick={() => switchTab('gallery')}
                className={`px-2 py-1 rounded-[3px] text-xs font-[var(--font-display)] font-semibold cursor-pointer ${
                  activeTab === 'gallery' ? 'brass-btn' : 'text-[#c9b89c]'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => switchTab('shop')}
                className={`px-2 py-1 rounded-[3px] text-xs font-[var(--font-display)] font-semibold cursor-pointer ${
                  activeTab === 'shop' ? 'brass-btn' : 'text-[#c9b89c]'
                }`}
              >
                Forge
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setSaveVaultOpen(true);
                }}
                aria-label="Open Save Vault"
                title="Save Vault"
                className="p-1.5 rounded-[3px] text-[#c9b89c] hover:text-[#f2d394] cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5" />
              </button>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[3px] brass-plaque text-[#f0c76e] font-mono text-xs font-bold">
                <Coins className="w-3 h-3 text-[#d9a242]" />
                {profile.gold.toLocaleString()}
              </span>
            </div>
          </header>
        )}

        {/* MAIN FULL-BLEED VIEWPORT STAGE */}
        <main
          className={`flex-1 min-w-0 h-full ${
            lockViewportForMatch ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {activeTab === 'home' && (
            <HomeView
              profile={profile}
              ownedUniqueCount={ownedUniqueCount}
              totalCards={totalCards}
              onStartFlow={launchPlayFlow}
              onOpenGallery={() => switchTab('gallery')}
              onOpenShop={() => switchTab('shop')}
              onOpenRules={() => setRulesOpen(true)}
            />
          )}
          {activeTab === 'arena' && (
            <Suspense fallback={<StageLoadingFallback />}>
              <ArenaView
                profile={profile}
                activeDeck={activeDeck}
                initialIntent={playIntent}
                launchNonce={playLaunchNonce}
                onSelectDeckSlot={selectDeckSlot}
                onCreateDeck={createDeck}
                onRenameDeck={renameDeck}
                onDeleteDeck={deleteDeck}
                onToggleDeckCard={toggleDeckCard}
                onAutoBuildDeck={autoBuildActiveDeck}
                onRecordMatch={recordMatchOutcome}
                onClaimSpoil={claimSpoilCard}
                onSellCardInstance={sellCardInstance}
                onSellExtraCopies={sellExtraCopies}
                onGoHome={() => switchTab('home')}
                onGoToGallery={() => switchTab('gallery')}
                onOpenRules={() => setRulesOpen(true)}
                onToggleSound={toggleSound}
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
                onSelectDeckSlot={selectDeckSlot}
                onCreateDeck={createDeck}
                onRenameDeck={renameDeck}
                onDeleteDeck={deleteDeck}
                onToggleDeckCard={toggleDeckCard}
                onAutoBuildDeck={autoBuildActiveDeck}
                onSellCardInstance={sellCardInstance}
                onSellExtraCopies={sellExtraCopies}
                onGoToShop={() => switchTab('shop')}
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
            <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
          </Suspense>
        )}
        {musicModalOpen && (
          <Suspense fallback={null}>
            <MusicModal
              open={musicModalOpen}
              onClose={() => setMusicModalOpen(false)}
              musicEnabled={musicEnabled}
              onToggleMusic={handleToggleMusic}
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
              onClose={() => setSaveVaultOpen(false)}
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
