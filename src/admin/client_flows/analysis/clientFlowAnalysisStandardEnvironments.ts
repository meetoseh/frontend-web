import { VISITOR_SOURCE } from '../../../shared/lib/visitorSource';
import { ClientFlowAnalysisEnvironment } from './ClientFlowAnalysisEnvironment';

const now = Math.floor(Date.now() / 1000 / 86400) * 86400;

type NamedEnvironment = {
  name: string;
  environment: Omit<ClientFlowAnalysisEnvironment, 'version'>;
};

const baseNewUser = {
  accountCreatedAt: now,
  now: now,
  lastJourneyRating: null,
  journeysToday: 0,
  journalEntriesInHistoryToday: 0,
  hasOsehPlus: false,
};
const newUserByPlatform: Record<typeof VISITOR_SOURCE, NamedEnvironment> = {
  browser: {
    name: 'New user on browser',
    environment: {
      ...baseNewUser,
      platform: 'browser',
    },
  },
  ios: {
    name: 'New user on iOS',
    environment: {
      ...baseNewUser,
      platform: 'ios',
    },
  },
  android: {
    name: 'New user on Android',
    environment: {
      ...baseNewUser,
      platform: 'android',
    },
  },
};

const baseNewProUser = {
  ...baseNewUser,
  hasOsehPlus: true,
};
const newProUserByPlatform: Record<typeof VISITOR_SOURCE, NamedEnvironment> = {
  browser: {
    name: 'New Pro user on browser',
    environment: {
      ...baseNewProUser,
      platform: 'browser',
    },
  },
  ios: {
    name: 'New Pro user on iOS',
    environment: {
      ...baseNewProUser,
      platform: 'ios',
    },
  },
  android: {
    name: 'New Pro user on Android',
    environment: {
      ...baseNewProUser,
      platform: 'android',
    },
  },
};

const baseOldFreeUser = {
  ...baseNewUser,
  accountCreatedAt: now - 60 * 60 * 24 * 30, // 30 days ago
  lastJourneyRating: 1,
  journeysToday: 1,
};
const oldFreeUserByPlatform: Record<typeof VISITOR_SOURCE, NamedEnvironment> = {
  browser: {
    name: 'Returning free user on browser',
    environment: {
      ...baseOldFreeUser,
      platform: 'browser',
    },
  },
  ios: {
    name: 'Returning free user on iOS',
    environment: {
      ...baseOldFreeUser,
      platform: 'ios',
    },
  },
  android: {
    name: 'Returning free user on Android',
    environment: {
      ...baseOldFreeUser,
      platform: 'android',
    },
  },
};

const baseOldProUser = {
  ...baseOldFreeUser,
  hasOsehPlus: true,
};
const oldProUserByPlatform: Record<typeof VISITOR_SOURCE, NamedEnvironment> = {
  browser: {
    name: 'Returning Pro user on browser',
    environment: {
      ...baseOldProUser,
      platform: 'browser',
    },
  },
  ios: {
    name: 'Returning Pro user on iOS',
    environment: {
      ...baseOldProUser,
      platform: 'ios',
    },
  },
  android: {
    name: 'Returning Pro user on Android',
    environment: {
      ...baseOldProUser,
      platform: 'android',
    },
  },
};

export const clientFlowAnalysisStandardEnvironments = {
  newUserByPlatform,
  newProUserByPlatform,
  oldFreeUserByPlatform,
  oldProUserByPlatform,
  flattened: [
    ...Object.values(newUserByPlatform),
    ...Object.values(newProUserByPlatform),
    ...Object.values(oldFreeUserByPlatform),
    ...Object.values(oldProUserByPlatform),
  ],
} as const;
