function normalizeLookupText(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return normalized || null;
}

export function buildNormalizedLookupKey(
  companyName: string | null | undefined,
  projectName: string | null | undefined
): string | null {
  return (
    normalizeLookupText(companyName) ??
    normalizeLookupText(projectName)
  );
}
