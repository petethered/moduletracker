/**
 * PlayerInfoFileInput — the hidden file input behind both Import Player Info
 * buttons (Settings' ImportPlayerInfoButton and the header's
 * ImportSaveHeaderButton). The button owns the ref and calls
 * `inputRef.current?.click()`.
 *
 * NO `accept` filter on purpose: mobile pickers (iOS in particular) grey out
 * extensions they don't recognise, and ".dat" is one of them. A wrong file is
 * caught by the parser with a clear message instead.
 *
 * The value is reset after each pick so choosing the same file again (e.g. an
 * updated save with the same name) still fires onChange.
 */
export function PlayerInfoFileInput({
  inputRef,
  onFile,
  testId,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  /** e2e hook; keep the player-info-* prefix (see PlayerInfoImportSummary). */
  testId: string;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onFile(file);
      }}
      className="hidden"
      data-testid={testId}
      aria-label="Player info save file"
    />
  );
}
