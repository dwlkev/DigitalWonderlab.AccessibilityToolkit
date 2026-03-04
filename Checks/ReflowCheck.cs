using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 1.4.10 – Reflow (Level AA)
/// Detects inline styles with fixed widths >320px or overflow:hidden on containers.
/// </summary>
public class ReflowCheck : IAccessibilityCheck
{
    public string RuleId => "reflow";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    private static readonly Regex WidthPxRegex = new(@"(?:^|;)\s*(?:min-)?width\s*:\s*(\d+)\s*px", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex OverflowHiddenRegex = new(@"overflow(?:-x)?\s*:\s*hidden", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Elements that commonly have fixed widths legitimately (images, canvases, etc.)
    private static readonly HashSet<string> ExcludedElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "img", "video", "canvas", "svg", "iframe", "embed", "object"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var styledNodes = document.DocumentNode.SelectNodes("//*[@style]");

        if (styledNodes == null) return issues;

        foreach (var node in styledNodes)
        {
            if (ExcludedElements.Contains(node.Name)) continue;

            var style = node.GetAttributeValue("style", "");
            if (string.IsNullOrEmpty(style)) continue;

            // Check for fixed widths > 320px
            var widthMatch = WidthPxRegex.Match(style);
            if (widthMatch.Success && int.TryParse(widthMatch.Groups[1].Value, out var width) && width > 320)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Element has fixed inline width of {width}px which may prevent content reflow at 320px viewport.",
                    Category = AccessibilityCategory.Meta,
                    Level = WcagLevel.AA,
                    WcagCriterion = "1.4.10",
                    Impact = "serious",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = "Use relative units (%, em, rem) or max-width instead of fixed pixel widths to allow content reflow."
                });
            }

            // Check for overflow:hidden on containers (may clip reflowed content)
            if (OverflowHiddenRegex.IsMatch(style))
            {
                // Only flag if the element has children (it's a container)
                var hasChildElements = node.ChildNodes.Any(c => c.NodeType == HtmlNodeType.Element);
                if (hasChildElements)
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "Container has overflow:hidden in inline style which may clip reflowed content on narrow viewports.",
                        Category = AccessibilityCategory.Meta,
                        Level = WcagLevel.AA,
                        WcagCriterion = "1.4.10",
                        Impact = "moderate",
                        Element = TruncateOuterHtml(node),
                        Selector = BuildSelector(node),
                        Recommendation = "Use overflow:auto or overflow:visible to allow content to reflow without clipping."
                    });
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
