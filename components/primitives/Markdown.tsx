import React from 'react';

export function Markdown({ text }: { text: string }) {
  const paras = text.split(/\n\n+/);
  return (
    <>
      {paras.map((p, i) => {
        const parts: React.ReactNode[] = [];
        let idx = 0;
        const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(p)) !== null) {
          if (m.index > idx) parts.push(p.slice(idx, m.index));
          if (m[0].startsWith('**')) parts.push(<strong key={`${i}:${m.index}`}>{m[0].slice(2, -2)}</strong>);
          else if (m[0].startsWith('`')) parts.push(<code key={`${i}:${m.index}`}>{m[0].slice(1, -1)}</code>);
          idx = m.index + m[0].length;
        }
        if (idx < p.length) parts.push(p.slice(idx));
        return <p key={i}>{parts}</p>;
      })}
    </>
  );
}
