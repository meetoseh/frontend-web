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
import { clientFlowImageKeyMap } from '../../../images/ClientFlowImage';
import { OsehImage } from '../../../../../shared/images/OsehImage';
import { Button } from '../../../../../shared/forms/Button';
import { showClientFlowImageSelector } from '../../../images/showClientFlowImageSelector';
import { ModalContext } from '../../../../../shared/contexts/ModalContext';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { showClientFlowImageUploader } from '../../../images/showClientFlowImageUploader';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { ErrorBlock } from '../../../../../shared/forms/ErrorBlock';

/**
 * Allows the user to input a fixed or formatted (python curly brackets style,
 * e.g, 'foo {standard[name][full]}') to fill in the schema.
 *
 * Only works if the schema is a string type.
 *
 * Supported validation properties when not using string formatting:
 * - `maxLength`
 * - `minLength`
 * - `pattern`
 * - `enum`
 */
export const ClientScreenSchemaImageInput = (props: ClientScreenSchemaInputProps): ReactElement => {
  if (props.schema.type !== 'string') {
    throw new Error('ClientScreenSchemaImageInput only works with string schemas');
  }
  if (props.schema.format !== 'image_uid') {
    throw new Error('ClientScreenSchemaImageInput only works with string format "image_uid"');
  }
  if (typeof props.schema['x-processor'] !== 'object') {
    throw new Error('ClientScreenSchemaImageInput requires an x-processor hint');
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
  const preview = (props.schema['x-preview'] as { width: number; height: number } | undefined) ?? {
    width: 200,
    height: 200,
  };

  const imageNR = useNetworkResponse(
    (active, loginContext) =>
      adaptActiveVWCToAbortSignal(active, async (signal) => {
        const uid = props.value.get();
        if (uid === null || uid === undefined || uid === '' || typeof uid !== 'string') {
          return null;
        }

        const response = await apiFetch(
          '/api/1/admin/client_flows/image/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              filters: {
                image_file_uid: {
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

        return convertUsingMapper(data.items[0], clientFlowImageKeyMap);
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
            props={imageNR}
            component={(image) => {
              if (image.type === 'error') {
                return <ErrorBlock>{image.error}</ErrorBlock>;
              }
              if (image.type === 'unavailable') {
                return <ErrorBlock>Image is invalid or in the wrong list</ErrorBlock>;
              }
              if (image.type !== 'success') {
                return <></>;
              }
              return (
                <OsehImage
                  displayWidth={preview.width}
                  displayHeight={preview.height}
                  alt=""
                  uid={image.result.imageFile.uid}
                  jwt={image.result.imageFile.jwt}
                  handler={props.imageHandler}
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
              const choice = await showClientFlowImageSelector(
                modalContext.modals,
                processor.list,
                preview
              ).promise;
              if (choice !== null && choice !== undefined) {
                setVWC(props.value, choice.imageFile.uid);
              }
            }}>
            Select Image
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={async (e) => {
              e.preventDefault();
              const choice = await showClientFlowImageUploader(
                modalContext.modals,
                loginContextRaw,
                {
                  processor,
                  description: props.schema.description ?? '(no description)',
                }
              ).promise;
              if (choice !== null && choice !== undefined) {
                setVWC(props.value, choice.imageFile.uid);
              }
            }}>
            Upload Image
          </Button>
        </div>
      </div>
    </div>
  );
};
