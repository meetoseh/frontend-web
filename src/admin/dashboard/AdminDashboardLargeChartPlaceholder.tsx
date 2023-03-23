import { useEffect, useRef, useState } from 'react';
import styles from './AdminDashboardLargeChartPlaceholder.module.css';

type AdminDashboardLargeChartPlaceholderProps = {
  /**
   * If specified, called once the placeholder comes into view. Useful for
   * delaying loading of data until the placeholder is visible. Only called
   * once per time it's changed. May be unset and then added later, in which
   * case it will be called if the component had ever been visible.
   */
  onVisible?: () => void;
};

/**
 * Shows a component that can be used as a placeholder for a large chart
 * while data is loading.
 */
export const AdminDashboardLargeChartPlaceholder = ({
  onVisible,
}: AdminDashboardLargeChartPlaceholderProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [beenVisible, setBeenVisible] = useState<boolean>(false);

  useEffect(() => {
    if (beenVisible) {
      return;
    }

    const element = ref.current;
    if (element === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setBeenVisible(true);
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [beenVisible]);

  useEffect(() => {
    if (beenVisible) {
      onVisible?.();
    }
  }, [onVisible, beenVisible]);

  return (
    <div className={styles.container} ref={ref}>
      <div className={styles.innerContainer}>
        <div className={styles.textContainer}>Loading data...</div>
      </div>
    </div>
  );
};
