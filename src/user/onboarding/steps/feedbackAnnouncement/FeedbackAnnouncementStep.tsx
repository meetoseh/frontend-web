import { useMemo } from 'react';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { OnboardingStep } from '../../models/OnboardingStep';
import { FeedbackAnnouncementResources } from './FeedbackAnnouncementResources';
import { FeedbackAnnouncementState } from './FeedbackAnnouncementState';
import { OsehImageProps, useOsehImageState } from '../../../../shared/OsehImage';
import { FeedbackAnnouncment } from './FeedbackAnnouncement';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

const imageProps: OsehImageProps = {
  uid: 'oseh_if_WEfZfgv6MDMOnNlUsB1cbA',
  jwt: null,
  displayWidth: 326,
  displayHeight: 257,
  alt: '',
  isPublic: true,
};

/**
 * Informs users about the new feedback feature
 */
export const FeedbackAnnouncementStep: OnboardingStep<
  FeedbackAnnouncementState,
  FeedbackAnnouncementResources
> = {
  identifier: 'feedbackAnnouncement',
  useWorldState: () => {
    const ian = useInappNotification('oseh_ian_T7AwwYHKJlfFc33muX6Fdg', Date.now() > 1688223600000);

    return useMemo<FeedbackAnnouncementState>(() => ({ ian }), [ian]);
  },
  useResources: (state) => {
    const session = useInappNotificationSession(state.ian?.uid ?? null);
    const image = useOsehImageState(imageProps);

    return useMemo<FeedbackAnnouncementResources>(
      () => ({ session, image, loading: session === null || image.loading }),
      [session, image]
    );
  },
  isRequired: (state) => {
    if (state.ian === null) {
      return undefined;
    }
    return state.ian.showNow;
  },
  component(worldState, resources, doAnticipateState) {
    return (
      <FeedbackAnnouncment
        state={worldState}
        resources={resources}
        doAnticipateState={doAnticipateState}
      />
    );
  },
};
