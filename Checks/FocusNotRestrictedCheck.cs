using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.4.11 – Focus Not Obscured / Focus Appearance (Level AA)
/// Detects elements with focus styling using outline:none/outline:0 in inline styles.
/// </summary>
public class FocusNotRestrictedCheck : IAccessibilityCheck
{
    public string RuleId => "focus-not-restricted";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    private static readonly Regex OutlineNoneRegex = new(
        @"outline\s*:\s*(?:none|0(?:px)?)\s*(?:!important)?",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly HashSet<string> FocusableElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "button", "input", "select", "textarea", "summary", "details"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var styledNodes = document.DocumentNode.SelectNodes("//*[@style]");

        if (styledNodes == null) return issues;

        foreach (var node in styledNodes)
        {
            var style = node.GetAttributeValue("style", "");
            if (string.IsNullOrEmpty(style)) continue;

            if (!OutlineNoneRegex.IsMatch(style)) continue;

            // Only flag focusable elements or elements with tabindex
            var isFocusable = FocusableElements.Contains(node.Name);
            var tabindex = node.GetAttributeValue("tabindex", "");
            if (!isFocusable && string.IsNullOrEmpty(tabindex)) continue;

            // Check if there's a replacement focus style (e.g., box-shadow, border)
            var hasAlternativeFocus = style.Contains("box-shadow", StringComparison.OrdinalIgnoreCase)
                                  || style.Contains("border", StringComparison.OrdinalIgnoreCase);

            if (!hasAlternativeFocus)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Focusable element has outline:none/0 in inline style with no visible alternative focus indicator.",
                    Category = AccessibilityCategory.Keyboard,
                    Level = WcagLevel.AA,
                    WcagCriterion = "2.4.11",
                    Impact = "serious",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = "Remove outline:none or provide an alternative visible focus indicator (e.g., box-shadow, border)."
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
