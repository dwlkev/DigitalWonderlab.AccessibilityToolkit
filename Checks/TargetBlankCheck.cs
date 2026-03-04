using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class TargetBlankCheck : IAccessibilityCheck
{
    public string RuleId => "target-blank";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly string[] NewWindowPhrases = [
        "new window", "new tab", "opens in", "external", "(opens"
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var links = document.DocumentNode.SelectNodes("//a[@target='_blank']");

        if (links == null) return issues;

        foreach (var link in links)
        {
            var text = link.InnerText?.Trim() ?? "";
            var ariaLabel = link.GetAttributeValue("aria-label", "");
            var title = link.GetAttributeValue("title", "");

            var combinedText = $"{text} {ariaLabel} {title}".ToLowerInvariant();

            // Check if the link already indicates it opens in a new window
            var hasIndication = NewWindowPhrases.Any(phrase => combinedText.Contains(phrase));

            // Also check for screen reader text inside the link
            var srOnly = link.SelectSingleNode(".//*[contains(@class,'sr-only') or contains(@class,'visually-hidden') or contains(@class,'screen-reader')]");
            if (srOnly != null)
            {
                var srText = srOnly.InnerText?.ToLowerInvariant() ?? "";
                if (NewWindowPhrases.Any(phrase => srText.Contains(phrase)))
                    hasIndication = true;
            }

            if (!hasIndication)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Link opens in a new tab without indicating this to the user.",
                    Category = AccessibilityCategory.Links,
                    Level = WcagLevel.A,
                    WcagCriterion = "3.2.5",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(link),
                    Selector = BuildSelector(link),
                    Recommendation = "Add visual and/or screen reader text indicating the link opens in a new tab, e.g. \"(opens in new tab)\"."
                });
            }
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode link)
    {
        var id = link.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"a#{id}";
        var href = link.GetAttributeValue("href", "");
        if (!string.IsNullOrEmpty(href)) return $"a[href=\"{href}\"]";
        return "a[target=\"_blank\"]";
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
