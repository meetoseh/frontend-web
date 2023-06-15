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
  const resources = VipChatRequestFeature.useResources(state, true, {} as FeatureAllStates);

  return (
    <CrudItemBlock title={chatRequest.user.email} controls={null}>
      <CrudFormElement title="User">
        {chatRequest.user.givenName} {chatRequest.user.familyName} ({chatRequest.user.sub})
      </CrudFormElement>
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

        {showingPreview && resources !== undefined && !resources.loading ? (
          <div
            style={{
              position: 'relative',
              width: resources.windowSize.width,
              height: resources.windowSize.height,
              marginTop: '24px',
            }}>
            <VipChatRequestComponent
              state={state}
              resources={resources}
              doAnticipateState={() => {}}
            />
          </div>
        ) : (
          <></>
        )}
      </CrudFormElement>
    </CrudItemBlock>
  );
};
