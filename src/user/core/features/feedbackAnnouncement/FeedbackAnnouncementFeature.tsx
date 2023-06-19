import { useMemo } from 'react';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { Feature } from '../../models/Feature';
import { FeedbackAnnouncementResources } from './FeedbackAnnouncementResources';
import { FeedbackAnnouncementState } from './FeedbackAnnouncementState';
import { FeedbackAnnouncment } from './FeedbackAnnouncement';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';

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
export const FeedbackAnnouncementFeature: Feature<
  FeedbackAnnouncementState,
  FeedbackAnnouncementResources
> = {
  identifier: 'feedbackAnnouncement',
  useWorldState: () => {
    const ian = useInappNotification('oseh_ian_T7AwwYHKJlfFc33muX6Fdg', Date.now() > 1688223600000);

    return useMemo<FeedbackAnnouncementState>(() => ({ ian }), [ian]);
  },
  useResources: (state, required) => {
    const session = useInappNotificationSession(state.ian?.uid ?? null);
    const images = useOsehImageStateRequestHandler({});
    const image = useOsehImageState(required ? imageProps : { ...imageProps, uid: null }, images);

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
