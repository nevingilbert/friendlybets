/** Thrown when an action needs a signed-in user and there is not one. */
export class NotSignedInError extends Error {
  constructor(message = "Sign in with Google to do that.") {
    super(message);
    this.name = "NotSignedInError";
  }
}

/** Thrown when a signed-in user is not allowed to do this particular thing. */
export class NotAllowedError extends Error {
  constructor(message = "You are not allowed to do that.") {
    super(message);
    this.name = "NotAllowedError";
  }
}

/** Thrown when the input itself is wrong; the message is shown as-is. */
export class BadInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadInputError";
  }
}
