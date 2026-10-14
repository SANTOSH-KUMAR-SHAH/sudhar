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

// Business: Two different "no" the API must not blur — we don't know who you are (unauthenticated,
// Business: 401) versus we know you and you're not allowed here (forbidden, 403).
export class AuthorizationError extends DomainError {
  constructor(
    public readonly kind: 'unauthenticated' | 'forbidden',
    message: string,
  ) {
    super(message);
  }
}

// Business: The action is legal on its own but collides with something that already exists — e.g.
// Business: provisioning a staff login whose username is taken. Nothing is overwritten; it just refuses.
export class ConflictError extends DomainError {
  constructor(resource: string, identifier: string) {
    super(`${resource} already exists: ${identifier}`);
  }
}
