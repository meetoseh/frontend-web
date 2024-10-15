import { ReactElement, useContext } from 'react';
import { TouchPoint, TouchPointSelectionStrategy, touchPointKeyMap } from './TouchPoint';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import styles from './CreateTouchPoint.module.css';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { TextInput, TextInputProps } from '../../shared/forms/TextInput';
import { setVWC } from '../../shared/lib/setVWC';
import { useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { adaptActiveVWCToAbortSignal } from '../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../shared/ApiConstants';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { TouchPointSelectionStrategySelect } from './components/TouchPointSelectionStrategySelect';
import { Button } from '../../shared/forms/Button';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { createUID } from '../../shared/lib/createUID';
import { convertUsingMapper } from '../crud/CrudFetcher';
import {
  chooseErrorFromStatus,
  DisplayableError,
  SimpleDismissBoxError,
} from '../../shared/lib/errors';

type CreateTouchPointProps = {
  /**
   * Called after a touch point is created by the user
   * @param touchPoint The touch point that was created
   */
  onCreated: (this: void, touchPoint: TouchPoint) => void;
};

/**
 * A block where the user can create a new touch point. We initialize this with one
 * sample SMS, sample push, and sample email to prevent it from being in the weird
 * state of having no messages.
 */
export const CreateTouchPoint = ({ onCreated }: CreateTouchPointProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);

  const slugVWC = useWritableValueWithCallbacks(() => '');
  const slugInputStyleVWC = useWritableValueWithCallbacks<TextInputProps['inputStyle']>(
    () => 'normal'
  );

  const slugValidationNR = useNetworkResponse<
    { type: 'ok' } | { type: 'error'; description: ReactElement }
  >(
    (active, loginContext) =>
      adaptActiveVWCToAbortSignal(active, async (signal) => {
        const slug = slugVWC.get();
        if (slug.length === 0) {
          return { type: 'ok' };
        }
        if (slug.length < 2) {
          return { type: 'error', description: <>Must be at least 2 characters</> };
        }
        if (slug.length > 255) {
          return { type: 'error', description: <>Must be at most 255 characters</> };
        }
        if (!/^[a-zA-Z][a-zA-Z_]*[a-zA-Z]$/.test(slug)) {
          return {
            type: 'error',
            description: (
              <>Must start and end with a letter and contain only letters and underscores</>
            ),
          };
        }

        const response = await apiFetch(
          '/api/1/touch_points/search',
          {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              filters: {
                event_slug: {
                  operator: 'eq',
                  value: slug,
                },
              },
              limit: 1,
            }),
          },
          loginContext
        );
        const body = await response.json();
        if (body.items.length > 0) {
          return { type: 'error', description: <>This slug is already in use</> };
        }
        return { type: 'ok' };
      }),
    {
      dependsOn: [slugVWC],
    }
  );

  const slugValidationErrorVWC = useMappedValueWithCallbacks(
    slugValidationNR,
    (v) => (v.type !== 'success' || v.result.type !== 'error' ? undefined : v.result.description),
    {
      outputEqualityFn: Object.is,
    }
  );

  useValueWithCallbacksEffect(slugValidationNR, (validation) => {
    if (validation.type !== 'success') {
      setVWC(slugInputStyleVWC, 'normal');
      return undefined;
    }

    if (validation.result.type === 'ok') {
      setVWC(slugInputStyleVWC, 'success');
      return undefined;
    }

    setVWC(slugInputStyleVWC, 'error');
    return undefined;
  });

  const textInputPropsVWC = useMappedValuesWithCallbacks(
    [slugVWC, slugInputStyleVWC],
    () => ({
      slug: slugVWC.get(),
      inputStyle: slugVWC.get() === '' ? 'normal' : slugInputStyleVWC.get(),
    }),
    {
      outputEqualityFn: (a, b) => a.slug === b.slug && a.inputStyle === b.inputStyle,
    }
  );

  const selectionStrategyVWC = useWritableValueWithCallbacks<TouchPointSelectionStrategy>(
    () => 'fixed'
  );

  const workingVWC = useWritableValueWithCallbacks(() => false);
  const disabledVWC = useMappedValuesWithCallbacks([slugVWC, slugValidationNR, workingVWC], () => {
    if (workingVWC.get()) {
      return true;
    }

    if (slugVWC.get().length < 2) {
      return true;
    }

    const validation = slugValidationNR.get();
    if (validation.type !== 'success') {
      return true;
    }

    if (validation.result.type !== 'ok') {
      return true;
    }

    return false;
  });

  const ctaState = useMappedValuesWithCallbacks([workingVWC, disabledVWC], () => ({
    spinner: workingVWC.get(),
    disabled: disabledVWC.get(),
  }));

  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);

  return (
    <CrudCreateBlock>
      <div className={styles.container}>
        <RenderGuardedComponent
          props={textInputPropsVWC}
          component={({ slug, inputStyle }) => (
            <TextInput
              label="Event Slug"
              value={slug}
              help={
                <RenderGuardedComponent
                  props={slugValidationErrorVWC}
                  component={(error) =>
                    error === undefined ? (
                      <>The event that, when triggered, sends a touch from this touch point.</>
                    ) : (
                      <>{error}</>
                    )
                  }
                />
              }
              disabled={false}
              inputStyle={inputStyle}
              onChange={(newValue) => setVWC(slugVWC, newValue)}
              html5Validation={{
                minLength: 2,
                maxLength: 255,
                pattern: '^[a-zA-Z][a-zA-Z_]*[a-zA-Z]$',
              }}
            />
          )}
          applyInstantly
        />
        <TouchPointSelectionStrategySelect vwc={selectionStrategyVWC} />
        <RenderGuardedComponent
          props={ctaState}
          component={({ spinner, disabled }) => (
            <Button
              type="button"
              variant="filled"
              disabled={disabled}
              spinner={spinner}
              onClick={async (e) => {
                e.preventDefault();

                if (workingVWC.get()) {
                  return;
                }

                const loginContextUnch = loginContextRaw.value.get();
                if (loginContextUnch.state !== 'logged-in') {
                  setVWC(
                    errorVWC,
                    new DisplayableError(
                      'server-refresh-required',
                      'create touch point',
                      'not logged in'
                    )
                  );
                  return;
                }

                const loginContext = loginContextUnch;

                setVWC(workingVWC, true);
                try {
                  let response;
                  try {
                    response = await apiFetch(
                      '/api/1/touch_points/',
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json; charset=utf-8',
                        },
                        body: JSON.stringify({
                          event_slug: slugVWC.get(),
                          selection_strategy: selectionStrategyVWC.get(),
                          messages: {
                            sms: [
                              {
                                priority: 1,
                                uid: 'oseh_tpsms_' + createUID(),
                                body_format: 'New SMS',
                                body_parameters: [],
                              },
                            ],
                            push: [
                              {
                                priority: 1,
                                uid: 'oseh_tppush_' + createUID(),
                                title_format: 'New Push Title',
                                title_parameters: [],
                                body_format: 'New Push Body',
                                body_parameters: [],
                                channel_id: 'default',
                              },
                            ],
                            email: [
                              {
                                priority: 1,
                                uid: 'oseh_tpem_' + createUID(),
                                subject_format: 'New Email Subject',
                                subject_parameters: [],
                                template: 'sample',
                                template_parameters_fixed: {},
                                template_parameters_substituted: [],
                              },
                            ],
                          },
                        }),
                      },
                      loginContext
                    );
                  } catch {
                    throw new DisplayableError('connectivity', 'create touch point');
                  }
                  if (!response.ok) {
                    throw chooseErrorFromStatus(response.status, 'create touch point');
                  }
                  const body = await response.json();
                  const parsed = convertUsingMapper(body, touchPointKeyMap);
                  onCreated(parsed);
                  setVWC(slugVWC, '');
                } catch (e) {
                  setVWC(
                    errorVWC,
                    e instanceof DisplayableError
                      ? e
                      : new DisplayableError('client', 'create touch point', `${e}`)
                  );
                } finally {
                  setVWC(workingVWC, false);
                }
              }}
              fullWidth>
              Create
            </Button>
          )}
        />
        <SimpleDismissBoxError error={errorVWC} />
      </div>
    </CrudCreateBlock>
  );
};
