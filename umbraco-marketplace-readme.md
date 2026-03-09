# Accessibility Toolkit

An Umbraco backoffice package that adds an **Accessibility** tab to every content page. Run WCAG accessibility checks against published pages and get a scored report with actionable recommendations.

## Features
- Workspace view tab on every content page
- 37 WCAG checks across Level A, AA, and AAA
- Score gauge (0-100) with impact breakdown
- Categorised issues table with expandable details
- Severity filtering and score delta indicator on page checks
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
- Licensing is currently configuration-driven (`AccessibilityToolkit:Licensing:*`), with signed-key validation planned.
- Telemetry is not yet implemented.

## Issues / Suggestions
- To report an issue or suggest a feature please use the GitHub issue tracker - https://github.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/issues
