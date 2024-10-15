import { ReactElement, useCallback, useContext, useState } from 'react';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { Instructor } from './Instructor';
import styles from './CreateInstructor.module.css';
import { TextInput } from '../../shared/forms/TextInput';
import { Button } from '../../shared/forms/Button';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { BoxError, chooseErrorFromStatus, DisplayableError } from '../../shared/lib/errors';

type CreateInstructorProps = {
  /**
   * Called after an instructor is created by the user
   * @param instructor The instructor that was created
   */
  onCreated: (this: void, instructor: Instructor) => void;
};

export const CreateInstructor = ({ onCreated }: CreateInstructorProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [name, setName] = useState('');
  const [bias, setBias] = useState<{ str: string; parsed: number | undefined }>({
    str: '0.00',
    parsed: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DisplayableError | null>(null);

  const createInstructor = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setError(
        new DisplayableError('server-refresh-required', 'create instructor', 'not logged in')
      );
      return;
    }
    const loginContext = loginContextUnch;

    if (bias.parsed === undefined) {
      setError(new DisplayableError('client', 'create instructor', 'bias is not a number'));
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
      setError(new DisplayableError('connectivity', 'create instructor'));
      setLoading(false);
      return;
    }

    if (!response.ok) {
      setError(chooseErrorFromStatus(response.status, 'create instructor'));
      setLoading(false);
      return;
    }

    const body = await response.json();
    onCreated({
      uid: body.uid,
      name: body.name,
      bias: body.bias,
      flags: body.flags,
      picture: null,
      createdAt: new Date(body.created_at * 1000),
    });
    setName('');
    setBias({ str: '0.00', parsed: 0 });
    setLoading(false);
  }, [onCreated, name, bias, loginContextRaw]);

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
        {error && <BoxError error={error} />}
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
