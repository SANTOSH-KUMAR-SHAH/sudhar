// Business: The one list of appliance kinds this service repairs. It backs BOTH the customer's "what's broken?"
// Business: picker and the skills an admin ticks when adding a technician — so a job can always match a person who
// Business: claims that skill. If the two lists ever drifted, the recommendation engine would quietly stop finding
// Business: anyone. Keeping them in one shared file is what makes "matched" mean something real.
// Technical: Dependency-free, reused by the frontend (labels/options) and the backend (skill validation). Matching
// in the recommender is case-insensitive, so these strings only need to be consistent, not identical in case.

export const APPLIANCE_TYPES = ['Television', 'Washing machine', 'Refrigerator', 'Air conditioner'] as const;

export type ApplianceType = (typeof APPLIANCE_TYPES)[number];
