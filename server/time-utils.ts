export function parseAsUKTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const tempUTC = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const londonStr = tempUTC.toLocaleString('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' });
  const offsetHours = londonStr.includes('BST') ? 1 : 0;
  return new Date(Date.UTC(year, month - 1, day, hours - offsetHours, minutes));
}
