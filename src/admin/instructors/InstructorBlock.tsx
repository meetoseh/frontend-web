import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { Instructor } from './Instructor';
import iconStyles from '../crud/icons.module.css';
import { IconButton } from '../../shared/forms/IconButton';
import { TextInput } from '../../shared/forms/TextInput';
import styles from './InstructorBlock.module.css';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { CrudFormElement } from '../crud/CrudFormElement';
import { OsehImage } from '../../shared/images/OsehImage';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { keyMap } from './Instructors';
import { Checkbox } from '../../shared/forms/Checkbox';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { Button } from '../../shared/forms/Button';
import { showUploader } from '../../shared/upload/uploader/showUploader';
import { createUploadPoller } from '../../shared/upload/uploader/createUploadPoller';

type InstructorBlockProps = {
  instructor: Instructor;
  setInstructor: (this: void, instructor: Instructor) => void;
  imageHandler: OsehImageStateRequestHandler;
};

export const InstructorBlock = ({
  instructor,
  setInstructor,
  imageHandler,
}: InstructorBlockProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(instructor.name);
  const [newBias, setNewBias] = useState<{ str: string; parsed: number | undefined }>({
    str: instructor.bias.toString(),
    parsed: instructor.bias,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);
  const [newDeleted, setNewDeleted] = useState(instructor.deletedAt !== null);

  const save = useCallback(async () => {
    setError(null);
    if (
      newName === instructor.name &&
      newBias.parsed === instructor.bias &&
      newDeleted === (instructor.deletedAt !== null)
    ) {
      setEditing(false);
      return;
    }
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    if (newBias.parsed === undefined) {
      setError(<>Bias must be a number</>);
      return;
    }

    setSaving(true);
    try {
      if (newName !== instructor.name || newBias.parsed !== instructor.bias) {
        const response = await apiFetch(
          `/api/1/instructors/${instructor.uid}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              name: newName,
              bias: newBias.parsed,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          setError(await describeErrorFromResponse(response));
          return;
        }

        const data = await response.json();
        setInstructor(Object.assign({}, instructor, data));
      }

      if (newDeleted !== (instructor.deletedAt !== null)) {
        let response: Response;
        try {
          if (newDeleted) {
            response = await apiFetch(
              `/api/1/instructors/${instructor.uid}`,
              {
                method: 'DELETE',
              },
              loginContext
            );
          } else {
            response = await apiFetch(
              `/api/1/instructors/${instructor.uid}/undelete`,
              {
                method: 'POST',
              },
              loginContext
            );
          }
        } catch (e) {
          setError(<>Failed to connect to server. Check your internet connection</>);
          return;
        }

        if (!response.ok) {
          setError(await describeErrorFromResponse(response));
          return;
        }

        if (newDeleted) {
          const data = await response.json();
          setInstructor(Object.assign({}, instructor, convertUsingKeymap(data, keyMap)));
        } else {
          setInstructor(Object.assign({}, instructor, { deletedAt: null }));
        }
      }

      setEditing(false);
    } catch (e) {
      setError(<>Failed to connect to server. Check your internet connection</>);
    } finally {
      setSaving(false);
    }
  }, [newName, instructor, loginContextRaw, setInstructor, newDeleted, newBias]);

  useEffect(() => {
    if (saving) {
      return;
    }

    setNewName(instructor.name);
    setNewBias({ parsed: instructor.bias, str: instructor.bias.toString() });
    setNewDeleted(instructor.deletedAt !== null);
  }, [instructor, saving]);

  return (
    <CrudItemBlock
      title={instructor.name}
      controls={
        <>
          <IconButton
            icon={editing ? iconStyles.check : iconStyles.pencil}
            srOnlyName={editing ? 'Save' : 'Edit'}
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
            label="Name"
            value={newName}
            onChange={setNewName}
            help="Display name for journey cards"
            disabled={false}
            inputStyle="normal"
            html5Validation={{ required: true }}
          />
          <TextInput
            label="Bias"
            value={newBias.str}
            help="A non-negative number generally less than one which influences content selection towards this instructor. Higher numbers are more influential."
            disabled={false}
            inputStyle="normal"
            onChange={(bias) => {
              try {
                const parsed = parseFloat(bias);
                if (isNaN(parsed)) {
                  setNewBias({ str: bias, parsed: undefined });
                } else {
                  setNewBias({ str: bias, parsed });
                }
              } catch (e) {
                setNewBias({ str: bias, parsed: undefined });
              }
            }}
            html5Validation={{ required: true, min: 0, step: 0.01 }}
            type="number"
          />
          <CrudFormElement title="Picture">
            <div className={styles.editPictureContainer}>
              {instructor.picture === null ? (
                <p>No picture</p>
              ) : (
                <OsehImage
                  uid={instructor.picture!.uid}
                  jwt={instructor.picture!.jwt}
                  displayWidth={60}
                  displayHeight={60}
                  alt="Instructor"
                  handler={imageHandler}
                />
              )}
              <Button
                type="button"
                variant="outlined"
                onClick={async (e) => {
                  e.preventDefault();
                  const newInstructor = await showUploader({
                    modals: modalContext.modals,
                    content: {
                      description: (
                        <>
                          <p>
                            Choose the new profile image for {instructor.name}.{' '}
                            <em>This change will take place immediately.</em>
                          </p>
                          <p>
                            Currently, these images are exported at various sizes between 38x38 and
                            512x512. At least 512x512 is recommended, but 90x90 is the minimum
                            accepted.
                          </p>
                        </>
                      ),
                      startEndpoint: {
                        type: 'path',
                        path: '/api/1/instructors/pictures/',
                        additionalBodyParameters: { uid: instructor.uid },
                      },
                      accept: 'image/*',
                      poller: createUploadPoller(
                        '/api/1/instructors/search',
                        keyMap,
                        loginContextRaw,
                        {
                          sha512Key: null,
                          additionalFilters: { uid: { operator: 'eq', value: instructor.uid } },
                          predicate: (item) => item.picture?.uid !== instructor.picture?.uid,
                        }
                      ),
                    },
                  }).promise;
                  if (newInstructor !== undefined) {
                    setInstructor(newInstructor);
                  }
                }}>
                Change
              </Button>
            </div>
          </CrudFormElement>
          <Checkbox label="Deleted" value={newDeleted} setValue={setNewDeleted} disabled={false} />
          {error && <ErrorBlock>{error}</ErrorBlock>}
          <button type="button" onClick={save} disabled={saving} hidden>
            Save
          </button>
        </form>
      ) : (
        <>
          {instructor.deletedAt !== null ? (
            <div className={styles.deletedAtContainer}>
              <CrudFormElement title="Deleted At">
                {instructor.deletedAt.toLocaleString()}
              </CrudFormElement>
            </div>
          ) : null}
          <CrudFormElement title="Bias">{instructor.bias.toLocaleString()}</CrudFormElement>
          <CrudFormElement title="Picture">
            {instructor.picture === null ? (
              <p>No picture</p>
            ) : (
              <div className={styles.picturesContainer}>
                <div className={styles.squarePictureContainer}>
                  <OsehImage
                    uid={instructor.picture.uid}
                    jwt={instructor.picture.jwt}
                    displayWidth={60}
                    displayHeight={60}
                    alt="Square"
                    handler={imageHandler}
                  />
                </div>
                <div className={styles.circlePictureContainer}>
                  <OsehImage
                    uid={instructor.picture.uid}
                    jwt={instructor.picture.jwt}
                    displayWidth={60}
                    displayHeight={60}
                    alt="Circular"
                    handler={imageHandler}
                  />
                </div>
              </div>
            )}
          </CrudFormElement>
        </>
      )}
    </CrudItemBlock>
  );
};
