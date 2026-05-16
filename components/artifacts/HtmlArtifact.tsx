'use client';

import { useMemo } from 'react';
import type { Artifact } from '@/lib/store';

const BASE_CSS = `
  html, body { margin: 0; padding: 0; background: #fff; color: #0b1117; font-family: ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif; font-size: 13px; line-height: 1.5; }
  body { padding: 18px; box-sizing: border-box; }
  #root { width: 100%; min-height: 400px; }
  h1, h2, h3 { margin: 0 0 8px; font-weight: 600; }
  h1 { font-size: 18px; }
  h2 { font-size: 15px; }
  h3 { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e6e8ee; text-align: left; }
  th { color: #556; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .echart, .chart, .viz { width: 100%; height: 360px; }
`;

function buildSrcDoc(artifact: Artifact, vendorBase: string): string {
  const userCss = artifact.css ?? '';
  const htmlBody = artifact.html ?? '';
  const script = artifact.script ?? '';
  const dataJson = artifact.dataJson ?? 'null';

  // Inject data JSON via a <script type="application/json"> tag to avoid
  // breaking out of JS string context; the inline bootstrap reads it.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${BASE_CSS}\n${userCss}</style>
<script src="${vendorBase}/vendor/echarts.min.js"></script>
<script src="${vendorBase}/vendor/d3.min.js"></script>
<script src="${vendorBase}/vendor/chart.umd.js"></script>
</head>
<body>
<div id="root">${htmlBody}</div>
<script id="__bcw_data__" type="application/json">${escapeJsonForScriptTag(dataJson)}</script>
<script>
(function () {
  try {
    var raw = document.getElementById('__bcw_data__').textContent || 'null';
    window.__DATA = JSON.parse(raw);
  } catch (e) {
    window.__DATA = null;
    console.warn('[HtmlArtifact] could not parse dataJson', e);
  }
})();
</script>
<script>
try {
${script}
} catch (err) {
  var root = document.getElementById('root');
  if (root) {
    var pre = document.createElement('pre');
    pre.style.cssText = 'color:#b91c1c;background:#fef2f2;padding:10px;border:1px solid #fecaca;border-radius:6px;white-space:pre-wrap;font-size:11px;';
    pre.textContent = 'Artifact script error: ' + (err && err.message ? err.message : String(err));
    root.appendChild(pre);
  }
  console.error('[HtmlArtifact] script error', err);
}
</script>
</body>
</html>`;
}

function escapeJsonForScriptTag(json: string): string {
  // A JSON payload inside <script type="application/json"> must not contain "</script"
  // or it will close the tag. Escape the "<" safely.
  return String(json).replace(/<\/(script)/gi, '<\\/$1');
}

export function HtmlArtifact({ artifact }: { artifact: Artifact }) {
  // Use the current page origin so vendor scripts load from the local Next.js
  // server. This works in both web dev (http://localhost:3000) and Electron
  // (http://127.0.0.1:PORT) since Electron always spawns a real HTTP server.
  const vendorBase = typeof window !== 'undefined' ? window.location.origin : 'https://cdn.jsdelivr.net/npm';
  const srcDoc = useMemo(() => buildSrcDoc(artifact, vendorBase), [
    artifact.html,
    artifact.css,
    artifact.script,
    artifact.dataJson,
    vendorBase,
  ]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {artifact.title && (
        <div className="artifact-title">
          <h2>{artifact.title}</h2>
        </div>
      )}
      <iframe
        title={artifact.title ?? artifact.label ?? 'Artifact'}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{
          width: '100%',
          height: artifact.title ? 'calc(100% - 40px)' : '100%',
          minHeight: 420,
          border: '1px solid var(--rule, #e6e8ee)',
          borderRadius: 8,
          background: '#fff',
        }}
      />
    </div>
  );
}
