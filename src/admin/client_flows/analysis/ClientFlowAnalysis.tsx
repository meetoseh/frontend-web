import { Fragment, ReactElement } from 'react';
import styles from './ClientFlowAnalysis.module.css';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { clientFlowAnalysisStandardEnvironments } from './clientFlowAnalysisStandardEnvironments';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { VerticalSpacer } from '../../../shared/components/VerticalSpacer';
import { useNetworkResponse } from '../../../shared/hooks/useNetworkResponse';
import { Button } from '../../../shared/forms/Button';
import { adaptActiveVWCToAbortSignal } from '../../../shared/lib/adaptActiveVWCToAbortSignal';
import {
  clientFlowsAnalyzeReachableAutoPaginateWithNoTarget,
  clientFlowsAnalyzeReachableAutoPaginateWithTarget,
} from './ClientFlowAnalyzeReachable';
import { convertClientFlowAnalysisEnvironmentToAPI } from './ClientFlowAnalysisEnvironment';
import { InlineOsehSpinner } from '../../../shared/components/InlineOsehSpinner';
import { ClientFlowPath } from './ClientFlowPath';
import { SCREEN_VERSION } from '../../../shared/lib/screenVersion';
import { TextInput } from '../../../shared/forms/TextInput';

const QUERIES = [
  { type: 'reachable-from-home', text: 'Paths to here from home' },
  { type: 'reachable-from-onboarding', text: 'Paths to here during onboarding' },
  { type: 'reachable-general', text: 'Paths to here from anywhere (MAY CAUSE LAG)' },
  { type: 'from-here', text: 'Paths from here' },
] as const;

export const ClientFlowAnalysis = ({ slug }: { slug: string }): ReactElement => {
  const environmentIndexVWC = useWritableValueWithCallbacks<number>(() => 0);
  const environmentVWC = useMappedValueWithCallbacks(
    environmentIndexVWC,
    (index) => clientFlowAnalysisStandardEnvironments.flattened[index]
  );
  const queryIndexVWC = useWritableValueWithCallbacks<number>(() => 0);
  const queryVWC = useMappedValueWithCallbacks(queryIndexVWC, (index) => QUERIES[index]);
  const versionStringVWC = useWritableValueWithCallbacks<string>(() => SCREEN_VERSION.toString());
  const versionVWC = useMappedValueWithCallbacks(versionStringVWC, (version) => {
    const stripped = version.trim();
    if (stripped === '') {
      return null;
    }
    try {
      const parsed = parseInt(stripped, 10);
      if (isNaN(parsed) || parsed <= 0 || !isFinite(parsed) || !Number.isSafeInteger(parsed)) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  });

  const analysisNR = useNetworkResponse(
    async (active, loginContext) => {
      return await adaptActiveVWCToAbortSignal(active, async (signal) => {
        const environment = environmentVWC.get();
        const query = queryVWC.get();
        const version = versionVWC.get();

        const settings = convertClientFlowAnalysisEnvironmentToAPI({
          ...environment.environment,
          version,
        });

        if (query.type === 'reachable-from-home') {
          return await clientFlowsAnalyzeReachableAutoPaginateWithTarget(
            {
              settings,
              source: 'empty',
              target: slug,
              inverted: false,
              max_steps: null,
            },
            loginContext,
            { signal }
          );
        } else if (query.type === 'reachable-from-onboarding') {
          return await clientFlowsAnalyzeReachableAutoPaginateWithTarget(
            {
              settings,
              source: 'signup',
              target: slug,
              inverted: false,
              max_steps: null,
            },
            loginContext,
            { signal }
          );
        } else if (query.type === 'reachable-general') {
          return await clientFlowsAnalyzeReachableAutoPaginateWithNoTarget(
            {
              settings,
              source: slug,
              inverted: true,
              max_steps: null,
            },
            loginContext,
            { signal }
          );
        } else {
          return await clientFlowsAnalyzeReachableAutoPaginateWithNoTarget(
            {
              settings,
              source: slug,
              inverted: false,
              max_steps: null,
            },
            loginContext,
            { signal }
          );
        }
      });
    },
    {
      dependsOn: [environmentVWC, queryVWC, versionVWC],
      minRefreshTimeMS: 2000,
    }
  );

  return (
    <div className={styles.container}>
      <div className={styles.title}>Reachability Analysis</div>
      <VerticalSpacer height={8} />
      <div className={styles.label}>User</div>
      <RenderGuardedComponent
        props={environmentIndexVWC}
        component={(index) => (
          <select
            value={index.toString()}
            className={styles.select}
            onChange={(e) => {
              const newIndex = parseInt(e.target.value, 10);
              if (
                newIndex >= 0 &&
                newIndex < clientFlowAnalysisStandardEnvironments.flattened.length
              ) {
                setVWC(environmentIndexVWC, newIndex);
              }
            }}>
            {clientFlowAnalysisStandardEnvironments.flattened.map((env, index) => (
              <option key={index} value={index.toString()}>
                {env.name}
              </option>
            ))}
          </select>
        )}
      />
      <VerticalSpacer height={12} />
      <div className={styles.label}>Query</div>
      <RenderGuardedComponent
        props={queryIndexVWC}
        component={(index) => (
          <select
            value={index.toString()}
            className={styles.select}
            onChange={(e) => {
              const newIndex = parseInt(e.target.value, 10);
              if (newIndex >= 0 && newIndex < QUERIES.length) {
                setVWC(queryIndexVWC, newIndex);
              }
            }}>
            {QUERIES.map((query, index) => (
              <option key={index} value={index.toString()}>
                {query.text}
              </option>
            ))}
          </select>
        )}
      />
      <VerticalSpacer height={4} />
      <RenderGuardedComponent
        props={versionStringVWC}
        component={(version) => (
          <TextInput
            label="Screen Version"
            type="number"
            value={version}
            help={`The version of the app they are on, using the android versioning system. This tab is running v${SCREEN_VERSION}`}
            onChange={(v) => {
              setVWC(versionStringVWC, v);
            }}
            disabled={false}
            inputStyle="normal"
            html5Validation={null}
          />
        )}
        applyInstantly
      />
      <VerticalSpacer height={4} />
      <Button
        type="button"
        variant="link-small"
        onClick={(e) => {
          e.preventDefault();
          analysisNR.get().refresh?.();
        }}>
        Refresh
      </Button>
      <VerticalSpacer height={20} />
      <RenderGuardedComponent
        props={analysisNR}
        component={(nr) => {
          if (nr.type === 'loading') {
            return (
              <InlineOsehSpinner
                size={{
                  type: 'react-rerender',
                  props: {
                    width: 40,
                  },
                }}
                variant="black"
              />
            );
          }

          if (nr.type !== 'success') {
            return <div className={styles.error}>failed to get analysis: {nr.type}</div>;
          }

          const data = nr.result;

          if (data.type === 'no-paths') {
            return <div className={styles.error}>no paths found</div>;
          }

          if (data.type === 'ratelimited') {
            return <div className={styles.error}>rate limited</div>;
          }

          if (Object.keys(data.result.items).length === 0) {
            return <div className={styles.error}>empty result</div>;
          }

          return (
            <>
              {Object.values(data.result.items).map((info, index) => (
                <Fragment key={index}>
                  {info.paths.map((path, pathIndex) => (
                    <ClientFlowPath key={pathIndex} source={info.source} path={path} />
                  ))}
                </Fragment>
              ))}
            </>
          );
        }}
      />
    </div>
  );
};
