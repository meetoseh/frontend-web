import { ReactElement, useCallback, useContext, useState } from 'react';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { Instructor } from './Instructor';
import styles from './CreateInstructor.module.css';
import { TextInput } from '../../shared/forms/TextInput';
import { Button } from '../../shared/forms/Button';
import { LoginContext } from '../../shared/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';

type CreateInstructorProps = {
  /**
   * Called after an instructor is created by the user
   * @param instructor The instructor that was created
   */
  onCreated: (this: void, instructor: Instructor) => void;
};

export const CreateInstructor = ({ onCreated }: CreateInstructorProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);

  const createInstructor = useCallback(async () => {
    if (loginContext.state !== 'logged-in') {
      setError(<>You must be logged in to create an instructor</>);
      return;
    }

    setLoading(true);
    setError(null);

    let response: Response;
    try {
      response = await apiFetch(
        '/api/1/instructors/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({ name }),
        },
        loginContext
      );
    } catch (e) {
      console.error(e);
      setError(<>Error connecting to server. Check your internet connection</>);
      setLoading(false);
      return;
    }

    if (!response.ok) {
      setError(await describeErrorFromResponse(response));
      setLoading(false);
      return;
    }

    const body = await response.json();
    onCreated({
      uid: body.uid,
      name: body.name,
      picture: null,
      createdAt: new Date(body.created_at * 1000),
      deletedAt: null,
    });
    setName('');
    setLoading(false);
  }, [onCreated, name, loginContext]);

  return (
    <CrudCreateBlock>
      <form className={styles.form}>
        <TextInput
          label="Name"
          value={name}
          help="For journey cards"
          disabled={false}
          inputStyle="normal"
          onChange={(name) => {
            setName(name);
            setError(null);
          }}
          html5Validation={{ required: '' }}
        />
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <div className={styles.buttonContainer}>
          <Button
            disabled={name === '' || loading}
            type="submit"
            onClick={(e) => {
              e.preventDefault();
              createInstructor();
            }}>
            Create
          </Button>
        </div>
      </form>
    </CrudCreateBlock>
  );
};
