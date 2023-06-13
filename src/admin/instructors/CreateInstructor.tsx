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
  const [bias, setBias] = useState<{ str: string; parsed: number | undefined }>({
    str: '0.00',
    parsed: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);

  const createInstructor = useCallback(async () => {
    if (loginContext.state !== 'logged-in') {
      setError(<>You must be logged in to create an instructor</>);
      return;
    }

    if (bias.parsed === undefined) {
      setError(<>Bias must be a number</>);
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
          body: JSON.stringify({ name, bias: bias.parsed }),
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
      bias: body.bias,
      picture: null,
      createdAt: new Date(body.created_at * 1000),
      deletedAt: null,
    });
    setName('');
    setBias({ str: '0.00', parsed: 0 });
    setLoading(false);
  }, [onCreated, name, bias, loginContext]);

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
          html5Validation={{ required: true }}
        />
        <TextInput
          label="Bias"
          value={bias.str}
          help="A non-negative number generally less than one which influences content selection towards this instructor. Higher numbers are more influential."
          disabled={false}
          inputStyle="normal"
          onChange={(bias) => {
            try {
              const parsed = parseFloat(bias);
              if (isNaN(parsed)) {
                setBias({ str: bias, parsed: undefined });
              } else {
                setBias({ str: bias, parsed });
              }
            } catch (e) {
              setBias({ str: bias, parsed: undefined });
            }
            setError(null);
          }}
          html5Validation={{ required: true, min: 0, step: 0.01 }}
          type="number"
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
