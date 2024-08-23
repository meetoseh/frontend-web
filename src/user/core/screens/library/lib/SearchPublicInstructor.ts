import { CrudFetcherMapper } from '../../../../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../../../../shared/images/OsehImageRef';

export type SearchPublicInstructorAPI = {
  /** The primary stable external identifier for the instructor */
  uid: string;
  /** The display name for the instructor; do not alter */
  name: string;
  /** The profile picture for the instructor, if available */
  picture?: OsehImageRef | null;

  __mapped: false;
};

export type SearchPublicInstructor = {
  /** The primary stable external identifier for the instructor */
  uid: string;
  /** The display name for the instructor; do not alter */
  name: string;
  /** The profile picture for the instructor, if available */
  picture?: OsehImageRef | null;

  __mapped: true;
};

export const searchPublicInstructorMapper: CrudFetcherMapper<SearchPublicInstructor> = (
  raw: any
) => {
  return raw as SearchPublicInstructor;
};

export const searchPublicInstructorToAPI = (
  mapped: SearchPublicInstructor
): SearchPublicInstructorAPI => {
  return mapped as any as SearchPublicInstructorAPI;
};
