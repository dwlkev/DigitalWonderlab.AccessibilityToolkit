using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 3.3.1 – Error Identification / 3.3.2 – Labels or Instructions (Level A)
/// Detects form inputs with required/aria-required but no visible indicator pattern.
/// </summary>
public class ErrorIdentificationCheck : IAccessibilityCheck
{
    public string RuleId => "error-identification";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Check required fields have visible indicators
        var requiredInputs = document.DocumentNode.SelectNodes("//input[@required or @aria-required='true']|//select[@required or @aria-required='true']|//textarea[@required or @aria-required='true']");
        if (requiredInputs != null)
        {
            foreach (var input in requiredInputs)
            {
                var type = input.GetAttributeValue("type", "text").ToLowerInvariant();
                if (type is "hidden" or "submit" or "button" or "reset" or "image")
                    continue;

                if (!HasVisibleRequiredIndicator(input, document))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "Required form field has no visible indicator (e.g., asterisk or 'required' text in its label).",
                        Category = AccessibilityCategory.Forms,
                        Level = WcagLevel.A,
                        WcagCriterion = "3.3.2",
                        Impact = "moderate",
                        Element = TruncateOuterHtml(input),
                        Selector = BuildSelector(input),
                        Recommendation = "Add a visible required indicator (e.g., asterisk *) to the label for this field."
                    });
                }
            }
        }

        // Check that aria-invalid is paired with aria-describedby for error messages
        var invalidInputs = document.DocumentNode.SelectNodes("//*[@aria-invalid='true']");
        if (invalidInputs != null)
        {
            foreach (var input in invalidInputs)
            {
                var describedBy = input.GetAttributeValue("aria-describedby", "");
                var errormessage = input.GetAttributeValue("aria-errormessage", "");

                if (string.IsNullOrEmpty(describedBy) && string.IsNullOrEmpty(errormessage))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "Element with aria-invalid=\"true\" has no associated error message (aria-describedby or aria-errormessage).",
                        Category = AccessibilityCategory.Forms,
                        Level = WcagLevel.A,
                        WcagCriterion = "3.3.1",
                        Impact = "serious",
                        Element = TruncateOuterHtml(input),
                        Selector = BuildSelector(input),
                        Recommendation = "Add aria-describedby or aria-errormessage pointing to the error message element."
                    });
                }
            }
        }

        return issues;
    }

    private static bool HasVisibleRequiredIndicator(HtmlNode input, HtmlDocument document)
    {
        var id = input.GetAttributeValue("id", "");

        // Check associated label
        if (!string.IsNullOrEmpty(id))
        {
            var label = document.DocumentNode.SelectSingleNode($"//label[@for='{id}']");
            if (label != null)
            {
                var labelHtml = label.InnerHtml?.ToLowerInvariant() ?? "";
                if (labelHtml.Contains("*") || labelHtml.Contains("required") ||
                    label.SelectSingleNode(".//*[contains(@class,'required')]") != null)
                    return true;
            }
        }

        // Check parent label
        var parentLabel = input.Ancestors("label").FirstOrDefault();
        if (parentLabel != null)
        {
            var labelHtml = parentLabel.InnerHtml?.ToLowerInvariant() ?? "";
            if (labelHtml.Contains("*") || labelHtml.Contains("required") ||
                parentLabel.SelectSingleNode(".//*[contains(@class,'required')]") != null)
                return true;
        }

        // Check for placeholder containing required indicator
        var placeholder = input.GetAttributeValue("placeholder", "").ToLowerInvariant();
        if (placeholder.Contains("required") || placeholder.Contains("*"))
            return true;

        return false;
    }

    private static string BuildSelector(HtmlNode node)
    {
        var id = node.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"#{id}";
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
