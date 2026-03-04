using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class LinkTextCheck : IAccessibilityCheck
{
    public string RuleId => "link-text";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly string[] GenericLinkTexts = [
        "click here", "here", "read more", "more", "link", "this", "click",
        "learn more", "go", "details", "continue", "info"
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var links = document.DocumentNode.SelectNodes("//a");

        if (links == null) return issues;

        foreach (var link in links)
        {
            var href = link.GetAttributeValue("href", "");
            var ariaLabel = link.GetAttributeValue("aria-label", "");
            var ariaLabelledBy = link.GetAttributeValue("aria-labelledby", "");
            var role = link.GetAttributeValue("role", "");

            // Skip anchors used as buttons or without href
            if (string.IsNullOrEmpty(href) && string.IsNullOrEmpty(role))
                continue;

            // Get effective text: inner text, aria-label, or img alt
            var innerText = link.InnerText?.Trim() ?? "";
            var imgAlt = link.SelectSingleNode(".//img")?.GetAttributeValue("alt", "") ?? "";

            var effectiveText = !string.IsNullOrEmpty(ariaLabel) ? ariaLabel
                : !string.IsNullOrEmpty(innerText) ? innerText
                : imgAlt;

            if (string.IsNullOrWhiteSpace(effectiveText) && string.IsNullOrEmpty(ariaLabelledBy))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Link has no accessible text.",
                    Category = AccessibilityCategory.Links,
                    Level = WcagLevel.A,
                    WcagCriterion = "2.4.4",
                    Impact = "critical",
                    Element = TruncateOuterHtml(link),
                    Selector = BuildSelector(link, href),
                    Recommendation = "Add text content, aria-label, or an img with alt text inside the link."
                });
                continue;
            }

            // Check for generic link text
            var textLower = effectiveText.Trim().ToLowerInvariant().TrimEnd('.');
            if (GenericLinkTexts.Contains(textLower))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Link uses generic text: \"{effectiveText}\".",
                    Category = AccessibilityCategory.Links,
                    Level = WcagLevel.A,
                    WcagCriterion = "2.4.4",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(link),
                    Selector = BuildSelector(link, href),
                    Recommendation = "Use descriptive link text that explains the destination or purpose."
                });
            }
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode link, string href)
    {
        var id = link.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"a#{id}";
        if (!string.IsNullOrEmpty(href)) return $"a[href=\"{href}\"]";
        return "a";
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
