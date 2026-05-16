'use client';

import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';

import { useEffect, useRef } from 'react';
import type { Artifact } from '@/lib/store';

// phase-a: spreadsheet seed pending. Phase B reintroduces a domain transform.
function transformToUniver(dataJson: string): any {
  try { return JSON.parse(dataJson); } catch { return {}; }
}

type Props = { artifact: Artifact };

export function SpreadsheetArtifact({ artifact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Hold the dispose function returned by Univer setup
  const disposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current || !artifact.dataJson) return;

    let cancelled = false;

    // Dispose any previous instance before mounting a new one
    if (disposeRef.current) {
      disposeRef.current();
      disposeRef.current = null;
    }

    // Clear previous canvas content
    containerRef.current.innerHTML = '';

    (async () => {
      if (cancelled) return;

      const [
        { Univer, LocaleType, UniverInstanceType },
        { defaultTheme },
        { UniverRenderEnginePlugin },
        { UniverFormulaEnginePlugin },
        { UniverUIPlugin },
        { UniverDocsPlugin },
        { UniverDocsUIPlugin },
        { UniverSheetsPlugin },
        { UniverSheetsUIPlugin },
        { UniverSheetsFormulaPlugin },
        { UniverSheetsFormulaUIPlugin },
        SheetsUILocale,
        UILocale,
        SheetsFormulaUILocale,
        DocsUILocale,
      ] = await Promise.all([
        import('@univerjs/core'),
        import('@univerjs/themes'),
        import('@univerjs/engine-render'),
        import('@univerjs/engine-formula'),
        import('@univerjs/ui'),
        import('@univerjs/docs'),
        import('@univerjs/docs-ui'),
        import('@univerjs/sheets'),
        import('@univerjs/sheets-ui'),
        import('@univerjs/sheets-formula'),
        import('@univerjs/sheets-formula-ui'),
        import('@univerjs/sheets-ui/locale/en-US'),
        import('@univerjs/ui/locale/en-US'),
        import('@univerjs/sheets-formula-ui/locale/en-US'),
        import('@univerjs/docs-ui/locale/en-US'),
      ]);

      if (cancelled || !containerRef.current) return;

      const workbookData = transformToUniver(artifact.dataJson!);

      const univer = new Univer({
        theme: defaultTheme,
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: {
            ...(UILocale.default ?? UILocale),
            ...(DocsUILocale.default ?? DocsUILocale),
            ...(SheetsUILocale.default ?? SheetsUILocale),
            ...(SheetsFormulaUILocale.default ?? SheetsFormulaUILocale),
          },
        },
      });

      univer.registerPlugin(UniverRenderEnginePlugin);
      univer.registerPlugin(UniverFormulaEnginePlugin);
      univer.registerPlugin(UniverUIPlugin, { container: containerRef.current });
      univer.registerPlugin(UniverDocsPlugin);
      univer.registerPlugin(UniverDocsUIPlugin);
      univer.registerPlugin(UniverSheetsPlugin);
      univer.registerPlugin(UniverSheetsUIPlugin);
      univer.registerPlugin(UniverSheetsFormulaPlugin);
      univer.registerPlugin(UniverSheetsFormulaUIPlugin);

      univer.createUnit(UniverInstanceType.UNIVER_SHEET, workbookData);

      disposeRef.current = () => univer.dispose();
    })();

    return () => {
      cancelled = true;
      if (disposeRef.current) {
        disposeRef.current();
        disposeRef.current = null;
      }
    };
  }, [artifact.dataJson]);

  if (!artifact.dataJson) {
    return (
      <div style={{ padding: 24, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
        No spreadsheet data.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 400 }}
    />
  );
}
