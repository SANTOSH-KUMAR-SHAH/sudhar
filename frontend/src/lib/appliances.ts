// Business: The skills an admin ticks when adding a technician must be the SAME appliance kinds the
// Business: customer can request, or the recommender would never match a person to a job. This re-export
// Business: gives the Add-Technician form one stable import instead of a hand-typed list that can drift.
// Technical: Single-sourced in packages/shared (the backend validates skills against it too); we only alias it.

export { APPLIANCE_TYPES, type ApplianceType } from '../../../packages/shared/src/appliances';
