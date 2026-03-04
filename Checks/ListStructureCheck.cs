using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class ListStructureCheck : IAccessibilityCheck
{
    public string RuleId => "list-structure";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var lists = document.DocumentNode.SelectNodes("//ul|//ol");

        if (lists == null) return issues;

        foreach (var list in lists)
        {
            var role = list.GetAttributeValue("role", "");
            // Skip lists with role=presentation/none or role=menu etc (custom ARIA patterns)
            if (role is "presentation" or "none" or "menu" or "menubar" or "tablist" or "listbox" or "tree")
                continue;

            var invalidChildren = new List<HtmlNode>();
            foreach (var child in list.ChildNodes)
            {
                if (child.NodeType == HtmlNodeType.Text && string.IsNullOrWhiteSpace(child.InnerText))
                    continue; // Whitespace text nodes are fine
                if (child.NodeType == HtmlNodeType.Comment)
                    continue;
                if (child.NodeType == HtmlNodeType.Element)
                {
                    // Valid children: li, script, template
                    if (child.Name is "li" or "script" or "template")
                        continue;
                }

                invalidChildren.Add(child);
            }

            if (invalidChildren.Count > 0)
            {
                var childNames = invalidChildren
                    .Where(c => c.NodeType == HtmlNodeType.Element)
                    .Select(c => $"<{c.Name}>")
                    .Distinct()
                    .ToList();

                var childDesc = childNames.Count > 0
                    ? string.Join(", ", childNames)
                    : "non-element content";

                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"<{list.Name}> contains invalid child elements: {childDesc}.",
                    Category = AccessibilityCategory.Structure,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(list),
                    Selector = BuildSelector(list),
                    Recommendation = $"<{list.Name}> elements should only contain <li> children. Wrap other content inside <li> elements."
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
