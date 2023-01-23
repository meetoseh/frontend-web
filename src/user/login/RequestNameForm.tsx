import React, { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { LoginContext } from '../../shared/LoginContext';
import '../../assets/fonts.css';
import styles from './RequestNameForm.module.css';
import { TextInput } from '../../shared/forms/TextInput';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImage } from '../../shared/OsehImage';

type RequestNameFormProps = {
  setLoaded: (this: void, loading: boolean) => void;
};

/**
 * Shows a form allowing the user to update their name. Requires a login context
 * @returns
 */
export const RequestNameForm = ({ setLoaded }: RequestNameFormProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    setLoaded(!imageLoading);
  }, [imageLoading, setLoaded]);

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
        loginContext.setUserAttributes({
          ...loginContext.userAttributes!,
          name: data.given_name + ' ' + data.family_name,
          givenName: data.given_name,
          familyName: data.family_name,
        });
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setError(err);
      } finally {
        setSaving(false);
      }
    },
    [loginContext, firstName, lastName]
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImage
          uid="oseh_if_hH68hcmVBYHanoivLMgstg"
          jwt={null}
          displayWidth={windowSize.width}
          displayHeight={windowSize.height}
          alt=""
          isPublic={true}
          setLoading={setImageLoading}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>What's Your Name?</div>
        <form className={styles.form} onSubmit={onSubmit}>
          <TextInput
            label="First Name"
            value={firstName}
            help={null}
            disabled={saving}
            inputStyle={'white'}
            onChange={setFirstName}
            html5Validation={{ required: '', 'min-length': '1', 'max-length': '255' }}
          />
          <TextInput
            label="Last Name"
            value={lastName}
            help={null}
            disabled={saving}
            inputStyle={'white'}
            onChange={setLastName}
            html5Validation={{ required: '', 'min-length': '1', 'max-length': '255' }}
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
