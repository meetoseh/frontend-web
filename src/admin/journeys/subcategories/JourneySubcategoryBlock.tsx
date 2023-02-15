import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { JourneySubcategory } from './JourneySubcategory';
import styles from './JourneySubcategoryBlock.module.css';
import iconStyles from '../../crud/icons.module.css';
import { TextInput } from '../../../shared/forms/TextInput';
import { LoginContext } from '../../../shared/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { describeErrorFromResponse, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { convertUsingKeymap } from '../../crud/CrudFetcher';
import { keyMap } from './JourneySubcategories';

type JourneySubcategoryBlockProps = {
  /**
   * The journey subcategory to display
   */
  journeySubcategory: JourneySubcategory;

  /**
   * The callback to use to update the journey subcategory visually after a
   * change has been confirmed with the server
   */
  setJourneySubcategory: (journeySubcategory: JourneySubcategory) => void;
};

export const JourneySubcategoryBlock = ({
  journeySubcategory,
  setJourneySubcategory,
}: JourneySubcategoryBlockProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);
  const [newInternalName, setNewInternalName] = useState(journeySubcategory.internalName);
  const [newExternalName, setNewExternalName] = useState(journeySubcategory.externalName);

  const save = useCallback(async () => {
    if (
      newInternalName === journeySubcategory.internalName &&
      newExternalName === journeySubcategory.externalName
    ) {
      setError(null);
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let response: Response;
      try {
        response = await apiFetch(
          `/api/1/journeys/subcategories/${journeySubcategory.uid}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              internal_name: newInternalName,
              external_name: newExternalName,
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

      const updatedJourneySubcategory = convertUsingKeymap(await response.json(), keyMap);
      setJourneySubcategory({ ...journeySubcategory, ...updatedJourneySubcategory });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [newInternalName, newExternalName, journeySubcategory, loginContext, setJourneySubcategory]);

  useEffect(() => {
    if (!editing) {
      setNewInternalName(journeySubcategory.internalName);
      setNewExternalName(journeySubcategory.externalName);
    }
  }, [editing, journeySubcategory]);

  return (
    <CrudItemBlock
      title={journeySubcategory.internalName}
      controls={
        <>
          <IconButton
            icon={editing ? iconStyles.check : iconStyles.pencil}
            srOnlyName={editing ? 'Save' : 'Edit'}
            disabled={saving}
            onClick={() => {
              if (editing) {
                save();
              } else {
                setEditing(true);
              }
            }}
          />
        </>
      }>
      {editing ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}>
          <TextInput
            label="Internal Name"
            value={newInternalName}
            onChange={setNewInternalName}
            disabled={saving}
            help={null}
            inputStyle={'normal'}
            html5Validation={{ required: true }}
          />
          <TextInput
            label="External Name"
            value={newExternalName}
            onChange={setNewExternalName}
            disabled={saving}
            help={null}
            inputStyle={'normal'}
            html5Validation={{ required: true }}
          />

          {error && <ErrorBlock>{error}</ErrorBlock>}

          <button type="submit" disabled={saving} hidden>
            Save
          </button>
        </form>
      ) : (
        <>
          <CrudFormElement title="External Name">{journeySubcategory.externalName}</CrudFormElement>
        </>
      )}
    </CrudItemBlock>
  );
};
