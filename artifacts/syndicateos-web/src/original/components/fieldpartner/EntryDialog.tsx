import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface EntryDialogProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  closeLabel: string;
  children: React.ReactNode;
}

/** Accessible modal shell: Escape / backdrop / close button dismiss without clearing caller state. */
export const EntryDialog: React.FC<EntryDialogProps> = ({ open, onClose, titleId, closeLabel, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab') {
        const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) || []).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-gray-950/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-xl space-y-4"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
};
