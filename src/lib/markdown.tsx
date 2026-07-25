/**
 * Shared Markdown renderer — sanitized with DOMPurify.
 *
 * Replaces the two duplicated, hand-rolled (and unsafe) renderers that used to
 * live inline in ChatMessage.tsx and LearningDashboard.tsx. All model output
 * passes through DOMPurify before being set as innerHTML, so a malicious or
 * malformed AI response can't inject script/HTML.
 */
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

/**
 * Convert a small subset of markdown to safe HTML:
 *  - fenced code blocks ```...```
 *  - inline `code`
 *  - **bold**, *italic*
 *  - bullet lists (- * •) and ordered lists (1.)
 *  - paragraphs / line breaks
 *
 * Escapes HTML first, then applies transformations, then sanitizes the result.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // 1. Escape everything so no raw HTML from the model can survive.
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Fence-aware splitting: pull out ``` blocks before other transforms so their
  // content isn't mangled by inline rules.
  const segments = markdown.split(/(```[\s\S]*?```)/g);
  const htmlParts: string[] = [];

  for (const segment of segments) {
    const fenceMatch = segment.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (fenceMatch) {
      const code = escape(fenceMatch[2].replace(/\n$/, ''));
      htmlParts.push(`<pre class="bg-gray-800 rounded-md p-3 my-2 overflow-x-auto"><code>${code}</code></pre>`);
      continue;
    }

    // Inline + block transforms on escaped text.
    const lines = escape(segment).split('\n');
    let inUl = false;
    let inOl = false;
    const closeLists = () => {
      if (inUl) {
        htmlParts.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        htmlParts.push('</ol>');
        inOl = false;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine;
      const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
      const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);

      if (ulMatch) {
        if (inOl) {
          htmlParts.push('</ol>');
          inOl = false;
        }
        if (!inUl) {
          htmlParts.push('<ul class="list-disc list-inside my-2 space-y-1">');
          inUl = true;
        }
        htmlParts.push(`<li>${inline(ulMatch[1])}</li>`);
      } else if (olMatch) {
        if (inUl) {
          htmlParts.push('</ul>');
          inUl = false;
        }
        if (!inOl) {
          htmlParts.push('<ol class="list-decimal list-inside my-2 space-y-1">');
          inOl = true;
        }
        htmlParts.push(`<li>${inline(olMatch[1])}</li>`);
      } else {
        closeLists();
        if (line.trim()) {
          htmlParts.push(`<p class="my-1">${inline(line)}</p>`);
        }
      }
    }
    closeLists();
  }

  const rawHtml = htmlParts.join('\n');
  // 2. Sanitize with DOMPurify (belt-and-suspenders; we already escaped).
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'pre', 'code', 'span'],
    ALLOWED_ATTR: ['class'],
  });
}

/** Inline transforms: code, bold, italic. Input is already HTML-escaped. */
function inline(text: string): string {
  let out = text;
  // inline code first so its content isn't bolded/italicized
  out = out.replace(/`([^`]+)`/g, '<code class="bg-gray-800 rounded px-1 py-0.5 text-sm">$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return out;
}

/** React component wrapper. Memoized so re-renders don't re-parse. */
export const Markdown: React.FC<{ content: string; className?: string }> = React.memo(
  function Markdown({ content, className }) {
    const html = useMemo(() => markdownToHtml(content), [content]);
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  },
);
