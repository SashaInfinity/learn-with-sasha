/**
 * Registers a DOM element as the stage's active anchor for the lifetime of the
 * component. Any screen can place Sasha by rendering a box and calling this.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { pushAnchor, popAnchor, type AnchorOptions } from '../stage/anchorRegistry';

export function useSashaAnchor(
  ref: RefObject<HTMLElement | null>,
  id: string,
  opts: AnchorOptions = {},
): void {
  // Serialised so a fresh object literal on every render doesn't re-register.
  const optsKey = JSON.stringify(opts);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pushAnchor(id, el, JSON.parse(optsKey) as AnchorOptions);
    return () => popAnchor(id);
  }, [ref, id, optsKey]);
}
