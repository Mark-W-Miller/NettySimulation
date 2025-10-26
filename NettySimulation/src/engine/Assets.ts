// Assets.ts — centralizes asset factory accessors for the engine
import { createAxisSet, disposeAxisSet } from './assets/axisAsset';
import { createSphereMesh, disposeSphereMesh } from './assets/sphereAsset';

export const Assets = {
  createAxisSet,
  disposeAxisSet,
  createSphereMesh,
  disposeSphereMesh,
};

export type { AxisMesh, AxisSet } from './assets/axisAsset';
export type { SphereMesh } from './assets/sphereAsset';
