export function validatePullForm(
  commonCount: number,
  rareCount: number,
  epicCount: number
) {
  const errors: string[] = [];
  if (commonCount < 0 || commonCount > 10)
    errors.push("Common count must be 0-10");
  if (rareCount < 0 || rareCount > 10) errors.push("Rare count must be 0-10");
  if (epicCount < 0 || epicCount > 10) errors.push("Epic count must be 0-10");
  if (commonCount + rareCount + epicCount !== 10)
    errors.push("Common + Rare + Epics must equal 10");
  return errors;
}

export function clampPullCount(raw: string): number {
  if (raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.trunc(n)));
}
