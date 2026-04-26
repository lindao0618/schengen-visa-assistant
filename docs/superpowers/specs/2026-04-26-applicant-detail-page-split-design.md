# Applicant Detail Page Split Design

## Goal

Reduce the runtime and maintenance pressure of [`d:\Ai-user\schengen-visa-assistant (2)\visa-assistant\app\applicants\[id]\ApplicantDetailClientPage.tsx`](d:\Ai-user\schengen-visa-assistant%20(2)\visa-assistant\app\applicants\%5Bid%5D\ApplicantDetailClientPage.tsx) without changing the `/applicants/[id]` route shape, user-visible workflow, or existing automation behavior.

The immediate target is to break the current monolithic client component into smaller, bounded modules so the page becomes safer to change and easier to optimize further.

## Current Problem

The current detail page is a single client component of roughly 3300 lines that mixes:

- applicant detail fetching and refresh logic
- permission and read-only gating
- profile form state
- case form state
- file upload and download actions
- Excel preview and inline editing
- Word/HTML/text preview
- audit dialog state and repair actions
- tab layout and top-level user messaging

This produces three concrete problems:

1. The page is difficult to reason about and easy to regress.
2. Heavy preview logic and large dialog state live in the main page bundle even when users only need basic detail editing.
3. Follow-up performance work such as lazy loading, cache tightening, or route-level profiling is harder because responsibilities are not isolated.

## Scope

This design covers only the applicant detail page under `/applicants/[id]`.

In scope:

- splitting state and UI responsibilities into focused modules
- preserving existing tab structure
- preserving role-based behavior from the current permissions work
- making later bundle and render optimizations easier

Out of scope:

- changing route paths
- changing API contracts beyond what the page already consumes
- removing any existing file preview, Excel edit, or audit behavior
- rewriting automation workflows
- redesigning the visual layout

## Recommended Approach

Use a page-shell pattern with a single controller hook and tab-specific child components.

Recommended structure:

- keep [`d:\Ai-user\schengen-visa-assistant (2)\visa-assistant\app\applicants\[id]\page.tsx`](d:\Ai-user\schengen-visa-assistant%20(2)\visa-assistant\app\applicants\%5Bid%5D\page.tsx) as the server entry
- reduce [`d:\Ai-user\schengen-visa-assistant (2)\visa-assistant\app\applicants\[id]\ApplicantDetailClientPage.tsx`](d:\Ai-user\schengen-visa-assistant%20(2)\visa-assistant\app\applicants\%5Bid%5D\ApplicantDetailClientPage.tsx) to a page shell
- move shared state and side effects into a controller hook
- move heavy dialogs and tab content into dedicated files

This is preferred over a pure lazy-loading pass because the primary problem is not only bundle size, but also responsibility sprawl. It is also preferred over a full rewrite because the existing workflows are already live and tightly coupled to current business logic.

## Target File Structure

The split should introduce a detail module under the current route folder:

- `app/applicants/[id]/detail/use-applicant-detail-controller.ts`
- `app/applicants/[id]/detail/basic-tab.tsx`
- `app/applicants/[id]/detail/cases-tab.tsx`
- `app/applicants/[id]/detail/materials-tab.tsx`
- `app/applicants/[id]/detail/progress-tab.tsx`
- `app/applicants/[id]/detail/material-preview-dialog.tsx`
- `app/applicants/[id]/detail/audit-dialog.tsx`
- `app/applicants/[id]/detail/types.ts`

The existing page shell file remains the integration point and imports these modules.

## Responsibilities By Module

### ApplicantDetailClientPage page shell

The page shell should only:

- read the requested tab from the URL
- initialize the controller hook
- render the tab list and shared header
- pass controller state and actions into the tab components
- mount dialogs with their extracted props

The page shell should no longer own detailed Excel preview logic, large blocks of case form rendering, or most asynchronous request code.

### use-applicant-detail-controller

This hook becomes the single state coordinator for the page. It should own:

- detail fetch and refresh
- top-level loading and message state
- selected case and form initialization
- save/delete/create actions for applicant and case records
- permission-derived booleans such as `isReadOnly`, `canAssign`, and `canRunAutomation`
- dialog open/close state and payload

This hook is the main boundary that allows the UI to become mostly declarative.

### basic-tab

This component receives:

- profile form state
- read-only flags
- save handler
- display helpers

It should not fetch data directly or manage unrelated page state.

### cases-tab

This component receives:

- case list
- selected case id
- case form state
- create/save/switch handlers
- role-based capability flags

It should encapsulate case rendering and editing UI but not own cross-page dialog state.

### materials-tab

This component receives:

- applicant files and metadata
- upload/download handlers
- preview trigger handler
- audit trigger handler
- read-only and automation capability flags

It should not implement preview parsing internally. It should only trigger dedicated dialogs.

### progress-tab

This component receives already-prepared data and only renders progress-oriented content such as status and reminder-related views.

### material-preview-dialog

This component owns the heavy preview surface:

- Excel workbook parsing and sheet switching
- inline Excel cell edits
- workbook save-back flow
- Word preview via `mammoth`
- text, image, and HTML preview modes

This isolates the most expensive and least frequently used code path from the page shell.

### audit-dialog

This component owns:

- audit progress state display
- issue list rendering
- auto-fix trigger flow
- audit-specific helper text

This keeps automation-adjacent UI out of the main page body.

## Data Flow

The data flow should become:

1. `page.tsx` validates session and passes `applicantId` and `viewerRole`
2. `ApplicantDetailClientPage` resolves the requested tab
3. `useApplicantDetailController` loads and normalizes the detail state
4. tab components render from controller-provided state
5. dialogs receive focused state slices and action callbacks from the controller

This keeps all remote effects and shared mutations in one place while letting UI modules remain focused.

## Rollout Order

To reduce risk, implementation should be incremental.

### Step 1: Extract controller

Move fetch, refresh, permission flags, and top-level mutation handlers into `use-applicant-detail-controller.ts` while keeping the UI mostly intact.

Why first:

- lowest visual risk
- immediately reduces state sprawl in the page shell
- creates a stable API for later UI extraction

### Step 2: Extract preview and audit dialogs

Move preview, Excel editing, `mammoth` parsing, and audit dialog rendering into dedicated modules.

Why second:

- cuts the heaviest logic from the main file
- isolates the least frequently used code path
- prepares for later lazy loading if desired

### Step 3: Extract cases tab

Move case editing, selection, and creation UI into `cases-tab.tsx`.

Why third:

- this is the second-largest responsibility cluster
- it has enough internal structure to stand on its own after controller extraction

### Step 4: Extract basic and progress tabs

Move the remaining simpler tab content into focused files, leaving the page shell as a composition layer.

Why last:

- lowest urgency compared with preview and case flows
- easiest to complete once the core state boundaries already exist

## Behavior Guarantees

The split must preserve:

- route: `/applicants/[id]`
- current tab names and tab navigation behavior
- applicant save, delete, and case save flows
- file upload, preview, and download behavior
- Excel online edit and save-back behavior
- audit dialog and auto-fix behavior
- permissions for boss, supervisor, specialist, and service roles

The goal is structural improvement first, not workflow change.

## Error Handling

The extracted modules should keep current behavior, but ownership becomes clearer:

- controller handles request failures and top-level user messages
- preview dialog handles preview parsing and preview save failures
- audit dialog handles audit action status transitions
- tab components stay mostly presentational and should not invent their own fetch layers

This reduces the chance of duplicated or inconsistent error reporting.

## Testing Strategy

Implementation should verify behavior at three levels:

- unit tests for any extracted pure helpers or controller utilities
- integration checks for detail page load, case switching, and preview open/save behavior
- build and lint verification to ensure the split does not break route compilation

At minimum, each extraction step should keep:

- `npm run lint`
- `npm run build`

Where feasible, targeted tests should be added around controller-level logic or newly extracted pure helpers.

## Risks

### Prop-drilling explosion

If the controller surface is too broad, tab components may receive unwieldy prop lists. Mitigation: define shared route-level types in `detail/types.ts` and group related actions into small objects.

### Hidden state coupling

Some local state may currently depend on execution order inside the monolith. Mitigation: extract incrementally and verify each step before the next.

### Premature visual churn

Large JSX moves can accidentally alter layout. Mitigation: keep markup stable during extraction and avoid opportunistic redesign.

## Success Criteria

This design is successful when:

- the applicant detail route still behaves the same for end users
- `ApplicantDetailClientPage.tsx` becomes a small integration shell rather than a monolith
- preview and audit logic no longer live in the page shell
- case editing UI is isolated from unrelated material preview logic
- future performance work can target smaller modules instead of a single 3300-line file

