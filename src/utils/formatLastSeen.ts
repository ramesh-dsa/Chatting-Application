import { isToday, isYesterday, format } from 'date-fns';

export function formatLastSeen(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;

  const date = new Date(timestamp);
  const now = new Date();
  
  // Guard against invalid dates
  if (isNaN(date.getTime())) return null;

  const diffInSeconds = (now.getTime() - date.getTime()) / 1000;
  
  // If timestamp is within the last 60 seconds (or slightly in the future due to clock skew)
  if (diffInSeconds < 60 && diffInSeconds >= -10) {
    return 'last seen just now';
  }

  const timeString = format(date, 'h:mm a');

  if (isToday(date)) {
    return `last seen today at ${timeString}`;
  }

  if (isYesterday(date)) {
    return `last seen yesterday at ${timeString}`;
  }

  // If within the last 6 calendar days (e.g. today is Thursday, so down to last Friday)
  // We can just check if diff in hours < 7 * 24 as a safe approximation for "within a week"
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffInHours < 7 * 24) {
    const weekday = format(date, 'EEEE');
    return `last seen ${weekday} at ${timeString}`;
  }

  // Older than 7 days
  const dateString = format(date, 'dd/MM/yyyy');
  return `last seen ${dateString}`;
}
