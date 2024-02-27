export type CourseRef = {
  /** The primary stable external identifier for the course */
  uid: string;
  /** The JWT for the course, which has the oseh:flags custom claim */
  jwt: string;
};
