import { ChangeEvent, Dispatch, ReactElement, SetStateAction, useCallback, useEffect } from 'react';
import { Button } from '../../../shared/forms/Button';
import { TextInput } from '../../../shared/forms/TextInput';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { AdminJourneyPrompt } from './AdminJourneyPrompt';
import styles from './AdminJourneyPromptPicker.module.css';

type AdminJourneyPromptPickerProps = {
  /**
   * The current prompt they have selected. Can start with the exported 'defaultPrompt'
   */
  prompt: AdminJourneyPrompt;

  /**
   * Used to update the prompt when the user changes their selection
   */
  setPrompt: Dispatch<SetStateAction<AdminJourneyPrompt>>;

  /**
   * If provided, we use this to set if the prompt is valid or not
   * when it changes.
   */
  setPromptValid?: Dispatch<SetStateAction<boolean>> | null;
};

/**
 * The default prompt to use when the user has not selected a prompt yet
 */
export const defaultPrompt: AdminJourneyPrompt = {
  style: 'numeric',
  text: 'How are you feeling?',
  min: 1,
  max: 10,
  step: 1,
};

const defaultColors = [
  '#cc0001',
  '#fb940b',
  '#ffff01',
  '#01cc00',
  '#03c0c6',
  '#0000fe',
  '#762ca7',
  '#fe98bf',
];

const defaultWords = ['Pretty Anxious', 'Weirdly Okay', 'Doing Great'];
/**
 * Shows the necessary crud components for a user to select a prompt,
 * including options based on the prompt style.
 */
export const AdminJourneyPromptPicker = ({
  prompt,
  setPrompt,
  setPromptValid = null,
}: AdminJourneyPromptPickerProps): ReactElement => {
  const setStyle = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newStyle = e.target.value as AdminJourneyPrompt['style'];
      if (prompt.style === newStyle) {
        return;
      }

      if (newStyle === 'numeric') {
        setPrompt({
          style: 'numeric',
          text: 'How are you feeling?',
          min: 1,
          max: 10,
          step: 1,
        });
      } else if (newStyle === 'word') {
        setPrompt({
          style: 'word',
          text: 'How are you feeling?',
          options: [],
        });
      } else if (newStyle === 'color') {
        setPrompt({
          style: 'color',
          text: 'What color are you feeling?',
          colors: [],
        });
      } else {
        setPrompt({
          style: 'press',
          text: 'Press and hold',
        });
      }
    },
    [prompt.style, setPrompt]
  );

  useEffect(() => {
    if (setPromptValid === null) {
      return;
    }

    if (prompt.text.length < 1 || prompt.text.length > 45) {
      setPromptValid(false);
      return;
    }

    if (prompt.style === 'numeric') {
      setPromptValid(
        !isNaN(prompt.min) &&
          !isNaN(prompt.max) &&
          prompt.min <= prompt.max &&
          prompt.max - prompt.min < 10
      );
    } else if (prompt.style === 'word') {
      setPromptValid(
        prompt.options.length > 1 &&
          prompt.options.length <= 8 &&
          !prompt.options.some((o) => o.length < 1 || o.length > 32) &&
          new Set(prompt.options).size === prompt.options.length
      );
    } else if (prompt.style === 'color') {
      setPromptValid(
        prompt.colors.length > 1 &&
          prompt.colors.length <= 8 &&
          !prompt.colors.some(
            (o) => o.length !== 7 || o[0] !== '#' || !/^[0-9a-fA-F]+$/.test(o.substring(1))
          ) &&
          new Set(prompt.colors).size === prompt.colors.length
      );
    } else {
      setPromptValid(true);
    }
  }, [prompt, setPromptValid]);

  return (
    <div className={styles.container}>
      <CrudFormElement title="Style">
        <select className={styles.select} value={prompt.style} onChange={setStyle}>
          <option value="numeric">Numeric</option>
          <option value="word">Word</option>
          <option value="color">Color</option>
          <option value="press">Press</option>
        </select>
      </CrudFormElement>

      <TextInput
        label="Prompt"
        value={prompt.text}
        help="The question"
        disabled={false}
        inputStyle="normal"
        onChange={(v) => setPrompt((p) => ({ ...p, text: v }))}
        html5Validation={{ required: true }}
      />

      {prompt.style === 'numeric' && (
        <>
          <TextInput
            label="Min"
            value={isNaN(prompt.min) ? '' : prompt.min.toString()}
            help="The minimum response, inclusive"
            disabled={false}
            inputStyle="normal"
            onChange={(v) => setPrompt((p) => ({ ...p, min: v === '' ? NaN : parseInt(v, 10) }))}
            html5Validation={{ required: true }}
            type="number"
          />
          <TextInput
            label="Max"
            value={isNaN(prompt.max) ? '' : prompt.max.toString()}
            help="The maximum response, inclusive"
            disabled={false}
            inputStyle="normal"
            onChange={(v) => setPrompt((p) => ({ ...p, max: v === '' ? NaN : parseInt(v, 10) }))}
            html5Validation={{ required: true }}
            type="number"
          />

          <CrudFormElement title="Step">{prompt.step.toLocaleString()}</CrudFormElement>
        </>
      )}

      {prompt.style === 'word' && (
        <CrudFormElement title="Options">
          <div className={styles.optionsContainer}>
            <div className={styles.options}>
              {prompt.options.map((option, i) => (
                <div key={i} className={styles.option}>
                  <TextInput
                    label="Option"
                    value={option}
                    help={null}
                    disabled={false}
                    inputStyle="normal"
                    onChange={(v) => {
                      setPrompt((p) => {
                        if (p.style !== 'word') {
                          return p;
                        }

                        const newOptions = [...p.options];
                        newOptions[i] = v;
                        return { ...p, options: newOptions };
                      });
                    }}
                    html5Validation={{ required: true, maxLength: 32 }}
                  />

                  <div className={styles.removeOptionContainer}>
                    <Button
                      type="button"
                      variant="link-small"
                      onClick={() => {
                        setPrompt((p) => {
                          if (p.style !== 'word') {
                            return p;
                          }

                          const newOptions = [...p.options];
                          newOptions.splice(i, 1);
                          return { ...p, options: newOptions };
                        });
                      }}>
                      Clear
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {prompt.options.length < 8 && (
              <div className={styles.addOptionContainer}>
                <Button
                  type="button"
                  variant={prompt.options.length < 2 ? 'filled' : 'outlined'}
                  onClick={() => {
                    setPrompt((p) => {
                      if (p.style !== 'word') {
                        return p;
                      }

                      return {
                        ...p,
                        options: [...p.options, defaultWords[p.options.length] ?? ''],
                      };
                    });
                  }}>
                  Add Option
                </Button>
              </div>
            )}
          </div>
        </CrudFormElement>
      )}

      {prompt.style === 'color' && (
        <CrudFormElement title="Colors">
          <div className={styles.optionsContainer}>
            <div className={styles.options}>
              {prompt.colors.map((color, i) => (
                <div key={i} className={styles.option}>
                  <TextInput
                    label="Color"
                    value={color}
                    help="Hex, e.g., #c2c2c2"
                    disabled={false}
                    inputStyle="normal"
                    onChange={(v) => {
                      setPrompt((p) => {
                        if (p.style !== 'color') {
                          return p;
                        }

                        const newColors = [...p.colors];
                        newColors[i] = v;
                        return { ...p, colors: newColors };
                      });
                    }}
                    html5Validation={{ required: true }}
                  />

                  {color.length === 7 &&
                  color[0] === '#' &&
                  /^[0-9a-fA-F]+$/.test(color.substring(1)) ? (
                    <div className={styles.colorPreview} style={{ backgroundColor: color }} />
                  ) : null}

                  <div className={styles.removeOptionContainer}>
                    <Button
                      type="button"
                      variant="link-small"
                      onClick={() => {
                        setPrompt((p) => {
                          if (p.style !== 'color') {
                            return p;
                          }

                          const newColors = [...p.colors];
                          newColors.splice(i, 1);
                          return { ...p, colors: newColors };
                        });
                      }}>
                      Clear
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {prompt.colors.length < 8 && (
              <div className={styles.addOptionContainer}>
                <Button
                  type="button"
                  variant={prompt.colors.length < 2 ? 'filled' : 'outlined'}
                  onClick={() => {
                    setPrompt((p) => {
                      if (p.style !== 'color') {
                        return p;
                      }

                      return { ...p, colors: [...p.colors, defaultColors[p.colors.length]] };
                    });
                  }}>
                  Add Color
                </Button>
              </div>
            )}
          </div>
        </CrudFormElement>
      )}
    </div>
  );
};
