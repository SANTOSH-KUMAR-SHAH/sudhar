# Sudhar Lab — Technician Portal Plan

## Purpose

The technician portal is a focused field-work tool. It helps a Sudhar Lab technician receive assigned jobs, understand the customer’s appliance problem, travel to the correct location, update the visit status, record diagnosis, report the fault to Sudhar Lab, and complete the job after the company’s process allows it.

It is not a marketplace, customer-management system, payroll system, quotation tool, or complex scheduling platform.

The technician should always understand:

```text
What job do I have?
Where do I need to go?
What is the next correct action?
What information must I record?
```

## Design principles

- Mobile-first because technicians work from phones in the field.
- One primary next action at a time.
- Large touch targets and simple wording.
- Minimal typing where possible.
- Clear status and clear responsibility.
- Customer information limited to what the assigned job requires.
- Important updates must work with slow or interrupted internet.
- The interface should be calm and practical, not visually crowded.
- The technician should not finalize the customer price unless the business process later changes.

## Technician routes

```text
/tech/login
/tech/dashboard
/tech/jobs
/tech/jobs/:id
/tech/profile
```

The following are states or panels rather than separate first-version routes:

```text
Loading
No jobs
Offline connection
Session expired
Assignment received
Diagnosis submitted
Waiting for customer decision
Waiting for parts
Job completed
Error and retry
```

## Page 1 — Technician login

### Purpose

Allow an authorized technician to securely enter the technician portal.

### Sections

- Sudhar Lab identity
- Technician Portal label
- Phone/email field
- Password field
- Show/hide password control
- Sign-in button
- Forgot password action
- Help/contact Sudhar Lab action
- Secure-access reassurance

### Rules

- Technicians do not self-register in the first version.
- Admin creates and manages technician accounts.
- The URL must never provide access without authentication.
- A technician must never be able to access `/admin`.
- Login errors must not reveal whether an account exists.

## Page 2 — Technician dashboard

### Purpose

Give the technician an immediate view of today’s work and the next required action.

### Sections

- Technician greeting and date
- Profile and notification controls
- Online/offline availability switch
- Today’s job summary
- Next visit card
- Today’s jobs timeline
- Upcoming jobs
- Recently completed jobs
- Empty state when no work is assigned

### Summary information

Show only useful operational information:

```text
Today’s jobs
Next visit
Completed today
```

Do not show company revenue, payroll, customer totals, or unnecessary performance analytics.

### Job card information

- Appliance
- Customer name
- Area
- Visit time
- Current status
- Short problem description
- Call customer action
- Open job action

The next job should be visually stronger than later jobs.

## Page 3 — My Jobs

### Purpose

Show every job assigned to the logged-in technician.

### Sections

- Page title
- Date selector
- Job filters
- Today’s jobs
- Upcoming jobs
- Completed jobs
- Job cards or a mobile-friendly list

### Recommended filters

```text
Today
Upcoming
Completed
All
```

Do not add complex scheduling filters in the first version.

### Job card information

- Request number
- Appliance type
- Brand and model, if known
- Customer name
- Area
- Preferred visit time
- Status
- Last update
- Call customer
- View job

The full address should not be displayed on every list card. It should be available inside the assigned job detail.

## Page 4 — Job detail

### Purpose

Guide the technician through one complete service visit.

The job detail page is the central technician workspace.

### Sections

1. Job header and current status
2. Primary next action
3. Customer contact
4. Location and directions
5. Appliance details
6. Customer-reported problem
7. Uploaded customer photos/videos
8. Visit status timeline
9. Diagnosis form
10. Price-approval waiting state
11. Repair section
12. Waiting-for-parts state
13. Completion form
14. Job activity history

### Job header

Show:

- Request number
- Appliance type
- Brand/model
- Customer name
- Area
- Visit time
- Current status

### Primary next action

Only show the most relevant next action for the current status:

```text
Accept Assignment
On the Way
Arrived
Begin Diagnosis
Submit Diagnosis
Start Repair
Mark Waiting for Parts
Mark Completed
Unable to Complete
```

Do not show every possible action at the same time.

## Customer and location section

Show only information necessary for the assigned work:

- Customer name
- Phone number
- Full address
- Area or tole
- Call customer
- WhatsApp later if approved
- Open directions/map link

The technician should not see unrelated customer records or private information from other jobs.

## Appliance section

Show:

- Appliance type
- Brand
- Model
- Customer-reported problem
- Preferred visit time
- Additional customer notes

Keep the customer’s original statement separate from the technician’s diagnosis.

```text
Customer reported:
“The washing machine fills with water but does not drain.”

Technician diagnosis:
Recorded after inspection.
```

## Media section

Show customer-uploaded photos and videos.

Later, allow the technician to add:

- Inspection photos
- Fault evidence
- Completion photos

Media must be private, permission-checked, size-limited, and usable on slow connections.

## Status workflow

The visible technician workflow is:

```text
Assigned
  → Technician Confirmed
  → On the Way
  → Arrived
  → Diagnosing
  → Waiting for Customer Decision
  → In Progress
  → Waiting for Parts, if needed
  → In Progress
  → Completed
```

The system should also support:

```text
Unable to Complete
```

Every status change should record:

- Who changed it
- When it changed
- Optional note
- Previous status
- New status

## Diagnosis form

### Purpose

Allow the technician to record the technical findings after inspecting the appliance.

### Fields

- Customer-reported problem
- Technician observations
- Diagnosed fault
- Recommended repair
- Required parts
- Estimated labour
- Evidence photos
- Recommendation
- Additional notes

### Actions

```text
Save Draft
Submit Diagnosis to Sudhar Lab
```

Submitting a diagnosis must not automatically mean that the customer price is approved.

The correct process is:

```text
Technician diagnoses
  → Technician reports fault
  → Sudhar Lab reviews
  → Sudhar Lab discusses price with customer
  → Customer approves or rejects
  → Technician repairs only if approved
```

## Price-approval waiting state

After submitting diagnosis, show a clear waiting state:

```text
Diagnosis submitted

Sudhar Lab is discussing the repair price with the customer.
Do not begin repair until approval is confirmed.
```

Available actions:

- View submitted diagnosis
- Contact Sudhar Lab
- Add an additional note

## Repair section

Show this only after the admin records customer approval.

### Information

- Approved work
- Required parts
- Admin instructions
- Customer approval status

### Actions

```text
Start Repair
Waiting for Parts
```

The technician should not be forced to mark the job complete when work cannot be completed.

## Completion form

### Fields

- Work performed
- Parts used
- Final technician notes
- Completion photos
- Appliance working status
- Follow-up recommendation
- Warranty information, once finalized

### Completion checklist

Before completion, confirm:

```text
[ ] Work performed is recorded
[ ] Parts used are recorded
[ ] Important final notes are added
[ ] Any unresolved issue is reported
```

Then provide:

```text
Mark Job Complete
```

## Page 5 — Technician profile

### Sections

- Technician name and profile image/initials
- Phone number
- Appliance skills
- Service area
- Technician ID
- Joined date
- Online/offline availability
- Change password
- Notification preferences
- Sign out

The technician must not edit permissions, billing rules, company settings, or their official role.

## Availability control

Initial states:

```text
Online
Offline
```

“Online” means:

> The technician is currently available to receive a new assignment.

It does not automatically mean the technician is physically online, free at every time, or able to travel anywhere.

Later states may include:

```text
Available
Busy
On Leave
Offline
```

## Notifications

Notifications may be implemented as a panel rather than a dedicated page initially.

Useful events include:

- New assignment
- Assignment changed
- Visit time changed
- Customer update
- Price approved
- Price rejected
- Parts update
- Admin message

Important notifications should eventually also use approved external channels such as phone, WhatsApp, or email. The portal should not be the only communication channel for urgent operational information.

## Access and privacy rules

- A technician can see only assigned jobs.
- A technician cannot browse all customers.
- A technician cannot see another technician’s assignments unless explicitly authorized later.
- A technician cannot change customer-facing price approval.
- A technician cannot edit admin permissions.
- Private customer media must be access-controlled.
- Status updates must be validated by the backend.
- Completed records should remain traceable and should not be silently overwritten.

## First-version technician scope

### Included

- Technician login
- Technician dashboard
- Assigned jobs list
- Job detail
- Customer and appliance information
- Call customer action
- Directions link
- Visit status updates
- Diagnosis notes
- Fault reporting
- Evidence photos later in the implementation sequence
- Completion notes
- Mark job complete
- Online/offline availability
- Basic notifications
- Secure role-based access

### Not required initially

- Technician marketplace
- Customer selection of technician
- Technician bidding
- Payroll
- Commission calculations
- Complex calendar
- Automatic route optimization
- Live GPS tracking
- Full inventory system
- Advanced parts management
- Customer database management
- Public technician ratings
- Advanced performance analytics
- Native mobile application

## First-version page order

Build and validate in this order:

1. `/tech/login`
2. `/tech/dashboard`
3. `/tech/jobs`
4. `/tech/jobs/:id`
5. `/tech/profile`

Inside the job detail page, implement the operational stages in this order:

1. View assignment
2. Contact customer and view location
3. Update visit status
4. Record diagnosis
5. Wait for price decision
6. Record repair work
7. Mark complete

## Technician portal success criteria

The first version is successful when a technician can:

1. Sign in securely.
2. See today’s assigned jobs.
3. Open one job and understand the work.
4. Call the customer and open directions.
5. Update the visit status.
6. Record the technical diagnosis.
7. Send the fault report to Sudhar Lab.
8. Wait clearly for customer price approval.
9. Record repair or inability to complete.
10. Mark the job complete with necessary notes.

## Final product principle

The technician portal should feel like a simple field-work companion:

```text
Assigned job
  → Customer and appliance details
  → Visit
  → Diagnosis
  → Fault report
  → Price approval wait
  → Repair if approved
  → Completion record
```

Every screen should make the next correct action obvious.
