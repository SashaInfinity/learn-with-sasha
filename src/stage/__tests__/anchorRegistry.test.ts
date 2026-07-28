import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushAnchor,
  popAnchor,
  activeAnchorRect,
  activeAnchorOptions,
} from '../anchorRegistry';

function makeEl(rect: { left: number; top: number; width: number; height: number }) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe('anchorRegistry', () => {
  beforeEach(() => {
    popAnchor('a');
    popAnchor('b');
    document.body.innerHTML = '';
  });

  it('returns null when nothing is registered', () => {
    expect(activeAnchorRect()).toBeNull();
  });

  it('returns the registered element rect', () => {
    pushAnchor('a', makeEl({ left: 10, top: 20, width: 100, height: 200 }));
    expect(activeAnchorRect()).toEqual({ left: 10, top: 20, width: 100, height: 200 });
  });

  it('the most recently pushed anchor wins', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('b', makeEl({ left: 50, top: 50, width: 20, height: 20 }));
    expect(activeAnchorRect()?.left).toBe(50);
  });

  it('popping the top restores the previous anchor', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('b', makeEl({ left: 50, top: 50, width: 20, height: 20 }));
    popAnchor('b');
    expect(activeAnchorRect()?.left).toBe(0);
  });

  it('popping a buried anchor removes it without disturbing the top', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('b', makeEl({ left: 50, top: 50, width: 20, height: 20 }));
    popAnchor('a');
    expect(activeAnchorRect()?.left).toBe(50);
  });

  it('re-pushing the same id replaces rather than duplicates', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('a', makeEl({ left: 99, top: 0, width: 10, height: 10 }));
    expect(activeAnchorRect()?.left).toBe(99);
    popAnchor('a');
    expect(activeAnchorRect()).toBeNull();
  });

  it('returns null once the element is detached from the document', () => {
    const el = makeEl({ left: 0, top: 0, width: 10, height: 10 });
    pushAnchor('a', el);
    el.remove();
    expect(activeAnchorRect()).toBeNull();
  });

  it('exposes the options registered with the active anchor', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }), { fillY: 0.5 });
    expect(activeAnchorOptions().fillY).toBe(0.5);
  });

  it('returns empty options when nothing is registered', () => {
    expect(activeAnchorOptions()).toEqual({});
  });
});
