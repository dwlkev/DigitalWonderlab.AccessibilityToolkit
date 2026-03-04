using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Checks.Utilities;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 1.4.6 – Contrast (Enhanced) (Level AAA)
/// Detects inline style colour pairs below 7:1 contrast ratio.
/// Reuses shared ContrastCalculator utility.
/// </summary>
public class EnhancedContrastCheck : IAccessibilityCheck
{
    public string RuleId => "enhanced-contrast";
    public WcagLevel MinimumLevel => WcagLevel.AAA;

    private static readonly Regex ColorRegex = new(@"(?:^|;)\s*color\s*:\s*([^;]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BgColorRegex = new(@"background(?:-color)?\s*:\s*([^;]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var styledNodes = document.DocumentNode.SelectNodes("//*[@style]");

        if (styledNodes == null) return issues;

        foreach (var node in styledNodes)
        {
            var style = node.GetAttributeValue("style", "");
            if (string.IsNullOrEmpty(style)) continue;

            var fgMatch = ColorRegex.Match(style);
            var bgMatch = BgColorRegex.Match(style);

            if (!fgMatch.Success || !bgMatch.Success) continue;

            var fg = ContrastCalculator.ParseColor(fgMatch.Groups[1].Value.Trim());
            var bg = ContrastCalculator.ParseColor(bgMatch.Groups[1].Value.Trim());

            if (fg == null || bg == null) continue;

            var ratio = ContrastCalculator.CalculateContrastRatio(fg.Value, bg.Value);

            // AAA requires 7:1 for normal text - only flag if it passes AA (4.5:1) but fails AAA
            if (ratio >= 4.5 && ratio < 7.0)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Contrast ratio ({ratio:F1}:1) meets AA but not AAA enhanced contrast (7:1 required).",
                    Category = AccessibilityCategory.Meta,
                    Level = WcagLevel.AAA,
                    WcagCriterion = "1.4.6",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = $"Increase contrast ratio to at least 7:1 for enhanced accessibility (current: {ratio:F1}:1)."
                });
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
