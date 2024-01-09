import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { ShareJourneyResources } from './ShareJourneyResources';
import { ShareJourneyState } from './ShareJourneyState';

/** Never shown */
export const ShareJourney = (
  _: FeatureComponentProps<ShareJourneyState, ShareJourneyResources>
): ReactElement => {
  return <></>;
};
