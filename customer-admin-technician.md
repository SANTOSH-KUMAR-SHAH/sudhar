# Sudhar Lab — Customer, Admin, and Technician Product Plan

## 1. Core business idea

Sudhar Lab is a Kathmandu-based home-appliance maintenance and repair company.

The initial services are:

- TV repair
- Washing-machine repair
- AC repair and maintenance
- Refrigerator repair and maintenance

The first system should be simple and operationally realistic. The customer submits a request, Sudhar Lab confirms it, Sudhar Lab assigns a technician, the technician diagnoses the appliance, and Sudhar Lab explains the repair price before work begins.

The long-term business may expand into larger maintenance contracts, tenders, VDR-system maintenance, and other technical services. Those future ideas should not complicate the first launch.

## 2. Core customer promise

The customer is not only buying a repair. The customer is buying confidence before spending money and allowing someone into their home.

The central promise should be:

> Diagnose first. Explain the price. Repair only after customer approval.

The customer should understand that:

- A technician will inspect the appliance first.
- The repair price is decided after diagnosis.
- Sudhar Lab discusses the price with the customer.
- Repair work starts only after approval.
- The inspection/service visit fee still applies if the customer rejects the repair.
- Sudhar Lab remains the official contact for the service.

The main customer button should be stronger and clearer than a generic “Request Service” button. Recommended wording:

> Get My Appliance Checked

Other acceptable wording:

- Book a Trusted Home Diagnosis
- Request Home Service
- Tell Us What Is Wrong

## 3. Website structure

The public customer website is available at the main domain.

```text
example.com/
```

The admin portal is available at:

```text
example.com/admin
```

The technician portal is available at:

```text
example.com/tech
```

The `/admin` and `/tech` paths must require secure authentication. The URL alone must never provide access.

## 4. Customer side

The customer side should feel like a simple service website, not like a complicated software product.

### Customer pages

```text
/
/services
/request-service
/how-it-works
/about
/faq
/contact
/privacy
/terms
```

The two most important actions throughout the site are:

- Get My Appliance Checked
- Call Us

WhatsApp can also be shown when it is available for customer communication.

## 5. Customer homepage

The homepage should answer five questions immediately:

1. What does Sudhar Lab do?
2. Which appliances does it service?
3. Where does it operate?
4. What happens after I request help?
5. Why should I trust it?

### Recommended homepage order

```text
Hero section
  ↓
Get My Appliance Checked + Call Us
  ↓
Appliance categories
  ↓
Trust promises
  ↓
How the process works
  ↓
Inspection fee and pricing explanation
  ↓
Service area
  ↓
FAQ
  ↓
Final request and call actions
```

### Hero section

Suggested message:

> Home Appliance Repair at Your Doorstep in Kathmandu

Supporting message:

> Tell us what is wrong. We will confirm your request, send a technician to inspect it, explain the fault, and get your approval before repair.

The website may use animations, illustrations, and visual effects. However, the service message and main buttons must remain visible quickly and clearly.

### Trust promises

Use concrete promises that the business can actually deliver:

- Kathmandu home visits
- Technician assigned by Sudhar Lab
- Diagnosis before repair
- Price approval before repair
- Service record after the visit
- Follow-up after service, once operationally supported

Do not use fake ratings, fake job counts, fake testimonials, or unsupported claims such as “certified,” “24/7,” or “same-day service.”

## 6. Services page

The Services page should contain four main sections:

- TV repair
- Washing-machine repair
- AC repair and maintenance
- Refrigerator repair and maintenance

Each section should explain:

- Common problems
- What Sudhar Lab can inspect
- Home visit availability
- Diagnosis process
- Inspection/service fee principle
- Repair price approval process
- Request and call actions

The customer should not need to know the exact fault before requesting help.

## 7. Request Service page

The request form is the most important customer feature.

The form should be simple but collect enough information for the admin to understand the request and assign a suitable technician.

### Recommended two-step form

#### Step 1: Appliance and problem

- Appliance type
- Brand
- Model, if known
- Problem description
- Photos or videos, if available
- Extra notes

Appliance choices:

```text
TV
Washing Machine
AC
Refrigerator
Other / Not Sure
```

“Other / Not Sure” is important because some customers will not know the exact category.

The problem field should give examples, such as:

> TV turns on but has no picture; washing machine is not draining; refrigerator is not cooling.

Photos and videos should remain optional.

#### Step 2: Customer and visit details

- Full name
- Phone number
- Address
- Area/location
- Preferred visit date
- Preferred time period
- Extra notes
- Permission to contact the customer

Time choices should initially use flexible windows:

```text
Morning
Afternoon
Evening
Specific preferred time
```

The exact appointment is confirmed by the admin during the phone call.

### Help option

The form should always show a clear:

> Need help? Call Us

Some customers may not know the appliance model, may not be comfortable filling out forms, or may prefer speaking to a person.

## 8. Customer submission and confirmation flow

```text
1. Customer opens the website.
2. Customer selects Get My Appliance Checked.
3. Customer fills in appliance, problem, contact, address, and visit details.
4. Customer submits the request.
5. The request is saved and sent to the admin.
6. The customer sees a confirmation message and request number.
7. Admin reviews the request.
8. Admin calls the customer to confirm the details.
9. Admin confirms the order in the system.
10. Normal customer cancellation is locked after confirmation.
11. Admin checks technician availability.
12. Admin assigns a suitable technician.
13. Technician receives the assigned job.
14. Technician visits and diagnoses the appliance.
15. Technician reports the fault to Sudhar Lab.
16. Sudhar Lab discusses the price with the customer.
17. Repair proceeds only after customer approval.
18. Technician completes the repair or maintenance work.
19. Technician marks the job complete.
20. Sudhar Lab records billing, payment, warranty, and service history.
```

## 9. Customer confirmation page

After submission, show:

- Request received message
- Request number
- Customer name
- Appliance type
- Phone number
- What happens next
- Call Us button
- WhatsApp button, if available

Example:

```text
Request received: SL-000124

Our team will review your request and call you to confirm the details.
A technician will be assigned after confirmation.
```

The request number should be usable during phone conversations.

## 10. Customer status and communication

Customer accounts are not required for the first version. Creating a password just to request repair would add unnecessary friction.

Later, Sudhar Lab can add a secure status page using:

- One-time secure link
- Phone verification
- OTP
- Request number plus a private verification value

A predictable request number alone must never expose another customer’s request.

Customer communication may use:

- Website notifications
- Phone calls
- WhatsApp
- Email

Important status updates should not rely only on an in-browser notification.

## 11. Customer trust and revenue strategy

The first customer action should lead to a financially sustainable service process.

The revenue sequence is:

```text
Service request
  ↓
Confirmed home visit
  ↓
Inspection/service fee
  ↓
Diagnosis
  ↓
Customer approves repair
  ↓
Repair revenue
  ↓
Future repeat service and warranty relationship
```

The inspection/service fee exists because the technician travels to the customer’s home and performs diagnosis.

The following decisions must be finalized before launch:

- Exact inspection fee
- Whether the fee changes by appliance
- Whether travel is included
- Whether the fee is paid before or after the visit
- Whether the fee is deducted from the repair price
- What happens if the customer is unavailable
- What happens if the appliance cannot be diagnosed
- What happens if the customer rejects the repair

The website should clearly explain:

> A home inspection/service fee applies. The repair price is discussed separately after diagnosis. If you do not approve the repair, the inspection fee still applies.

## 12. Sudhar Lab differentiation

Many appliance-service competitors promote fast service, verified technicians, transparent pricing, ratings, and warranties. Sudhar Lab should not rely only on the same generic words.

The stronger differentiation is:

> Sudhar Lab manages the complete service and remains responsible for the customer relationship.

The customer gets:

- One official company contact
- One request number
- One confirmation process
- One assigned technician
- Price explanation before repair
- One service record
- One complaint/follow-up channel

The customer is not simply given an unknown technician’s phone number.

## 13. Customer service record

After the visit, the customer should eventually receive a simple record:

```text
Appliance: LG Washing Machine
Problem: Not draining
Diagnosis: Pump blockage
Work performed: Pump cleaned
Inspection fee: Rs. ___
Repair charge: Rs. ___
Warranty: ___
Technician: ___
Date: ___
```

This record creates trust, supports complaints, and becomes the foundation of future appliance history.

## 14. Admin portal

The admin portal is the operational heart of Sudhar Lab.

### Admin pages

```text
/admin/login
/admin/dashboard
/admin/requests
/admin/requests/:id
/admin/technicians
/admin/technicians/:id
/admin/customers
/admin/billing
/admin/notifications
/admin/settings
```

### Admin dashboard

The dashboard should show which requests require action now.

Useful summary sections:

```text
New Requests
Waiting for Confirmation
Confirmed
Unassigned
Assigned
In Progress
Needs Price Approval
Completed
Needs Attention
```

The dashboard should also show:

- Online technicians
- Technicians with current jobs
- Delayed or overdue jobs
- Requests waiting for customer decisions
- Requests waiting for payment

### Admin request list

Each request should show:

- Request number
- Customer name
- Appliance
- Area
- Current status
- Preferred visit time
- Assigned technician
- Created time
- Attention indicator

Filters should include:

- Status
- Appliance type
- Area
- Technician
- Date
- Unassigned requests
- Requests needing action

### Admin request detail page

The request detail page should contain:

#### Customer details

- Name
- Phone number
- Address
- Area
- Contact history

#### Appliance details

- Type
- Brand
- Model
- Previous service history, later

#### Problem details

- Customer description
- Photos/videos
- Extra notes

#### Operational details

- Preferred visit time
- Confirmation status
- Assigned technician
- Technician availability
- Service status
- Internal notes

#### Pricing details

- Inspection fee
- Diagnosis
- Parts
- Labor
- Proposed repair price
- Customer approval
- Payment status

#### Activity timeline

The system should record events such as:

```text
10:22 AM — Request submitted
10:35 AM — Admin called customer
10:41 AM — Customer confirmed
10:48 AM — Technician assigned
12:10 PM — Technician on the way
1:05 PM — Diagnosis added
1:40 PM — Price approved
3:10 PM — Repair completed
```

The timeline helps with accountability, customer questions, and business disagreements.

### Admin confirmation action

Use a clear action such as:

> Confirmed with customer

When clicked, the system should store:

- Admin who confirmed it
- Date and time
- Confirmation notes
- Confirmed visit time
- Contact method

The system should explain that normal customer cancellation becomes locked after confirmation.

### Technician assignment

The admin should see:

- Technician name
- Online/offline status
- Appliance skills
- Current assigned jobs
- Service area
- Last availability update
- Current workload

The admin makes the final assignment decision.

Automatic matching is not required in the first version.

### Price approval

The workflow should be:

```text
Technician diagnoses
  ↓
Technician reports fault
  ↓
Admin records diagnosis
  ↓
Admin discusses price with customer
  ↓
Customer approves or rejects
  ↓
Repair continues or stops
```

Useful admin actions include:

- Send price for approval
- Customer approved
- Customer rejected
- Customer will decide later
- Repair not economical
- Waiting for parts

## 15. Technician portal

The technician portal should be simple and focused on assigned work.

Technicians do not need a complicated marketplace, quotation, payroll, or customer-management system in the first version.

### Technician pages

```text
/tech/login
/tech/dashboard
/tech/jobs
/tech/jobs/:id
/tech/profile
```

### Technician home page

Show:

```text
Today’s Jobs
Upcoming Jobs
Completed Jobs
```

Each job card should show:

- Appliance
- Customer name
- Area
- Preferred time
- Status
- Call button
- View details button

### Technician job detail

Show:

- Customer name
- Phone number
- Address
- Appliance type
- Brand
- Model
- Problem description
- Uploaded photos/videos
- Preferred visit time
- Admin notes
- Call customer
- Directions/map link

The technician should see only the customer information needed for the assigned work.

### Technician statuses

The visible actions should be large and clear:

```text
Accept Assignment
On the Way
Arrived
Diagnosing
Waiting for Customer Decision
In Progress
Waiting for Parts
Completed
Unable to Complete
```

The system may hide some statuses in the first version, but the underlying workflow should be able to represent real situations.

### Diagnosis form

The technician should record:

- Customer-reported problem
- Technician observations
- Diagnosed fault
- Required repair
- Required parts
- Estimated labor
- Photos/evidence
- Recommendation
- Additional notes

The technician should not finalize the customer price if the agreed process requires Sudhar Lab to discuss and approve the price with the customer.

### Completion form

Before marking a job complete, the system should collect:

- Work performed
- Parts used
- Final technician notes
- Completion photos, if required
- Customer confirmation, later if introduced
- Warranty information, once finalized

### Technician availability

Initial availability states:

- Online
- Offline

“Online” should mean:

> The technician is currently available for new assignments.

It should not automatically mean that the technician is physically online, free at every time, or able to travel anywhere.

Later states may include:

- Available
- Busy
- On Leave
- Offline

## 16. Service statuses

The first system should support:

```text
New Request
Under Review
Customer Confirmed
Assigned
Technician Confirmed
Technician On the Way
Arrived
Diagnosing
Price Approval
In Progress
Waiting for Parts
Completed
Invoiced
Paid
Closed
Cancelled
Unable to Complete
```

The central flow is:

```text
New Request
  → Under Review
  → Customer Confirmed
  → Assigned
  → Technician Confirmed
  → Technician On the Way
  → Diagnosing
  → Price Approval
  → In Progress
  → Completed
  → Invoiced
  → Paid
  → Closed
```

Every status should represent a real-world condition. Every transition should have a responsible actor and a defined rule.

## 17. Important missing decisions

These decisions should be made before the final launch:

- Exact Kathmandu service area
- English, Nepali, or bilingual interface
- Exact inspection fee
- Whether inspection fee is deducted from repair cost
- Exact repair pricing approval wording
- Payment provider and payment method
- Billing/invoice format
- Cancellation rules after confirmation
- Warranty policy
- What happens if a technician is unavailable
- What happens if the customer rejects the repair price
- What happens when a part is unavailable
- What happens if the customer is unavailable
- Response-time promise
- Appointment time windows
- Notification timing and channels
- Media upload limits
- Data retention period for customer photos/videos
- Complaint and refund policy
- Technician identity and verification process
- Customer follow-up process

## 18. Operational risks to plan for

The system should eventually handle:

- Customer enters an incomplete address
- Customer does not answer the phone
- Customer submits duplicate requests
- Technician cannot find the location
- Technician is late
- Technician rejects or cannot complete the job
- Required spare part is unavailable
- Customer rejects the repair price
- Appliance cannot be economically repaired
- Customer claims the problem returned
- Customer claims property damage
- Customer disputes the price
- Uploaded file is too large
- Internet connection fails during submission
- Customer presses submit twice

## 19. Mobile-first and Nepal-relevant design

The customer website should be designed for phones first.

Use:

- Large buttons
- Large form controls
- Simple wording
- Easy phone calling
- Easy WhatsApp access
- Minimal typing
- Clear feedback after each action
- No tiny text
- No complicated navigation

The website should support future Nepali language use. Initial English can be simple and clear, but the design should not make later bilingual support difficult.

## 20. Security and privacy foundation

The system must protect customer phone numbers, addresses, photos, technician details, and service history.

The first security principles are:

- Secure admin and technician authentication
- Role-based authorization
- Customers cannot see other customers’ requests
- Technicians can see only assigned job information
- Admin actions are permission-controlled
- Secrets never appear in frontend code
- Input is validated on both frontend and backend
- Database queries use parameterized methods
- Uploaded files are restricted and validated
- Important changes are logged
- Sensitive errors are not shown to customers
- Backups and recovery are planned before production

No technology can promise perfect security. The system should be tested continuously and designed with defense in depth.

## 21. First-version scope

### Included

- Simple public homepage
- Service sections for four appliances
- Request Service form
- Get My Appliance Checked action
- Call Us action
- Request confirmation and request number
- Admin login
- Admin request dashboard
- Admin request review
- Customer confirmation action
- Technician online/offline status
- Manual technician assignment
- Technician assigned-job view
- Customer and appliance details
- Status updates
- Diagnosis notes
- Completion marking
- Basic inspection-fee and billing records
- Secure role-based access foundation
- Basic customer and technician notifications

### Not required initially

- Customer account creation
- Automatic technician matching
- Complex technician scheduling
- Technician payroll management
- Full inventory system
- Advanced spare-parts management
- Online payment implementation details
- Complete warranty automation
- Automatic cancellation/refund automation
- Mobile applications
- Tenders and enterprise contracts
- VDR-system maintenance features
- Advanced analytics
- Sanity CMS

## 22. First-version success criteria

The first version is successful when:

1. A customer understands what Sudhar Lab does within a few seconds.
2. A customer can request an appliance diagnosis without creating an account.
3. A customer can easily call if they need help.
4. The request reaches the admin reliably.
5. The admin can call and confirm the customer.
6. The admin can see technician availability.
7. The admin can assign a technician manually.
8. The technician can see the assigned job and customer details.
9. The technician can update the visit status.
10. The technician can record diagnosis and complete the job.
11. Sudhar Lab can explain the repair price before work begins.
12. The system records the service history and billing information.
13. Customer and operational information is protected according to user roles.
14. The business can collect the inspection/service fee and approved repair revenue.

## 23. Final product principle

The customer should experience:

```text
Broken appliance
  ↓
Clear explanation
  ↓
Simple request
  ↓
Official confirmation
  ↓
Trusted technician visit
  ↓
Clear diagnosis
  ↓
Price approval
  ↓
Repair
  ↓
Service record and follow-up
```

The admin should experience:

```text
New request
  ↓
Review
  ↓
Customer confirmation
  ↓
Technician assignment
  ↓
Diagnosis
  ↓
Price approval
  ↓
Completion
  ↓
Billing and history
```

The technician should experience:

```text
Assigned job
  ↓
Customer and appliance details
  ↓
Visit
  ↓
Diagnosis
  ↓
Status update
  ↓
Repair or report
  ↓
Completion
```

The core product is not merely a booking form. It is a simple, accountable service operation that helps the customer make a confident repair decision.
