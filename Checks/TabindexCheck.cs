using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.4.3 – Focus Order (Level A)
/// Detects positive tabindex values that disrupt natural focus order.
/// </summary>
public class TabindexCheck : IAccessibilityCheck
{
    public string RuleId => "tabindex-positive";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var tabindexNodes = document.DocumentNode.SelectNodes("//*[@tabindex]");

        if (tabindexNodes == null) return issues;

        foreach (var node in tabindexNodes)
        {
            var tabindexStr = node.GetAttributeValue("tabindex", "");
            if (!int.TryParse(tabindexStr, out var tabindex)) continue;

            if (tabindex > 0)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Element has positive tabindex=\"{tabindex}\" which disrupts natural focus order.",
                    Category = AccessibilityCategory.Keyboard,
                    Level = WcagLevel.A,
                    WcagCriterion = "2.4.3",
                    Impact = "serious",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = "Remove the positive tabindex value. Use tabindex=\"0\" to add to natural tab order, or tabindex=\"-1\" for programmatic focus only."
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
