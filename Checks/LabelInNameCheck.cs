using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.5.3 – Label in Name (Level A)
/// Detects when visible button/link text doesn't match the start of aria-label.
/// </summary>
public class LabelInNameCheck : IAccessibilityCheck
{
    public string RuleId => "label-in-name";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        var nodes = document.DocumentNode.SelectNodes("//a[@aria-label]|//button[@aria-label]|//*[@role='button'][@aria-label]|//*[@role='link'][@aria-label]");
        if (nodes == null) return issues;

        foreach (var node in nodes)
        {
            var ariaLabel = node.GetAttributeValue("aria-label", "").Trim();
            if (string.IsNullOrEmpty(ariaLabel)) continue;

            var visibleText = GetVisibleText(node).Trim();
            if (string.IsNullOrEmpty(visibleText)) continue;

            // The accessible name (aria-label) should contain the visible text
            if (!ariaLabel.Contains(visibleText, StringComparison.OrdinalIgnoreCase))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Visible text \"{visibleText}\" is not contained in aria-label \"{ariaLabel}\".",
                    Category = AccessibilityCategory.Aria,
                    Level = WcagLevel.A,
                    WcagCriterion = "2.5.3",
                    Impact = "serious",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = "Ensure the aria-label starts with or contains the visible text of the element."
                });
            }
        }

        return issues;
    }

    private static string GetVisibleText(HtmlNode node)
    {
        // Exclude screen-reader-only text
        var clone = node.CloneNode(true);
        var srNodes = clone.SelectNodes(".//*[contains(@class,'sr-only') or contains(@class,'visually-hidden') or contains(@class,'screen-reader')]");
        if (srNodes != null)
        {
            foreach (var sr in srNodes)
                sr.Remove();
        }
        return clone.InnerText?.Trim() ?? "";
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
