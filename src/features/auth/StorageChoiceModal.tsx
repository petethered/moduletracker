import { useStore } from "../../store";

export function StorageChoiceModal() {
  const storageChoice = useStore((s) => s.storageChoice);
  const setStorageChoice = useStore((s) => s.setStorageChoice);

  if (storageChoice !== null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="bg-[var(--color-navy-700)]/95 backdrop-blur-md rounded-2xl border border-[var(--color-navy-500)]/50 w-full max-w-md animate-slide-up"
        style={{ boxShadow: "0 0 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <div className="p-5 border-b border-[var(--color-navy-500)]/30">
          <h2
            className="text-base font-semibold text-[var(--color-accent-gold)] text-center"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            Welcome to ModuleTracker
          </h2>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-400 text-center mb-4">
            How would you like to store your data?
          </p>

          <button
            onClick={() => setStorageChoice("local")}
            className="w-full p-4 rounded-xl border border-[var(--color-navy-500)] bg-[var(--color-navy-800)] hover:border-[var(--color-accent-gold)]/30 transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-[var(--color-accent-gold)] transition-colors">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              <span className="text-sm font-medium text-gray-200">Local Storage Only</span>
            </div>
            <p className="text-xs text-gray-500 ml-8">
              Your data stays on this device. No account needed.
            </p>
          </button>

          <button
            onClick={() => setStorageChoice("cloud")}
            className="w-full p-4 rounded-xl border border-[var(--color-navy-500)] bg-[var(--color-navy-800)] hover:border-[var(--color-accent-gold)]/30 transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-[var(--color-accent-gold)] transition-colors">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
              <span className="text-sm font-medium text-gray-200">Cloud Storage</span>
            </div>
            <p className="text-xs text-gray-500 ml-8">
              Sync across devices. Requires a free account.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
