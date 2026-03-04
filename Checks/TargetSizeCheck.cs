using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.5.5 – Target Size (Enhanced) (Level AAA)
/// Detects inline styled clickable elements with width/height below 44px.
/// </summary>
public class TargetSizeCheck : IAccessibilityCheck
{
    public string RuleId => "target-size";
    public WcagLevel MinimumLevel => WcagLevel.AAA;

    private const int MinTargetSize = 44;

    private static readonly Regex WidthRegex = new(@"(?:^|;)\s*width\s*:\s*(\d+)\s*px", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex HeightRegex = new(@"(?:^|;)\s*height\s*:\s*(\d+)\s*px", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly HashSet<string> ClickableElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "button", "input", "select", "textarea", "summary"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var styledNodes = document.DocumentNode.SelectNodes("//*[@style]");

        if (styledNodes == null) return issues;

        foreach (var node in styledNodes)
        {
            // Only check clickable/interactive elements
            var isClickable = ClickableElements.Contains(node.Name);
            var role = node.GetAttributeValue("role", "");
            var hasOnclick = !string.IsNullOrEmpty(node.GetAttributeValue("onclick", ""));
            var hasTabindex = !string.IsNullOrEmpty(node.GetAttributeValue("tabindex", ""));

            if (!isClickable && role is not ("button" or "link" or "menuitem" or "tab" or "checkbox" or "radio") && !hasOnclick && !hasTabindex)
                continue;

            var style = node.GetAttributeValue("style", "");
            if (string.IsNullOrEmpty(style)) continue;

            var widthMatch = WidthRegex.Match(style);
            var heightMatch = HeightRegex.Match(style);

            var hasSmallWidth = widthMatch.Success && int.TryParse(widthMatch.Groups[1].Value, out var w) && w < MinTargetSize;
            var hasSmallHeight = heightMatch.Success && int.TryParse(heightMatch.Groups[1].Value, out var h) && h < MinTargetSize;

            if (hasSmallWidth || hasSmallHeight)
            {
                var widthStr = widthMatch.Success ? $"{widthMatch.Groups[1].Value}px" : "auto";
                var heightStr = heightMatch.Success ? $"{heightMatch.Groups[1].Value}px" : "auto";

                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Interactive element has small target size ({widthStr} x {heightStr}). Minimum recommended is {MinTargetSize}x{MinTargetSize}px.",
                    Category = AccessibilityCategory.Interactivity,
                    Level = WcagLevel.AAA,
                    WcagCriterion = "2.5.5",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = $"Increase the target size to at least {MinTargetSize}x{MinTargetSize}px for better touch accessibility."
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
