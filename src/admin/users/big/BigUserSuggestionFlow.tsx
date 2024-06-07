import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../User';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import styles from './BigUserSuggestionFlow.module.css';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { DashboardTable, DashboardTableProps } from '../../dashboard/subComponents/DashboardTable';
import { Button } from '../../../shared/forms/Button';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/contexts/ModalContext';
import { ModalWrapper } from '../../../shared/ModalWrapper';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { Checkbox } from '../../../shared/forms/Checkbox';
import { setVWC } from '../../../shared/lib/setVWC';

type Instructor = {
  uid: string;
  name: string;
  bias: number;
};

type Category = {
  uid: string;
  internal_name: string;
  bias: number;
};

type Combination = {
  instructor: Instructor;
  category: Category;
};

type FindCombinationsResponse = {
  combinations: Combination[];
  computation_time: number;
};

type ViewCountItem = Combination & { view_count: number };

type ViewCountResponse = {
  rows: ViewCountItem[];
  computation_time: number;
};

type Feedback = {
  feedback_uid: string;
  journey_uid: string;
  journey_title: string;
  instructor_uid: string;
  instructor_name: string;
  category_uid: string;
  category_internal_name: string;
  feedback_at: number;
  feedback_version: number;
  feedback_response: number;
};

type FeedbackTerm = {
  feedback: Feedback;
  age_term: number;
  category_relevance_term: number;
  instructor_relevance_term: number;
  net_score_scale: number;
  net_score: number;
};

type FeedbackScore = {
  score: number;
  terms: FeedbackTerm[];
  terms_sum: number;
  instructor_bias: number;
  category_bias: number;
  bias_sum: number;
};

type FeedbackItem = Combination & { feedback_score: FeedbackScore };

type FeedbackResponse = {
  rows: FeedbackItem[];
  computation_time: number;
};

type AdjustedScoreItem = Combination & { times_seen_recently: number; score: number };

type AdjustedScoreResponse = {
  rows: AdjustedScoreItem[];
  computation_time: number;
};

type BestCategoryItem = Combination & { ties_with_next: boolean };

type BestCategoriesResponse = {
  rows: BestCategoryItem[];
  computation_time: number;
};

type BestJourneyItem = {
  journey_uid: string;
  journey_title: string;
  journey_created_at: number;
  user_views: number;
};

type BestJourneysResponse = {
  rows: BestJourneyItem[];
  computation_time: number;
};

type AnalyzeResponse = {
  find_combinations: FindCombinationsResponse;
  find_lowest_view_counts: ViewCountResponse;
  find_feedback_score: FeedbackResponse;
  find_adjusted_scores: AdjustedScoreResponse;
  find_best_categories: BestCategoriesResponse;
  find_best_journeys: BestJourneysResponse;
};

/**
 * Allows for deep inspection on the content personalization system for the user with
 * the given sub.
 */
export const BigUserSuggestionFlow = ({ user }: { user: User }): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [error, setError] = useState<ReactElement | null>(null);
  const [emotions, setEmotions] = useState<string[]>(() => ['calm']);
  const [emotion, setEmotion] = useState('calm');
  const [analyzeResponse, setAnalyzeResponse] = useState<AnalyzeResponse | null>(null);
  const [inspectingFeedbackScore, setInspectingFeedbackScore] = useState<FeedbackScore | null>(
    null
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback((loginContextUnch) => {
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      let active = true;
      fetchEmotions();
      return () => {
        active = false;
      };

      async function fetchEmotionsInner() {
        const response = await apiFetch(
          '/api/1/emotions/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              sort: [
                {
                  key: 'word',
                  dir: 'asc',
                  before: null,
                  after: null,
                },
              ],
              limit: 1000,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data: { items: { word: string }[] } = await response.json();
        if (active) {
          setEmotions(data.items.map((item) => item.word));
        }
      }

      async function fetchEmotions() {
        try {
          await fetchEmotionsInner();
        } catch (e) {
          console.log('failed to fetch emotions: ', e);
        }
      }
    }, [])
  );

  const premiumVWC = useWritableValueWithCallbacks<boolean>(() => false);

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, premiumVWC],
    useCallback(() => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;
      const premium = premiumVWC.get();

      let active = true;
      analyze();
      return () => {
        active = false;
      };

      async function analyzeInner() {
        const response = await apiFetch(
          `/api/1/personalization/analyze?emotion=${encodeURIComponent(
            emotion
          )}&user_sub=${encodeURIComponent(user.sub)}&premium=${premium}`,
          { method: 'GET' },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        const data: AnalyzeResponse = await response.json();
        if (active) {
          setAnalyzeResponse(data);
        }
      }

      async function analyze() {
        setError(null);
        try {
          await analyzeInner();
        } catch (e) {
          const err = await describeError(e);
          if (active) {
            setError(err);
            setAnalyzeResponse(null);
          }
        }
      }
    }, [user.sub, emotion, loginContextRaw.value, premiumVWC])
  );

  const instructorCategories = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Instructor Bias', 'Category Bias'],
      rows:
        analyzeResponse === null
          ? []
          : analyzeResponse.find_combinations.combinations.map(({ instructor, category }) => [
              instructor.name,
              category.internal_name,
              instructor.bias.toLocaleString(),
              category.bias.toLocaleString(),
            ]),
    }),
    [analyzeResponse]
  );

  const instructorCategoryCounts = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Lowest View Count'],
      rows:
        analyzeResponse === null
          ? []
          : analyzeResponse.find_lowest_view_counts.rows.map(
              ({ instructor, category, view_count }) => [
                instructor.name,
                category.internal_name,
                view_count.toLocaleString(),
              ]
            ),
    }),
    [analyzeResponse]
  );

  const instructorCategoryScores = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Score', 'View Breakdown'],
      rows:
        analyzeResponse === null
          ? []
          : analyzeResponse.find_feedback_score.rows.map(
              ({ instructor, category, feedback_score }) => [
                instructor.name,
                category.internal_name,
                feedback_score.score.toLocaleString(),
                {
                  csv: 'NA',
                  display: (
                    <Button
                      type="button"
                      variant="link-small"
                      onClick={(e) => {
                        e.preventDefault();
                        setInspectingFeedbackScore(feedback_score);
                      }}>
                      View
                    </Button>
                  ),
                },
              ]
            ),
    }),
    [analyzeResponse]
  );

  const instructorCategoryAdjScores = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Adj. Score'],
      rows:
        analyzeResponse === null
          ? []
          : analyzeResponse.find_adjusted_scores.rows.map(({ instructor, category, score }) => [
              instructor.name,
              category.internal_name,
              score.toLocaleString(),
            ]),
    }),
    [analyzeResponse]
  );

  const instructorTimesSeenToday = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Times Seen Recently'],
      rows:
        analyzeResponse === null
          ? []
          : (() => {
              const seen = new Set<string>();
              const result: [string, string][] = [];
              const rows = analyzeResponse.find_adjusted_scores.rows;
              for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (seen.has(row.instructor.uid)) {
                  continue;
                }
                seen.add(row.instructor.uid);
                result.push([row.instructor.name, row.times_seen_recently.toLocaleString()]);
              }
              return result;
            })(),
    }),
    [analyzeResponse]
  );

  const sortedInstructorCategories = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Lowest View Count', 'Adj. Score'],
      rows:
        analyzeResponse === null
          ? []
          : analyzeResponse.find_best_categories.rows.map(({ instructor, category }) => [
              instructor.name,
              category.internal_name,
              analyzeResponse.find_lowest_view_counts.rows
                .find(
                  (i) => i.category.uid === category.uid && i.instructor.uid === instructor.uid
                )!
                .view_count.toLocaleString(),
              analyzeResponse.find_adjusted_scores.rows
                .find(
                  (i) => i.category.uid === category.uid && i.instructor.uid === instructor.uid
                )!
                .score.toLocaleString(),
            ]),
    }),
    [analyzeResponse]
  );

  const journeys = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Title', 'Views', 'Created'],
      rows:
        analyzeResponse === null
          ? []
          : analyzeResponse.find_best_journeys.rows.map(
              ({ journey_title, journey_created_at, user_views }) => [
                journey_title,
                user_views.toLocaleString(),
                new Date(journey_created_at * 1000).toLocaleString(),
              ]
            ),
    }),
    [analyzeResponse]
  );

  useEffect(() => {
    if (inspectingFeedbackScore === null) {
      return;
    }

    let total = 0;

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper onClosed={() => setInspectingFeedbackScore(null)}>
        <div className={styles.explanation}>The feedback portion:</div>
        <DashboardTable
          columnHeaders={[
            'Journey Title',
            'Age Term',
            'Category Indicator',
            'Instructor Indicator',
            'Feedback Version',
            'Feedback Response',
            'Summand',
            'Running Total',
          ]}
          rows={inspectingFeedbackScore.terms.map(
            ({
              feedback,
              age_term,
              category_relevance_term,
              instructor_relevance_term,
              net_score,
            }) => [
              feedback.journey_title,
              age_term.toLocaleString(),
              category_relevance_term.toLocaleString(),
              instructor_relevance_term.toLocaleString(),
              feedback.feedback_version.toLocaleString(),
              (() => {
                if (feedback.feedback_version === 1 || feedback.feedback_version === 2) {
                  if (feedback.feedback_response === 1) {
                    return 'Liked';
                  } else if (feedback.feedback_response === 2) {
                    return 'Disliked';
                  } else {
                    return feedback.feedback_response.toLocaleString();
                  }
                } else if (feedback.feedback_version === 3) {
                  return (
                    {
                      1: 'Way more',
                      2: 'More',
                      3: 'Less',
                      4: 'Way less',
                    }[feedback.feedback_response] || feedback.feedback_response.toLocaleString()
                  );
                } else {
                  return feedback.feedback_response.toLocaleString();
                }
              })(),
              net_score.toFixed(4),
              (() => {
                total += net_score;
                return total.toFixed(4);
              })(),
            ]
          )}
        />
        <div className={styles.explanation}>
          Instructor bias: {inspectingFeedbackScore.instructor_bias.toFixed(4)}, Category bias:{' '}
          {inspectingFeedbackScore.category_bias.toFixed(4)}, Total Score:{' '}
          {inspectingFeedbackScore.score.toFixed(4)}
        </div>
      </ModalWrapper>
    );
  }, [modalContext.modals, inspectingFeedbackScore]);

  const identifier =
    user.givenName ?? user.emails[0]?.address ?? user.phones[0]?.number ?? user.sub;

  return (
    <CrudItemBlock title="Content Personalization Inspect Tool" controls={null}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      <div className={styles.explanation}>
        This tool allows deep inspection of how content is surfaced to this user. Currently, users
        are shown a selection of emotions based on how much content we have for each emotion and
        what emotions they've seen recently (stored client-side and reset when the page refreshes).
        After selecting an emotion, however, the journey they are taken to is based on their journey
        feedback. This tool allows you to explore the personalization that occurs after selecting an
        emotion.
      </div>
      <CrudFormElement title="Emotion">
        <select
          value={emotion}
          className={styles.select}
          onChange={(e) => {
            setAnalyzeResponse(null);
            setEmotion(e.target.value);
          }}>
          {emotions.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </CrudFormElement>
      <CrudFormElement title="Premium">
        <RenderGuardedComponent
          props={premiumVWC}
          component={(premium) => (
            <Checkbox
              label="Premium"
              value={premium}
              setValue={(v) => {
                setVWC(premiumVWC, v);
              }}
            />
          )}
        />
      </CrudFormElement>
      <div className={styles.explanation}>
        <h2>Step 1</h2>
        <div className={styles.timing}>
          {analyzeResponse === null
            ? null
            : analyzeResponse.find_combinations.computation_time.toFixed(6)}
          s
        </div>
        The first step is to determine what instructor/category combinations are available within
        this emotion and what fixed bias they have. Note that this step does not depend on the user,
        and thus can be calculated in advance. For {emotion}, we have:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorCategories} />
      </div>
      <div className={styles.explanation}>
        <h2>Step 2</h2>
        <div className={styles.timing}>
          {analyzeResponse === null
            ? null
            : analyzeResponse.find_lowest_view_counts.computation_time.toFixed(6)}
          s
        </div>
        The second step is to determine the journey with the fewest views by this user within each
        instructor/category combination. For example, if there is any journey within "Dylan Werner,
        meditation" tagged {emotion} which the user hasn't seen, this value is 0. If the user has
        seen them all at least 3 times but at least 1 exactly 3 times, this is 3, etc. For{' '}
        {identifier}, this gives:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorCategoryCounts} />
      </div>
      <div className={styles.explanation}>This number is not used until step 5.</div>
      <div className={styles.explanation}>
        <h2>Step 3</h2>
        <div className={styles.timing}>
          {analyzeResponse === null
            ? null
            : analyzeResponse.find_feedback_score.computation_time.toFixed(6)}
          s
        </div>
        The third step is we assign a score for this user to each of these combinations. The score
        is computed as the sum of:
        <ul>
          <li>The category bias</li>
          <li>The instructor bias</li>
          <li>A score produced from the users feedback</li>
        </ul>
        Note that this step doesn't use the view count, and could happen in parallel with the
        previous step. The category and instructor biases are non-negative fixed values that are
        assigned in admin that universally bias content selection towards certain categories and
        instructors. Its value is generally less than 1, so the users ratings will quickly dominate
        the score.
      </div>
      <div className={styles.explanation}>
        Feedback is given per journey, but each journey has both an instructor and a category.
        Hence, a +1 rating for a journey results in both a +1 rating for the category and a +1
        rating for the instructor, which is a +2 rating for the instructor/category combination. The
        computation is as follows, where j<sub>0</sub> is the most recent feedback, and increasing j
        <sub>i</sub> is older feedback, and <code>c(j, i)</code> is an indicator function which is{' '}
        <code>1</code> if feedback <code>i</code> is a category match and <code>0</code> otherwise,
        and <code>I(j, i)</code> is an indicator function which is <code>1</code> if feedback{' '}
        <code>i</code> is an instructor match and <code>0</code> otherwise:
      </div>
      <div className={styles.scoreFunctionContainer}>
        <div className={styles.scoreFunctionIcon}></div>
      </div>
      <div className={styles.explanation}>
        Only the most recent 100 feedback items, or most recent 6 months of feedback (whichever is
        shorter) is considered, to account for changing preferences. Feedback which comes from
        yes/no questions, like "Did you like this?", give a score of +1 for yes and -1 for no.
        Feedback which comes from a 2-point scale, i.e., "Complete the sentence: I want to see...",
        "Much more like this", "More like this", "Less like this", "Much less like this", give
        scores +1, 0, -1, -2 respectively.
      </div>
      <div className={styles.explanation}>These are the scores for {identifier}:</div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorCategoryScores} />
      </div>
      <div className={styles.explanation}>
        <h2>Step 4</h2>
        <div className={styles.timing}>
          {analyzeResponse === null
            ? null
            : analyzeResponse.find_adjusted_scores.computation_time.toFixed(6)}
          s
        </div>
        The fourth step is intended to ensure the user sees an adequate amount of variety within the
        content that they like. The general idea is that the user is biased away from instructors
        they've seen in the last two weeks, or in the last 10 journeys (whichever is shorter), but
        not enough to flip a score from positive to negative. First, we determine how many times the
        user has seen each instructor within the relevant window. For {identifier}, this gives:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorTimesSeenToday} />
      </div>
      <div className={styles.explanation}>
        Then the scores are adjusting according to the following calculation, where <code>s</code>{' '}
        is the score before adjustment, <code>v</code> is the number of times the user has seen the
        instructor recently, and <code>s</code>
        <sub>
          <code>a</code>
        </sub>{' '}
        is the adjusted score:
        <div className={styles.adjustedScoreFunctionContainer}>
          <div className={styles.adjustedScoreFunctionIcon}></div>
        </div>
        After adjustment, this gives the following scores for {identifier}:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorCategoryAdjScores} />
      </div>
      <div className={styles.explanation}>
        <h2>Step 5</h2>
        <div className={styles.timing}>
          {analyzeResponse === null
            ? null
            : analyzeResponse.find_best_categories.computation_time.toFixed(6)}
          s
        </div>
        The lowest view count is used to avoid content repetition whenever possible, while still
        respecting the users feedback. The primary goal is that if there is an instructor/category
        with a neutral or positive rating, we should use that instead of repeating content from
        another instructor/category with a higher rating. However, prefer repetition over showing
        them something from an instructor/category with a negative score. Furthermore, if the choice
        is between instructor/categories which the user has seen all the content already, prefer the
        one which they've gone through fewer times.
      </div>
      <div className={styles.explanation}>
        We do this by defining a comparison function which takes two instructor/categories and
        returns a negative number if the first is better, a positive number if the second is better,
        and 0 if they are equal. The comparison function is as follows, where s<sub>a</sub> is the
        feedback score for the first instructor/category combination, v<sub>a</sub> is the lowest
        view count for the first instructor/category combination, s<sub>b</sub> is the feedback
        score for the second instructor/category combination, v<sub>b</sub> is the lowest view count
        for the second instructor/category combination, and <code>sign</code>
        <sub>
          <code>+</code>
        </sub>
        <code>(n)</code> returns <code>1</code> if <code>n &gt;= 0</code> and <code>-1</code>{' '}
        otherwise:
        <div className={styles.comparisonFunctionContainer}>
          <div className={styles.comparisonFunctionIcon}></div>
        </div>
        Note that this will still eventually resurface instructor/categories the user has disliked,
        because there is a cutoff on how long feedback is taken into account (last 100 ratings or
        last 6 months, whichever is shorter), and hence scores will eventually reach zero once there
        is no recent feedback within an instructor/category. From there, step 4 will ensure the
        category eventually has a higher score. This is what the instructor/categories look like for{' '}
        {identifier} after sorting:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...sortedInstructorCategories} />
      </div>
      <div className={styles.explanation}>
        <h2>Step 6</h2>
        <div className={styles.timing}>
          {analyzeResponse === null
            ? null
            : analyzeResponse.find_best_journeys.computation_time.toFixed(6)}
          s
        </div>
        Finally, we find the best journey within the best instructor/category combination. This uses
        a basic sequenced comparison: prefer fewer views by the user, then prefer more recently
        uploaded. Although in practice this doesn't require fetching and fully sorting the journeys,
        this is what that list would look like for {identifier}:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...journeys} />
      </div>
      <div className={styles.explanation}>
        Hence, if {identifier} picked {emotion}, they would get{' '}
        <strong>
          {analyzeResponse === null
            ? 'loading'
            : analyzeResponse.find_best_journeys.rows[0].journey_title}
        </strong>
        .
      </div>
    </CrudItemBlock>
  );
};
