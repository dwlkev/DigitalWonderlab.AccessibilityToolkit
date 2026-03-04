using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class SemanticHtmlCheck : IAccessibilityCheck
{
    public string RuleId => "semantic-html";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Check for <main> landmark
        var mains = document.DocumentNode.SelectNodes("//main");
        var roleMain = document.DocumentNode.SelectNodes("//*[@role='main']");
        var mainCount = (mains?.Count ?? 0) + (roleMain?.Count ?? 0);

        if (mainCount == 0)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page is missing a <main> landmark.",
                Category = AccessibilityCategory.Semantics,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "moderate",
                Element = "",
                Selector = "main",
                Recommendation = "Wrap the primary content in a <main> element."
            });
        }
        else if (mainCount > 1)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = "multiple-main-landmarks",
                Description = $"Page has {mainCount} <main> landmarks. There should be only one.",
                Category = AccessibilityCategory.Semantics,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "moderate",
                Element = "",
                Selector = "main",
                Recommendation = "Use a single <main> element to identify the primary content area."
            });
        }

        // Check for <nav> landmark
        var nav = document.DocumentNode.SelectSingleNode("//nav") ??
                  document.DocumentNode.SelectSingleNode("//*[@role='navigation']");
        if (nav == null)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page is missing a <nav> landmark.",
                Category = AccessibilityCategory.Semantics,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "minor",
                Element = "",
                Selector = "nav",
                Recommendation = "Wrap navigation links in a <nav> element."
            });
        }

        // Check for <header> landmark
        var header = document.DocumentNode.SelectSingleNode("//header") ??
                     document.DocumentNode.SelectSingleNode("//*[@role='banner']");
        if (header == null)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page is missing a <header> landmark.",
                Category = AccessibilityCategory.Semantics,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "minor",
                Element = "",
                Selector = "header",
                Recommendation = "Add a <header> element for the site banner/header area."
            });
        }

        // Check for <footer> landmark
        var footer = document.DocumentNode.SelectSingleNode("//footer") ??
                     document.DocumentNode.SelectSingleNode("//*[@role='contentinfo']");
        if (footer == null)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page is missing a <footer> landmark.",
                Category = AccessibilityCategory.Semantics,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "minor",
                Element = "",
                Selector = "footer",
                Recommendation = "Add a <footer> element for the site footer area."
            });
        }

        return issues;
    }
}
