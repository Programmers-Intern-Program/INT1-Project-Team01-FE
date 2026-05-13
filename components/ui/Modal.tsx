"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { GlyphText } from "@/components/arcade";

const SIZE_CLASSES: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  full: "max-w-[90vw]",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  /** If true, Escape key will NOT close the modal */
  disableEscapeClose?: boolean;
  children: ReactNode;
}

const modalCloseStack: Array<() => void> = [];

function ModalRoot({ open, onClose, title, size = "md", disableEscapeClose, children }: ModalProps) {
  useEffect(() => {
    if (!open || disableEscapeClose) return;
    const closer = () => onClose();
    modalCloseStack.push(closer);
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modalCloseStack[modalCloseStack.length - 1] !== closer) return;
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      const idx = modalCloseStack.lastIndexOf(closer);
      if (idx >= 0) modalCloseStack.splice(idx, 1);
    };
  }, [open, onClose, disableEscapeClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      data-modal-overlay
      style={{ background: "rgba(5,6,13,0.78)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`${SIZE_CLASSES[size]} w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden`}
        style={{
          background: "rgba(20,28,55,0.96)",
          border: "1px solid var(--t4-pink)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.6), inset 0 0 24px rgba(154,122,255,0.08), 0 0 22px rgba(255,122,220,0.35)",
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{
              borderBottom: "1px solid var(--t4-line)",
              background: "rgba(0,0,0,0.4)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 11,
                letterSpacing: 2,
                color: "var(--t4-pink)",
                textShadow: "0 0 8px var(--t4-pink)",
                margin: 0,
              }}
            >
              <GlyphText glyph="◆">
                {typeof title === "string" ? title.toUpperCase() : title}
              </GlyphText>
            </h2>
            <button
              onClick={onClose}
              style={{
                color: "var(--t4-dim)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ModalBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-4 ${className}`}
      style={{ color: "var(--t4-ink)" }}
    >
      {children}
    </div>
  );
}

function ModalFooter({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0 min-h-[68px] ${className}`}
      style={{
        borderTop: "1px solid var(--t4-line)",
        background: "rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </div>
  );
}

const Modal = Object.assign(ModalRoot, {
  Body: ModalBody,
  Footer: ModalFooter,
});

export default Modal;
