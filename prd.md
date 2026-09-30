# Sudhar Lab — Product Requirements Document

## 1. Document purpose

This document defines the first version of the Sudhar Lab website and internal service-management workflow.

The current product is for a Kathmandu-based home-appliance maintenance and repair company. It is not yet the full long-term Sudhar Lab platform.

## 2. Business context

Sudhar Lab currently focuses on home-service maintenance and repair for:

- Televisions
- Washing machines
- Air conditioners
- Refrigerators

The initial operating area is Kathmandu only.

The long-term business may expand into larger maintenance work, tenders, VDR-system maintenance, and other technical services. The first product should therefore be understandable and extendable, but should not build those future features now.

## 3. Main business principle

The customer submits a service request. The request goes to the Sudhar Lab admin. The admin confirms the information with the customer, checks technician availability, and assigns the job to a suitable technician.

The customer does not choose a technician or receive an automatic assignment.

## 4. Main users

### Customer

The customer can:

- Open the website
- Submit a repair or maintenance request
- Provide appliance and problem information
- Request a preferred visit time
- Upload photos or videos
- Add extra notes
- Contact Sudhar Lab by phone if they need help
- Receive service updates

### Admin / Sudhar Lab company staff

The admin can:

- Receive and review service requests
- Call the customer for confirmation
- Edit or complete request information
- Confirm an order after speaking with the customer
- View technician online/offline availability
- Select and assign a technician
- View and update the service request
- Coordinate diagnosis and pricing
- Approve the final repair price with the customer
- Track completion and billing information

### Technician

The technician has a simple work view. The technician can:

- See assigned jobs
- View customer and appliance details
- Contact the customer
- Update the visit/service status
- Perform diagnosis
- Report the fault to Sudhar Lab
- Mark the job complete
- Set their availability as online or offline

The technician does not need complicated scheduling, payroll, pricing, or customer-management features in the first version. Sudhar Lab is the company assigning the work and paying the technician.

## 5. Customer request form

The website must provide a clear **Request Service** option.

The form should collect:

- Customer name
- Phone number
- Address
- Appliance type
- Appliance brand
- Appliance model, if known
- Problem description
- Preferred visit time
- Photos or videos, if available
- Extra notes

The form should make important information required and allow optional information to remain empty when the customer does not know it.

If the customer cannot complete the form or does not know the required information, the website should provide an obvious **Call Us** option.

## 6. Request submission flow

1. Customer opens the website.
2. Customer selects **Request Service**.
3. Customer fills in the appliance, contact, address, problem, and visit information.
4. Customer submits the request.
5. The request is saved and sent to the admin.
6. The customer receives a submission confirmation.
7. Admin reviews the request.
8. Admin calls the customer to confirm the details and visit arrangement.
9. Admin uses an **Order Confirmed** action after the call.
10. Once the order is confirmed, the customer cannot cancel it through the normal website flow.
11. Admin checks suitable technician availability.
12. Admin assigns the request to a technician.
13. The technician receives the assigned job.
14. The technician visits the customer and diagnoses the appliance.
15. The technician reports the fault to Sudhar Lab.
16. Sudhar Lab discusses the repair price with the customer.
17. The repair price is approved before repair work proceeds.
18. The technician completes the repair or maintenance work.
19. The technician marks the job complete.
20. The service is recorded for billing and future history.

## 7. Service visit and pricing

There is a service visit/inspection charge because the technician travels to the customer’s home and performs diagnosis.

The exact inspection fee is not decided yet.

The repair price is not fixed at the time of the initial request. The price is decided after diagnosis:

1. Technician inspects the appliance.
2. Technician reports the fault to Sudhar Lab.
3. Sudhar Lab discusses the price with the customer.
4. Sudhar Lab approves the price with the customer.
5. Repair work proceeds if the customer agrees.

If the customer decides not to continue with the repair, the inspection/service visit charge still applies.

Online billing will be part of the product. The detailed payment method and payment rules will be defined later.

## 8. Service request statuses

The first version should support these statuses:

```text
New Request
Under Review
Order Confirmed
Assigned
Technician Confirmed
Technician On the Way
Diagnosing
In Progress
Completed
Invoiced
Paid
Closed
Cancelled
```

The most important current flow is:

```text
New Request
  → Under Review
  → Order Confirmed
  → Assigned
  → Technician Confirmed
  → Technician On the Way
  → Diagnosing
  → In Progress
  → Completed
  → Invoiced
  → Paid
  → Closed
```

The detailed cancellation rules, including exceptions after confirmation, are still open for discussion.

## 9. Technician availability

Each technician should have a simple availability state:

- Online
- Offline

The admin can see which technicians are online or offline before assigning a request.

Availability is an input for assignment, not an automatic assignment system. The admin remains responsible for choosing the technician.

## 10. Notifications and communication

The website should support service notifications for relevant request updates.

Sudhar Lab may also communicate with customers through:

- WhatsApp
- Email
- Phone calls

The exact automatic notification events and integrations will be defined later. The first version must at least make the request status and contact information clear to the admin and technician.

## 11. Information and records

The system should preserve the complete service record, including:

- Customer details
- Address and contact information
- Appliance details
- Problem description
- Uploaded media
- Preferred visit time
- Assigned technician
- Status changes
- Diagnosis and fault information
- Approved repair price
- Inspection/service charge
- Completion information
- Billing and payment information
- Later service history

## 12. Security and access control

Customer, technician, and admin information must be protected.

The system must be designed so that:

- Only authorized users can access the admin area.
- Customers cannot view other customers’ information.
- Technicians can see only the jobs and information needed for their assigned work.
- Admin users can manage service operations.
- Sensitive information is not exposed through public pages or insecure links.
- Important changes are validated and stored reliably.

The exact permission matrix and security implementation will be discussed before the relevant features are built.

## 13. First-version scope

### Included

- Public Sudhar Lab website
- Request Service form
- Call Us option
- Request submission and confirmation
- Admin login
- Admin request dashboard
- Request review and editing
- Order confirmation action
- Technician list
- Technician online/offline status
- Manual technician assignment
- Technician assigned-job view
- Customer and appliance details for assigned jobs
- Service status updates
- Diagnosis/fault notes
- Completion marking
- Basic billing records
- Secure role-based access foundation

### Not yet included

- Automatic technician assignment
- Complex technician scheduling
- Technician payroll management
- Full inventory management
- Advanced spare-parts system
- Online payment implementation details
- Complete warranty system
- Automatic cancellation/refund rules
- Mobile applications
- Tenders and enterprise maintenance contracts
- VDR-system maintenance features
- Advanced analytics

## 14. Acceptance criteria

The first version is successful when the following complete flow works:

1. A customer can submit a valid appliance service request.
2. The request appears in the admin dashboard.
3. The admin can review and confirm the request after calling the customer.
4. The admin can see technician availability.
5. The admin can assign a technician.
6. The technician can see the assigned job and customer details.
7. The technician can update the visit status and record completion.
8. The admin can record diagnosis, approved price, inspection charge, and billing information.
9. The system protects the information according to user roles.
10. The complete request history remains available for future reference.

## 15. Open decisions before implementation

These items are intentionally not decided yet:

- Exact inspection/visit fee
- Exact repair pricing process and approval wording
- Payment provider and payment methods
- Billing and invoice format
- Exact cancellation rules after order confirmation
- Notification messages and timing
- WhatsApp and email integration details
- Detailed permission matrix
- Warranty policy
- What happens when a technician is unavailable after assignment
- What happens when a customer rejects the repair price
- Legal/company operating details

## 16. Product direction

The first product should be simple, reliable, secure, and based on the real Sudhar Lab operating process.

The core product is not merely a booking form. It is an admin-controlled service-request system:

```text
Customer Request
  → Admin Review
  → Customer Confirmation
  → Technician Assignment
  → Home Visit and Diagnosis
  → Price Approval
  → Repair or Maintenance
  → Billing
  → Service Record
```

Future features should be added only after the basic service workflow works correctly in real life.
