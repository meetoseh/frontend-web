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
  const [error, setError] = useState<ReactElement | null>();
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
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
    } finally {
      setSaving(false);
    }
  }, [internalName, externalName, loginContext, onCreated]);

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
