using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class MetaViewportCheck : IAccessibilityCheck
{
    public string RuleId => "meta-viewport";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var viewport = document.DocumentNode.SelectSingleNode("//meta[@name='viewport']");

        if (viewport == null) return issues;

        var content = viewport.GetAttributeValue("content", "").ToLowerInvariant();

        // Check for user-scalable=no
        if (content.Contains("user-scalable=no") || content.Contains("user-scalable=0"))
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Viewport meta tag disables user zooming (user-scalable=no).",
                Category = AccessibilityCategory.Meta,
                Level = WcagLevel.AA,
                WcagCriterion = "1.4.4",
                Impact = "critical",
                Element = TruncateOuterHtml(viewport),
                Selector = "meta[name=\"viewport\"]",
                Recommendation = "Remove user-scalable=no to allow users to zoom the page."
            });
        }

        // Check for maximum-scale < 2
        var maxScaleMatch = System.Text.RegularExpressions.Regex.Match(content, @"maximum-scale\s*=\s*([0-9.]+)");
        if (maxScaleMatch.Success && double.TryParse(maxScaleMatch.Groups[1].Value, out var maxScale) && maxScale < 2.0)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = $"Viewport meta tag restricts maximum zoom to {maxScale}x (should be at least 2x).",
                Category = AccessibilityCategory.Meta,
                Level = WcagLevel.AA,
                WcagCriterion = "1.4.4",
                Impact = "serious",
                Element = TruncateOuterHtml(viewport),
                Selector = "meta[name=\"viewport\"]",
                Recommendation = "Set maximum-scale to at least 2.0 or remove it entirely."
            });
        }

        return issues;
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
