import { ReactElement } from 'react';
import { TouchPoint } from './TouchPoint';
import { IconButton } from '../../shared/forms/IconButton';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import styles from './TouchPointBlock.module.css';
import { CrudFormElement } from '../crud/CrudFormElement';

type TouchPointBlockProps = {
  /**
   * The touch point to display. Generally this will have no messages until
   * the user clicks the block, then we will fetch them and setTouchPoint with
   * the full touch point, so they are not reloaded the next time the user
   * clicks the block.
   */
  touchPoint: TouchPoint;

  /**
   * Used to update the touch point after a confirmation from the server
   */
  setTouchPoint: (this: void, touchPoint: TouchPoint) => void;

  /**
   * If true, we remove the expand button
   */
  noControls?: boolean;
};

/**
 * Renders basic information about a touch point in the admin area, and when
 * clicked fetches the messages (if not already fetched) and displays a
 * modal with full information.
 */
export const TouchPointBlock = ({
  touchPoint,
  setTouchPoint,
  noControls,
}: TouchPointBlockProps): ReactElement => {
  return (
    <CrudItemBlock
      title={touchPoint.eventSlug}
      controls={
        noControls ? (
          <></>
        ) : (
          <>
            <IconButton
              icon={styles.iconExpand}
              onClick={`/admin/touch_point?slug=${encodeURIComponent(touchPoint.eventSlug)}`}
              srOnlyName="Expand"
            />
          </>
        )
      }>
      <CrudFormElement title="Selection Strategy">{touchPoint.selectionStrategy}</CrudFormElement>
      <CrudFormElement title="Created At">{touchPoint.createdAt.toLocaleString()}</CrudFormElement>
    </CrudItemBlock>
  );
};
