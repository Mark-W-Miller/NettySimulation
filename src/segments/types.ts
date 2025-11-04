import type { SimObjectDefinition } from '../engine/assets/simTypes';

export interface SegmentAssetInstance {
  assetId: string;
  instanceId: string;
  config?: Record<string, unknown>;
  children?: SegmentAssetInstance[];
}

export interface SegmentBlueprint {
  id: string;
  name: string;
  assets: SegmentAssetInstance[];
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
}
