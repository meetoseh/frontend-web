import { ReactElement } from 'react';
import styles from './SplashScreen.module.css';

export const SplashScreen = (): ReactElement => {
  return (
    <div className={styles.container}>
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
