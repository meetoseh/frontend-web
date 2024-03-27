import { ReactElement, useCallback, useContext } from 'react';
import styles from './RequestName.module.css';
import { TextInput } from '../../../../shared/forms/TextInput';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { RequestNameResources } from './RequestNameResources';
import { RequestNameState } from './RequestNameState';
import { FeatureComponentProps } from '../../models/Feature';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { FullHeightDiv } from '../../../../shared/components/FullHeightDiv';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { Button } from '../../../../shared/forms/Button';

/**
 * Prompts the user their name.
 */
export const RequestName = ({
  resources,
}: FeatureComponentProps<RequestNameState, RequestNameResources>): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const firstNameVWC = useWritableValueWithCallbacks(() => '');
  const lastNameVWC = useWritableValueWithCallbacks(() => '');
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const savingVWC = useWritableValueWithCallbacks(() => false);

  useErrorModal(modalContext.modals, errorVWC, 'name update');

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        setVWC(errorVWC, <>You need to login again.</>);
        return;
      }
      const loginContext = loginContextUnch;

      setVWC(savingVWC, true);
      const firstName = firstNameVWC.get();
      const lastName = lastNameVWC.get();
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
        const latestContext = loginContextRaw.value.get();
        if (latestContext.state === 'logged-in') {
          loginContextRaw.setUserAttributes({
            ...latestContext.userAttributes,
            name: data.given_name + ' ' + data.family_name,
            givenName: data.given_name,
            familyName: data.family_name,
          });
        }
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setVWC(errorVWC, err);
      } finally {
        setVWC(savingVWC, false);
      }
    },
    [loginContextRaw, firstNameVWC, lastNameVWC, errorVWC]
  );
  const disabledVWC = useMappedValuesWithCallbacks(
    [firstNameVWC, lastNameVWC, savingVWC],
    () => firstNameVWC.get().length === 0 || lastNameVWC.get().length === 0 || savingVWC.get()
  );

  const buttonStateVWC = useMappedValuesWithCallbacks([disabledVWC, savingVWC], () => ({
    disabled: disabledVWC.get(),
    spinner: savingVWC.get(),
  }));

  return (
    <div className={styles.container}>
      <FullHeightDiv className={styles.background} />
      <div className={styles.foreground}>
        <div className={styles.content}>
          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.contentSpacer} />
            <div className={styles.title}>What&rsquo;s Your Name?</div>
            <RenderGuardedComponent
              props={firstNameVWC}
              component={(firstName) => (
                <TextInput
                  label="First Name"
                  value={firstName}
                  help={null}
                  disabled={false}
                  inputStyle="white"
                  onChange={(n) => setVWC(firstNameVWC, n)}
                  html5Validation={{ required: true, minLength: 1, maxLength: 255 }}
                />
              )}
              applyInstantly
            />
            <RenderGuardedComponent
              props={lastNameVWC}
              component={(lastName) => (
                <TextInput
                  label="Last Name"
                  value={lastName}
                  help={null}
                  disabled={false}
                  inputStyle="white"
                  onChange={(n) => setVWC(lastNameVWC, n)}
                  html5Validation={{ required: true, minLength: 1, maxLength: 255 }}
                />
              )}
              applyInstantly
            />
            <div className={styles.contentSpacer} />
            <div className={styles.submitContainer}>
              <RenderGuardedComponent
                props={buttonStateVWC}
                component={({ disabled, spinner }) => (
                  <Button
                    type="submit"
                    variant="filled-white"
                    disabled={disabled}
                    spinner={spinner}
                    fullWidth>
                    Continue
                  </Button>
                )}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
