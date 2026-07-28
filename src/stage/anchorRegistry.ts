/**
 * Active-anchor registry.
 *
 * Screens declare where Sasha belongs by registering a DOM element. The render
 * loop reads the topmost registered element's rect every frame, so layout — not
 * hardcoded NDC constants — drives the 3D placement. A stack lets a screen
 * mounting over another take over and restore cleanly.
 */
import type { AnchorRect } from './types';

/** Per-anchor fitting overrides, forwarded to anchors.fitScale. */
export interface AnchorOptions {
  fillX?: number;
  fillY?: number;
  min?: number;
  max?: number;
}

interface Entry {
  id: string;
  el: HTMLElement;
  opts: AnchorOptions;
}

const stack: Entry[] = [];

/** Registers (or replaces) an anchor and makes it active. */
export function pushAnchor(id: string, el: HTMLElement, opts: AnchorOptions = {}): void {
  const existing = stack.findIndex((e) => e.id === id);
  if (existing !== -1) stack.splice(existing, 1);
  stack.push({ id, el, opts });
}

/** Removes an anchor wherever it sits in the stack. */
export function popAnchor(id: string): void {
  const index = stack.findIndex((e) => e.id === id);
  if (index !== -1) stack.splice(index, 1);
}

/** The topmost still-connected entry, dropping stale ones as it goes. */
function topEntry(): Entry | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].el.isConnected) return stack[i];
  }
  return null;
}

/** Rect of the active anchor, or null when there is none. */
export function activeAnchorRect(): AnchorRect | null {
  const entry = topEntry();
  if (!entry) return null;
  const r = entry.el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Fitting overrides of the active anchor. */
export function activeAnchorOptions(): AnchorOptions {
  return topEntry()?.opts ?? {};
}
