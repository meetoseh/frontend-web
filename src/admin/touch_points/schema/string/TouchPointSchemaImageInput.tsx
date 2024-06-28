import { ReactElement, useContext, useMemo } from 'react';
import { TouchPointSchemaInputProps } from '../TouchPointSchemaInputProps';
import { prettySchemaPath } from '../../../lib/schema/prettySchemaPath';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import styles from './TouchPointSchemaImageInput.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../../../shared/lib/setVWC';
import { TouchPointSchemaStringInput } from './TouchPointSchemaStringInput';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useNetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { adaptActiveVWCToAbortSignal } from '../../../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../../../shared/ApiConstants';
import { convertUsingMapper } from '../../../crud/CrudFetcher';
import { emailImageKeyMap } from '../../models/EmailImage';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { OsehImage } from '../../../../shared/images/OsehImage';
import { Button } from '../../../../shared/forms/Button';
import { showEmailImageSelector } from '../../lib/showEmailImageSelector';
import { showEmailImageUploader } from '../../lib/showEmailImageUploader';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { ModalContext } from '../../../../shared/contexts/ModalContext';

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
export const TouchPointSchemaImageInput = (props: TouchPointSchemaInputProps): ReactElement => {
  if (props.schema.type !== 'string') {
    throw new Error('TouchPointSchemaImageInput only works with string schemas');
  }
  if (props.schema.format !== 'x-image') {
    throw new Error('TouchPointSchemaImageInput only works with x-image format schemas');
  }
  const outputPrettyPath = useMemo(() => prettySchemaPath(props.path), [props.path]);
  const isVariableVWC = useMappedValueWithCallbacks(props.variable, (v) => v.has(outputPrettyPath));

  return (
    <RenderGuardedComponent
      props={isVariableVWC}
      component={(variable) =>
        variable ? <TouchPointSchemaStringInput {...props} /> : <Content {...props} />
      }
    />
  );
};

const Content = ({
  path: outputPath,
  schema,
  value: valueVWC,
  variable: variableMapVWC,
  imageHandler,
}: TouchPointSchemaInputProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const sizeVWC = useReactManagedValueAsValueWithCallbacks(
    schema['x-size'] as { width: number; height: number }
  );
  const imageNR = useNetworkResponse(
    (active, loginContext) =>
      adaptActiveVWCToAbortSignal(active, async (signal) => {
        const uid = valueVWC.get();
        if (uid === null || uid === undefined || uid === '' || typeof uid !== 'string') {
          return null;
        }

        const size = sizeVWC.get();

        const response = await apiFetch(
          '/api/1/admin/email/image/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              filters: {
                uid: {
                  operator: 'eq',
                  value: uid,
                },
                width: {
                  operator: 'eq',
                  value: size.width,
                },
                height: {
                  operator: 'eq',
                  value: size.height,
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

        return convertUsingMapper(data.items[0], emailImageKeyMap);
      }),
    {
      dependsOn: [valueVWC, sizeVWC],
    }
  );
  const name = schema.title ?? outputPath[outputPath.length - 1];
  return (
    <div className={styles.container}>
      <div className={styles.meta}>
        {name && <div className={styles.title}>{name}</div>}
        {schema.description && <div className={styles.description}>{schema.description}</div>}
        <RenderGuardedComponent
          props={sizeVWC}
          component={(size) => {
            if (size === undefined) {
              return <></>;
            }

            return (
              <div className={styles.description}>
                Size in the email template: {size.width}px width by {size.height}px height
              </div>
            );
          }}
        />
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
                return <ErrorBlock>Image is unset, invalid, or is not the correct size</ErrorBlock>;
              }
              if (image.type !== 'success') {
                return <></>;
              }
              return (
                <OsehImage
                  displayWidth={image.result.size.width}
                  displayHeight={image.result.size.height}
                  alt=""
                  uid={image.result.imageFile.uid}
                  jwt={image.result.imageFile.jwt}
                  handler={imageHandler}
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
              const choice = await showEmailImageSelector(modalContext.modals, sizeVWC.get())
                .promise;
              if (choice !== null && choice !== undefined) {
                setVWC(valueVWC, choice.uid);
              }
            }}>
            Select Image
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={async (e) => {
              e.preventDefault();
              const choice = await showEmailImageUploader(modalContext.modals, loginContextRaw, {
                size: sizeVWC.get(),
                description: schema.description ?? '(no description)',
              }).promise;
              if (choice !== null && choice !== undefined) {
                setVWC(valueVWC, choice.uid);
              }
            }}>
            Upload Image
          </Button>
        </div>
      </div>
    </div>
  );
};
