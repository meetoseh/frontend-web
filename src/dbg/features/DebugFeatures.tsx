import { ReactElement, useContext } from 'react';
import { LoginContext, LoginProvider } from '../../shared/contexts/LoginContext';
import { InterestsAutoProvider } from '../../shared/contexts/InterestsContext';
import { ModalProvider } from '../../shared/contexts/ModalContext';
import styles from './DebugFeatures.module.css';
import { useFeaturesState, features as featuresList } from '../../user/core/hooks/useFeaturesState';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * Loads the useFeatures hook with debugging enabled and visualizes its state
 */
export const DebugFeatures = (): ReactElement => {
  return (
    <LoginProvider>
      <InterestsAutoProvider>
        <ModalProvider>
          <DebugFeaturesInner />
        </ModalProvider>
      </InterestsAutoProvider>
    </LoginProvider>
  );
};

const DebugFeaturesInner = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const states = useWritableValueWithCallbacks<any[]>(() => []);
  const required = useWritableValueWithCallbacks<(boolean | undefined)[]>(() => []);
  const requiredRollingSum = useWritableValueWithCallbacks<number[]>(() => []);
  const loadingFeatures = useWritableValueWithCallbacks<boolean[]>(() => []);
  const resources = useWritableValueWithCallbacks<any[]>(() => []);
  const loadingResources = useWritableValueWithCallbacks<boolean[]>(() => []);

  const allButLog = useMappedValuesWithCallbacks(
    [states, required, requiredRollingSum, loadingFeatures, resources, loadingResources],
    () => ({
      states: states.get(),
      required: required.get(),
      requiredRollingSum: requiredRollingSum.get(),
      loadingFeatures: loadingFeatures.get(),
      resources: resources.get(),
      loadingResources: loadingResources.get(),
    })
  );

  const log = useWritableValueWithCallbacks<HTMLDivElement>(() => {
    const res = document.createElement('div');
    res.classList.add('log');
    return res;
  });

  useFeaturesState({
    debug: {
      log: (level, msg) => {
        log.get().appendChild(
          (() => {
            const res = document.createElement('div');
            res.classList.add(styles['log-message']);
            res.classList.add(styles[`log-message-${level}`]);
            res.textContent = msg;
            return res;
          })()
        );
      },
      states,
      required,
      requiredRollingSum,
      loadingFeatures,
      resources,
      loadingResources,
    },
  });

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.title}>Debug Features</div>
        <div className={styles.subtitle}>
          This page is intended to be used to identify issues that cause the app to malfunction. If
          you got here and you didn't expect to, go back to the <a href="/">home page</a>.
        </div>
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIdentifier}>Login Context</div>
            <div className={styles.featureSections}>
              <div className={styles.featureSection}>
                <div className={styles.featureSectionTitle}>State</div>
                <div className={styles.featureStateContainer}>
                  <pre className={styles.featureState}>
                    <RenderGuardedComponent
                      props={loginContextRaw.value}
                      component={(loginContext) => (
                        <>
                          {JSON.stringify(
                            {
                              ...loginContext,
                              authTokens:
                                loginContext.state !== 'logged-in' ? 'NOT LOGGED IN' : 'SET',
                            },
                            null,
                            2
                          )}
                        </>
                      )}
                    />
                  </pre>
                </div>
              </div>
            </div>
          </div>
          <RenderGuardedComponent
            props={allButLog}
            component={(data) => (
              <>
                {featuresList.map((f, idx) => (
                  <div key={idx} className={styles.feature}>
                    <div className={styles.featureIdentifier}>{f.identifier}</div>
                    <div className={styles.featureSections}>
                      <div className={styles.featureSection}>
                        <div className={styles.featureSectionTitle}>State</div>
                        <div className={styles.featureStateContainer}>
                          <pre className={styles.featureState}>
                            {JSON.stringify(data.states[idx], null, 2)}
                          </pre>
                        </div>
                      </div>
                      <div className={styles.featureSection}>
                        <div className={styles.featureSectionTitle}>Resources</div>
                        <div className={styles.featureStateContainer}>
                          <pre className={styles.featureState}>
                            {JSON.stringify(data.resources[idx], null, 2)}
                          </pre>
                        </div>
                      </div>
                      <div className={styles.featureSection}>
                        <div className={styles.featureSectionTitle}>Required</div>
                        <div className={styles.featureStateContainer}>
                          <pre className={styles.featureState}>
                            {JSON.stringify(data.required[idx], null, 2)}
                          </pre>
                        </div>
                      </div>
                      <div className={styles.featureSection}>
                        <div className={styles.featureSectionTitle}>Loading</div>
                        <div className={styles.featureStateContainer}>
                          <pre className={styles.featureState}>
                            {JSON.stringify(data.loadingResources[idx], null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          />
        </div>
        <div className={styles.log} ref={(e) => e?.appendChild(log.get())} />
      </div>
    </div>
  );
};
