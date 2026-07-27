// <input type="datetime-local"> values carry no timezone ("YYYY-MM-DDTHH:MM").
// Server actions run in UTC (Vercel), so `new Date(value)` would interpret the
// admin's Korea-time input as UTC and shift it by 9 hours — making scheduled
// popups/banners appear at the wrong time (or not at all). Admins enter Korea
// time (KST = UTC+9, no DST), so parse it explicitly as such.
export function kstDatetimeLocalToUtcIso(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const withSeconds = /T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  const d = new Date(`${withSeconds}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
