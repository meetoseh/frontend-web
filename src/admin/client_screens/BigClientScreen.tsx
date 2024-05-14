import { ReactElement, useContext } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { NetworkResponse, useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { ClientScreen, clientScreenKeyMap } from './ClientScreen';
import { adaptActiveVWCToAbortSignal } from '../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingMapper } from '../crud/CrudFetcher';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import styles from './BigClientScreen.module.css';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import { OpenAPISchemaViewer } from '../crud/schema/OpenAPISchemaViewer';
import { useReactManagedValueAsValueWithCallbacks } from '../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { FLAG_PRESETS_LOOKUP } from './ClientScreenFilterAndSortBlock';

export const BigClientScreen = (): ReactElement => {
  const modalContext = useContext(ModalContext);
  const slugVWC = useWritableValueWithCallbacks(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
  });
  const clientScreenNR = useNetworkResponse<ClientScreen>(
    (active, ctx) =>
      adaptActiveVWCToAbortSignal(active, async (signal): Promise<ClientScreen | null> => {
        const response = await apiFetch(
          '/api/1/client_screens/search',
          {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              filters: {
                slug: {
                  operator: 'eq',
                  value: slugVWC.get(),
                },
              },
              limit: 1,
              include_messages: true,
            }),
          },
          ctx
        );
        if (!response.ok) {
          throw response;
        }
        const data: { items: any[] } = await response.json();
        if (data.items.length === 0) {
          return null;
        }

        return convertUsingMapper(data.items[0], clientScreenKeyMap);
      }),
    {
      dependsOn: [slugVWC],
    }
  );

  const clientScreenNRPopupErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(
    () => null
  );
  useValueWithCallbacksEffect(clientScreenNR, (cs) => {
    setVWC(clientScreenNRPopupErrorVWC, cs.error);
    return undefined;
  });
  useErrorModal(modalContext.modals, clientScreenNRPopupErrorVWC, 'loading client screen');

  return (
    <div className={styles.container}>
      <div className={styles.title}>Client Screens</div>
      <RenderGuardedComponent
        props={clientScreenNR}
        component={(cs) => {
          if (cs.type === 'unavailable') {
            return <div className={styles.error}>No client screen found</div>;
          }
          if (cs.type === 'error') {
            return <div className={styles.error}>There was an error loading the touch point</div>;
          }
          if (cs.type === 'loading') {
            return <div className={styles.error}>Loading...</div>;
          }
          if (cs.type === 'load-prevented') {
            return <div className={styles.error}>Load prevented</div>;
          }
          return <Content clientScreen={cs.result} networkResponse={clientScreenNR} />;
        }}
      />
    </div>
  );
};

const Content = ({
  clientScreen,
  networkResponse,
}: {
  clientScreen: ClientScreen;
  networkResponse: ValueWithCallbacks<NetworkResponse<ClientScreen>>;
}): ReactElement => {
  const schemaVWC = useReactManagedValueAsValueWithCallbacks({
    parsed: clientScreen.screenSchema,
    source: JSON.stringify(clientScreen.screenSchema, undefined, 2),
  });
  return (
    <div className={styles.content}>
      <div className={styles.topRow}>
        <div className={styles.basic}>
          <CrudItemBlock title={clientScreen.slug} controls={null}>
            <div className={styles.basicInner}>
              <CrudFormElement title="name">{clientScreen.name}</CrudFormElement>
              <CrudFormElement title="description">{clientScreen.description}</CrudFormElement>
              <CrudFormElement title="schema">
                <OpenAPISchemaViewer schema={schemaVWC} />
              </CrudFormElement>
              <CrudFormElement title="flags">
                {clientScreen.flags}: {FLAG_PRESETS_LOOKUP.get(clientScreen.flags) ?? 'unknown'}
              </CrudFormElement>
            </div>
          </CrudItemBlock>
        </div>
      </div>
    </div>
  );
};
