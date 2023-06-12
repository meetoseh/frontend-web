import { ReactElement, useMemo } from 'react';
import { User } from '../User';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import styles from './BigUserSuggestionFlow.module.css';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { DashboardTable, DashboardTableProps } from '../../dashboard/subComponents/DashboardTable';
import { Button } from '../../../shared/forms/Button';

const fakeInstructorCategoryCounts = [
  {
    instructor: 'Dylan Werner',
    category: 'meditation',
    lowestViewCount: 1,
    score: 15.5,
    instructorBias: 0.1,
    categoryBias: 0.1,
    timesSeenToday: 1,
  },
  {
    instructor: 'Dylan Werner',
    category: 'mindful talk',
    lowestViewCount: 0,
    score: -1,
    instructorBias: 0.1,
    categoryBias: 0,
    timesSeenToday: 0,
  },
  {
    instructor: 'Dylan Werner',
    category: 'breathwork',
    lowestViewCount: 0,
    score: -3,
    instructorBias: 0.1,
    categoryBias: 0.025,
    timesSeenToday: 0,
  },
  {
    instructor: 'Donte Quinine',
    category: 'meditation',
    lowestViewCount: 2,
    score: 30.5,
    instructorBias: 0,
    categoryBias: 0.1,
    timesSeenToday: 0,
  },
  {
    instructor: 'Donte Quinine',
    category: 'mindful talk',
    lowestViewCount: 1,
    score: 0,
    instructorBias: 0,
    categoryBias: 0,
    timesSeenToday: 0,
  },
  {
    instructor: 'Alisa Galper',
    category: 'instrumental',
    lowestViewCount: 0,
    score: -2,
    instructorBias: 0,
    categoryBias: 0,
    timesSeenToday: 0,
  },
  {
    instructor: 'Isaiah Quinn',
    category: 'poetry',
    lowestViewCount: 0,
    score: -1.95,
    instructorBias: 0,
    categoryBias: 0,
    timesSeenToday: 0,
  },
  {
    instructor: 'Natalie Wong',
    category: 'affirmations',
    lowestViewCount: 0,
    score: -0.05,
    instructorBias: 0,
    categoryBias: 0,
    timesSeenToday: 0,
  },
];

const fakeJourneys = [
  {
    title: 'Cultivate Presence',
    views: 1,
    created: new Date(1682352922387),
  },
  {
    title: 'Quiet Mind',
    views: 1,
    created: new Date(1682352511720),
  },
  {
    title: 'Anxiety Release',
    views: 1,
    created: new Date(1682101843871),
  },
  {
    title: 'Forgiveness',
    views: 2,
    created: new Date(1682959941622),
  },
];

const computeFixedScore = ({
  score,
  timesSeenToday,
}: {
  score: number;
  timesSeenToday: number;
}): number => {
  if (score < 0) {
    return score * (timesSeenToday + 1);
  }
  if (score < 2 && timesSeenToday === 0) {
    return 2;
  }
  return score * Math.pow(0.5, timesSeenToday);
};

const compareInstructorCategories = (
  a: { lowestViewCount: number; score: number; timesSeenToday: number },
  b: { lowestViewCount: number; score: number; timesSeenToday: number }
): number => {
  const fixedScoreA = computeFixedScore(a);
  const fixedScoreB = computeFixedScore(b);
  if (a.lowestViewCount === b.lowestViewCount) {
    return fixedScoreB - fixedScoreA;
  }
  if ((fixedScoreA >= 0 && fixedScoreB >= 0) || (fixedScoreA < 0 && fixedScoreB < 0)) {
    return a.lowestViewCount - b.lowestViewCount;
  }
  return Math.sign(fixedScoreB) - Math.sign(fixedScoreA);
};

/**
 * Allows for deep inspection on the content personalization system for the user with
 * the given sub.
 */
export const BigUserSuggestionFlow = ({ user }: { user: User }): ReactElement => {
  // Currently I'm just setting up how it will look, not attaching it to the backend.

  const instructorCategories = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Instructor Bias', 'Category Bias'],
      rows: fakeInstructorCategoryCounts.map(
        ({ instructor, category, instructorBias, categoryBias }) => [
          instructor,
          category,
          instructorBias.toLocaleString(),
          categoryBias.toLocaleString(),
        ]
      ),
    }),
    []
  );

  const instructorCategoryCounts = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Lowest View Count'],
      rows: fakeInstructorCategoryCounts.map(({ instructor, category, lowestViewCount }) => [
        instructor,
        category,
        lowestViewCount.toLocaleString(),
      ]),
    }),
    []
  );

  const instructorCategoryScores = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Score', 'View Breakdown'],
      rows: fakeInstructorCategoryCounts.map(({ instructor, category, score }) => [
        instructor,
        category,
        score.toLocaleString(),
        {
          csv: 'NA',
          display: (
            <Button type="button" variant="link-small">
              View
            </Button>
          ),
        },
      ]),
    }),
    []
  );

  const instructorCategoryAdjScores = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Adj. Score'],
      rows: fakeInstructorCategoryCounts.map((i) => [
        i.instructor,
        i.category,
        computeFixedScore(i).toLocaleString(),
      ]),
    }),
    []
  );

  const instructorCategoryTimesSeenToday = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Times Seen Today'],
      rows: fakeInstructorCategoryCounts.map(({ instructor, category, timesSeenToday }) => [
        instructor,
        category,
        timesSeenToday.toLocaleString(),
      ]),
    }),
    []
  );

  const sortedInstructorCategories = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Instructor', 'Category', 'Lowest View Count', 'Adj. Score'],
      rows: fakeInstructorCategoryCounts
        .slice()
        .sort(compareInstructorCategories)
        .map((i) => [
          i.instructor,
          i.category,
          i.lowestViewCount.toLocaleString(),
          computeFixedScore(i).toLocaleString(),
        ]),
    }),
    []
  );

  const journeys = useMemo<DashboardTableProps>(
    () => ({
      columnHeaders: ['Title', 'Views', 'Created'],
      rows: fakeJourneys.map(({ title, views, created }) => [
        title,
        views.toLocaleString(),
        created.toLocaleString(),
      ]),
    }),
    []
  );

  const identifier = user.givenName ?? user.email;

  return (
    <CrudItemBlock title="Content Personalization Inspect Tool" controls={null}>
      <div className={styles.explanation}>
        This tool allows deep inspection of how content is surfaced to this user. Currently, users
        are shown a selection of emotions based on how much content we have for each emotion and
        what emotions they've seen recently (stored client-side and reset when the page refreshes).
        After selecting an emotion, however, the journey they are taken to is based on their journey
        feedback. This tool allows you to explore the personalization that occurs after selecting an
        emotion.
      </div>
      <CrudFormElement title="Emotion">
        <select value="calm" className={styles.select} onChange={() => {}}>
          <option value="calm">calm</option>
          <option value="relaxed">relaxed</option>
          <option value="grounded">grounded</option>
        </select>
      </CrudFormElement>
      <div className={styles.explanation}>
        <h2>Step 1</h2>
        The first step is to determine what instructor/category combinations are available within
        this emotion and what fixed bias they have. Note that this step does not depend on the user,
        and thus can be calculated in advance. For calm, we have:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorCategories} />
      </div>
      <div className={styles.explanation}>
        <h2>Step 2</h2>
        The second step is to determine the journey with the fewest views by this user within each
        instructor/category combination. For example, if there is any journey within "Dylan Werner,
        meditation" tagged calm which the user hasn't seen, this value is 0. If the user has seen
        them all at least 3 times but at least 1 exactly 3 times, this is 3, etc. For {identifier},
        this gives:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorCategoryCounts} />
      </div>
      <div className={styles.explanation}>This number is not used until step 5.</div>
      <div className={styles.explanation}>
        <h2>Step 3</h2>
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
        The fourth step is intended to ensure the user sees an adequate amount of variety within the
        content that they like. The general idea is that the user is biased away from combinations
        they've seen today, but not enough to flip a score from positive to negative. First, we
        determine how many times the user has seen each instructor/category combination today. For{' '}
        {identifier}, this gives:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...instructorCategoryTimesSeenToday} />
      </div>
      <div className={styles.explanation}>
        Then the scores are adjusting according to the following calculation, where <code>s</code>{' '}
        is the score before adjustment, <code>v</code> is the number of times the user has seen the
        instructor/category combination today, and <code>s</code>
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
        Finally, we find the best journey within the best instructor/category combination. This uses
        a basic sequenced comparison: prefer fewer views by the user, then prefer more recently
        uploaded. Although in practice this doesn't require fetching and fully sorting the journeys,
        this is what that list would look like for {identifier}:
      </div>
      <div className={styles.instructorCategoryCounts}>
        <DashboardTable {...journeys} />
      </div>
      <div className={styles.explanation}>
        Hence, if {identifier} picked calm, they would get <strong>{fakeJourneys[0].title}</strong>.
      </div>
    </CrudItemBlock>
  );
};
