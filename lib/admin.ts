export const ADMIN_EMAILS = new Set<string>([
  'ameetk96@gmail.com',
  'ameet@glammatic.com',
]);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export function isAdminFromEmails(emails: Array<string | null | undefined>): boolean {
  for (const e of emails) {
    if (e && ADMIN_EMAILS.has(e.trim().toLowerCase())) return true;
  }
  return false;
}


