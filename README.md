# Accessibility Toolkit for Umbraco

An Umbraco backoffice package that adds an **Accessibility** tab to every content page. Editors can run WCAG accessibility checks against the published version of their pages and get an instant scored report with actionable recommendations.

## Features

- **Workspace view tab** on every content page - no separate dashboard needed
- **9 WCAG checks** covering structure, images, forms, links, language, ARIA, semantics, tables, and viewport
- **Score gauge** (0-100) with colour-coded rating (green/orange/red)
- **Categorised issues table** with impact badges (critical/serious/moderate/minor)
- **Expandable detail rows** showing element snippets, selectors, and fix recommendations
- **Category filtering** and **impact sorting**
- **CSV export** for offline review and reporting
- **WCAG level selection** - check against Level A, AA, or AAA

## Compatibility

- Umbraco 17+
- .NET 10.0

## Installation

Install via NuGet:

```
dotnet add package DigitalWonderlab.AccessibilityToolkit
```

Or search for `DigitalWonderlab.AccessibilityToolkit` in the NuGet Package Manager.

## Usage

1. Navigate to any content page in the Umbraco backoffice
2. Click the **Accessibility** tab in the content workspace
3. Select a WCAG level (A, AA, or AAA)
4. Click **Run Check**
5. Review the score and issues
6. Click **Export CSV** to download the report

## WCAG Checks Included

| Check | WCAG Criterion | Level | Detects |
|-------|---------------|-------|---------|
| Heading Hierarchy | 1.3.1 | A | Skipped heading levels, multiple/missing h1, empty headings |
| Image Alt Text | 1.1.1 | A | Missing/empty alt attributes, filename-as-alt, generic alt text |
| Form Labels | 1.3.1, 4.1.2 | A | Form inputs without associated labels |
| Link Text | 2.4.4 | A | Empty links, generic link text ("click here", "read more") |
| Language Attribute | 3.1.1 | A | Missing or invalid lang attribute on html element |
| ARIA Attributes | 4.1.2 | A | Broken aria references, invalid roles, aria-hidden on focusable elements |
| Semantic HTML | 1.3.1 | A | Missing landmark elements (main, nav, header, footer) |
| Meta Viewport | 1.4.4 | AA | Zoom disabled via user-scalable=no or restrictive maximum-scale |
| Table Structure | 1.3.1 | A | Data tables missing headers, scope attributes, or captions |

## How It Works

The tool fetches the published HTML of the page server-side using `HttpClient`, parses it with HtmlAgilityPack, and runs rule-based checks against the DOM. No iframes or client-side rendering required.

## Issues / Suggestions

To report an issue or suggest a feature, please use the GitHub issue tracker:
https://github.com/dwlkev/DigitalWonderlab.AccessibilityToolkit/issues
