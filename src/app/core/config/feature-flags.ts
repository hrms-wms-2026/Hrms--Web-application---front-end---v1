export const FEATURE_FLAGS = {
  realtimeNotifications: true,
  experimentalFeatures: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
