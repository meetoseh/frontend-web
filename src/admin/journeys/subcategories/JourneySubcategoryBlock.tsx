import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { JourneySubcategory } from './JourneySubcategory';
import styles from './JourneySubcategoryBlock.module.css';
import iconStyles from '../../crud/icons.module.css';
import { TextInput } from '../../../shared/forms/TextInput';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../crud/CrudFetcher';
import { keyMap } from './JourneySubcategories';
import { BoxError, chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

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
  const loginContextRaw = useContext(LoginContext);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<DisplayableError | null>(null);
  const [newInternalName, setNewInternalName] = useState(journeySubcategory.internalName);
  const [newExternalName, setNewExternalName] = useState(journeySubcategory.externalName);
  const [newBias, setNewBias] = useState<{ str: string; num: number | undefined }>({
    str: journeySubcategory.bias.toString(),
    num: journeySubcategory.bias,
  });

  const save = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setError(
        new DisplayableError('server-refresh-required', 'save journey subcategory', 'not logged in')
      );
      return;
    }
    const loginContext = loginContextUnch;

    if (
      newInternalName === journeySubcategory.internalName &&
      newExternalName === journeySubcategory.externalName &&
      newBias.num === journeySubcategory.bias
    ) {
      setError(null);
      setEditing(false);
      return;
    }

    if (newBias.num === undefined) {
      setError(new DisplayableError('client', 'save journey subcategory', 'bias is not a number'));
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
              bias: newBias.num,
            }),
          },
          loginContext
        );
      } catch {
        throw new DisplayableError('connectivity', 'save journey subcategory');
      }

      if (!response.ok) {
        throw chooseErrorFromStatus(response.status, 'save journey subcategory');
      }

      const updatedJourneySubcategory = convertUsingKeymap(await response.json(), keyMap);
      setJourneySubcategory({ ...journeySubcategory, ...updatedJourneySubcategory });
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof DisplayableError
          ? e
          : new DisplayableError('client', 'save journey subcategory', `${e}`)
      );
    } finally {
      setSaving(false);
    }
  }, [
    newInternalName,
    newExternalName,
    newBias,
    journeySubcategory,
    loginContextRaw,
    setJourneySubcategory,
  ]);

  useEffect(() => {
    if (!editing) {
      setNewInternalName(journeySubcategory.internalName);
      setNewExternalName(journeySubcategory.externalName);
      setNewBias({ str: journeySubcategory.bias.toString(), num: journeySubcategory.bias });
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
          <TextInput
            label="Bias"
            value={newBias.str}
            help="A non-negative number generally less than one which influences content selection towards this subcategory. Higher numbers are more influential."
            disabled={false}
            inputStyle="normal"
            onChange={(bias) => {
              try {
                const parsed = parseFloat(bias);
                if (isNaN(parsed)) {
                  setNewBias({ str: bias, num: undefined });
                } else {
                  setNewBias({ str: bias, num: parsed });
                }
              } catch (e) {
                setNewBias({ str: bias, num: undefined });
              }
            }}
            html5Validation={{ required: true, min: 0, step: 0.01 }}
            type="number"
          />
          {error && <BoxError error={error} />}

          <button type="submit" disabled={saving} hidden>
            Save
          </button>
        </form>
      ) : (
        <>
          <CrudFormElement title="External Name">{journeySubcategory.externalName}</CrudFormElement>
          <CrudFormElement title="Bias">{journeySubcategory.bias.toLocaleString()}</CrudFormElement>
        </>
      )}
    </CrudItemBlock>
  );
};
