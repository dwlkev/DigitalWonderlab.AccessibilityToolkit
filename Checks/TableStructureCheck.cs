using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class TableStructureCheck : IAccessibilityCheck
{
    public string RuleId => "table-structure";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var tables = document.DocumentNode.SelectNodes("//table");

        if (tables == null) return issues;

        foreach (var table in tables)
        {
            var role = table.GetAttributeValue("role", "");

            // Skip layout tables
            if (role is "presentation" or "none")
                continue;

            // Check if this appears to be a data table (has th or multiple rows)
            var rows = table.SelectNodes(".//tr");
            if (rows == null || rows.Count < 2)
                continue; // Likely not a data table

            var thCells = table.SelectNodes(".//th");
            var tdCells = table.SelectNodes(".//td");

            // If there are td cells but no th, it's likely a data table missing headers
            if (tdCells != null && tdCells.Count > 0 && (thCells == null || thCells.Count == 0))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Data table has no header cells (<th>).",
                    Category = AccessibilityCategory.Tables,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "serious",
                    Element = TruncateOuterHtml(table),
                    Selector = BuildSelector(table),
                    Recommendation = "Add <th> elements to identify column or row headers."
                });
            }

            // Check th cells for scope attribute
            if (thCells != null)
            {
                foreach (var th in thCells)
                {
                    var scope = th.GetAttributeValue("scope", "");
                    if (string.IsNullOrEmpty(scope))
                    {
                        issues.Add(new AccessibilityIssue
                        {
                            RuleId = RuleId,
                            Description = "Table header cell (<th>) is missing a scope attribute.",
                            Category = AccessibilityCategory.Tables,
                            Level = WcagLevel.A,
                            WcagCriterion = "1.3.1",
                            Impact = "moderate",
                            Element = TruncateOuterHtml(th),
                            Selector = BuildSelector(table),
                            Recommendation = "Add scope=\"col\" or scope=\"row\" to each <th> element."
                        });
                        break; // Only report once per table
                    }
                }
            }

            // Check for caption
            var caption = table.SelectSingleNode(".//caption");
            var ariaLabel = table.GetAttributeValue("aria-label", "");
            var ariaLabelledBy = table.GetAttributeValue("aria-labelledby", "");

            if (caption == null && string.IsNullOrEmpty(ariaLabel) && string.IsNullOrEmpty(ariaLabelledBy))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Data table has no caption or accessible name.",
                    Category = AccessibilityCategory.Tables,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(table),
                    Selector = BuildSelector(table),
                    Recommendation = "Add a <caption> element or aria-label to describe the table's purpose."
                });
            }
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode table)
    {
        var id = table.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"table#{id}";
        var cls = table.GetAttributeValue("class", "");
        if (!string.IsNullOrEmpty(cls)) return $"table.{cls.Split(' ')[0]}";
        return "table";
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
