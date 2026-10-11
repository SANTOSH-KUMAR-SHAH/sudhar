// Business: Domain errors are how the "kitchen" says no. An illegal status move is not
// Business: a warning to log — it is a hard rejection the API turns into a clear 4xx.
// Technical: Plain Error subclasses so callers can `instanceof`-check without a library.

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Business: Someone tried to move a job along the workflow in a way the rules forbid
// Business: (e.g. "new" straight to "done", or cancelling after the tech is on the way).
export class IllegalTransitionError extends DomainError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Illegal status transition: ${from} -> ${to}`);
  }
}

// Business: A record the caller referenced does not exist (bad/unknown request code).
export class NotFoundError extends DomainError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`);
  }
}
