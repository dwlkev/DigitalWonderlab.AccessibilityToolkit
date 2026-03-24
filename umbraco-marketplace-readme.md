# Accessibility Toolkit

An Umbraco backoffice package that adds an **Accessibility** tab to every content page. Combines 37 server-side WCAG checks with **axe-core** powered visual analysis — covering colour contrast, ARIA names, landmark structure, and more — to give you a scored, actionable report on every page.

![Page scan](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-page-scan.jpg)

![Scan history](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-page-history.jpg)

![Scan report](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-report-scan.jpg)

![Audit history](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-site-audit-history.jpg)

![Printable report](https://raw.githubusercontent.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/main/screenshots/accessibility-report.jpg)

## Features
- Workspace view tab on every content page
- **37 server-side WCAG checks** across Level A, AA, and AAA
- **axe-core visual checks** — 30+ additional rules run against the live rendered DOM in the editor's browser: colour contrast, ARIA names, landmark structure, meta-refresh, and more
- Score gauge (0-100) with checks run / checks flagged summary
- Issues grouped by **Content / Code / Design** categories with severity badges (critical, serious, moderate, minor)
- Expandable issue details with element snippets, selectors, and fix recommendations
- Severity filtering and score delta indicator compared with previous scan
- CSV and report export options
- Page-level run history with per-run export actions
- WCAG level selection (A, AA, AAA)
- Content dashboard with Recent Reports, Site Audit, FAQ, Help & Services, and Settings
- Site audits across a selected content subtree with saved audit history and re-export
- Element preview snippets captured inline for visual issues
- Settings license panel showing mode/status/features/expiry/domain

## Compatibility
- Umbraco 17+
- .NET 10.0
- Works on Umbraco Cloud, Azure App Service, and all standard hosting environments
- No server-side dependencies — no headless browsers, no server-side binaries, no additional infrastructure
- axe-core loads client-side in the editor's browser; falls back gracefully if unavailable (offline/intranet)

## Installation
- Install via NuGet https://www.nuget.org/packages/DigitalWonderlab.AccessibilityToolkit/latest
- No configuration required — install, restart, and start scanning
- Navigate to any content page and click the Accessibility tab

## Current Release Notes
- All features enabled out of the box — no configuration required.
- Anonymous usage telemetry is opt-out via the dashboard Settings tab.

## Issues / Suggestions
- To report an issue or suggest a feature please use the GitHub issue tracker - https://github.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/issues
