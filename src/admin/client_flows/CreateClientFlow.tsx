import { ReactElement, useContext } from 'react';
import { ClientFlow, clientFlowKeyMap } from './ClientFlow';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { TextInput } from '../../shared/forms/TextInput';
import { setVWC } from '../../shared/lib/setVWC';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { Button } from '../../shared/forms/Button';
import { describeError } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { convertUsingMapper } from '../crud/CrudFetcher';
import styles from './CreateClientFlow.module.css';

type CreateClientFlowProps = {
  /**
   * Called after a client flow is created by the user
   * @param clientFlow The client flow that was created
   */
  onCreated: (this: void, clientFlow: ClientFlow) => void;
};

/**
 * Shows a form to create a new client flow
 */
export const CreateClientFlow = ({ onCreated }: CreateClientFlowProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const slugVWC = useWritableValueWithCallbacks<string>(() => '');
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const loginContextRaw = useContext(LoginContext);

  useErrorModal(modalContext.modals, errorVWC, 'creating client flow');

  return (
    <CrudCreateBlock>
      <RenderGuardedComponent
        props={slugVWC}
        component={(slug) => (
          <TextInput
            type="text"
            value={slug}
            onChange={(v) => setVWC(slugVWC, v)}
            label="Slug"
            disabled={false}
            help={null}
            inputStyle="normal"
            html5Validation={null}
          />
        )}
        applyInstantly
      />

      <div className={styles.createButton}>
        <Button
          type="button"
          onClick={async (e) => {
            e.preventDefault();

            const loginContextUnch = loginContextRaw.value.get();
            if (loginContextUnch.state !== 'logged-in') {
              return;
            }

            const loginContext = loginContextUnch;

            try {
              const slug = slugVWC.get();
              const response = await apiFetch(
                '/api/1/client_flows/',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                  },
                  body: JSON.stringify({
                    slug,
                  }),
                },
                loginContext
              );

              if (!response.ok) {
                throw response;
              }

              const raw = await response.json();
              const clientFlow = convertUsingMapper(raw, clientFlowKeyMap);
              onCreated(clientFlow);
            } catch (e) {
              const err = await describeError(e);
              setVWC(errorVWC, err);
            }
          }}>
          Create
        </Button>
      </div>
    </CrudCreateBlock>
  );
};
