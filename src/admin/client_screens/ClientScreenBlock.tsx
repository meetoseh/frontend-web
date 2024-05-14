import { IconButton } from '../../shared/forms/IconButton';
import { CrudFormElement } from '../crud/CrudFormElement';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { ClientScreen } from './ClientScreen';
import styles from './ClientScreenBlock.module.css';

export type ClientScreenBlockProps = {
  /**
   * The client screen to display
   */
  clientScreen: ClientScreen;

  /**
   * Used to update the screen after confirmation from the server
   */
  setClientScreen: (this: void, clientScreen: ClientScreen) => void;

  /**
   * Disables nested links to the big client screen page
   */
  noControls?: boolean;
};

/**
 * Renders a small crud item block describing the given client screen,
 * usually with a link to the full client screen page.
 */
export const ClientScreenBlock = ({
  clientScreen,
  setClientScreen,
  noControls,
}: ClientScreenBlockProps) => {
  return (
    <CrudItemBlock
      title={clientScreen.name ?? clientScreen.slug}
      controls={
        noControls ? (
          <></>
        ) : (
          <>
            <IconButton
              icon={styles.iconExpand}
              onClick={`/admin/client_screen?slug=${encodeURIComponent(clientScreen.slug)}`}
              srOnlyName="Expand"
            />
          </>
        )
      }>
      <CrudFormElement title="slug">{clientScreen.slug}</CrudFormElement>
      <CrudFormElement title="description">{clientScreen.description}</CrudFormElement>
    </CrudItemBlock>
  );
};
