# Accessibility Toolkit for Umbraco

An Umbraco backoffice package that adds comprehensive WCAG 2.1 accessibility checking to your content workflow. Editors can run checks on individual pages or audit entire site sections, with instant scored reports, scan history, and CSV exports.

## Features

### Page-Level Checks
- **Accessibility tab** on every content page in the workspace
- **37 WCAG checks** across Level A, AA, and AAA
- **Score gauge** (0-100) with colour-coded rating
- **Categorised issues table** with impact badges (critical/serious/moderate/minor)
- **Grouped issues** with expandable detail rows showing element snippets, selectors, and fix recommendations
- **Category filtering** and **impact sorting**
- **CSV export** for offline review and reporting
- **Scan history** per page showing scores over time

### Site Audits
- **Site audit tool** — pick a content node and scan it plus all descendants in one go
- **Summary cards** showing pages scanned, average score, and total issues
- **Collapsible page list** — summary shown up front, per-page details expandable
- **Audit history** — all past audits stored with full results, re-exportable as CSV at any time
- **Delete** individual audit records or scan history entries

### Dashboard
- **Accessibility Toolkit dashboard** in the Content section
- **Recent Reports** — paginated table of all recent page-level scans
- **Audit History** — table of past site audits with re-export and delete
- **Site Audit** form with content node picker and WCAG level selector

### Visual Checks (Coming Soon)
- Browser-based accessibility analysis using Playwright and axe-core
- Catches issues that static HTML analysis cannot: computed color contrast, touch target sizes, focus indicator visibility, text reflow, text spacing tolerance, and z-index stacking
- Premium feature with locked preview in the backoffice

## Compatibility

- Umbraco 17+
- .NET 10.0

## Installation

Install via NuGet:

```
dotnet add package DigitalWonderlab.AccessibilityToolkit
```

Or search for `DigitalWonderlab.AccessibilityToolkit` in the NuGet Package Manager.

No additional configuration required. The package registers itself automatically via an Umbraco composer and creates its database tables on startup.

## Usage

### Individual Page Check
1. Navigate to any content page in the Umbraco backoffice
2. Click the **Accessibility** tab in the content workspace
3. Select a WCAG level (A, AA, or AAA)
4. Click **Run Check**
5. Review the score, impact summary, and issues
6. Click **Export CSV** to download the report

### Site Audit
1. Go to the **Content** section and open the **Accessibility Toolkit** dashboard
2. Click **Pick Content Node** to select a root node (or paste a GUID)
3. Select a WCAG level
4. Click **Run Audit**
5. Review the summary cards and expand the page list for per-page results
6. Click **Export CSV** to download the full audit report

### Re-Exporting Past Audits
Past audits are stored with their full results. In the Audit History table on the dashboard, click **Export** on any row to regenerate the CSV.

## WCAG Checks Included (37 checks)

### Level A (24 checks)
| Check | WCAG Criterion | Detects |
|-------|---------------|---------|
| Heading Hierarchy | 1.3.1 | Skipped heading levels, multiple/missing h1, empty headings |
| Image Alt Text | 1.1.1 | Missing/empty alt attributes, filename-as-alt, generic alt text |
| Form Labels | 1.3.1, 4.1.2 | Form inputs without associated labels |
| Link Text | 2.4.4 | Empty links, generic link text ("click here", "read more") |
| Language Attribute | 3.1.1 | Missing or invalid lang attribute on html element |
| ARIA Attributes | 4.1.2 | Broken aria references, invalid roles, aria-hidden on focusable |
| Semantic HTML | 1.3.1 | Missing landmark elements (main, nav, header, footer) |
| Table Structure | 1.3.1 | Data tables missing headers, scope attributes, or captions |
| Page Title | 2.4.2 | Missing or empty page title |
| Duplicate IDs | 4.1.1 | Duplicate id attributes in the document |
| Interactive Elements | 4.1.2 | Interactive elements missing accessible names |
| Color Contrast (static) | 1.4.3 | Inline styles with insufficient contrast ratios |
| Media | 1.2.1 | Audio/video elements missing captions or descriptions |
| Iframe Title | 2.4.1 | Iframes missing title attributes |
| List Structure | 1.3.1 | Incorrect list nesting and structure |
| Form Grouping | 1.3.1 | Related form controls not grouped with fieldset/legend |
| Target Blank | 2.4.4 | Links opening new windows without warning |
| Bypass Blocks | 2.4.1 | Missing skip navigation links |
| Tabindex | 2.4.3 | Positive tabindex values disrupting natural tab order |
| Keyboard Events | 2.1.1 | Mouse-only event handlers without keyboard equivalents |
| Label in Name | 2.5.3 | Accessible name doesn't contain visible label text |
| Autocomplete | 1.3.5 | Missing or invalid autocomplete attributes on inputs |
| Media Alternatives | 1.2.1 | Media without text alternatives |
| Error Identification | 3.3.1 | Form error messages not programmatically associated |

### Level AA (7 checks)
| Check | WCAG Criterion | Detects |
|-------|---------------|---------|
| Meta Viewport | 1.4.4 | Zoom disabled via user-scalable=no or restrictive maximum-scale |
| Language of Parts | 3.1.2 | Content in other languages missing lang attribute |
| Status Messages | 4.1.3 | Dynamic status messages missing ARIA live regions |
| Text Spacing | 1.4.12 | Content that may break with adjusted text spacing |
| Reflow | 1.4.10 | Horizontal scrolling at 320px viewport width |
| Input Purpose | 1.3.5 | Common input fields missing autocomplete attributes |
| Focus Not Restricted | 2.4.11 | Focus trapped within components |

### Level AAA (6 checks)
| Check | WCAG Criterion | Detects |
|-------|---------------|---------|
| Link Purpose (Full) | 2.4.9 | Links not understandable out of context |
| Section Headings | 2.4.10 | Content sections without headings |
| Enhanced Contrast | 1.4.6 | Inline styles below 7:1 contrast ratio |
| Target Size | 2.5.5 | Interactive elements smaller than 44x44px |
| Abbreviations | 3.1.4 | Abbreviations without expansion |
| Reading Level | 3.1.5 | Content readability indicators |

## Configuration

### Visual Checks (optional)

To enable the visual checks feature (coming soon), add to your `appsettings.json`:

```json
{
  "AccessibilityToolkit": {
    "VisualChecks": {
      "Enabled": true
    }
  }
}
```

When disabled (default), the workspace view shows a locked preview of the visual checks feature.

## How It Works

The tool fetches the published HTML of each page server-side using `HttpClient`, parses it with HtmlAgilityPack, and runs rule-based checks against the DOM. Results are stored in the database (`dwAccessibilityResults` for per-page scans, `dwAccessibilityAudits` for full site audits) so history and re-exports are always available.

## API Endpoints

All endpoints are under `/umbraco/AccessibilityToolkit/Accessibility/` and require backoffice authentication:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `Check?nodeKey={guid}&level=AA` | Run accessibility check on a single page |
| GET | `GetHistory?nodeKey={guid}` | Get scan history for a specific page |
| GET | `GetRecentHistory?count=20` | Get recent page-level scans |
| DELETE | `DeleteHistory?id={int}` | Delete a scan history entry |
| POST | `RunAudit?nodeKey={guid}&level=AA` | Run audit on a node and all descendants |
| GET | `GetRecentAudits?count=20` | Get recent audit summaries |
| GET | `ExportAudit?id={int}` | Get full audit results JSON for re-export |
| DELETE | `DeleteAudit?id={int}` | Delete an audit record |
| GET | `GetFeatures` | Get enabled feature flags |

## Issues / Suggestions

To report an issue or suggest a feature, please use the GitHub issue tracker:
https://github.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/issues
