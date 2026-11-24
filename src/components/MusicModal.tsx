import React, { useRef, useState } from 'react';
import {
  Check,
  Disc,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  MUSIC_TRACKS,
  MusicThemeId,
  MusicTrackMeta,
  music,
} from '../utils/music';
import { sound } from '../utils/sound';

interface MusicModalProps {
  open: boolean;
  onClose: () => void;
  musicEnabled: boolean;
  onToggleMusic: (enabled: boolean) => void;
  musicVolume: number;
  onChangeVolume: (vol: number) => void;
  activeTheme: MusicThemeId;
  onSelectTheme: (theme: MusicThemeId) => void;
  adaptiveMode: boolean;
  onToggleAdaptive: (adaptive: boolean) => void;
}

export const MusicModal: React.FC<MusicModalProps> = ({
  open,
  onClose,
  musicEnabled,
  onToggleMusic,
  musicVolume,
  onChangeVolume,
  activeTheme,
  onSelectTheme,
  adaptiveMode,
  onToggleAdaptive,
}) => {
  const [customFileNames, setCustomFileNames] = useState<
    Partial<Record<MusicThemeId, string>>
  >({});
  const fileInputRefs = useRef<Partial<Record<MusicThemeId, HTMLInputElement | null>>>({});

  if (!open) return null;

  const handleFileUpload = (
    themeId: MusicThemeId,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sound.select();
    const objectUrl = URL.createObjectURL(file);
    music.setCustomTrack(themeId, objectUrl);
    setCustomFileNames((prev) => ({ ...prev, [themeId]: file.name }));
    if (!musicEnabled) {
      onToggleMusic(true);
    }
    onSelectTheme(themeId);
  };

  const handleResetCustomTrack = (themeId: MusicThemeId) => {
    sound.select();
    music.setCustomTrack(themeId, null);
    setCustomFileNames((prev) => {
      const copy = { ...prev };
      delete copy[themeId];
      return copy;
    });
    const input = fileInputRefs.current[themeId];
    if (input) input.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#060403]/88 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="music-modal-title"
    >
      <div className="w-full max-w-xl rounded-[5px] brass-panel riveted-frame shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#4b3a26]/85 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[3px] brass-plaque flex items-center justify-center text-[#eab95d]">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="music-modal-title"
                className="font-[var(--font-display)] text-lg font-bold text-[#f6e1b5] tracking-wide"
              >
                Soundtrack &amp; Bardic Audio Studio
              </h2>
              <p className="font-[var(--font-serif)] text-sm text-[#b39e81]">
                Multi-instrument fantasy score &amp; custom MP3/OGG soundtrack loader
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.select();
              onClose();
            }}
            aria-label="Close soundtrack studio"
            className="iron-btn min-h-[40px] min-w-[40px] rounded-[3px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[78dvh] overflow-y-auto">
          {/* Master Playback & Volume Bar */}
          <div className="p-4 rounded-[4px] basalt-recess flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  onToggleMusic(!musicEnabled);
                }}
                className={`min-h-[44px] px-4 rounded-[3px] font-[var(--font-display)] font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  musicEnabled
                    ? 'brass-btn'
                    : 'iron-btn'
                }`}
              >
                {musicEnabled ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Music Playing</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Game Music</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.select();
                  onToggleAdaptive(!adaptiveMode);
                }}
                className={`min-h-[44px] px-3.5 rounded-[3px] font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  adaptiveMode
                    ? 'brass-plaque text-[#f5d593]'
                    : 'iron-btn text-[#9b896f]'
                }`}
                title="Automatically switch soundtrack between Tavern Prep, Arena Duel, and Boss Sanctum"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#e2b053] shrink-0" />
                <span>Auto-Adaptive: {adaptiveMode ? 'On' : 'Off'}</span>
              </button>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2.5 min-w-[160px]">
              {musicVolume <= 0.01 || !musicEnabled ? (
                <VolumeX className="w-4 h-4 text-[#7d6c56] shrink-0" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#e2b053] shrink-0" />
              )}
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={musicVolume}
                onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                aria-label="Music volume"
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-xs font-mono tabular-nums text-[#dfd0b6] w-9 text-right">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Built-in & Custom Theme Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-[#b7a386]">
                Soundtrack Themes
              </h3>
              <span className="font-[var(--font-serif)] italic text-xs text-[#9b896f]">
                Tap any theme to audition or load your own MP3/OGG
              </span>
            </div>

            <div className="space-y-2.5">
              {MUSIC_TRACKS.map((track: MusicTrackMeta) => {
                const isSelected = activeTheme === track.id;
                const customName = customFileNames[track.id];
                const hasCustom = Boolean(customName) || music.hasCustomTrack(track.id);

                return (
                  <div
                    key={track.id}
                    className={`p-3.5 rounded-[4px] border transition-all ${
                      isSelected
                        ? 'brass-plaque border-[#cf9a42]'
                        : 'basalt-recess hover:border-[#6e522b]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          sound.select();
                          onSelectTheme(track.id);
                          if (!musicEnabled) {
                            onToggleMusic(true);
                          }
                        }}
                        className="flex items-start gap-3 text-left flex-1 cursor-pointer"
                      >
                        <div
                          className={`mt-0.5 w-9 h-9 rounded-[3px] flex items-center justify-center shrink-0 border ${
                            isSelected && musicEnabled
                              ? 'bg-[#e2b053] text-[#170f06] border-[#f8df9d]'
                              : 'bg-[#1a140f] text-[#9b896f] border-[#423426]'
                          }`}
                        >
                          <Disc
                            className={`w-4 h-4 ${
                              isSelected && musicEnabled ? 'animate-spin' : ''
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-[var(--font-display)] font-bold text-sm text-[#f6dfb0]">
                              {track.title}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                <Check className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="font-[var(--font-serif)] text-sm text-[#b39e81] mt-0.5">
                            {hasCustom
                              ? `Custom Audio Loaded: ${customName ?? 'Custom Audio File'}`
                              : track.subtitle}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-[#8a775f] mt-1">
                            {hasCustom
                              ? 'Looping local audio stream'
                              : `${track.bpm} BPM • Multi-Voice Acoustic Score`}
                          </p>
                        </div>
                      </button>

                      {/* Custom MP3 / OGG Upload Controls */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[track.id] = el;
                          }}
                          type="file"
                          accept="audio/*"
                          onChange={(e) => handleFileUpload(track.id, e)}
                          className="hidden"
                          id={`custom-audio-${track.id}`}
                        />
                        <label
                          htmlFor={`custom-audio-${track.id}`}
                          className="iron-btn min-h-[38px] px-3 rounded-[3px] font-[var(--font-display)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          title="Load your own .mp3, .ogg, or .wav music file for this theme"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#e2b053]" />
                          <span>{hasCustom ? 'Replace MP3' : 'Load MP3'}</span>
                        </label>

                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => handleResetCustomTrack(track.id)}
                            title="Restore built-in synthesized score"
                            className="iron-btn min-h-[38px] px-2.5 rounded-[3px] text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Note on How Game Music Works */}
          <div className="p-3.5 rounded-[3px] basalt-recess font-[var(--font-serif)] text-sm text-[#b39e81] space-y-1.5 leading-relaxed">
            <p className="font-[var(--font-display)] text-xs uppercase tracking-wider text-[#f0d59e] font-semibold">
              How Adaptive Soundtrack &amp; Custom MP3s Work:
            </p>
            <p>
              • <strong className="text-[#f3dfb6]">Built-In Fantasy Score:</strong> Includes three multi-voice acoustic arrangements (Tavern Lute &amp; Recorder, Keep Harpsichord &amp; Strings, and Boss Symphonic Brass &amp; Timpani) mixed through stereo concert-hall reverb.
            </p>
            <p>
              • <strong className="text-[#f3dfb6]">Bring Your Own OST:</strong> Use <span className="text-[#f3dfb6] font-semibold">Load MP3</span> on any theme above to import your own custom soundtrack <code className="font-mono text-xs text-[#f0c76e]">.mp3</code>, <code className="font-mono text-xs text-[#f0c76e]">.ogg</code>, or <code className="font-mono text-xs text-[#f0c76e]">.wav</code> files directly from your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
