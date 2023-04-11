import { ReactElement, useCallback, useContext, useState } from 'react';
import { VipChatRequest, convertVipChatRequest } from './VipChatRequest';
import { LoginContext } from '../../shared/LoginContext';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import styles from './CreateVipChatRequest.module.css';
import { ErrorBlock, describeError } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { TextInput } from '../../shared/forms/TextInput';
import { Button } from '../../shared/forms/Button';

type CreateVipChatRequestProps = {
  /**
   * Called after a vip chat erquest is created by the user
   * @param chatRequest the created chat request
   */
  onCreated: (this: void, chatRequest: VipChatRequest) => void;
};

/**
 * A standard create block for creating a vip chat request.
 */
export const CreateVipChatRequest = ({ onCreated }: CreateVipChatRequestProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [sub, setSub] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);

  const createVipChatRequest = useCallback(async () => {
    setError(null);
    setLoading(true);

    const subToUse = sub.trim();

    if (subToUse === '') {
      return;
    }

    try {
      const response = await apiFetch(
        '/api/1/vip_chat_requests/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            user_sub: sub,
            variant: 'phone-04102023',
            display_data: {},
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      data.popup_seen_at = null;
      const parsed = convertVipChatRequest(data);
      onCreated(parsed);
    } catch (e) {
      const error = await describeError(e);
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [onCreated, sub, loginContext]);

  return (
    <CrudCreateBlock>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) {
            createVipChatRequest();
          }
        }}>
        <TextInput
          label="Sub"
          value={sub}
          help="The unique identifier for the user, which is the subject of their JWT, i.e, their 'sub' claim"
          disabled={false}
          inputStyle="normal"
          onChange={(sub) => {
            setSub(sub);
            setError(null);
          }}
          html5Validation={{ required: true }}
        />
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <div className={styles.buttonContainer}>
          <Button disabled={sub === '' || loading} type="submit">
            Create
          </Button>
        </div>
      </form>
    </CrudCreateBlock>
  );
};
