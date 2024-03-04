import { ReactElement } from 'react';
import styles from './WorkingOverlay.module.css';
import { InlineOsehSpinner } from './InlineOsehSpinner';
import { FullHeightDiv } from './FullHeightDiv';

/**
 * A basic full-width, full-height component that can be rendered without
 * a wrapper in the modals system to prevent clicking through and to
 * provide some feedback that the app is working.
 */
export const WorkingOverlay = (): ReactElement => {
  return (
    <FullHeightDiv className={styles.container}>
      <InlineOsehSpinner
        size={{
          type: 'react-rerender',
          props: {
            width: 80,
          },
        }}
      />
    </FullHeightDiv>
  );
};
