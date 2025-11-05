export interface DoubleClickEventContext {
  clientX: number;
  clientY: number;
  bounds: DOMRect;
}

export interface DoubleClickTarget {
  priority?: number;
  hitTest(context: DoubleClickEventContext): boolean;
  onDoubleClick(context: DoubleClickEventContext): void;
}

const targets: DoubleClickTarget[] = [];

export function registerDoubleClickTarget(target: DoubleClickTarget): () => void {
  targets.push(target);
  targets.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return () => {
    const index = targets.indexOf(target);
    if (index >= 0) {
      targets.splice(index, 1);
    }
  };
}

export function dispatchDoubleClick(context: DoubleClickEventContext): boolean {
  for (const target of targets) {
    if (target.hitTest(context)) {
      target.onDoubleClick(context);
      return true;
    }
  }
  return false;
}
