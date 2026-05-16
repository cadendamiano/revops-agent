// Minimal snapshot-watcher for Univer units. Univer's command-service API
// shifts between minor versions, so we use the version-stable approach of
// polling the unit's snapshot at a debounced interval and only firing
// onChange when the serialized JSON differs from the last seen state.
//
// `unit` is whatever `Univer#createUnit` returned: a Workbook for sheets,
// a DocumentDataModel for docs, a SlideDataModel for slides. All of them
// expose getSnapshot() on 0.21.x; we fall back to `save()` defensively.

export type UniverPersistenceOpts = {
  intervalMs?: number;
  onChange: (json: string) => void;
};

function snapshotOf(unit: any): unknown {
  if (!unit) return null;
  if (typeof unit.getSnapshot === 'function') return unit.getSnapshot();
  if (typeof unit.save === 'function') return unit.save();
  return null;
}

export function watchUniverUnit(
  unit: unknown,
  opts: UniverPersistenceOpts
): () => void {
  const interval = opts.intervalMs ?? 1500;
  let last = '';
  try {
    last = JSON.stringify(snapshotOf(unit));
  } catch {
    last = '';
  }
  const t = setInterval(() => {
    try {
      const cur = JSON.stringify(snapshotOf(unit));
      if (cur && cur !== last) {
        last = cur;
        opts.onChange(cur);
      }
    } catch {
      // Snapshot can throw mid-disposal; ignore and try again next tick.
    }
  }, interval);
  return () => clearInterval(t);
}
