import { useContext } from 'react';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { Feature } from '../../models/Feature';
import { IsaiahCourseResources } from './IsaiahCourseResources';
import { IsaiahCourseState } from './IsaiahCourseState';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { IsaiahCourse } from './IsaiahCourse';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';

const backgroundUid = 'oseh_if_0ykGW_WatP5-mh-0HRsrNw';

export const IsaiahCourseFeature: Feature<IsaiahCourseState, IsaiahCourseResources> = {
  identifier: 'isaiahCourse',
  useWorldState: () => {
    const interests = useContext(InterestsContext);
    const loginContext = useContext(LoginContext);
    const ian = useInappNotificationValueWithCallbacks({
      type: 'react-rerender',
      props: {
        uid: 'oseh_ian_1DsXw1UM0_cQ_PRglgchcg',
        suppress: interests.state !== 'loaded' || interests.primaryInterest !== 'isaiah-course',
      },
    });
    const primaryInterest =
      interests.state === 'loading'
        ? undefined
        : interests.state === 'loaded'
        ? loginContext.state === 'logged-in'
          ? interests.primaryInterest
          : null
        : null;

    const attachedCourse = useWritableValueWithCallbacks<boolean | null>(() => null);
    useValueWithCallbacksEffect(ian, (ian) => {
      if (attachedCourse.get() !== null) {
        return;
      }

      if (
        primaryInterest !== 'isaiah-course' ||
        ian === null ||
        !ian.showNow ||
        interests.state === 'loading'
      ) {
        return;
      }

      if (interests.state === 'unavailable') {
        setVWC(attachedCourse, false);
        return;
      }

      if (interests.visitor.loading) {
        return;
      }

      let active = true;
      attachCourse();
      return () => {
        active = false;
      };

      async function attachCourseInner() {
        if (interests.state !== 'loaded') {
          if (active) {
            setVWC(attachedCourse, false);
          }
          return;
        }

        const response = await apiFetch(
          '/api/1/courses/attach_free',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...(interests.visitor.loading || interests.visitor.uid === null
                ? {}
                : { Visitor: interests.visitor.uid }),
            },
            body: JSON.stringify({
              course_slug: 'resilient-spirit-07202023',
              source: 'browser',
            }),
          },
          loginContext
        );
        if (!active) {
          return;
        }
        if (response.ok || response.status === 409) {
          await response.text();
          setVWC(attachedCourse, true);
          return;
        }
        throw response;
      }

      async function attachCourse() {
        try {
          await attachCourseInner();
        } catch (e) {
          if (active) {
            console.warn('failed to attach isaiah course:', e);
            setVWC(attachedCourse, false);
          }
        }
      }
    });
    return useMappedValuesWithCallbacks([ian, attachedCourse], () => ({
      ian: ian.get(),
      primaryInterest,
      attachedCourse: attachedCourse.get(),
    }));
  },
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const windowSizeVWC = useWindowSizeValueWithCallbacks();
    const imageHandler = useOsehImageStateRequestHandler({});
    const background = useOsehImageStateValueWithCallbacks(
      adaptValueWithCallbacksAsVariableStrategyProps(
        useMappedValuesWithCallbacks(
          [requiredVWC, windowSizeVWC],
          (): OsehImageProps => ({
            uid: requiredVWC.get() ? backgroundUid : null,
            jwt: null,
            displayWidth: windowSizeVWC.get().width,
            displayHeight: windowSizeVWC.get().height,
            alt: '',
            isPublic: true,
          })
        )
      ),
      imageHandler
    );
    const ianUID = useMappedValuesWithCallbacks([requiredVWC, stateVWC], () => ({
      uid: requiredVWC.get() ? stateVWC.get().ian?.uid ?? null : null,
    }));
    const session = useInappNotificationSessionValueWithCallbacks(
      adaptValueWithCallbacksAsVariableStrategyProps(ianUID)
    );

    return useMappedValuesWithCallbacks(
      [background, session],
      (): IsaiahCourseResources => ({
        background: background.get(),
        session: session.get(),
        loading: background.get().loading || session.get() === null,
        gotoPurchases: () => {
          const favorites = allStatesVWC.get().favorites;
          favorites.setTab('courses', false);
          favorites.setShow(true, true);
        },
      })
    );
  },
  isRequired: (state, allStates) => {
    if (state.primaryInterest === undefined) {
      return undefined;
    }

    if (state.primaryInterest !== 'isaiah-course') {
      return false;
    }

    if (state.ian === null || (state.ian.showNow && state.attachedCourse === null)) {
      return undefined;
    }

    return !!state.attachedCourse && state.ian.showNow;
  },
  component: (state, resources) => <IsaiahCourse state={state} resources={resources} />,
};
