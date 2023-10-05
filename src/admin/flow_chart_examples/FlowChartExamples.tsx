import { ReactElement } from 'react';
import styles from './FlowChartExamples.module.css';
import { FlowChart } from '../../shared/components/flowchart/FlowChart';

export const FlowChartExamples = (): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Flow Chart Examples</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <FlowChart
            tree={{
              element: <div className={styles.block}>A</div>,
              children: [
                {
                  element: <div className={styles.block}>B</div>,
                  children: [
                    {
                      element: <div className={styles.block}>C</div>,
                      children: [
                        {
                          element: <div className={styles.block}>D</div>,
                          children: [
                            {
                              element: <div className={styles.block}>E</div>,
                              children: [],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            }}
          />
        </div>
        <div className={styles.section}>
          <FlowChart
            tree={{
              element: <div className={styles.block}>A</div>,
              children: [
                {
                  element: <div className={styles.block}>B</div>,
                  children: [
                    {
                      element: <div className={styles.block}>C</div>,
                      children: [],
                    },
                    {
                      element: <div className={styles.block}>D</div>,
                      children: [],
                    },
                  ],
                },
              ],
            }}
          />
        </div>
        <div className={styles.section}>
          <FlowChart
            tree={{
              element: <div className={styles.block}>A</div>,
              children: [
                {
                  element: <div className={styles.block}>B</div>,
                  children: [
                    {
                      element: <div className={styles.block}>C</div>,
                      children: [],
                    },
                    {
                      element: <div className={styles.block}>D</div>,
                      children: [],
                    },
                    {
                      element: <div className={styles.block}>E</div>,
                      children: [],
                    },
                  ],
                },
              ],
            }}
          />
        </div>
        <div className={styles.section}>
          <FlowChart
            tree={{
              element: <div className={styles.block}>A</div>,
              children: [
                {
                  element: <div className={styles.block}>B</div>,
                  children: [
                    {
                      element: <div className={styles.block}>C</div>,
                      children: [],
                    },
                    {
                      element: <div className={styles.block}>D</div>,
                      children: [],
                    },
                    {
                      element: <div className={styles.block}>E</div>,
                      children: [],
                    },
                    {
                      element: <div className={styles.block}>F</div>,
                      children: [],
                    },
                  ],
                },
              ],
            }}
          />
        </div>
        <div className={styles.section}>
          <FlowChart
            tree={{
              element: <div className={styles.block}>A</div>,
              children: [
                {
                  element: <div className={styles.block}>B</div>,
                  children: [
                    {
                      element: <div className={styles.block}>C</div>,
                      children: [],
                    },
                    {
                      element: <div className={styles.block}>D</div>,
                      children: [
                        {
                          element: <div className={styles.block}>E</div>,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            }}
          />
        </div>
      </div>
    </div>
  );
};
