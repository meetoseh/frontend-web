import { ReactElement } from 'react';
import styles from './GridBlackBackground.module.css';

/**
 * An element which fills the background using grid-area: 1 / 1 / -1 / -1
 * and has a black background.
 */
export const GridBlackBackground = (): ReactElement => <div className={styles.container} />;
