export type OnboardingClassState = {
  /**
   * True if the user has not taken the onboarding flow yet,
   * false if they have, undefined if not logged in.
   */
  isRecentSignup: boolean | undefined;

  /**
   * True if the user has seen an onboarding class recently,
   * false if they have not, undefined if not logged in.
   */
  sawClass: boolean | undefined;

  /**
   * A function to call if the user plays at least some of the class,
   * so that we can store they saw it.
   */
  onContinue: () => OnboardingClassState;
};
