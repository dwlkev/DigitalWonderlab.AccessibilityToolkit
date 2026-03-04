using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class DuplicateIdCheck : IAccessibilityCheck
{
    public string RuleId => "duplicate-id";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var elementsWithId = document.DocumentNode.SelectNodes("//*[@id]");

        if (elementsWithId == null) return issues;

        var idCounts = new Dictionary<string, List<HtmlNode>>(StringComparer.Ordinal);

        foreach (var el in elementsWithId)
        {
            var id = el.GetAttributeValue("id", "");
            if (string.IsNullOrWhiteSpace(id)) continue;

            if (!idCounts.ContainsKey(id))
                idCounts[id] = new List<HtmlNode>();
            idCounts[id].Add(el);
        }

        foreach (var (id, nodes) in idCounts)
        {
            if (nodes.Count <= 1) continue;

            // Report the duplicate (second occurrence onwards)
            foreach (var node in nodes.Skip(1))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Duplicate id attribute: \"{id}\" is used {nodes.Count} times.",
                    Category = AccessibilityCategory.Structure,
                    Level = WcagLevel.A,
                    WcagCriterion = "4.1.1",
                    Impact = "serious",
                    Element = TruncateOuterHtml(node),
                    Selector = $"#{id}",
                    Recommendation = "Ensure every id attribute value is unique within the page."
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
