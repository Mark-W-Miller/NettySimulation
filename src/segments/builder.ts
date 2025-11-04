import type {
  SegmentAssetInstance,
  SegmentBlueprint,
  SegmentRuntimeAsset,
  SimulationSegmentDefinition,
} from './types';
import { SEGMENT_BLUEPRINTS } from './registry';
import { instantiateAsset } from '../assets/registry';

function expandAsset(instance: SegmentAssetInstance, collected: SegmentRuntimeAsset[]) {
  const result = instantiateAsset(instance.instanceId, instance.assetId, instance.config ?? {});
  collected.push({ assetId: instance.assetId, instanceId: instance.instanceId });
  const objects = [...result.simObjects];

  if (instance.children?.length) {
    for (const child of instance.children) {
      const childResult = expandAsset(child, collected);
      objects.push(...childResult);
    }
  }

  return objects;
}

function buildSegment(segment: SegmentBlueprint): SimulationSegmentDefinition {
  const runtimeAssets: SegmentRuntimeAsset[] = [];
  const objects = segment.assets.flatMap((asset) => expandAsset(asset, runtimeAssets));

  return {
    id: segment.id,
    name: segment.name,
    objects,
    assets: runtimeAssets,
  };
}

export function buildAllSegments(): SimulationSegmentDefinition[] {
  return SEGMENT_BLUEPRINTS.map(buildSegment);
}
