import { normalizeText } from "~/utils/normalize-text";

export type FieldGroupRefType = { id: string; name: string };
export type FieldCandidateType = { value: string; fieldGroupId: string };

/** Identity of a field: the value alone is ambiguous across groups. */
export const getFieldKey = (candidate: FieldCandidateType): string =>
  `${candidate.fieldGroupId}:${candidate.value}`;

/**
 * Collects the field values a parsed item contributes, one entry per
 * (field group, value) pair. The same text in two groups stays two candidates;
 * repeats inside one group collapse into one.
 */
export function buildFieldCandidates(
  details: Record<string, unknown>,
  fieldGroups: FieldGroupRefType[],
): FieldCandidateType[] {
  const candidates = new Map<string, FieldCandidateType>();

  for (const fieldGroup of fieldGroups) {
    const raw = details[fieldGroup.name];
    const rawValues = Array.isArray(raw) ? raw : [raw];

    for (const rawValue of rawValues) {
      if (typeof rawValue !== "string" && typeof rawValue !== "number") {
        continue;
      }

      // Values are filter identities, so they stay normalized. External ids
      // never go through here — see buildCanonicalKey.
      const value = normalizeText(String(rawValue));

      if (!value) {
        continue;
      }

      const candidate: FieldCandidateType = {
        value,
        fieldGroupId: fieldGroup.id,
      };
      const key = getFieldKey(candidate);

      if (!candidates.has(key)) {
        candidates.set(key, candidate);
      }
    }
  }

  return [...candidates.values()];
}
