import { ExternalCourse } from '../../../series/lib/ExternalCourse';

export type UpgradeContextGeneric = {
  /** Fallback reason */
  type: 'generic';
};

export type UpgradeContextOnboarding = {
  /** Came from the onboarding process */
  type: 'onboarding';
};

export type UpgradeContextSeries = {
  /** From a series details screen */
  type: 'series';
  /** The series that they were directed from */
  course: ExternalCourse;
};

export type UpgradeContextLongerClasses = {
  /** After picking an emotion, chose to take a longer class */
  type: 'longerClasses';
  /** The emotion they chose */
  emotion: string;
};

/**
 * Reasons for showing an upgrade screen, discriminated by type
 */
export type UpgradeContext =
  | UpgradeContextGeneric
  | UpgradeContextOnboarding
  | UpgradeContextSeries
  | UpgradeContextLongerClasses;
