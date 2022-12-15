import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { Instructor } from './Instructor';
import iconStyles from '../crud/icons.module.css';
import { IconButton } from '../../shared/forms/IconButton';
import { TextInput } from '../../shared/forms/TextInput';
import styles from './InstructorBlock.module.css';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { CrudFormElement } from '../crud/CrudFormElement';
import { OsehImage } from '../../shared/OsehImage';
import {
  FileUploadHandler,
  parseUploadInfoFromResponse,
} from '../../shared/upload/FileUploadHandler';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { keyMap } from './Instructors';
import { Checkbox } from '../../shared/forms/Checkbox';

type InstructorBlockProps = {
  instructor: Instructor;
  setInstructor: (this: void, instructor: Instructor) => void;
};

export const InstructorBlock = ({
  instructor,
  setInstructor,
}: InstructorBlockProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(instructor.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);
  const [newPicture, setNewPicture] = useState<File | null>(null);
  const [uploadHandler, setUploadHandler] = useState<ReactElement | null>(null);
  const [newDeleted, setNewDeleted] = useState(instructor.deletedAt !== null);

  const save = useCallback(async () => {
    setError(null);
    if (
      newName === instructor.name &&
      newPicture === null &&
      newDeleted === (instructor.deletedAt !== null)
    ) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      if (newName !== instructor.name) {
        const response = await apiFetch(
          `/api/1/instructors/${instructor.uid}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              name: newName,
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

      if (newPicture !== null) {
        const response = await apiFetch(
          '/api/1/instructors/pictures/',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              uid: instructor.uid,
              file_size: newPicture.size,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          setError(await describeErrorFromResponse(response));
          return;
        }
        const data = await response.json();
        await new Promise<void>((resolve) => {
          const handler = (
            <FileUploadHandler
              file={newPicture}
              uploadInfo={parseUploadInfoFromResponse(data)}
              onComplete={resolve}
            />
          );

          setUploadHandler(handler);
        });

        let found = false;
        for (let i = 0; i < 30; i++) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1000));
          const response = await apiFetch(
            '/api/1/instructors/search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                filters: {
                  uid: {
                    operator: 'eq',
                    value: instructor.uid,
                  },
                },
              }),
            },
            loginContext
          );

          if (!response.ok) {
            setError(await describeErrorFromResponse(response));
            return;
          }

          const searchData = await response.json();
          if (searchData.items.length !== 1) {
            setError(<>The instructor was deleted during the request.</>);
            return;
          }

          const newInstructor = convertUsingKeymap<Instructor>(searchData.items[0], keyMap);
          if (
            newInstructor.picture !== null &&
            (instructor.picture === null || newInstructor.picture.uid !== instructor.picture.uid)
          ) {
            setInstructor(newInstructor);
            found = true;
            break;
          }
        }

        if (!found) {
          setError(
            <>
              Picture is taking longer than expected to process. You will need to refresh manually
              or contact support.
            </>
          );
          return;
        }

        setNewPicture(null);
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
      setUploadHandler(null);
      setSaving(false);
    }
  }, [newName, instructor, loginContext, setInstructor, newPicture, newDeleted]);

  useEffect(() => {
    if (saving) {
      return;
    }

    setNewName(instructor.name);
    setNewDeleted(instructor.deletedAt !== null);
    setNewPicture(null);
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
            html5Validation={{ required: '' }}
          />
          <CrudFormElement title="Picture">
            <div className={styles.editPictureContainer}>
              {instructor.picture === null && newPicture === null ? (
                <p>No picture</p>
              ) : newPicture === null ? (
                <OsehImage
                  uid={instructor.picture!.uid}
                  jwt={instructor.picture!.jwt}
                  displayWidth={60}
                  displayHeight={60}
                  alt={'Instructor'}
                />
              ) : (
                <img src={URL.createObjectURL(newPicture)} width={60} height={60} alt="New" />
              )}
              {uploadHandler}
              <input
                className={styles.editPictureInput}
                type="file"
                accept="image/png, image/jpeg, image/svg"
                name="picture"
                onChange={(e) => {
                  if (e.target.files !== null && e.target.files.length > 0) {
                    setNewPicture(e.target.files[0]);
                  } else {
                    setNewPicture(null);
                  }
                }}></input>
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
                    alt={'Square'}
                  />
                </div>
                <div className={styles.circlePictureContainer}>
                  <OsehImage
                    uid={instructor.picture.uid}
                    jwt={instructor.picture.jwt}
                    displayWidth={60}
                    displayHeight={60}
                    alt={'Circular'}
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
