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
import { OsehContent } from '../../../../../shared/content/OsehContent';
import { clientFlowContentKeyMap } from '../../../content/ClientFlowContent';
import { showClientFlowContentSelector } from '../../../content/showClientFlowContentSelector';
import { showClientFlowContentUploader } from '../../../content/showClientFlowContentUploader';

/**
 * Allows the user to select or upload a video or audio file to fill a string prop.
 */
export const ClientScreenSchemaContentInput = (
  props: ClientScreenSchemaInputProps
): ReactElement => {
  if (props.schema.type !== 'string') {
    throw new Error('ClientScreenSchemaContentInput only works with string schemas');
  }
  if (props.schema.format !== 'content_uid') {
    throw new Error('ClientScreenSchemaContentInput only works with string format "content_uid"');
  }
  if (typeof props.schema['x-processor'] !== 'object') {
    throw new Error('ClientScreenSchemaContentInput requires an x-processor hint');
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
  const processor = props.schema['x-processor'] as { job: string; list: string };
  const preview = (props.schema['x-preview'] as
    | { type: 'audio' }
    | { type: 'video'; width: number; height: number }
    | undefined) ?? {
    type: 'audio',
  };

  const contentNR = useNetworkResponse(
    (active, loginContext) =>
      adaptActiveVWCToAbortSignal(active, async (signal) => {
        const uid = props.value.get();
        if (uid === null || uid === undefined || uid === '' || typeof uid !== 'string') {
          return null;
        }

        const response = await apiFetch(
          '/api/1/admin/client_flows/content/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              filters: {
                content_file_uid: {
                  operator: 'eq',
                  value: uid,
                },
                list_slug: {
                  operator: 'eq',
                  value: processor.list,
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

        return convertUsingMapper(data.items[0], clientFlowContentKeyMap);
      }),
    {
      dependsOn: [props.value],
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
            props={contentNR}
            component={(content) => {
              if (content.type === 'error') {
                return <ErrorBlock>{content.error}</ErrorBlock>;
              }
              if (content.type === 'unavailable') {
                return <ErrorBlock>File is invalid or in the wrong list</ErrorBlock>;
              }
              if (content.type !== 'success') {
                return <></>;
              }

              return (
                <OsehContent
                  uid={content.result.contentFile.uid}
                  jwt={content.result.contentFile.jwt}
                  showAs={preview.type}
                  playerStyle={
                    preview.type !== 'video'
                      ? undefined
                      : {
                          width: preview.width,
                          height: preview.height,
                        }
                  }
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
              const choice = await showClientFlowContentSelector(
                modalContext.modals,
                processor.list,
                preview
              ).promise;
              if (choice !== null && choice !== undefined) {
                setVWC(props.value, choice.contentFile.uid);
              }
            }}>
            Select {preview.type === 'video' ? 'Video' : 'Audio'}
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={async (e) => {
              e.preventDefault();
              const choice = await showClientFlowContentUploader(
                modalContext.modals,
                loginContextRaw,
                {
                  processor,
                  description: props.schema.description ?? '(no description)',
                }
              ).promise;
              if (choice !== null && choice !== undefined) {
                setVWC(props.value, choice.contentFile.uid);
              }
            }}>
            Upload {preview.type === 'video' ? 'Video' : 'Audio'}
          </Button>
        </div>
      </div>
    </div>
  );
};
