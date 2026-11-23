import { useCallback, useState } from 'react';
import {
  BookOpen,
  Coins,
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
import { MusicModal } from './components/MusicModal';
import { RulesModal } from './components/RulesModal';
import { ShopView } from './components/ShopView';
import { useProfile } from './store/useProfile';
import { MusicThemeId, music } from './utils/music';
import { sound } from './utils/sound';

type TabId = 'arena' | 'gallery' | 'shop';

export default function App() {
  const {
    profile,
    activeDeck,
    ownedUniqueCount,
    totalCards,
    toggleSound,
    selectDeckSlot,
    toggleDeckCard,
    autoBuildActiveDeck,
    buyCard,
    openBoosterPack,
    recordMatchOutcome,
    claimSpoilCard,
    sellCardInstance,
    sellExtraCopies,
  } = useProfile();

  const [activeTab, setActiveTab] = useState<TabId>('arena');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.55);
  const [activeMusicTheme, setActiveMusicTheme] = useState<MusicThemeId>('tavern');
  const [adaptiveMusic, setAdaptiveMusic] = useState(true);

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
    if (adaptiveMusic && tab !== 'arena') {
      setActiveMusicTheme('tavern');
      music.setTheme('tavern');
    }
  };

  return (
    <CardPreviewProvider>
    <div className="min-h-dvh flex flex-col bg-[#0B111E] text-slate-100">
      {/* Desktop Top Navigation Bar & Compact Mobile Header */}
      <header className="sticky top-0 z-30 h-[54px] md:h-16 bg-[#0B111E]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => switchTab('arena')}
            className="font-[var(--font-display)] text-lg sm:text-xl font-bold tracking-wider text-amber-200 hover:text-amber-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Aether Triad
          </button>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => switchTab('arena')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'arena'
                  ? 'text-amber-300 border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Arena
            </button>
            <button
              type="button"
              onClick={() => switchTab('gallery')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'gallery'
                  ? 'text-amber-300 border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Gallery ({ownedUniqueCount}/{totalCards})
            </button>
            <button
              type="button"
              onClick={() => switchTab('shop')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'shop'
                  ? 'text-amber-300 border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Shop
            </button>
            <button
              type="button"
              onClick={() => {
                sound.select();
                setRulesOpen(true);
              }}
              className="py-1 text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Rules
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => switchTab('shop')}
              title="View Shop & Gold Balance"
              className="min-h-[40px] px-2.5 flex items-center gap-1.5 text-sm font-mono font-semibold tabular-nums text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Coins className="w-4 h-4 shrink-0" />
              <span>{profile.gold}g</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                if (!musicEnabled) {
                  handleToggleMusic(true);
                }
                setMusicModalOpen(true);
              }}
              aria-label="Open Soundtrack & Custom Music Studio"
              title="Game Music & Custom MP3 Loader"
              className={`min-h-[40px] px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border ${
                musicEnabled
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-200 hover:bg-amber-500/25'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
              }`}
            >
              <Music
                className={`w-4 h-4 shrink-0 ${
                  musicEnabled ? 'text-amber-300 animate-pulse' : ''
                }`}
              />
              <span className="hidden sm:inline">
                {musicEnabled ? 'Music On' : 'Music'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-label={profile.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              title={profile.soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors cursor-pointer"
            >
              {profile.soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-10">
        {activeTab === 'arena' && (
          <ArenaView
            profile={profile}
            activeDeck={activeDeck}
            onSelectDeckSlot={selectDeckSlot}
            onRecordMatch={recordMatchOutcome}
            onClaimSpoil={claimSpoilCard}
            onGoToGallery={() => switchTab('gallery')}
            onOpenRules={() => setRulesOpen(true)}
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
            onBuyCard={buyCard}
            onOpenPack={openBoosterPack}
            onSellCardInstance={sellCardInstance}
            onSellExtraCopies={sellExtraCopies}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0B111E]/95 backdrop-blur-md border-t border-slate-800/90 pb-safe"
      >
        <div className="grid grid-cols-4 h-[58px] items-center">
          <button
            type="button"
            onClick={() => switchTab('arena')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              activeTab === 'arena' ? 'text-amber-300' : 'text-slate-400'
            }`}
          >
            <Swords className="w-5 h-5" />
            <span className="text-[11px] font-medium">Arena</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('gallery')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              activeTab === 'gallery' ? 'text-amber-300' : 'text-slate-400'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[11px] font-medium">Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('shop')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              activeTab === 'shop' ? 'text-amber-300' : 'text-slate-400'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[11px] font-medium">Shop</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.select();
              setRulesOpen(true);
            }}
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[11px] font-medium">Rules</span>
          </button>
        </div>
      </nav>

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
