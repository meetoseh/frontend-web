import { ReactElement, useMemo, useState } from 'react';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { VipChatRequest } from './VipChatRequest';
import { CrudFormElement } from '../crud/CrudFormElement';
import { Button } from '../../shared/forms/Button';
import { VipChatRequestState } from '../../user/core/features/vipChatRequest/VipChatRequestState';
import { VipChatRequestFeature } from '../../user/core/features/vipChatRequest/VipChatRequestFeature';
import { FeatureAllStates } from '../../user/core/models/FeatureAllStates';
import { VipChatRequestComponent } from '../../user/core/features/vipChatRequest/VipChatRequestComponent';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import styles from './VipChatRequestBlock.module.css';
import { useReactManagedValueAsValueWithCallbacks } from '../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { ValueWithCallbacks } from '../../shared/lib/Callbacks';
import { VipChatRequestResources } from '../../user/core/features/vipChatRequest/VipChatRequestResources';
import { IconButton } from '../../shared/forms/IconButton';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';

/**
 * Renders a single vip chat request
 */
export const VipChatRequestBlock = ({
  chatRequest,
}: {
  chatRequest: VipChatRequest;
}): ReactElement => {
  const [showingPreview, setShowingPreview] = useState(false);
  const windowSize = useWindowSize();
  const state = useMemo<VipChatRequestState>(() => {
    return {
      chatRequest: {
        uid: chatRequest.uid,
        variant: {
          identifier: 'phone-04102023',
          ...chatRequest.displayData,
        },
      },
      onDone: () => {
        return {
          chatRequest: null,
          onDone: () => {
            throw new Error('Not implemented');
          },
        };
      },
      forcedWindowSize: {
        width: Math.min(390, windowSize.width),
        height: 633,
      },
      suppressEvents: true,
    };
  }, [chatRequest, windowSize.width]);
  const stateVWC = useReactManagedValueAsValueWithCallbacks(state);
  const requiredVWC = useReactManagedValueAsValueWithCallbacks(true);
  const allStatesVWC = useReactManagedValueAsValueWithCallbacks({} as FeatureAllStates);
  const resourcesVWC = VipChatRequestFeature.useResources(stateVWC, requiredVWC, allStatesVWC);

  return (
    <CrudItemBlock
      title={`${chatRequest.user.givenName} ${chatRequest.user.familyName}`}
      controls={
        <>
          <IconButton
            icon={styles.iconExpand}
            onClick={`/admin/user?sub=${encodeURIComponent(chatRequest.user.sub)}`}
            srOnlyName="Expand"
          />
        </>
      }>
      <CrudFormElement title="Reason">
        {chatRequest.reason ?? <i>No reason provided</i>}
      </CrudFormElement>
      <CrudFormElement title="Created At">{chatRequest.createdAt.toLocaleString()}</CrudFormElement>
      <CrudFormElement title="Prompted At">
        {chatRequest.popupSeenAt?.toLocaleString() ?? <i>Not prompted yet</i>}
      </CrudFormElement>
      <CrudFormElement title="Preview">
        <div className={styles.previewToggle}>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setShowingPreview((s) => !s);
            }}
            variant="filled">
            {showingPreview ? 'Hide' : 'Show'}
          </Button>
        </div>

        {showingPreview ? (
          <RenderGuardedComponent
            props={resourcesVWC}
            component={(resources) =>
              !resources.loading ? (
                <div
                  style={{
                    position: 'relative',
                    width: resources.windowSize.width,
                    height: resources.windowSize.height,
                    marginTop: '24px',
                  }}>
                  <VipChatRequestComponent
                    state={stateVWC}
                    resources={resourcesVWC as ValueWithCallbacks<VipChatRequestResources>}
                  />
                </div>
              ) : (
                <></>
              )
            }
          />
        ) : (
          <></>
        )}
      </CrudFormElement>
    </CrudItemBlock>
  );
};
