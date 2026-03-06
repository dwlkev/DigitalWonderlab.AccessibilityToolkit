# Project Context — DigitalWonderlab.AccessibilityToolkit

## What This Is

A NuGet package for Umbraco 17+ (.NET 10.0) that adds automated WCAG 2.1 accessibility checking to the Umbraco backoffice. It fetches the published HTML of content pages, runs 37 rule-based checks against the DOM, and presents results in the backoffice UI.

This is a **library project** that gets packed as a NuGet package and consumed by Umbraco sites. It is NOT a standalone web application.

## Architecture

### Backend (C#)

- **Controller**: `Controllers/AccessibilityController.cs` — inherits `UmbracoApiController` with `[PluginController("AccessibilityToolkit")]`. All endpoints are backoffice-authenticated. Convention-based routing: `/umbraco/AccessibilityToolkit/Accessibility/{Action}`.
- **Analyzer**: `Services/AccessibilityAnalyzer.cs` / `IAccessibilityAnalyzer` — fetches page HTML via `HttpClient`, passes it through all registered `IAccessibilityCheck` implementations, returns an `AccessibilityResult`.
- **Checks**: `Checks/` — 37 classes implementing `IAccessibilityCheck`. Each receives parsed HTML (HtmlAgilityPack) and returns issues. Checks are registered in the composer and run at the WCAG level the user selects (A, AA, or AAA).
- **Result Store**: `Services/AccessibilityResultStore.cs` / `IAccessibilityResultStore` — CRUD for two DB tables using NPoco with raw `new Sql(...)` queries (NOT generic `From<T>()`).
- **Licence Service**: `Services/AccessibilityLicenceService.cs` / `IAccessibilityLicenceService` — reads `AccessibilityToolkit:VisualChecks:Enabled` from `IConfiguration`. Currently a simple bool flag; will become licence key validation later.
- **Migrations**: `Migrations/` — `MigrationBase` subclasses creating `dwAccessibilityResults` and `dwAccessibilityAudits` tables. Chained in `RunAccessibilityMigration.cs`.
- **Composer**: `Startup/AccessibilityToolkitComposer.cs` — registers all services, checks, and the migration handler.

### Frontend (JavaScript)

Vanilla web components with Shadow DOM. No build step, no framework. Files live in `App_Plugins/AccessibilityToolkit/` and are packed into the NuGet package as content.

- **`accessibility-toolkit.js`** — Workspace view (Accessibility tab on each content node). Score gauge, issues table, scan history, visual checks preview.
- **`accessibility-dashboard.js`** — Dashboard in the Content section. Recent reports, audit history, site audit form.
- **`accessibility-dashboard-template.html`** — HTML template loaded by the dashboard JS.
- **`accessibility-toolkit-style.css`** — Shared styles for both views.
- **`umbraco-package.json`** — Registers the workspace view and dashboard with Umbraco.

### Database Tables

- **`dwAccessibilityResults`** — Per-page scan results (node key, URL, score, issue counts, full JSON, timestamp).
- **`dwAccessibilityAudits`** — Full audit runs (root node key, level, page count, avg score, total issues, full JSON for re-export, timestamp).

### NuGet Packaging

- `App_Plugins/` files are packed as content via `<Content Include="App_Plugins\...">` in the csproj.
- A `.targets` file in `buildTransitive/` copies App_Plugins to the consuming project on build and removes them on clean.
- The package is built to `bin/Release/` and consumed by the test baseline via a local NuGet source (`LocalDWL` in the baseline's `nuget.config`).

## Key Files

| File | Purpose |
|---|---|
| `DigitalWonderlab.AccessibilityToolkit.csproj` | Project config, version, NuGet metadata |
| `Startup/AccessibilityToolkitComposer.cs` | DI registration for all services and checks |
| `Controllers/AccessibilityController.cs` | All API endpoints |
| `Services/AccessibilityAnalyzer.cs` | Core scan engine |
| `Services/AccessibilityResultStore.cs` | Database CRUD |
| `Services/AccessibilityLicenceService.cs` | Feature flag for premium features |
| `Migrations/RunAccessibilityMigration.cs` | Migration plan orchestrator |
| `Models/AccessibilityResult.cs` | Scan result model returned by analyzer |
| `Models/AccessibilityResultDto.cs` | NPoco DTO for results table |
| `Models/AccessibilityAuditDto.cs` | NPoco DTO for audits table |
| `App_Plugins/AccessibilityToolkit/umbraco-package.json` | Umbraco extension registration |

## API Endpoints

All under `/umbraco/AccessibilityToolkit/Accessibility/`, backoffice auth required:

| Method | Action | Purpose |
|---|---|---|
| GET | `Check?nodeKey={guid}&level=AA` | Scan a single page |
| GET | `GetHistory?nodeKey={guid}` | Page scan history |
| GET | `GetRecentHistory?count=20` | Recent scans across all pages |
| DELETE | `DeleteHistory?id={int}` | Delete a scan record |
| POST | `RunAudit?nodeKey={guid}&level=AA` | Audit node + all descendants |
| GET | `GetRecentAudits?count=20` | Recent audit summaries |
| GET | `ExportAudit?id={int}` | Full audit JSON for CSV re-export |
| DELETE | `DeleteAudit?id={int}` | Delete an audit record |
| GET | `GetFeatures` | Feature flags (visualChecks bool) |

## Development & Testing Workflow

The test environment is a separate Umbraco site at `C:\Users\KevinTriggle\source\repos\dwl-baseline`.

**After every code change, the full deploy cycle must be completed:**

1. Bump `<Version>` in the csproj
2. `dotnet pack -c Release -o bin/Release`
3. Clear NuGet cache: `rm -rf C:/Users/KevinTriggle/.nuget/packages/digitalwonderlab.accessibilitytoolkit`
4. Update version in `dwl-baseline/src/UmbracoProject/UmbracoProject.csproj`
5. `dotnet restore && dotnet build` on the baseline
6. Verify App_Plugins deployed and build has 0 errors

Never use project references. Always NuGet package. This ensures the packaging and content deployment works correctly.

## Technical Constraints

- **NPoco queries**: Use raw `new Sql(...)`, never generic `From<T>()`/`Select<T>()` — they don't work with Umbraco's scope provider.
- **IScopeProvider**: Import from `Umbraco.Cms.Infrastructure.Scoping`, not `Umbraco.Cms.Core.Scoping`.
- **SQL dialect**: Use ANSI SQL (`OFFSET...FETCH NEXT`), not SQL Server-specific syntax (`TOP`). Umbraco supports SQLite too.
- **Deprecated APIs**: `MigrationBase`, `UmbracoApiController`, and `Upgrader.Execute` are all deprecated in v17 (removal in v18). Acceptable for now.
- **DLL locking**: If Visual Studio / IIS Express is running the baseline, the toolkit DLL will be locked. User must stop debugging before rebuilding.

## Planned Features (Not Yet Implemented)

- **Visual checks**: Client-side axe-core injection into an iframe to catch computed style issues (color contrast, target sizes, focus indicators, reflow, text spacing). Will use the browser the editor is already in rather than server-side Playwright.
- **Licence key validation**: Replace the config-based bool with proper licence key checking for premium features.
- **Page exclusions**: Allow users to exclude specific pages from audits.

## Current Version

**1.3.2**
