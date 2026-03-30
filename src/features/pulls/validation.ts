export function validatePullForm(commonCount: number, rareCount: number) {
  const errors: string[] = [];
  if (commonCount < 0 || commonCount > 10)
    errors.push("Common count must be 0-10");
  if (rareCount < 0 || rareCount > 10) errors.push("Rare count must be 0-10");
  if (commonCount + rareCount > 10)
    errors.push("Common + Rare cannot exceed 10");
  return errors;
}
