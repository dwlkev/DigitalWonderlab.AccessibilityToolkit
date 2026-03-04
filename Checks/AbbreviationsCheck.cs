using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 3.1.4 – Abbreviations (Level AAA)
/// Detects &lt;abbr&gt; elements without a title attribute.
/// </summary>
public class AbbreviationsCheck : IAccessibilityCheck
{
    public string RuleId => "abbreviations";
    public WcagLevel MinimumLevel => WcagLevel.AAA;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var abbrNodes = document.DocumentNode.SelectNodes("//abbr");

        if (abbrNodes == null) return issues;

        foreach (var abbr in abbrNodes)
        {
            var title = abbr.GetAttributeValue("title", "");
            var ariaLabel = abbr.GetAttributeValue("aria-label", "");

            if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(ariaLabel))
            {
                var text = abbr.InnerText?.Trim() ?? "";
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Abbreviation \"{text}\" has no title attribute to provide the expanded form.",
                    Category = AccessibilityCategory.Language,
                    Level = WcagLevel.AAA,
                    WcagCriterion = "3.1.4",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(abbr),
                    Selector = BuildSelector(abbr),
                    Recommendation = $"Add a title attribute to <abbr> with the expanded form, e.g. <abbr title=\"...\">{ text}</abbr>."
                });
            }
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode node)
    {
        var id = node.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"#{id}";
        return $"abbr";
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
