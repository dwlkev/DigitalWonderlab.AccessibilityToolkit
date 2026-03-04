using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class HeadingHierarchyCheck : IAccessibilityCheck
{
    public string RuleId => "heading-hierarchy";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly string[] GenericHeadingTexts = [
        "title", "heading", "header", "section", "untitled", "new section",
        "text", "content", "placeholder", "lorem ipsum"
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var headings = document.DocumentNode.SelectNodes("//h1|//h2|//h3|//h4|//h5|//h6");

        if (headings == null || headings.Count == 0)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page has no headings. Headings provide document structure for screen readers.",
                Category = AccessibilityCategory.Structure,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "serious",
                Element = "",
                Selector = "",
                Recommendation = "Add at least one h1 heading to define the page's main topic."
            });
            return issues;
        }

        // Check for multiple h1s
        var h1s = headings.Where(h => h.Name == "h1").ToList();
        if (h1s.Count == 0)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page has no h1 heading.",
                Category = AccessibilityCategory.Structure,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "serious",
                Element = "",
                Selector = "h1",
                Recommendation = "Add a single h1 heading that describes the page content."
            });
        }
        else if (h1s.Count > 1)
        {
            foreach (var h1 in h1s.Skip(1))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Multiple h1 headings found. A page should have a single h1.",
                    Category = AccessibilityCategory.Structure,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(h1),
                    Selector = "h1",
                    Recommendation = "Use only one h1 per page. Demote additional h1s to h2 or lower."
                });
            }
        }

        // Check for empty headings
        foreach (var heading in headings)
        {
            var text = heading.InnerText?.Trim();
            if (string.IsNullOrEmpty(text))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Empty {heading.Name} heading found.",
                    Category = AccessibilityCategory.Structure,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(heading),
                    Selector = heading.Name,
                    Recommendation = "Remove empty headings or add meaningful text content."
                });
            }
        }

        // Check for generic heading text (WCAG 2.4.6 – Level AA)
        foreach (var heading in headings)
        {
            var text = heading.InnerText?.Trim() ?? "";
            if (string.IsNullOrEmpty(text)) continue; // Already caught above

            var textLower = text.ToLowerInvariant();
            if (GenericHeadingTexts.Contains(textLower))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = "heading-text-quality",
                    Description = $"Heading contains generic text: \"{text}\".",
                    Category = AccessibilityCategory.Structure,
                    Level = WcagLevel.AA,
                    WcagCriterion = "2.4.6",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(heading),
                    Selector = heading.Name,
                    Recommendation = "Use descriptive heading text that summarises the section content."
                });
            }
        }

        // Check for skipped levels
        int previousLevel = 0;
        foreach (var heading in headings)
        {
            int currentLevel = int.Parse(heading.Name.Substring(1));
            if (previousLevel > 0 && currentLevel > previousLevel + 1)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Heading level skipped: h{previousLevel} to {heading.Name}.",
                    Category = AccessibilityCategory.Structure,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(heading),
                    Selector = heading.Name,
                    Recommendation = $"Use h{previousLevel + 1} instead to maintain a logical heading hierarchy."
                });
            }
            previousLevel = currentLevel;
        }

        return issues;
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
