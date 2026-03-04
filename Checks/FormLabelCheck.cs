using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class FormLabelCheck : IAccessibilityCheck
{
    public string RuleId => "form-label";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly string[] InputTypesRequiringLabel = ["text", "email", "password", "search", "tel", "url", "number", "date", "time", "datetime-local", "month", "week", "color", "file", "range"];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        var inputs = document.DocumentNode.SelectNodes("//input|//select|//textarea");
        if (inputs == null) return issues;

        foreach (var input in inputs)
        {
            var type = input.GetAttributeValue("type", "text").ToLowerInvariant();

            // Skip hidden, submit, button, reset, image inputs
            if (type is "hidden" or "submit" or "button" or "reset" or "image")
                continue;

            if (input.Name == "input" && !InputTypesRequiringLabel.Contains(type) && type != "checkbox" && type != "radio")
                continue;

            var id = input.GetAttributeValue("id", "");
            var ariaLabel = input.GetAttributeValue("aria-label", "");
            var ariaLabelledBy = input.GetAttributeValue("aria-labelledby", "");
            var title = input.GetAttributeValue("title", "");

            // Check if wrapped in a label
            var parentLabel = input.Ancestors("label").FirstOrDefault();
            if (parentLabel != null) continue;

            // Check for associated label via for/id
            if (!string.IsNullOrEmpty(id))
            {
                var label = document.DocumentNode.SelectSingleNode($"//label[@for='{id}']");
                if (label != null) continue;
            }

            // Check for aria-label or aria-labelledby
            if (!string.IsNullOrEmpty(ariaLabel) || !string.IsNullOrEmpty(ariaLabelledBy))
                continue;

            // Check for title attribute as fallback
            if (!string.IsNullOrEmpty(title))
                continue;

            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = $"Form {input.Name} element has no associated label.",
                Category = AccessibilityCategory.Forms,
                Level = WcagLevel.A,
                WcagCriterion = "1.3.1",
                Impact = "critical",
                Element = TruncateOuterHtml(input),
                Selector = BuildSelector(input),
                Recommendation = "Associate a <label> element using the 'for' attribute, wrap in a <label>, or add aria-label."
            });
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode node)
    {
        var id = node.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"{node.Name}#{id}";
        var name = node.GetAttributeValue("name", "");
        if (!string.IsNullOrEmpty(name)) return $"{node.Name}[name=\"{name}\"]";
        return node.Name;
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
