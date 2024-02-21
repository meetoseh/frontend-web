import { CourseFlags } from './CourseFlags';

export const COURSE_FLAG_PRESETS: [CourseFlags | 0, string][] = [
  [0, 'Hard Deleted'],
  [CourseFlags.SERIES_VISIBLE_IN_OWNED | CourseFlags.JOURNEYS_IN_SERIES_IN_HISTORY, 'Soft Deleted'],
  [
    CourseFlags.JOURNEYS_IN_SERIES_CODE_SHAREABLE |
      CourseFlags.SERIES_PUBLIC_SHAREABLE |
      CourseFlags.SERIES_CODE_SHAREABLE |
      CourseFlags.SERIES_VISIBLE_IN_OWNED |
      CourseFlags.JOURNEYS_IN_SERIES_IN_HISTORY |
      CourseFlags.SERIES_ATTACHABLE_FOR_FREE |
      CourseFlags.SERIES_IN_ADMIN_AREA,
    'Free',
  ],
  [
    CourseFlags.JOURNEYS_IN_SERIES_CODE_SHAREABLE |
      CourseFlags.SERIES_PUBLIC_SHAREABLE |
      CourseFlags.SERIES_CODE_SHAREABLE |
      CourseFlags.SERIES_VISIBLE_IN_OWNED |
      CourseFlags.JOURNEYS_IN_SERIES_IN_HISTORY |
      CourseFlags.SERIES_IN_SERIES_TAB |
      CourseFlags.JOURNEYS_IN_SERIES_ARE_PREMIUM |
      CourseFlags.SERIES_IN_ADMIN_AREA,
    'Premium',
  ],
];
export const COURSE_FLAG_PRESETS_MAP = new Map(COURSE_FLAG_PRESETS);
export const COURSE_FLAG_PRESETS_REVERSE_MAP = new Map(COURSE_FLAG_PRESETS.map(([k, v]) => [v, k]));
