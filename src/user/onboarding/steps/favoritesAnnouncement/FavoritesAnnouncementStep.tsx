import { useMemo } from 'react';
import { useInappNotification } from '../../../../shared/hooks/useInappNotification';
import { OnboardingStep } from '../../models/OnboardingStep';
import { FavoritesAnnouncementResources } from './FavoritesAnnouncementResources';
import { FavoritesAnnouncementState } from './FavoritesAnnouncementState';
import { OsehImageProps, useOsehImageState } from '../../../../shared/OsehImage';
import { FavoritesAnnouncement } from './FavoritesAnnouncement';
import { useInappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

const imageProps: OsehImageProps = {
  uid: 'oseh_if_IpfCWgN-6w_c1VxR4OX_Vg',
  jwt: null,
  displayWidth: 326,
  displayHeight: 257,
  alt: '',
  isPublic: true,
};

/**
 * Informs users about the new favorites feature
 */
export const FavoritesAnnouncementStep: OnboardingStep<
  FavoritesAnnouncementState,
  FavoritesAnnouncementResources
> = {
  identifier: 'favoritesAnnouncement',
  useWorldState: () => {
    const ian = useInappNotification('oseh_ian_rLkvxKAwvgI2Vpcvu0bjsg', Date.now() > 1688223600000);

    return useMemo<FavoritesAnnouncementState>(() => ({ ian }), [ian]);
  },
  useResources: (state) => {
    const session = useInappNotificationSession(state.ian?.uid ?? null);
    const image = useOsehImageState(imageProps);

    return useMemo<FavoritesAnnouncementResources>(
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
      <FavoritesAnnouncement
        state={worldState}
        resources={resources}
        doAnticipateState={doAnticipateState}
      />
    );
  },
};
