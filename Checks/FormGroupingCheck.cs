using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class FormGroupingCheck : IAccessibilityCheck
{
    public string RuleId => "form-grouping";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        CheckRadioGroups(document, issues);
        CheckCheckboxGroups(document, issues);
        CheckFieldsetLegend(document, issues);

        return issues;
    }

    private void CheckRadioGroups(HtmlDocument document, List<AccessibilityIssue> issues)
    {
        var radios = document.DocumentNode.SelectNodes("//input[@type='radio']");
        if (radios == null) return;

        // Group by name attribute
        var groups = radios
            .GroupBy(r => r.GetAttributeValue("name", ""))
            .Where(g => !string.IsNullOrEmpty(g.Key) && g.Count() > 1);

        foreach (var group in groups)
        {
            var firstRadio = group.First();
            var fieldset = firstRadio.Ancestors("fieldset").FirstOrDefault();
            var ariaGroup = firstRadio.Ancestors().FirstOrDefault(a =>
                a.GetAttributeValue("role", "") is "group" or "radiogroup");

            if (fieldset == null && ariaGroup == null)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Radio button group \"{group.Key}\" ({group.Count()} options) is not wrapped in a <fieldset>.",
                    Category = AccessibilityCategory.Forms,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "serious",
                    Element = TruncateOuterHtml(firstRadio),
                    Selector = $"input[name=\"{group.Key}\"]",
                    Recommendation = "Wrap related radio buttons in a <fieldset> with a <legend> describing the group."
                });
            }
        }
    }

    private void CheckCheckboxGroups(HtmlDocument document, List<AccessibilityIssue> issues)
    {
        var checkboxes = document.DocumentNode.SelectNodes("//input[@type='checkbox']");
        if (checkboxes == null) return;

        var groups = checkboxes
            .GroupBy(c => c.GetAttributeValue("name", "").TrimEnd('[', ']'))
            .Where(g => !string.IsNullOrEmpty(g.Key) && g.Count() > 1);

        foreach (var group in groups)
        {
            var firstCheckbox = group.First();
            var fieldset = firstCheckbox.Ancestors("fieldset").FirstOrDefault();
            var ariaGroup = firstCheckbox.Ancestors().FirstOrDefault(a =>
                a.GetAttributeValue("role", "") == "group");

            if (fieldset == null && ariaGroup == null)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Checkbox group \"{group.Key}\" ({group.Count()} options) is not wrapped in a <fieldset>.",
                    Category = AccessibilityCategory.Forms,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(firstCheckbox),
                    Selector = $"input[name=\"{group.Key}\"]",
                    Recommendation = "Wrap related checkboxes in a <fieldset> with a <legend> describing the group."
                });
            }
        }
    }

    private void CheckFieldsetLegend(HtmlDocument document, List<AccessibilityIssue> issues)
    {
        var fieldsets = document.DocumentNode.SelectNodes("//fieldset");
        if (fieldsets == null) return;

        foreach (var fieldset in fieldsets)
        {
            var legend = fieldset.SelectSingleNode("./legend");
            if (legend == null)
            {
                var ariaLabel = fieldset.GetAttributeValue("aria-label", "");
                var ariaLabelledBy = fieldset.GetAttributeValue("aria-labelledby", "");

                if (string.IsNullOrWhiteSpace(ariaLabel) && string.IsNullOrWhiteSpace(ariaLabelledBy))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "Fieldset is missing a <legend> element.",
                        Category = AccessibilityCategory.Forms,
                        Level = WcagLevel.A,
                        WcagCriterion = "1.3.1",
                        Impact = "moderate",
                        Element = TruncateOuterHtml(fieldset),
                        Selector = BuildSelector(fieldset),
                        Recommendation = "Add a <legend> element as the first child of the <fieldset> to describe the group."
                    });
                }
            }
            else if (string.IsNullOrWhiteSpace(legend.InnerText))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Fieldset has an empty <legend> element.",
                    Category = AccessibilityCategory.Forms,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(fieldset),
                    Selector = BuildSelector(fieldset),
                    Recommendation = "Add descriptive text to the <legend> element."
                });
            }
        }
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
