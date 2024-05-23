import { ReactElement, useContext, useMemo } from 'react';
import styles from './ClientScreenSchemaImageInput.module.css';
import { ClientScreenSchemaInputProps } from '../ClientScreenSchemaInputProps';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { prettySchemaPath } from '../../../../lib/schema/prettySchemaPath';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { useNetworkResponse } from '../../../../../shared/hooks/useNetworkResponse';
import { adaptActiveVWCToAbortSignal } from '../../../../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { convertUsingMapper } from '../../../../crud/CrudFetcher';
import { Button } from '../../../../../shared/forms/Button';
import { ModalContext } from '../../../../../shared/contexts/ModalContext';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { ErrorBlock } from '../../../../../shared/forms/ErrorBlock';
import { clientFlowKeyMap } from '../../../ClientFlow';
import { ClientFlowBlock } from '../../../ClientFlowBlock';
import { showClientFlowPicker } from '../../../showClientFlowPicker';

/**
 * Allows the user to select or upload a video or audio file to fill a string prop.
 */
export const ClientScreenSchemaFlowSlugInput = (
  props: ClientScreenSchemaInputProps
): ReactElement => {
  if (props.schema.type !== 'string') {
    throw new Error('ClientScreenSchemaFlowSlugInput only works with string schemas');
  }
  if (props.schema.format !== 'flow_slug') {
    throw new Error('ClientScreenSchemaFlowSlugInput only works with string format "flow_slug"');
  }

  const outputPrettyPath = useMemo(() => prettySchemaPath(props.path), [props.path]);
  const variableVWC = useMappedValueWithCallbacks(props.variable, (v) => v.get(outputPrettyPath));
  const isVariableVWC = useMappedValueWithCallbacks(variableVWC, (v) => v !== undefined);

  return (
    <RenderGuardedComponent
      props={isVariableVWC}
      component={(variable) =>
        variable ? (
          props.noCopyDelegator({ ...props, delegator: props.withCopyDelegator })
        ) : (
          <Content {...props} />
        )
      }
    />
  );
};

const Content = (props: ClientScreenSchemaInputProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);
  const slugVWC = useMappedValueWithCallbacks(props.value, (v): string | null => v ?? null);

  const flowNR = useNetworkResponse(
    (active, loginContext) =>
      adaptActiveVWCToAbortSignal(active, async (signal) => {
        const slug = slugVWC.get();
        if (slug === null || slug === '' || typeof slug !== 'string') {
          return null;
        }

        const response = await apiFetch(
          '/api/1/client_flows/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              filters: {
                slug: {
                  operator: 'eq',
                  value: slug,
                },
              },
            }),
            signal,
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        const data: { items: any[] } = await response.json();
        if (data.items.length !== 1) {
          return null;
        }

        return convertUsingMapper(data.items[0], clientFlowKeyMap);
      }),
    {
      dependsOn: [slugVWC],
    }
  );

  const name = props.schema.title ?? props.path[props.path.length - 1];
  return (
    <div className={styles.container}>
      <div className={styles.meta}>
        {name && <div className={styles.title}>{name}</div>}
        {props.schema.description && (
          <div className={styles.description}>{props.schema.description}</div>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.image}>
          <RenderGuardedComponent
            props={flowNR}
            component={(content) => {
              if (content.type === 'error') {
                return <ErrorBlock>{content.error}</ErrorBlock>;
              }
              if (content.type === 'unavailable') {
                return <ErrorBlock>Flow is invalid</ErrorBlock>;
              }
              if (content.type !== 'success') {
                return <></>;
              }

              return (
                <ClientFlowBlock
                  clientFlow={content.result}
                  setClientFlow={(v) => {
                    content.replace(v);
                  }}
                />
              );
            }}
          />
        </div>
        <div className={styles.buttons}>
          <Button
            type="button"
            variant="outlined"
            onClick={async (e) => {
              e.preventDefault();
              const choice = await showClientFlowPicker({ modals: modalContext.modals }).promise;
              if (choice !== null && choice !== undefined) {
                setVWC(props.value, choice.slug);
              }
            }}>
            Select Flow
          </Button>
        </div>
      </div>
    </div>
  );
};