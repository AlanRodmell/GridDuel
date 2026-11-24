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
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="music-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl bg-[#131C31] border border-amber-500/30 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#1A243D] via-[#172138] to-[#131C31] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="music-modal-title"
                className="font-[var(--font-display)] text-lg font-bold text-amber-200 tracking-wide"
              >
                Soundtrack & Custom Audio Studio
              </h2>
              <p className="text-xs text-slate-400">
                Multi-instrument fantasy score & custom MP3/OGG soundtrack loader
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
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[78dvh] overflow-y-auto">
          {/* Master Playback & Volume Bar */}
          <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  onToggleMusic(!musicEnabled);
                }}
                className={`min-h-[44px] px-4 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  musicEnabled
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
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
                className={`min-h-[44px] px-3.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  adaptiveMode
                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Automatically switch soundtrack between Tavern Prep, Arena Duel, and Boss Sanctum"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Auto-Adaptive: {adaptiveMode ? 'On' : 'Off'}</span>
              </button>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2.5 min-w-[160px]">
              {musicVolume <= 0.01 || !musicEnabled ? (
                <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-300 shrink-0" />
              )}
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={musicVolume}
                onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                aria-label="Music volume"
                className="w-full accent-amber-400 cursor-pointer"
              />
              <span className="text-xs font-mono tabular-nums text-slate-300 w-9 text-right">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Built-in & Custom Theme Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Game Soundtrack Themes (Built-in & Custom Audio)
              </h3>
              <span className="text-[11px] text-slate-400">
                Tap any theme to audition or upload your own MP3/OGG
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
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#1A2540] border-amber-400/50 shadow-md'
                        : 'bg-[#0F172A]/80 border-slate-800/80 hover:border-slate-700'
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
                          className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                            isSelected && musicEnabled
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-slate-800/90 text-slate-400 border-slate-700'
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
                            <span className="font-[var(--font-display)] font-bold text-sm text-amber-100">
                              {track.title}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                                <Check className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {hasCustom
                              ? `Custom Audio Loaded: ${customName ?? 'Custom Audio File'}`
                              : track.subtitle}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
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
                          className="min-h-[38px] px-3 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Load your own .mp3, .ogg, or .wav music file for this theme"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-300" />
                          <span>{hasCustom ? 'Replace MP3' : 'Load MP3'}</span>
                        </label>

                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => handleResetCustomTrack(track.id)}
                            title="Restore built-in synthesized score"
                            className="min-h-[38px] px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
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
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <p className="text-slate-200 font-semibold">
              How Adaptive Soundtrack & Custom MP3s Work:
            </p>
            <p>
              • <strong className="text-amber-200">Built-In Fantasy Score:</strong> Includes three multi-voice acoustic arrangements (Tavern Lute &amp; Recorder, Keep Harpsichord &amp; Strings, and Boss Symphonic Brass &amp; Timpani) mixed through stereo concert-hall reverb.
            </p>
            <p>
              • <strong className="text-amber-200">Bring Your Own OST:</strong> Use <span className="text-slate-200 font-medium">Load MP3</span> on any theme above to import your own custom soundtrack <code className="text-amber-300">.mp3</code>, <code className="text-amber-300">.ogg</code>, or <code className="text-amber-300">.wav</code> files directly from your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
