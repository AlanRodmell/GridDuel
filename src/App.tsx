import { useCallback, useState } from 'react';
import {
  BookOpen,
  Coins,
  Crown,
  Home,
  LayoutGrid,
  Music,
  ShoppingBag,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ArenaView } from './components/ArenaView';
import { CardPreviewProvider } from './components/CardPreviewContext';
import { GalleryView } from './components/GalleryView';
import { HomeView, PlayLaunchIntent } from './components/HomeView';
import { MusicModal } from './components/MusicModal';
import { RulesModal } from './components/RulesModal';
import { ShopView } from './components/ShopView';
import { useProfile } from './store/useProfile';
import { MusicThemeId, music } from './utils/music';
import { sound } from './utils/sound';

type TabId = 'home' | 'arena' | 'gallery' | 'shop';

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
  } = useProfile();

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [playIntent, setPlayIntent] = useState<PlayLaunchIntent>('choose');
  const [playLaunchNonce, setPlayLaunchNonce] = useState(0);
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.55);
  const [activeMusicTheme, setActiveMusicTheme] = useState<MusicThemeId>('tavern');
  const [adaptiveMusic, setAdaptiveMusic] = useState(true);

  const lockViewportForMatch = activeTab === 'arena' && isMatchActive;

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
      <div className="h-dvh w-screen overflow-hidden flex flex-col md:flex-row bg-[#070c16] text-slate-100">
        {/* DESKTOP LEFT APPLICATION RAIL (Compact icon rail on md-lg, full labeled rail on xl+) */}
        <aside
          aria-label="Application navigation"
          className="hidden md:flex flex-col justify-between w-[74px] xl:w-[224px] shrink-0 h-full bg-[#090f1d] border-r border-slate-800/85 px-2.5 xl:px-3.5 py-4 select-none z-30"
        >
          {/* Top Brand + Player Economy */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => switchTab('home')}
              className="w-full flex items-center justify-center xl:justify-start gap-2.5 px-1.5 py-1 rounded-xl hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-slate-950 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.35)] shrink-0">
                <Crown className="w-5 h-5" />
              </span>
              <div className="hidden xl:block text-left min-w-0">
                <div className="font-[var(--font-display)] text-lg font-bold tracking-wider text-amber-200 leading-none">
                  GridDuel
                </div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
                  Tactical Arena
                </div>
              </div>
            </button>

            {/* Gold & Record Summary Card */}
            <div className="rounded-xl bg-[#0d1528] border border-amber-500/25 p-2 xl:px-3 xl:py-2.5 space-y-1.5">
              <div
                title={`${profile.gold.toLocaleString()} Gold`}
                className="flex flex-col xl:flex-row items-center justify-between gap-1"
              >
                <span className="inline-flex items-center gap-1.5 text-amber-300 font-mono text-xs xl:text-sm font-bold tabular-nums">
                  <Coins className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-amber-400 shrink-0" />
                  <span>{profile.gold.toLocaleString()}</span>
                </span>
                <span className="hidden xl:inline text-[10px] uppercase tracking-wider text-slate-400">
                  Gold
                </span>
              </div>
              <div className="hidden xl:flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Record</span>
                <span className="font-mono font-semibold">
                  <span className="text-emerald-300">{profile.wins}W</span>
                  <span className="text-slate-600"> · </span>
                  <span className="text-rose-300">{profile.losses}L</span>
                </span>
              </div>
            </div>

            {/* Primary Navigation Links */}
            <nav className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => switchTab('home')}
                title="Home"
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-xl flex items-center justify-center xl:justify-start gap-3 text-sm font-semibold transition-all cursor-pointer border ${
                  activeTab === 'home'
                    ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.12)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline">Home</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.select();
                  launchPlayFlow('choose');
                }}
                title="Play Arena"
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-xl flex items-center justify-center xl:justify-start gap-3 text-sm font-semibold transition-all cursor-pointer border ${
                  activeTab === 'arena'
                    ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.12)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <Swords className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline flex-1 text-left">Play</span>
                {isMatchActive && (
                  <span className="hidden xl:inline-flex px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-mono text-emerald-300">
                    Live
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => switchTab('gallery')}
                title={`Gallery (${ownedUniqueCount}/${totalCards})`}
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-xl flex items-center justify-center xl:justify-start gap-3 text-sm font-semibold transition-all cursor-pointer border ${
                  activeTab === 'gallery'
                    ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.12)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline flex-1 text-left">Compendium</span>
                <span className="hidden xl:inline font-mono text-[11px] text-slate-400">
                  {ownedUniqueCount}/{totalCards}
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchTab('shop')}
                title="Shop & Runeforge"
                className={`w-full min-h-[44px] px-2.5 xl:px-3 py-2 rounded-xl flex items-center justify-center xl:justify-start gap-3 text-sm font-semibold transition-all cursor-pointer border ${
                  activeTab === 'shop'
                    ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.12)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline">Shop &amp; Forge</span>
              </button>
            </nav>
          </div>

          {/* Bottom Utility Controls */}
          <div className="space-y-1.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                sound.select();
                setRulesOpen(true);
              }}
              title="Field & Biome Guide"
              className="w-full min-h-[38px] px-2.5 xl:px-3 py-2 rounded-xl flex items-center justify-center xl:justify-start gap-3 text-xs font-semibold text-slate-300 hover:text-amber-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-amber-300/90 shrink-0" />
              <span className="hidden xl:inline">Field Guide</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                setMusicModalOpen(true);
              }}
              title="Soundtrack & Music"
              className={`w-full min-h-[38px] px-2.5 xl:px-3 py-2 rounded-xl flex items-center justify-center xl:justify-start gap-3 text-xs font-semibold transition-colors cursor-pointer ${
                musicEnabled
                  ? 'text-amber-200 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <span className="relative shrink-0">
                <Music className="w-4 h-4" />
                {musicEnabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </span>
              <span className="hidden xl:inline flex-1 text-left">Soundtrack</span>
              <span className="hidden xl:inline text-[10px] font-mono text-slate-400">
                {musicEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              title={profile.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              className="w-full min-h-[38px] px-2.5 xl:px-3 py-2 rounded-xl flex items-center justify-center xl:justify-start gap-3 text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              {profile.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-sky-300 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 shrink-0" />
              )}
              <span className="hidden xl:inline flex-1 text-left">Sound FX</span>
              <span className="hidden xl:inline text-[10px] font-mono text-slate-500">
                {profile.soundEnabled ? 'ON' : 'MUTE'}
              </span>
            </button>
          </div>
        </aside>

        {/* COMPACT FALLBACK HEADER FOR NARROW WINDOWS (< md) */}
        {!lockViewportForMatch && (
          <header className="md:hidden shrink-0 h-[52px] bg-[#090f1d] border-b border-slate-800/80 px-3 flex items-center justify-between gap-2 z-30">
            <button
              type="button"
              onClick={() => switchTab('home')}
              className="font-[var(--font-display)] text-base font-bold tracking-wider text-amber-200 cursor-pointer"
            >
              GridDuel
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => launchPlayFlow('choose')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  activeTab === 'arena' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                Play
              </button>
              <button
                type="button"
                onClick={() => switchTab('gallery')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  activeTab === 'gallery' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => switchTab('shop')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  activeTab === 'shop' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                Shop
              </button>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#131d33] border border-amber-500/35 text-amber-300 font-mono text-xs font-bold">
                <Coins className="w-3 h-3 text-amber-400" />
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
              onGoHome={() => switchTab('home')}
              onGoToGallery={() => switchTab('gallery')}
              onOpenRules={() => setRulesOpen(true)}
              onToggleSound={toggleSound}
              onMatchActiveChange={setIsMatchActive}
              onMatchThemeChange={handleMatchThemeChange}
            />
          )}
          {activeTab === 'gallery' && (
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
          )}
          {activeTab === 'shop' && (
            <ShopView
              profile={profile}
              activeDeck={activeDeck}
              onBuyCard={buyCard}
              onOpenPack={openBoosterPack}
              onCraftAugment={craftAugmentOnCopy}
              onSellCardInstance={sellCardInstance}
              onSellExtraCopies={sellExtraCopies}
            />
          )}
        </main>

        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
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
      </div>
    </CardPreviewProvider>
  );
}
