import { ReactElement } from 'react';
import { FlowPath } from './ClientFlowAnalyzeReachable';
import styles from './ClientFlowPath.module.css';
import { FlowChart } from '../../../shared/components/FlowChart';
import { prettySchemaPath } from '../../lib/schema/prettySchemaPath';
import { VerticalSpacer } from '../../../shared/components/VerticalSpacer';

/**
 * Displays a path as returned from client flow analysis
 */
export const ClientFlowPath = ({
  source,
  path,
}: {
  source: string;
  path: FlowPath;
}): ReactElement => {
  const elements: ReactElement[] = [];
  elements.push(
    <div key="source" className={styles.step}>
      <div className={styles.slug}>{source}</div>
    </div>
  );
  path.nodes.forEach((step, index) => {
    elements.push(
      <div key={index} className={styles.step}>
        <a
          href={'/admin/client_flow?slug=' + encodeURIComponent(step.slug)}
          className={styles.slug}>
          {step.slug}
        </a>
        {step.via.type === 'flow-replacer-rule' ? (
          <div className={styles.description}>via replacer on rule #{step.via.ruleIndex + 1}</div>
        ) : null}
        {step.via.type === 'screen-allowed' ? (
          <div className={styles.description}>
            via screen #{step.via.index + 1}
            {step.via.name !== null && step.via.name.trim() !== '' ? (
              <> ({step.via.name})</>
            ) : undefined}{' '}
            ({step.via.slug})
          </div>
        ) : null}
        {step.via.type === 'screen-trigger' ? (
          <>
            <div className={styles.description}>
              via screen #{step.via.index + 1}
              {step.via.name !== null && step.via.name.trim() !== '' ? (
                <> ({step.via.name})</>
              ) : undefined}{' '}
              ({step.via.slug})
            </div>
            <VerticalSpacer height={8} />
            <div className={styles.description}>
              using trigger {prettySchemaPath(step.via.trigger)}
            </div>
            <div className={styles.description}>{step.via.description}</div>
          </>
        ) : null}
      </div>
    );
  });

  return (
    <FlowChart
      columnGap={{ type: 'react-rerender', props: 32 }}
      rowGap={{ type: 'react-rerender', props: 40 }}
      color={{ type: 'react-rerender', props: [0, 0, 0, 1] }}
      lineThickness={{ type: 'react-rerender', props: 2 }}
      arrowBlockGapPx={{ type: 'react-rerender', props: { head: 4, tail: 4 } }}
      arrowHeadLengthPx={{ type: 'react-rerender', props: 8 }}
      arrowHeadAngleDeg={{ type: 'react-rerender', props: 30 }}>
      {elements}
    </FlowChart>
  );
};
