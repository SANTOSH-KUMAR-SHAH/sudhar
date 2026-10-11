// Business: One door for the shared rulebook so both apps import from a single path.
// Technical: Re-export the dependency-free modules. Presentation (labels, badge colours,
// portal routes, phone masking) intentionally lives in the frontend, not here.

export * from './service-status';
export * from './roles';
export * from './validation';
export * from './contracts';
