import { CourseRef } from '../../favorites/lib/CourseRef';

/**
 * A course ref with a function to call when we wanted to use the reference
 * but the jwt was expired. This is intended to be immutable; the reportExpired
 * function should cleanup whatever it is that is holding the ref, and initialize
 * a new version with a more recent jwt.
 */
export type ExpirableCourseRef = {
  /** The underlying course */
  course: CourseRef;
  /** The idempotent function that reports we wanted to use the ref but it was expired */
  reportExpired: () => void;
};
