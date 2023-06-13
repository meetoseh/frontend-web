import { ReactElement, useCallback, useContext, useState } from 'react';
import { CrudCreateBlock } from '../../crud/CrudCreateBlock';
import { JourneySubcategory } from './JourneySubcategory';
import styles from './CreateJourneySubcategory.module.css';
import { TextInput } from '../../../shared/forms/TextInput';
import { Button } from '../../../shared/forms/Button';
import { describeErrorFromResponse, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/LoginContext';
import { convertUsingKeymap } from '../../crud/CrudFetcher';
import { keyMap } from './JourneySubcategories';

type CreateJourneySubcategoryProps = {
  /**
   * The callback for after we've successfully created a journey subcategory
   */
  onCreated: (this: void, journeySubcategory: JourneySubcategory) => void;
};

/**
 * The component for creating a journey subcategories
 */
export const CreateJourneySubcategory = ({
  onCreated,
}: CreateJourneySubcategoryProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [internalName, setInternalName] = useState('');
  const [externalName, setExternalName] = useState('');
  const [bias, setBias] = useState<{ str: string; num: number | undefined }>({
    str: '0.00',
    num: 0,
  });
  const [error, setError] = useState<ReactElement | null>();
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (bias.num === undefined) {
      setError(<>Bias must be a number.</>);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let response: Response;
      try {
        response = await apiFetch(
          '/api/1/journeys/subcategories/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              internal_name: internalName,
              external_name: externalName,
              bias: bias.num,
            }),
          },
          loginContext
        );
      } catch (e) {
        console.error(e);
        setError(<>Could not connect to server. Check your internet connection.</>);
        return;
      }

      if (!response.ok) {
        setError(await describeErrorFromResponse(response));
        return;
      }

      const data = await response.json();
      const subcat = convertUsingKeymap(data, keyMap);
      onCreated(subcat);
      setInternalName('');
      setExternalName('');
      setBias({ str: '0.00', num: 0 });
    } finally {
      setSaving(false);
    }
  }, [internalName, externalName, loginContext, bias, onCreated]);

  return (
    <CrudCreateBlock>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}>
        <TextInput
          label="Internal Name"
          value={internalName}
          help="More specific, not shown to users"
          disabled={saving}
          inputStyle="normal"
          onChange={setInternalName}
          html5Validation={{ required: true }}
        />
        <TextInput
          label="External Name"
          value={externalName}
          help="Shown on journey cards"
          disabled={saving}
          inputStyle="normal"
          onChange={setExternalName}
          html5Validation={{ required: true }}
        />
        <TextInput
          label="Bias"
          value={bias.str}
          help="A non-negative number generally less than one which influences content selection towards this subcategory. Higher numbers are more influential."
          disabled={false}
          inputStyle="normal"
          onChange={(bias) => {
            try {
              const parsed = parseFloat(bias);
              if (isNaN(parsed)) {
                setBias({ str: bias, num: undefined });
              } else {
                setBias({ str: bias, num: parsed });
              }
            } catch (e) {
              setBias({ str: bias, num: undefined });
            }
          }}
          html5Validation={{ required: true, min: 0, step: 0.01 }}
          type="number"
        />
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <div className={styles.submitContainer}>
          <Button disabled={saving} type="submit">
            Create
          </Button>
        </div>
      </form>
    </CrudCreateBlock>
  );
};
