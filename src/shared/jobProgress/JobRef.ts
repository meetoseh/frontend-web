export type JobRef = {
  /**
   * The job progress uid
   */
  uid: string;
  /**
   * A JWT that allows connecting to the jobs progress
   */
  jwt: string;
};
