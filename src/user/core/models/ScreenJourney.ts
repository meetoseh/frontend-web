import { CrudFetcherMapper, convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { JourneyRef, journeyRefKeyMap } from '../../journey/models/JourneyRef';

export type ScreenJourneyAPI = {
  journey: unknown;
  last_taken_at: number | null;
  liked_at: number | null;
};

export type ScreenJourneyMapped = JourneyRef & {
  lastTakenAt: Date | null;
  likedAt: Date | null;
};

export const screenJourneyMapper: CrudFetcherMapper<ScreenJourneyMapped> = (
  raw: ScreenJourneyAPI
) => ({
  ...convertUsingMapper(raw.journey, journeyRefKeyMap),
  lastTakenAt: raw.last_taken_at === null ? null : new Date(raw.last_taken_at * 1000),
  likedAt: raw.liked_at === null ? null : new Date(raw.liked_at * 1000),
});
