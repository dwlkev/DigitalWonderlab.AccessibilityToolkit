using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.4.10 – Section Headings (Level AAA)
/// Detects content sections (long text blocks) without preceding headings.
/// </summary>
public class SectionHeadingsCheck : IAccessibilityCheck
{
    public string RuleId => "section-headings";
    public WcagLevel MinimumLevel => WcagLevel.AAA;

    private const int MinTextLengthForSection = 200;

    private static readonly HashSet<string> SectionElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "section", "article", "aside"
    };

    private static readonly HashSet<string> HeadingElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "h1", "h2", "h3", "h4", "h5", "h6"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Check <section>, <article>, <aside> elements for headings
        foreach (var sectionTag in SectionElements)
        {
            var sections = document.DocumentNode.SelectNodes($"//{sectionTag}");
            if (sections == null) continue;

            foreach (var section in sections)
            {
                var text = section.InnerText?.Trim() ?? "";
                if (text.Length < MinTextLengthForSection) continue;

                var hasHeading = section.SelectSingleNode(".//h1|.//h2|.//h3|.//h4|.//h5|.//h6") != null;
                var hasAriaLabel = !string.IsNullOrEmpty(section.GetAttributeValue("aria-label", ""));
                var hasAriaLabelledBy = !string.IsNullOrEmpty(section.GetAttributeValue("aria-labelledby", ""));

                if (!hasHeading && !hasAriaLabel && !hasAriaLabelledBy)
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = $"<{sectionTag}> element contains substantial content but has no heading.",
                        Category = AccessibilityCategory.Structure,
                        Level = WcagLevel.AAA,
                        WcagCriterion = "2.4.10",
                        Impact = "moderate",
                        Element = TruncateOuterHtml(section),
                        Selector = BuildSelector(section),
                        Recommendation = $"Add a heading (h2-h6) at the start of this <{sectionTag}> to help users identify its content."
                    });
                }
            }
        }

        // Check for long text blocks in divs without any structural headings
        var mainContent = document.DocumentNode.SelectSingleNode("//main") ?? document.DocumentNode.SelectSingleNode("//body");
        if (mainContent != null)
        {
            var divs = mainContent.SelectNodes(".//div");
            if (divs != null)
            {
                foreach (var div in divs)
                {
                    // Only check top-level content divs (not deeply nested)
                    if (div.Ancestors().Count(a => a.Name == "div") > 3) continue;

                    var directTextLength = 0;
                    foreach (var child in div.ChildNodes)
                    {
                        if (child.NodeType == HtmlNodeType.Text || child.Name == "p" || child.Name == "span")
                            directTextLength += (child.InnerText?.Trim().Length ?? 0);
                    }

                    if (directTextLength < 500) continue;

                    var hasHeading = div.SelectSingleNode(".//h1|.//h2|.//h3|.//h4|.//h5|.//h6") != null;
                    if (!hasHeading)
                    {
                        // Check if a heading precedes this div as a sibling
                        var prevSibling = div.PreviousSibling;
                        while (prevSibling != null && prevSibling.NodeType != HtmlNodeType.Element)
                            prevSibling = prevSibling.PreviousSibling;

                        if (prevSibling != null && HeadingElements.Contains(prevSibling.Name))
                            continue;

                        issues.Add(new AccessibilityIssue
                        {
                            RuleId = RuleId,
                            Description = "Long content block has no heading to identify its topic.",
                            Category = AccessibilityCategory.Structure,
                            Level = WcagLevel.AAA,
                            WcagCriterion = "2.4.10",
                            Impact = "minor",
                            Element = TruncateOuterHtml(div),
                            Selector = BuildSelector(div),
                            Recommendation = "Add a heading before or at the start of this content block to aid navigation."
                        });
                    }
                }
            }
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode node)
    {
        var id = node.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"#{id}";
        var cls = node.GetAttributeValue("class", "");
        if (!string.IsNullOrEmpty(cls)) return $"{node.Name}.{cls.Split(' ')[0]}";
        return node.Name;
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
