import { DIAGRAM_TYPES, type DiagramType } from "@/lib/types";

export const MAX_PROMPT_CHARS = 8000;

/** Prompt skeleton for each diagram type: the information the DiagramAgent needs for that type. */
export const TEMPLATES: Record<DiagramType, string> = {
  technical: `## System
- Name and purpose:
- Components or services (frontend, backend, workers, data stores):
- Technologies:
- Users and how they access the system:

## Infrastructure
- Cloud provider and hosting:
- Scaling approach:
- AI provider (if any):

## Data and integrations
- Data stores:
- External integrations (APIs, SaaS, identity provider):

## Assumptions
-

## Constraints
- Budget:
- Compliance and security:
- Performance targets:
- Existing systems to keep:

## Additional information
`,

  logical: `## System
- Name and business purpose:
- Main functional areas or modules:
- Users and actors:
- Core domain entities (for example: customer, order, invoice):

## Relationships
- Which modules depend on which:
- Shared services (for example: identity, notifications, reporting):

## Assumptions
-

## Constraints
- Compliance and security:
- Existing systems to keep:
- Other constraints:

## Additional information
`,

  layered: `## System
- Name and purpose:
- Layers, top to bottom (for example presentation, API, services, data, infrastructure):
- Components inside each layer:
- Users and how they access the system:

## Cross-cutting concerns
- Authentication and authorization:
- Logging, monitoring and auditing:
- Shared services (caching, messaging, search):

## Technologies and hosting
- Technologies per layer:
- Cloud provider and hosting:
- AI provider (if any):

## Data and integrations
- Data stores:
- External integrations (APIs, SaaS, identity provider):

## Assumptions
-

## Constraints
- Budget:
- Compliance and security:
- Performance targets:
- Existing systems to keep:

## Additional information
`,

  network: `## Environments
- Environments (for example: dev, staging, prod):
- Cloud provider and regions:
- Availability zones per region:

## Network layout
- VPCs and subnets (public, private, data):
- Gateways and load balancers (internet gateway, NAT, VPN, Transit Gateway):
- Security boundaries (security groups, firewalls, WAF):

## Access and connectivity
- Public-facing endpoints:
- Private access (VPN, Direct Connect, bastion, Session Manager):
- Connectivity to on-premises systems:

## Traffic flow
- Main inbound and outbound flows:

## Assumptions
-

## Constraints
- Compliance and security:
- Budget:
- Availability and performance targets:

## Additional information
`,

  raci: `## Process
- Name and purpose of the process:
- Tasks or activities (one per line):
- Roles or teams (one per line):

## Known responsibilities (optional)
- Who does each task today:

## Assumptions
-

## Constraints
- Approval rules or compliance requirements:
- Existing organization or team structure:

## Additional information
`,

  workflow: `## Process
- Name and purpose:
- Start event (what triggers the process):
- End events (successful and unsuccessful outcomes):

## Steps and actors
- Steps in order (one per line, with the actor for each):
- Systems used in each step:
- Handoffs between teams or systems:

## Decisions and exceptions
- Decision points (question and possible outcomes):
- Failure and exception paths (what happens when a step fails):

## Assumptions
-

## Constraints
- Service levels or deadlines:
- Compliance and approvals:

## Additional information
`,
};

export interface SamplePrompt {
  title: string;
  description: string;
  prompt: string;
}

export const SAMPLE_PROMPTS: Record<DiagramType, SamplePrompt[]> = {
  technical: [
    {
      title: "Online order platform",
      description: "Web store with payments, email and staff admin on AWS",
      prompt: `## System
- Name and purpose: Online store order management for a retail company
- Components or services: React web frontend, FastAPI order service, background worker for emails, admin dashboard
- Technologies: Next.js, Python FastAPI, PostgreSQL
- Users and how they access the system: Shoppers over HTTPS in the browser; store staff through the admin dashboard with SSO

## Infrastructure
- Cloud provider and hosting: AWS, containers on ECS Fargate behind an Application Load Balancer
- Scaling approach: Autoscale on CPU and request count
- AI provider (if any): None

## Data and integrations
- Data stores: Amazon RDS for PostgreSQL, Amazon S3 for product images
- External integrations (APIs, SaaS, identity provider): Stripe for payments, SendGrid for email, Okta for staff SSO

## Assumptions
- Single AWS region (us-east-1)

## Constraints
- Budget: Moderate, prefer managed services
- Compliance and security: Card data stays with Stripe (PCI scope limited)
- Performance targets: Checkout API under 500 ms at p95

## Additional information
`,
    },
    {
      title: "Document processing pipeline",
      description: "Serverless upload, extraction and search",
      prompt: `## System
- Name and purpose: Upload and extract text from scanned contracts so legal staff can search them
- Components or services: Upload API, extraction workers, search index, review UI
- Technologies: Python, serverless functions
- Users and how they access the system: Legal staff via a web app (SSO); partner systems upload through an API key

## Infrastructure
- Cloud provider and hosting: AWS, serverless
- Scaling approach: Scale to zero, queue-based for bursts
- AI provider (if any): Amazon Bedrock for summarization

## Data and integrations
- Data stores: S3 for documents, DynamoDB for metadata, OpenSearch for search
- External integrations (APIs, SaaS, identity provider): Microsoft Entra ID for SSO

## Assumptions
- Documents are PDF, up to 50 MB

## Constraints
- Compliance and security: Data encrypted at rest; no data leaves the AWS account
- Budget: Pay per use

## Additional information
`,
    },
  ],

  logical: [
    {
      title: "Learning platform modules",
      description: "Functional areas for courses, enrollment and reporting",
      prompt: `## System
- Name and business purpose: Online learning platform for corporate training
- Main functional areas or modules: Course catalog, enrollment, assessments, progress tracking, reporting, notifications
- Users and actors: Learners, instructors, training administrators
- Core domain entities: course, module, enrollment, assessment, certificate

## Relationships
- Which modules depend on which: Enrollment depends on the catalog; assessments and progress depend on enrollment; reporting reads from progress and assessments
- Shared services: identity, notifications

## Assumptions
- Learners and admins share one login

## Constraints
- Compliance and security: Learner records are personal data (GDPR)
- Existing systems to keep: Current HR system is the source of employee records

## Additional information
Show the layers from user-facing features down to core business rules.
`,
    },
    {
      title: "Insurance claims system",
      description: "Layers and modules for claim intake through settlement",
      prompt: `## System
- Name and business purpose: Property insurance claims handling
- Main functional areas or modules: Claim intake, policy lookup, fraud checks, assessment, payments, customer communications
- Users and actors: Customers, claims handlers, adjusters, finance team
- Core domain entities: policy, claim, incident, adjuster assignment, payment

## Relationships
- Which modules depend on which: Claim intake uses policy lookup; payments depend on the settlement decision
- Shared services: document storage, audit log

## Assumptions
- Fraud checks are rule-based in the first release

## Constraints
- Compliance and security: Regulated insurance data; full audit trail required
- Existing systems to keep: Legacy policy administration system (read-only access)

## Additional information
`,
    },
  ],

  layered: [
    {
      title: "Layered web application",
      description: "Presentation, API, service and data layers on AWS",
      prompt: `## System
- Name and purpose: Customer self-service portal for a utility company
- Layers, top to bottom: Presentation (web app), API (REST gateway), Services (billing, usage, account), Data (PostgreSQL, S3), Infrastructure (AWS)
- Components inside each layer: Presentation has the Next.js app and admin pages; API has the gateway and rate limiting; Services has billing, usage and account services; Data has PostgreSQL and document storage
- Users and how they access the system: Customers and staff over HTTPS through the browser

## Cross-cutting concerns
- Authentication and authorization: Amazon Cognito with role-based access
- Logging, monitoring and auditing: CloudWatch logs and metrics, audit table for billing changes
- Shared services: Redis cache for usage summaries, SQS for background jobs

## Technologies and hosting
- Technologies per layer: Next.js, FastAPI, PostgreSQL, S3
- Cloud provider and hosting: AWS, containers on ECS Fargate
- AI provider (if any): None

## Data and integrations
- Data stores: RDS PostgreSQL, S3 for bills (PDF)
- External integrations: Meter data feed (SFTP) from the utility network

## Assumptions
- Single region (eu-west-1)

## Constraints
- Budget: Moderate
- Compliance and security: Customer data encrypted at rest and in transit
- Performance targets: Dashboard loads in under 2 seconds

## Additional information
`,
    },
    {
      title: "Layered data platform",
      description: "Ingestion, storage, processing and serving layers",
      prompt: `## System
- Name and purpose: Analytics platform for sales and inventory data
- Layers, top to bottom: Serving (BI dashboards, query API), Processing (transformations), Storage (raw, curated, warehouse), Ingestion (connectors), Infrastructure (AWS)
- Components inside each layer: Serving has QuickSight and a query API; Processing has Glue jobs and dbt models; Storage has S3 raw and curated zones plus Redshift; Ingestion has Kinesis and scheduled connectors
- Users and how they access the system: Analysts through QuickSight; data engineers through the console and CI pipelines

## Cross-cutting concerns
- Authentication and authorization: IAM Identity Center, column-level permissions in Redshift
- Logging, monitoring and auditing: CloudTrail and CloudWatch, lineage in the catalog
- Shared services: Glue Data Catalog, Secrets Manager

## Technologies and hosting
- Technologies per layer: Kinesis, Glue, dbt, Redshift, QuickSight
- Cloud provider and hosting: AWS, us-east-1
- AI provider (if any): None

## Data and integrations
- Data stores: S3 data lake, Redshift warehouse
- External integrations: Salesforce and the ERP system via scheduled connectors

## Assumptions
- Data volume is about 200 GB per month

## Constraints
- Compliance and security: Personal data masked in the curated zone
- Budget: Keep monthly cost under a fixed amount

## Additional information
`,
    },
  ],

  network: [
    {
      title: "Dev and prod VPCs",
      description: "Two environments, public load balancer, private data tier",
      prompt: `## Environments
- Environments: dev and prod, separate AWS accounts
- Cloud provider and regions: AWS, us-east-1 only
- Availability zones per region: 2 for dev, 3 for prod

## Network layout
- VPCs and subnets: One VPC per environment; public subnets for the load balancer, private subnets for application containers, isolated subnets for the database
- Gateways and load balancers: Internet gateway, NAT gateway per AZ, public Application Load Balancer
- Security boundaries: Security groups per tier; AWS WAF on the load balancer

## Access and connectivity
- Public-facing endpoints: HTTPS to the load balancer only
- Private access: Bastion replaced by Session Manager
- Connectivity to on-premises systems: Site-to-site VPN to the office network for the admin tools

## Traffic flow
- Main inbound and outbound flows: Users to load balancer to app; app to RDS and to external payment API through NAT

## Assumptions
- Office network is 10.20.0.0/16

## Constraints
- Compliance and security: No database endpoint is reachable from the internet
- Availability and performance targets: 99.9% availability for prod

## Additional information
`,
    },
    {
      title: "Hybrid data platform",
      description: "Private connectivity from an on-premises data center",
      prompt: `## Environments
- Environments: production only, plus a non-production account for testing
- Cloud provider and regions: AWS, eu-west-1 primary and eu-central-1 for disaster recovery
- Availability zones per region: 3 in each region

## Network layout
- VPCs and subnets: Hub VPC for shared services, spoke VPCs for the data lake and analytics
- Gateways and load balancers: Transit Gateway between VPCs, Direct Connect to the data center
- Security boundaries: Network firewall in the hub; no internet egress from data subnets

## Access and connectivity
- Public-facing endpoints: None; the analytics dashboard is internal only
- Private access: VPN for remote analysts through an identity-aware proxy
- Connectivity to on-premises systems: 10 Gbps Direct Connect to the main data center; nightly batch exports from the ERP

## Traffic flow
- Main inbound and outbound flows: ERP exports over Direct Connect to S3; analysts query through the proxy to the warehouse

## Assumptions
- Data residency requires all storage in the EU

## Constraints
- Compliance and security: GDPR; traffic between regions must be encrypted
- Availability and performance targets: Recovery time under 4 hours

## Additional information
`,
    },
  ],

  raci: [
    {
      title: "Software release process",
      description: "Who does what from code freeze to production release",
      prompt: `## Process
- Name and purpose of the process: Monthly software release for the customer portal
- Tasks or activities (one per line):
  - Plan release scope
  - Freeze code and create release branch
  - Run regression tests
  - Approve security review
  - Deploy to production
  - Communicate release notes to customers
- Roles or teams (one per line):
  - Product Owner
  - Engineering Lead
  - QA Engineer
  - Security Engineer
  - DevOps Engineer
  - Customer Success

## Known responsibilities (optional)
- Engineering Lead currently approves the security review

## Assumptions
- Each task has exactly one accountable role

## Constraints
- Approval rules or compliance requirements: Security sign-off is required before production
- Existing organization or team structure: Platform team sits under Engineering

## Additional information
`,
    },
    {
      title: "Incident response",
      description: "Roles during a production incident",
      prompt: `## Process
- Name and purpose of the process: Handling a production outage from detection to post-incident review
- Tasks or activities (one per line):
  - Detect and acknowledge the alert
  - Declare the incident and set severity
  - Lead the technical investigation
  - Communicate status to stakeholders
  - Apply the fix or rollback
  - Write the post-incident review
- Roles or teams (one per line):
  - On-call Engineer
  - Incident Commander
  - Service Owner
  - Communications Lead
  - Customer Support

## Assumptions
- Incident Commander is a separate person from the investigator

## Constraints
- Approval rules or compliance requirements: SEV1 incidents need executive notification within 30 minutes
- Existing organization or team structure: Follow-the-sun on-call rotation

## Additional information
`,
    },
  ],

  workflow: [
    {
      title: "Employee onboarding",
      description: "Steps, approvals and handoffs for a new hire",
      prompt: `## Process
- Name and purpose: New employee onboarding for all full-time hires
- Start event: Offer is accepted in the HR system
- End events: Employee completes first-week tasks (success); offer withdrawn (exit)

## Steps and actors
- Steps in order (one per line, with the actor for each):
  - Create employee record (HR Coordinator)
  - Order laptop and accounts (IT Administrator)
  - Run background check (HR Coordinator, third-party provider)
  - Assign training plan (Manager)
  - Complete first-day orientation (New hire)
- Systems used in each step: Workday, ServiceNow, Okta
- Handoffs between teams or systems: HR to IT after the record is created; IT to manager when accounts are ready

## Decisions and exceptions
- Decision points: Background check passed or failed? If failed, HR reviews and decides whether to continue
- Failure and exception paths: Laptop out of stock means a loaner is issued; accounts that fail to create are retried and escalated after 24 hours

## Assumptions
- Background checks take 3 to 5 days

## Constraints
- Service levels or deadlines: Accounts ready before the start date
- Compliance and approvals: Background check consent is recorded before any check starts

## Additional information
`,
    },
    {
      title: "Customer refund request",
      description: "Review, approval and payment with failure paths",
      prompt: `## Process
- Name and purpose: Handling refund requests from customers for online orders
- Start event: Customer submits a refund request in the account portal
- End events: Refund paid to the customer; request rejected with a reason

## Steps and actors
- Steps in order (one per line, with the actor for each):
  - Validate the order and refund window (Support Agent)
  - Check for fraud signals (automated rules)
  - Review high-value requests (Support Team Lead)
  - Issue the refund (Payments system)
  - Notify the customer (Automated email)
- Systems used in each step: Order management, fraud rules engine, Stripe
- Handoffs between teams or systems: Support Agent to Team Lead for requests over $500

## Decisions and exceptions
- Decision points: Inside the refund window? Fraud flag raised? Amount over $500?
- Failure and exception paths: Payment provider error retries three times, then the agent is alerted; disputed orders go to the Chargeback team

## Assumptions
- Refunds are issued to the original payment method

## Constraints
- Service levels or deadlines: Decision within 2 business days
- Compliance and approvals: Two approvals for refunds above $5,000

## Additional information
`,
    },
  ],
};

/** True when the editor holds nothing the user wrote: empty, or a template or sample prompt. */
export function isUntouchedPrompt(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === "") return true;
  const known = [
    ...Object.values(TEMPLATES),
    ...Object.values(SAMPLE_PROMPTS).flatMap((samples) => samples.map((sample) => sample.prompt)),
  ];
  return known.some((template) => template.trim() === trimmed);
}

export const DIAGRAM_TYPE_LABELS = Object.fromEntries(DIAGRAM_TYPES.map((t) => [t.value, t.label])) as Record<
  DiagramType,
  string
>;
