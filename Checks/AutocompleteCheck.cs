using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 1.3.5 – Identify Input Purpose (Level A)
/// Detects form inputs for common personal data fields missing autocomplete attributes.
/// </summary>
public class AutocompleteCheck : IAccessibilityCheck
{
    public string RuleId => "autocomplete-missing";
    public WcagLevel MinimumLevel => WcagLevel.A;

    // Map of (name/id patterns) -> expected autocomplete value
    private static readonly (string[] Patterns, string AutocompleteValue)[] FieldMappings =
    [
        (["name", "full-name", "fullname", "your-name"], "name"),
        (["first-name", "firstname", "fname", "given-name"], "given-name"),
        (["last-name", "lastname", "lname", "surname", "family-name"], "family-name"),
        (["email", "e-mail", "email-address"], "email"),
        (["tel", "phone", "telephone", "phone-number", "mobile"], "tel"),
        (["address", "street-address", "address-line1", "address1"], "street-address"),
        (["city", "locality"], "address-level2"),
        (["state", "region", "province"], "address-level1"),
        (["zip", "zipcode", "zip-code", "postal-code", "postcode"], "postal-code"),
        (["country"], "country-name"),
        (["username", "user-name", "user"], "username"),
        (["organization", "organisation", "company", "org"], "organization"),
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        var inputs = document.DocumentNode.SelectNodes("//input[@type='text' or @type='email' or @type='tel' or @type='url' or @type='search' or not(@type)]|//select|//textarea");
        if (inputs == null) return issues;

        foreach (var input in inputs)
        {
            var type = input.GetAttributeValue("type", "text").ToLowerInvariant();
            if (type is "hidden" or "submit" or "button" or "reset" or "image" or "checkbox" or "radio" or "file")
                continue;

            var autocomplete = input.GetAttributeValue("autocomplete", "");
            if (!string.IsNullOrEmpty(autocomplete)) continue;

            var name = input.GetAttributeValue("name", "").ToLowerInvariant();
            var id = input.GetAttributeValue("id", "").ToLowerInvariant();
            var placeholder = input.GetAttributeValue("placeholder", "").ToLowerInvariant();

            var matchedField = FieldMappings.FirstOrDefault(fm =>
                fm.Patterns.Any(p => name.Contains(p) || id.Contains(p) || placeholder.Contains(p)));

            if (matchedField.Patterns != null)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Input field appears to collect personal data but is missing autocomplete attribute (suggested: autocomplete=\"{matchedField.AutocompleteValue}\").",
                    Category = AccessibilityCategory.Forms,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.3.5",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(input),
                    Selector = BuildSelector(input),
                    Recommendation = $"Add autocomplete=\"{matchedField.AutocompleteValue}\" to help users fill in this field."
                });
            }
        }

        return issues;
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
