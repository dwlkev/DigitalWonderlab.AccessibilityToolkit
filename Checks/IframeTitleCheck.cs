using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class IframeTitleCheck : IAccessibilityCheck
{
    public string RuleId => "iframe-title";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var iframes = document.DocumentNode.SelectNodes("//iframe");

        if (iframes == null) return issues;

        foreach (var iframe in iframes)
        {
            var title = iframe.GetAttributeValue("title", "");
            var ariaLabel = iframe.GetAttributeValue("aria-label", "");
            var ariaLabelledBy = iframe.GetAttributeValue("aria-labelledby", "");
            var ariaHidden = iframe.GetAttributeValue("aria-hidden", "");

            // Skip hidden iframes (aria-hidden, display:none, visibility:hidden, or zero-size)
            if (ariaHidden == "true") continue;
            var style = iframe.GetAttributeValue("style", "").ToLowerInvariant();
            if (style.Contains("display:none") || style.Contains("display: none")
                || style.Contains("visibility:hidden") || style.Contains("visibility: hidden"))
                continue;
            var width = iframe.GetAttributeValue("width", "");
            var height = iframe.GetAttributeValue("height", "");
            if (width == "0" && height == "0") continue;

            if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(ariaLabel) && string.IsNullOrWhiteSpace(ariaLabelledBy))
            {
                var src = iframe.GetAttributeValue("src", "");
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Iframe is missing a descriptive title attribute.",
                    Category = AccessibilityCategory.Structure,
                    Level = WcagLevel.A,
                    WcagCriterion = "4.1.2",
                    Impact = "serious",
                    Element = TruncateOuterHtml(iframe),
                    Selector = !string.IsNullOrEmpty(src) ? $"iframe[src=\"{src}\"]" : "iframe",
                    Recommendation = "Add a title attribute that describes the iframe content, e.g. title=\"Contact form\" or title=\"Google Map\"."
                });
            }
        }

        return issues;
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
