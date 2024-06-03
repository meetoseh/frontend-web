import { ReactElement, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './SetName.module.css';
import {
  playEntranceTransition,
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  Callbacks,
  WritableValueWithTypedCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { screenOut } from '../../lib/screenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { useWorkingModal } from '../../../../shared/hooks/useWorkingModal';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { apiFetch } from '../../../../shared/ApiConstants';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { SurveyCheckboxGroup } from '../../../../shared/components/SurveyCheckboxGroup';
import { BackContinue } from '../../../../shared/components/BackContinue';
import { SetNameResources } from './SetNameResources';
import { SetNameMappedParams } from './SetNameParams';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { TextInput } from '../../../../shared/forms/TextInput';

/**
 * A basic screen where the user can configure their name
 */
export const SetName = ({
  ctx,
  screen,
  resources,
  trace,
  startPop,
}: ScreenComponentProps<'set_name', SetNameResources, SetNameMappedParams>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const savingVWC = useWritableValueWithCallbacks<boolean>(() => false);

  useErrorModal(modalContext.modals, errorVWC, 'saving name');
  useWorkingModal(modalContext.modals, savingVWC, { delayStartMs: 200 });

  const serverNameVWC = useMappedValueWithCallbacks(ctx.login.value, (s): [string, string] => {
    if (s.state !== 'logged-in') {
      return ['', ''];
    }

    let given = s.userAttributes.givenName;
    if (given === undefined || given === null || given.includes('anon')) {
      given = '';
    }

    let family = s.userAttributes.familyName;
    if (family === undefined || family === null || family.includes('anon')) {
      family = '';
    }

    return [given, family];
  });

  const givenNameVWC = useWritableValueWithCallbacks(() => '');
  const familyNameVWC = useWritableValueWithCallbacks(() => '');
  useValueWithCallbacksEffect(serverNameVWC, ([given, family]) => {
    setVWC(givenNameVWC, given);
    setVWC(familyNameVWC, family);
    return undefined;
  });

  /** If the user needs to save, a function to save, otherwise null */
  const prepareSave = (): (() => Promise<boolean>) | null => {
    const selected = [givenNameVWC.get().trim(), familyNameVWC.get().trim()];
    const server = serverNameVWC.get();
    if (server[0] === selected[0] && server[1] === selected[1]) {
      return null;
    }

    return async () => {
      if (savingVWC.get()) {
        return false;
      }

      const loginContextUnch = ctx.login.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return false;
      }
      const loginContext = loginContextUnch;

      setVWC(savingVWC, true);
      setVWC(errorVWC, null);
      try {
        const response = await apiFetch(
          '/api/1/users/me/attributes/name',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              given_name: selected[0],
              family_name: selected[1],
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        const data: { given_name: string; family_name: string } = await response.json();
        ctx.login.setUserAttributes({
          ...loginContext.userAttributes,
          givenName: data.given_name,
          familyName: data.family_name,
          name: `${data.given_name} ${data.family_name}`.trim(),
        });
        return true;
      } catch (e) {
        setVWC(errorVWC, await describeError(e));
        return false;
      } finally {
        setVWC(savingVWC, false);
      }
    };
  };

  const tryExit = ({
    type,
    trigger,
    exit,
  }: {
    type: string;
    trigger: string | null;
    exit: StandardScreenTransition;
  }) => {
    screenWithWorking(workingVWC, async () => {
      const save = prepareSave();
      if (save === null) {
        trace({ type, draft: false });
        await screenOut(null, startPop, transition, exit, trigger);
        return;
      }

      trace({ type, draft: true, step: 'save' });
      const exitTransition = playExitTransition(transition);
      const result = await save();
      trace({ type, draft: false, step: 'save', result });
      if (result) {
        const finishPop = startPop(
          trigger === null
            ? null
            : {
                slug: trigger,
                parameters: {},
              }
        );
        await exitTransition.promise;
        finishPop();
      } else {
        await exitTransition.promise;
        await playEntranceTransition(transition).promise;
      }
    });
  };

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={32} />
        <div className={styles.top}>{screen.parameters.top}</div>
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.title}>{screen.parameters.title}</div>
        {screen.parameters.message === null ? null : (
          <>
            <VerticalSpacer height={16} />
            <div className={styles.message}>{screen.parameters.message}</div>
          </>
        )}
        <VerticalSpacer height={32} />
        <RenderGuardedComponent
          props={givenNameVWC}
          component={(givenName) => (
            <TextInput
              type="text"
              value={givenName}
              onChange={(v) => setVWC(givenNameVWC, v)}
              label="First Name"
              html5Validation={null}
              disabled={false}
              help={null}
              inputStyle="white"
            />
          )}
          applyInstantly
        />
        <VerticalSpacer height={16} />
        <RenderGuardedComponent
          props={familyNameVWC}
          component={(familyName) => (
            <TextInput
              type="text"
              value={familyName}
              onChange={(v) => setVWC(familyNameVWC, v)}
              label="Last Name"
              html5Validation={null}
              disabled={false}
              help={null}
              inputStyle="white"
            />
          )}
          applyInstantly
        />
        <VerticalSpacer height={0} flexGrow={1} />
        <BackContinue
          onBack={
            screen.parameters.back === null
              ? null
              : (
                  (back) => () =>
                    tryExit({ ...back, type: 'back' })
                )(screen.parameters.back)
          }
          onContinue={() => tryExit({ ...screen.parameters.save, type: 'save' })}
          backText={screen.parameters.back?.text}
          continueText={screen.parameters.save.text}
        />
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
