import { ReactElement, useCallback, useContext, useState } from 'react';
import styles from './RequestName.module.css';
import { TextInput } from '../../../../shared/forms/TextInput';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { ErrorBlock, describeError } from '../../../../shared/forms/ErrorBlock';
import { RequestNameResources } from './RequestNameResources';
import { RequestNameState } from './RequestNameState';
import { FeatureComponentProps } from '../../models/Feature';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';

/**
 * Prompts the user their name.
 */
export const RequestName = ({
  resources,
}: FeatureComponentProps<RequestNameState, RequestNameResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      setSaving(true);
      try {
        const response = await apiFetch(
          '/api/1/users/me/attributes/name',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              given_name: firstName,
              family_name: lastName,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data: { given_name: string; family_name: string } = await response.json();
        if (loginContext.userAttributes !== null) {
          loginContext.setUserAttributes({
            ...loginContext.userAttributes,
            name: data.given_name + ' ' + data.family_name,
            givenName: data.given_name,
            familyName: data.family_name,
          });
        }
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setError(err);
        throw new Error('Network request failed');
      } finally {
        setSaving(false);
      }
    },
    [loginContext, firstName, lastName]
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(resources, (r) => r.background)}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>What&rsquo;s Your Name?</div>
        <form className={styles.form} onSubmit={onSubmit}>
          <TextInput
            label="First Name"
            value={firstName}
            help={null}
            disabled={saving}
            inputStyle={'white'}
            onChange={setFirstName}
            html5Validation={{ required: true, minLength: 1, maxLength: 255 }}
          />
          <TextInput
            label="Last Name"
            value={lastName}
            help={null}
            disabled={saving}
            inputStyle={'white'}
            onChange={setLastName}
            html5Validation={{ required: true, minLength: 1, maxLength: 255 }}
          />

          {error && <ErrorBlock>{error}</ErrorBlock>}

          <div className={styles.submitContainer}>
            <button className={styles.submit} type="submit" disabled={saving}>
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
