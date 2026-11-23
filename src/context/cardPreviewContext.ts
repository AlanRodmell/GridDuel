import { createContext, useContext } from 'react';
import { ArrowDir, Owner, TetraStats } from '../types/game';

export interface CardPreviewData {
  cardId: string;
  stats: TetraStats;
  baseStats?: TetraStats;
  arrows: ArrowDir[];
  owner?: Owner | 'neutral';
  lastAugmented?: {
    label: string;
    isBuff: boolean;
    timestamp: number;
  };
}

export interface CardPreviewContextValue {
  openPreview: (data: CardPreviewData) => void;
  closePreview: () => void;
}

export const CardPreviewContext = createContext<CardPreviewContextValue>({
  openPreview: () => {},
  closePreview: () => {},
});

export function useCardPreview(): CardPreviewContextValue {
  return useContext(CardPreviewContext);
}
