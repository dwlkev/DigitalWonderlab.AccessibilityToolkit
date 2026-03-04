using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.4.1 – Bypass Blocks (Level A)
/// Detects missing skip-to-content link or navigation landmark.
/// </summary>
public class BypassBlocksCheck : IAccessibilityCheck
{
    public string RuleId => "bypass-blocks";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly string[] SkipLinkPatterns = [
        "skip to content", "skip to main", "skip navigation", "skip nav",
        "skip to main content", "jump to content", "jump to main"
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Check for skip link
        var hasSkipLink = false;
        var allLinks = document.DocumentNode.SelectNodes("//a[@href]");
        if (allLinks != null)
        {
            foreach (var link in allLinks)
            {
                var href = link.GetAttributeValue("href", "");
                if (!href.StartsWith("#") || href == "#") continue;

                var text = (link.InnerText?.Trim() ?? "").ToLowerInvariant();
                var ariaLabel = link.GetAttributeValue("aria-label", "").ToLowerInvariant();

                if (SkipLinkPatterns.Any(p => text.Contains(p) || ariaLabel.Contains(p)))
                {
                    hasSkipLink = true;
                    break;
                }
            }
        }

        // Check for nav landmark
        var hasNavLandmark = document.DocumentNode.SelectSingleNode("//nav") != null
                          || document.DocumentNode.SelectSingleNode("//*[@role='navigation']") != null;

        // Check for main landmark
        var hasMainLandmark = document.DocumentNode.SelectSingleNode("//main") != null
                           || document.DocumentNode.SelectSingleNode("//*[@role='main']") != null;

        if (!hasSkipLink && !hasNavLandmark)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page has no skip navigation link and no <nav> landmark to help users bypass repeated blocks.",
                Category = AccessibilityCategory.Navigation,
                Level = WcagLevel.A,
                WcagCriterion = "2.4.1",
                Impact = "serious",
                Element = "",
                Selector = "body",
                Recommendation = "Add a 'Skip to main content' link at the top of the page, or use <nav> landmarks to structure navigation."
            });
        }
        else if (!hasSkipLink && !hasMainLandmark)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page has no skip navigation link and no <main> landmark. Users cannot easily bypass repeated content.",
                Category = AccessibilityCategory.Navigation,
                Level = WcagLevel.A,
                WcagCriterion = "2.4.1",
                Impact = "moderate",
                Element = "",
                Selector = "body",
                Recommendation = "Add a 'Skip to main content' link at the top of the page targeting the main content area."
            });
        }

        return issues;
    }
}
