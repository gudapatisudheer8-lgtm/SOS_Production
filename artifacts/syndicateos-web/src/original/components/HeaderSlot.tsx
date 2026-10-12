import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Central composition point for page-owned controls rendered inside the shared sticky Header.
 * The Header registers its slot element; a page renders <HeaderSlot> to portal controls into it.
 * Controls stay owned by the page (state, modals, callbacks), and unmount with it, so there are
 * no stale slots after a role or workspace switch.
 */
interface HeaderSlotState {
  target: HTMLElement | null;
  setTarget: (el: HTMLElement | null) => void;
  brandTarget: HTMLElement | null;
  setBrandTarget: (el: HTMLElement | null) => void;
  occupied: number;
  setOccupied: React.Dispatch<React.SetStateAction<number>>;
}

const Ctx = createContext<HeaderSlotState | null>(null);

export const HeaderSlotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [brandTarget, setBrandTarget] = useState<HTMLElement | null>(null);
  const [occupied, setOccupied] = useState(0);
  return <Ctx.Provider value={{ target, setTarget, brandTarget, setBrandTarget, occupied, setOccupied }}>{children}</Ctx.Provider>;
};

/** Used by Header: ref callback for the slot container and whether a page filled it. */
export const useHeaderSlotHost = () => {
  const ctx = useContext(Ctx);
  return { ref: ctx?.setTarget, brandRef: ctx?.setBrandTarget, occupied: (ctx?.occupied ?? 0) > 0 };
};

/** Renders children inside the Header slot. Falls back to inline rendering when no Header host exists. */
export const HeaderSlot: React.FC<{ children: React.ReactNode; position?: 'controls' | 'brand' }> = ({ children, position = 'controls' }) => {
  const ctx = useContext(Ctx);
  const setOccupied = ctx?.setOccupied;
  useEffect(() => {
    if (!setOccupied) return;
    setOccupied((n) => n + 1);
    return () => setOccupied((n) => n - 1);
  }, [setOccupied]);
  if (!ctx) return <>{children}</>;
  const target = position === 'brand' ? ctx.brandTarget : ctx.target;
  if (!target) return null;
  return createPortal(children, target);
};
