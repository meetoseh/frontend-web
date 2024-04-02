import { Emotion } from '../../../../shared/models/Emotion';
import { JourneyRef } from '../../../journey/models/JourneyRef';

export type SingleJourneyContext =
  | { type: 'generic'; ref: JourneyRef }
  | { type: 'emotion'; ref: JourneyRef; emotion: Emotion };
