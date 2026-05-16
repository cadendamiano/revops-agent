import type { ArtifactKind } from '@/lib/flows';

type Props = {
  kind?: ArtifactKind;
};

export function ArtifactSkeleton({ kind }: Props) {
  if (kind === 'spreadsheet') return <TableSkeleton />;
  if (kind === 'document') return <DocSkeleton />;
  if (kind === 'slides') return <SlidesSkeleton />;
  return <GenericSkeleton />;
}

function TableSkeleton() {
  return (
    <div className="artifact-skeleton">
      <div className="artifact-skeleton-head">
        <div className="skel-block" style={{ width: '32%', height: 14 }} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skel-block" style={{ width: '100%', height: 28 }} />
        ))}
      </div>
    </div>
  );
}

function DocSkeleton() {
  return (
    <div className="artifact-skeleton">
      <div className="skel-block" style={{ width: '60%', height: 18 }} />
      <div className="skel-block" style={{ width: '30%', height: 11, marginTop: 8 }} />
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[100, 96, 92, 88, 70, 100, 94, 60].map((w, i) => (
          <div key={i} className="skel-block" style={{ width: `${w}%`, height: 11 }} />
        ))}
      </div>
    </div>
  );
}

function SlidesSkeleton() {
  return (
    <div className="artifact-skeleton">
      <div className="skel-block" style={{ width: '100%', height: 240 }} />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel-block" style={{ flex: 1, height: 56 }} />
        ))}
      </div>
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div className="artifact-skeleton">
      <div className="skel-block" style={{ width: '40%', height: 14 }} />
      <div className="skel-block" style={{ width: '100%', height: 180, marginTop: 14 }} />
    </div>
  );
}
