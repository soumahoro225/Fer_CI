export const REPORTER_NAME_MAX_LENGTH = 100;
export const REPORTER_PHONE_MAX_LENGTH = 30;

const namePattern = /^[^\u0000-\u001f\u007f]*$/u;
const phonePattern = /^[+0-9][0-9 .()/-]{6,29}$/;

type OptionalField = { valid: boolean; value: string | null };

function optionalText(value: unknown, maxLength: number, pattern?: RegExp): OptionalField {
  if (value === null || value === undefined || value === "") return { valid: true, value: null };
  if (typeof value !== "string") return { valid: false, value: null };

  const normalized = value.trim();
  if (!normalized) return { valid: true, value: null };
  return {
    valid: normalized.length <= maxLength && (!pattern || pattern.test(normalized)),
    value: normalized,
  };
}

export function parseReporterContact(body: Record<string, unknown>) {
  const firstName = optionalText(body.reporterFirstName, REPORTER_NAME_MAX_LENGTH, namePattern);
  const lastName = optionalText(body.reporterLastName, REPORTER_NAME_MAX_LENGTH, namePattern);
  const phone = optionalText(body.reporterPhone, REPORTER_PHONE_MAX_LENGTH, phonePattern);

  return {
    valid: firstName.valid && lastName.valid && phone.valid,
    values: {
      reporter_first_name: firstName.value,
      reporter_last_name: lastName.value,
      reporter_phone: phone.value,
    },
  };
}
