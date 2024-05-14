import { ReactElement } from 'react';
import { IconButton } from '../../shared/forms/IconButton';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { ClientFlow } from './ClientFlow';
import styles from './ClientFlowBlock.module.css';
import { CrudFormElement } from '../crud/CrudFormElement';

type ClientFlowBlockProps = {
  /**
   * The client flow to display
   */
  clientFlow: ClientFlow;

  /**
   * Used to update the flow after confirmation from the server
   */
  setClientFlow: (this: void, clientFlow: ClientFlow) => void;

  /**
   * Disables nested links to the big client flow page
   */
  noControls?: boolean;
};

/**
 * Shows a short description about a client flow and, unless `noControls` is
 * set, a link to the full client flow page.
 */
export const ClientFlowBlock = ({
  clientFlow,
  setClientFlow,
  noControls,
}: ClientFlowBlockProps): ReactElement => {
  return (
    <CrudItemBlock
      title={clientFlow.name ?? clientFlow.slug}
      controls={
        noControls ? (
          <></>
        ) : (
          <>
            <IconButton
              icon={styles.iconExpand}
              onClick={`/admin/client_flow?slug=${encodeURIComponent(clientFlow.slug)}`}
              srOnlyName="Expand"
            />
          </>
        )
      }>
      <CrudFormElement title="Slug">{clientFlow.slug}</CrudFormElement>
      <CrudFormElement title="Description">{clientFlow.description}</CrudFormElement>
    </CrudItemBlock>
  );
};
