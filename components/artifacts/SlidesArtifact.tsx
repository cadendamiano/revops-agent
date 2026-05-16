'use client';

import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/slides-ui/lib/index.css';

import { useEffect, useRef } from 'react';
import { watchUniverUnit } from '@/lib/univerPersistence';
import { useStore, type Artifact } from '@/lib/store';

// phase-a: slides seed pending. Phase B reintroduces a domain transform.
function transformToUniverSlide(dataJson: string): any {
  try { return JSON.parse(dataJson); } catch { return {}; }
}

type Props = { artifact: Artifact };

export function SlidesArtifact({ artifact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const setArtifacts = useStore(s => s.setArtifactsInActiveWorkspaceThread);

  useEffect(() => {
    if (!containerRef.current || !artifact.dataJson) return;
    let cancelled = false;

    if (disposeRef.current) {
      disposeRef.current();
      disposeRef.current = null;
    }
    containerRef.current.innerHTML = '';

    (async () => {
      if (cancelled) return;

      const [
        { Univer, LocaleType, UniverInstanceType },
        { defaultTheme },
        { UniverRenderEnginePlugin },
        { UniverUIPlugin },
        { UniverDocsPlugin },
        { UniverDocsUIPlugin },
        { UniverSlidesPlugin },
        { UniverSlidesUIPlugin },
        UILocale,
        DocsUILocale,
        SlidesUILocale,
      ] = await Promise.all([
        import('@univerjs/core'),
        import('@univerjs/themes'),
        import('@univerjs/engine-render'),
        import('@univerjs/ui'),
        import('@univerjs/docs'),
        import('@univerjs/docs-ui'),
        import('@univerjs/slides'),
        import('@univerjs/slides-ui'),
        import('@univerjs/ui/locale/en-US'),
        import('@univerjs/docs-ui/locale/en-US'),
        import('@univerjs/slides-ui/locale/en-US'),
      ]);

      if (cancelled || !containerRef.current) return;

      const slideData = transformToUniverSlide(artifact.dataJson!);

      const univer = new Univer({
        theme: defaultTheme,
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: {
            ...(UILocale.default ?? UILocale),
            ...(DocsUILocale.default ?? DocsUILocale),
            ...(SlidesUILocale.default ?? SlidesUILocale),
          },
        },
      });

      univer.registerPlugin(UniverRenderEnginePlugin);
      univer.registerPlugin(UniverUIPlugin, { container: containerRef.current });
      univer.registerPlugin(UniverDocsPlugin);
      univer.registerPlugin(UniverDocsUIPlugin);
      univer.registerPlugin(UniverSlidesPlugin);
      univer.registerPlugin(UniverSlidesUIPlugin);

      const unit = univer.createUnit(UniverInstanceType.UNIVER_SLIDE, slideData);

      const stopWatching = watchUniverUnit(unit, {
        onChange: (json) => {
          setArtifacts(prev =>
            prev.map(a =>
              a.id === artifact.id
                ? { ...a, dataJson: json, editedBy: 'You', editedAt: Date.now() }
                : a
            )
          );
        },
      });

      disposeRef.current = () => {
        stopWatching();
        univer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      if (disposeRef.current) {
        disposeRef.current();
        disposeRef.current = null;
      }
    };
    // We intentionally do not depend on artifact.dataJson here — re-rendering
    // every keystroke would tear down the live editor. The artifact id changes
    // when the user opens a different deck, so that's the right boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.id]);

  if (!artifact.dataJson) {
    return (
      <div style={{ padding: 24, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
        No slide data.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 480 }}
    />
  );
}
