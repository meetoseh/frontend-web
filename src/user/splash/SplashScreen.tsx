import { ReactElement, useRef } from 'react';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import styles from './SplashScreen.module.css';

export const SplashScreen = (): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight' });

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.logo}></div>
      <div className={styles.spinner}>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <div className={styles.text}>Loading...</div>
    </div>
  );
};
