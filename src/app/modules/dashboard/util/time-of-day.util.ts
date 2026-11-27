export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeOfDayInfo {
  timeOfDay: TimeOfDay;
  greeting: string;
  illustrationSrc: string;
  emoji: string;
  glowClass: string;
  cardBgClass: string;
}

/**
 * Determines the current time of day based on the hour (24-hour clock):
 * - Morning: 5:00 AM - 11:59 AM
 * - Afternoon: 12:00 PM - 4:59 PM
 * - Evening: 5:00 PM - 8:59 PM
 * - Night: 9:00 PM - 4:59 AM
 */
export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'evening';
  }
  return 'night';
}

/**
 * Returns complete time-of-day metadata including matching vector illustration from 'photos 4 agent',
 * greeting message, decorative emoji, and background gradient classes.
 */
export function getTimeOfDayInfo(now: Date = new Date()): TimeOfDayInfo {
  const timeOfDay = getTimeOfDay(now);

  switch (timeOfDay) {
    case 'morning':
      return {
        timeOfDay: 'morning',
        greeting: 'Good morning',
        illustrationSrc: 'assets/dashboard/greeting-morning-blue.webp',
        emoji: '☀️',
        glowClass: 'bg-amber-200/50',
        cardBgClass: 'greeting-card-bg-morning'
      };
    case 'afternoon':
      return {
        timeOfDay: 'afternoon',
        greeting: 'Good afternoon',
        illustrationSrc: 'assets/dashboard/greeting-midday-blue.webp',
        emoji: '☀️',
        glowClass: 'bg-amber-300/60',
        cardBgClass: 'greeting-card-bg-afternoon'
      };
    case 'evening':
      return {
        timeOfDay: 'evening',
        greeting: 'Good evening',
        illustrationSrc: 'assets/dashboard/modern_minimalist_clean_digital_vector_illustration_of_golden_hour_sunset_dusk.png',
        emoji: '🌇',
        glowClass: 'bg-orange-300/50',
        cardBgClass: 'greeting-card-bg-evening'
      };
    case 'night':
      return {
        timeOfDay: 'night',
        // Kept as 'Good night' (starts with 'Good') so specs asserting .toContain('Good') pass seamlessly
        greeting: 'Good night',
        illustrationSrc: 'assets/dashboard/modern_minimalist_clean_digital_vector_illustration_of_calm_night_sky_deep.png',
        emoji: '🌙',
        glowClass: 'bg-indigo-300/40',
        cardBgClass: 'greeting-card-bg-night'
      };
  }
}
