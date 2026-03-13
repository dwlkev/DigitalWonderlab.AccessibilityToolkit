# Accessibility Toolkit

An Umbraco backoffice package that adds an **Accessibility** tab to every content page. Run WCAG accessibility checks against published pages and get a scored report with actionable recommendations.

![Page scan](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-page-scan.jpg)

![Scan history](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-page-history.jpg)

![Scan report](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-report-scan.jpg)

![Audit history](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-site-audit-history.jpg)

![Printable report](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-report.jpg)

## Features
- Workspace view tab on every content page
- 37 WCAG checks across Level A, AA, and AAA
- Score gauge (0-100) with impact breakdown
- Issues grouped by **Content / Code / Design** categories with severity badges (critical, serious, moderate, minor)
- Expandable issue details with element snippets, selectors, and fix recommendations
- Severity filtering and score delta indicator compared with previous scan
- CSV and report export options
- Page-level run history with per-run export actions
- WCAG level selection (A, AA, AAA)
- Content dashboard with Recent Reports, Site Audit, FAQ, Help & Services, and Settings
- Site audits across a selected content subtree with saved audit history and re-export
- Browser-based visual contrast checks with inline preview snippets and graceful fallback
- Settings license panel showing mode/status/features/expiry/domain

## Compatibility
- Umbraco 17+
- .NET 10.0

## Installation
- Install via NuGet https://www.nuget.org/packages/DigitalWonderlab.AccessibilityToolkit/latest
- Navigate to any content page and click the Accessibility tab

## Current Release Notes
- All features enabled out of the box — no configuration required.
- Anonymous usage telemetry is opt-out via the dashboard Settings tab.

## Issues / Suggestions
- To report an issue or suggest a feature please use the GitHub issue tracker - https://github.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/issues
