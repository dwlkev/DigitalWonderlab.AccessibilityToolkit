using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 1.4.12 – Text Spacing (Level AA)
/// Detects inline styles with !important on text spacing properties that would prevent user override.
/// </summary>
public class TextSpacingCheck : IAccessibilityCheck
{
    public string RuleId => "text-spacing";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    private static readonly Regex[] ImportantSpacingPatterns =
    [
        new(@"line-height\s*:\s*[^;]*!important", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"letter-spacing\s*:\s*[^;]*!important", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"word-spacing\s*:\s*[^;]*!important", RegexOptions.IgnoreCase | RegexOptions.Compiled),
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var styledNodes = document.DocumentNode.SelectNodes("//*[@style]");

        if (styledNodes == null) return issues;

        foreach (var node in styledNodes)
        {
            var style = node.GetAttributeValue("style", "");
            if (string.IsNullOrEmpty(style) || !style.Contains("!important", StringComparison.OrdinalIgnoreCase))
                continue;

            var violatingProperties = new List<string>();

            foreach (var pattern in ImportantSpacingPatterns)
            {
                if (pattern.IsMatch(style))
                {
                    var propName = pattern.ToString().Split(@"\s")[0];
                    violatingProperties.Add(pattern.ToString().Contains("line-height") ? "line-height"
                        : pattern.ToString().Contains("letter-spacing") ? "letter-spacing"
                        : "word-spacing");
                }
            }

            if (violatingProperties.Count > 0)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Inline style uses !important on text spacing properties ({string.Join(", ", violatingProperties)}), preventing user override.",
                    Category = AccessibilityCategory.Meta,
                    Level = WcagLevel.AA,
                    WcagCriterion = "1.4.12",
                    Impact = "serious",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = "Remove !important from text spacing properties to allow users to override with custom stylesheets."
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
