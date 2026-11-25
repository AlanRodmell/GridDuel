import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Coins,
  Download,
  HardDrive,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { ALL_FIGHTERS } from '../data/ladder';
import { PlayerProfile } from '../types/game';
import { sound } from '../utils/sound';

interface SaveVaultModalProps {
  open: boolean;
  onClose: () => void;
  profile: PlayerProfile;
  ownedUniqueCount: number;
  totalCards: number;
  onExportSave: () => string;
  onImportSave: (rawJson: string) => { ok: boolean; message: string };
  onResetProfile: () => void;
}

export const SaveVaultModal: React.FC<SaveVaultModalProps> = ({
  open,
  onClose,
  profile,
  ownedUniqueCount,
  totalCards,
  onExportSave,
  onImportSave,
  onResetProfile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!open) {
      setStatusBanner(null);
      setConfirmReset(false);
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const conqueredCount = useMemo(
    () => ALL_FIGHTERS.filter((f) => (profile.fighterWins?.[f.id] ?? 0) > 0).length,
    [profile.fighterWins]
  );

  if (!open) return null;

  const handleDownloadBackup = () => {
    try {
      sound.select();
      const json = onExportSave();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gridduel-save-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusBanner({
        ok: true,
        text: `Exported campaign backup (gridduel-save-${stamp}.json).`,
      });
    } catch {
      sound.defeat();
      setStatusBanner({
        ok: false,
        text: 'Could not generate save backup file.',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportSave(text);
      if (res.ok) {
        sound.victory();
      } else {
        sound.defeat();
      }
      setStatusBanner({ ok: res.ok, text: res.message });
      setConfirmReset(false);
    };
    reader.onerror = () => {
      sound.defeat();
      setStatusBanner({ ok: false, text: 'Could not read the selected backup file.' });
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = () => {
    sound.defeat();
    onResetProfile();
    setConfirmReset(false);
    setStatusBanner({
      ok: true,
      text: 'Campaign reset to a fresh starter warband and 300g treasury.',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060403]/88 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-vault-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg brass-panel riveted-frame rounded-[5px] shadow-[0_28px_80px_rgba(0,0,0,0.92)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#4b3a26]/85 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[3px] brass-plaque flex items-center justify-center text-[#eab95d] shrink-0">
              <HardDrive className="w-4 h-4" />
            </span>
            <div>
              <h2
                id="save-vault-title"
                className="font-[var(--font-display)] text-lg font-bold tracking-wide text-[#f6dfb0]"
              >
                Campaign Save Vault
              </h2>
              <p className="font-[var(--font-serif)] text-xs text-[#b5a184]">
                Back up, restore, or reset your local browser campaign ledger
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.select();
              onClose();
            }}
            aria-label="Close Save Vault"
            className="iron-btn w-8 h-8 rounded-[3px] flex items-center justify-center text-[#cbb89a] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Current Campaign Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="basalt-recess rounded-[3px] p-2.5">
              <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                Treasury
              </div>
              <div className="font-mono font-bold text-[#f0c76e] mt-0.5 inline-flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#d9a242]" />
                <span>{profile.gold.toLocaleString()}g</span>
              </div>
            </div>

            <div className="basalt-recess rounded-[3px] p-2.5">
              <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                Record
              </div>
              <div className="font-mono font-bold text-[#efe3cd] mt-0.5">
                <span className="text-emerald-400">{profile.wins}W</span> ·{' '}
                <span className="text-rose-400">{profile.losses}L</span>
              </div>
            </div>

            <div className="basalt-recess rounded-[3px] p-2.5">
              <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                Arena
              </div>
              <div className="font-mono font-bold text-[#f0c76e] mt-0.5">
                {conqueredCount}/{ALL_FIGHTERS.length}
              </div>
            </div>

            <div className="basalt-recess rounded-[3px] p-2.5">
              <div className="font-[var(--font-display)] uppercase tracking-wider text-[10px] text-[#9b886e]">
                Compendium
              </div>
              <div className="font-mono font-bold text-[#efe3cd] mt-0.5">
                {ownedUniqueCount}/{totalCards}
              </div>
            </div>
          </div>

          {statusBanner && (
            <div
              className={`rounded-[3px] px-3.5 py-2.5 text-xs border flex items-center gap-2 ${
                statusBanner.ok
                  ? 'bg-emerald-950/65 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/65 border-rose-500/50 text-rose-200'
              }`}
            >
              {statusBanner.ok ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusBanner.text}</span>
            </div>
          )}

          {/* Export & Import Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="brass-btn min-h-[46px] px-4 rounded-[3px] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Save (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.select();
                fileInputRef.current?.click();
              }}
              className="iron-btn min-h-[46px] px-4 rounded-[3px] font-[var(--font-display)] font-semibold text-xs sm:text-sm text-[#f2dfc0] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#e2b053]" />
              <span>Import Save (.json)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="ornate-divider" />

          {/* Two-Step Guarded Campaign Reset */}
          <div className="iron-panel rounded-[4px] p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-rose-300">
                  Reset Campaign Progress
                </div>
                <p className="font-[var(--font-serif)] text-xs text-[#b5a184] mt-0.5 leading-relaxed">
                  Wipes current gold, ladder conquests, decks, and rolled cards back to a fresh
                  starter warband. Export a backup first if you want to keep this save.
                </p>
              </div>
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => {
                  sound.select();
                  setConfirmReset(true);
                }}
                className="iron-btn min-h-[38px] px-3.5 rounded-[3px] font-[var(--font-display)] text-xs font-semibold text-rose-300 hover:text-rose-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Start Fresh Campaign…</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="font-[var(--font-display)] text-xs font-bold text-rose-300">
                  Confirm full campaign wipe?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.select();
                      setConfirmReset(false);
                    }}
                    className="iron-btn min-h-[34px] px-3 rounded-[3px] font-[var(--font-display)] text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="crimson-btn min-h-[34px] px-3.5 rounded-[3px] font-[var(--font-display)] text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Confirm Full Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
