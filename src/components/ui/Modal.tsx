import { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="bg-[var(--color-navy-700)]/95 backdrop-blur-md rounded-2xl border border-[var(--color-navy-500)]/50 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up"
        style={{
          boxShadow:
            "0 0 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-navy-500)]/30">
          <h2
            className="text-base font-semibold text-[var(--color-accent-gold)]"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 text-lg leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-navy-600)]"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
