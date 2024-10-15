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
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';
import { BoxError, DisplayableError } from '../../../../../shared/lib/errors';

/**
 * Allows the user to select or upload an image to fill a string prop.
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
  const dynamicSize = props.schema['x-dynamic-size'] as
    | {
        width: string[];
        height: string[];
      }
    | undefined;
  const processor = props.schema['x-processor'] as { job: string; list: string };
  const previewRaw = (props.schema['x-preview'] as
    | { width: number; height: number }
    | undefined) ?? {
    width: 200,
    height: 200,
  };

  const resolvedDynamicSizeVWC = useMappedValueWithCallbacks(
    props.rootValue,
    (rootValue) => {
      if (dynamicSize === undefined) {
        return undefined;
      }
      const rawWidth = walkPath(props.rootSchema, rootValue, dynamicSize.width);
      const rawHeight = walkPath(props.rootSchema, rootValue, dynamicSize.height);

      const width = Number.isNaN(rawWidth) ? 100 : Number(rawWidth);
      const height = Number.isNaN(rawHeight) ? 100 : Number(rawHeight);
      return {
        width,
        height,
      };
    },
    {
      outputEqualityFn: (a, b) =>
        a === undefined || b === undefined ? a === b : a.width === b.width && a.height === b.height,
    }
  );

  const previewVWC = useMappedValueWithCallbacks(
    resolvedDynamicSizeVWC,
    (dynamicSize) => {
      if (dynamicSize === undefined) {
        return previewRaw;
      }

      if (dynamicSize.width < 200 && dynamicSize.height < 200) {
        return {
          width: dynamicSize.width,
          height: dynamicSize.height,
        };
      }

      if (dynamicSize.width <= dynamicSize.height) {
        return {
          width: Math.floor(200 * (dynamicSize.width / dynamicSize.height)),
          height: 200,
        };
      }

      return {
        width: 200,
        height: Math.floor(200 * (dynamicSize.height / dynamicSize.width)),
      };
    },
    {
      inputEqualityFn: () => false,
      outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
    }
  );

  const listVWC = useMappedValueWithCallbacks(
    resolvedDynamicSizeVWC,
    (dynamicSize) =>
      processor.list +
      (dynamicSize === undefined ? '' : `@${dynamicSize.width}x${dynamicSize.height}`)
  );

  const cleanedValue = useMappedValueWithCallbacks(props.value, (v) => v, {
    outputEqualityFn: (a, b) => a === b,
  });

  const imageNR = useNetworkResponse(
    (active, loginContext) =>
      adaptActiveVWCToAbortSignal(active, async (signal) => {
        const uid = cleanedValue.get();
        if (uid === null || uid === undefined || uid === '' || typeof uid !== 'string') {
          return null;
        }
        const list = listVWC.get();

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
                  value: list,
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
      dependsOn: [cleanedValue, listVWC],
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
        <RenderGuardedComponent
          props={resolvedDynamicSizeVWC}
          component={(dynamicSize) => {
            if (dynamicSize === undefined) {
              return <></>;
            }

            return (
              <div className={styles.description}>
                Resolved dynamic size: {`${dynamicSize.width} width x ${dynamicSize.height} height`}
              </div>
            );
          }}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.image}>
          <RenderGuardedComponent
            props={useMappedValuesWithCallbacks([imageNR, previewVWC], () => ({
              image: imageNR.get(),
              preview: previewVWC.get(),
            }))}
            component={({ image, preview }) => {
              if (image.type === 'error') {
                return <BoxError error={image.error} />;
              }
              if (image.type === 'unavailable') {
                return (
                  <BoxError
                    error={
                      new DisplayableError(
                        'server-not-retryable',
                        'show image',
                        'image is invalid or in the wrong list'
                      )
                    }
                  />
                );
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
                listVWC.get(),
                previewVWC.get()
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
                  dynamicSize: resolvedDynamicSizeVWC.get() ?? null,
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

/**
 * Recursively determines the value at the given path, filling in default
 * values as required
 */
function walkPath(schema: any, value: any, path: string[]): any {
  if (schema === undefined || typeof schema !== 'object') {
    console.warn('walkPath filling in unknown schema');
    schema = { type: 'object' };
  }

  if ((value === null || value === undefined) && schema.default !== undefined) {
    value = schema.default;
  }

  if (path.length === 0) {
    return value;
  }

  if (
    schema.type === 'object' &&
    'x-enum-discriminator' in schema &&
    typeof schema['x-enum-discriminator'] === 'string' &&
    value !== null &&
    value !== undefined &&
    schema['x-enum-discriminator'] in value
  ) {
    const chosen = value[schema['x-enum-discriminator']];
    for (const choice of schema.oneOf ?? []) {
      if (chosen === choice.properties?.[schema['x-enum-discriminator']].enum[0]) {
        return walkPath(choice, value, path);
      }
    }
  }

  if (value === null || value === undefined || typeof value !== 'object' || !(path[0] in value)) {
    return walkPath(schema.properties?.[path[0]], undefined, path.slice(1));
  }

  return walkPath(schema.properties?.[path[0]], value[path[0]], path.slice(1));
}
