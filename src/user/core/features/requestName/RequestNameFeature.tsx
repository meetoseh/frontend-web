import { useContext, useMemo } from 'react';
import { Feature } from '../../models/Feature';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { RequestNameState } from './RequestNameState';
import { RequestNameResources } from './RequestNameResources';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { RequestName } from './RequestName';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../../shared/images/useOsehImageState';

const backgroundImageUid = 'oseh_if_hH68hcmVBYHanoivLMgstg';

/**
 * Glue code surrounding requesting a users name if we don't know their name.
 */
export const RequestNameFeature: Feature<RequestNameState, RequestNameResources> = {
  identifier: 'requestName',

  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    return {
      givenName: loginContext.userAttributes?.givenName,
    };
  },

  useResources: (worldState, required) => {
    const images = useOsehImageStateRequestHandler({});
    const windowSize = useWindowSize();
    const background = useOsehImageState(
      {
        uid: required ? backgroundImageUid : null,
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
      },
      images
    );

    return useMemo<RequestNameResources>(
      () => ({
        background,
        loading: background === null || background.loading,
      }),
      [background]
    );
  },

  isRequired: (worldState) => {
    if (worldState.givenName === undefined) {
      return undefined;
    }

    return worldState.givenName === 'Anonymous';
  },

  component: (worldState, resources, doAnticipateState) => (
    <RequestName state={worldState} resources={resources} doAnticipateState={doAnticipateState} />
  ),
};
