import { createContext, useContext } from 'react';
import { ArrowDir, BiomeType, Owner, PlacedCard, TetraStats } from '../types/game';

export interface ArenaBiomeCount {
  biome: BiomeType;
  count: number;
}

export interface CardPreviewData {
  cardId: string;
  stats?: TetraStats;
  baseStats?: TetraStats;
  arrows?: ArrowDir[];
  augmentId?: string;
  owner?: Owner | 'neutral';
  terrain?: BiomeType | null;
  terrainMod?: PlacedCard['terrainMod'];
  relicAuraMod?: PlacedCard['relicAuraMod'];
  arenaBiomes?: ArenaBiomeCount[];
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
