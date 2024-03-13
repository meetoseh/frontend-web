import { JourneyRef } from '../../../journey/models/JourneyRef';
import { Emotion } from '../pickEmotionJourney/Emotion';

export type SingleJourneyContext =
  | { type: 'generic'; ref: JourneyRef }
  | { type: 'emotion'; ref: JourneyRef; emotion: Emotion };
