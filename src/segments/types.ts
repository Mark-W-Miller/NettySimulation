import type { SimObjectDefinition } from '../engine/assets/simTypes';

export interface SegmentAssetInstance {
  assetId: string;
  instanceId: string;
  config?: Record<string, unknown>;
  children?: SegmentAssetInstance[];
}

export interface GhostObjectDefinition {
  id: string;
  position: [number, number, number];
  color: [number, number, number];
  radius: number;
  opacity: number;
}

export interface SegmentBlueprint {
  id: string;
  name: string;
  assets: SegmentAssetInstance[];
  ghosts?: GhostObjectDefinition[];
}

export interface SegmentRuntimeAsset {
  assetId: string;
  instanceId: string;
}

export interface SimulationSegmentDefinition {
  id: string;
  name: string;
  objects: SimObjectDefinition[];
  assets: SegmentRuntimeAsset[];
  ghosts: GhostObjectDefinition[];
}
