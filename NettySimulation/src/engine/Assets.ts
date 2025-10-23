// Assets.ts — centralizes asset factory accessors for the engine
import { createAxisMesh, disposeAxisMesh } from './assets/axisAsset';

export const Assets = {
  createAxisMesh,
  disposeAxisMesh,
};

export type { AxisMesh } from './assets/axisAsset';
