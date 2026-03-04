using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 1.3.5 – Identify Input Purpose (Level AA)
/// Detects login/contact form inputs missing autocomplete attributes.
/// More targeted than AutocompleteCheck – focuses on login and contact forms specifically.
/// </summary>
public class InputPurposeCheck : IAccessibilityCheck
{
    public string RuleId => "input-purpose";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    private static readonly string[] LoginFormIndicators = ["login", "signin", "sign-in", "log-in", "auth"];
    private static readonly string[] ContactFormIndicators = ["contact", "enquiry", "inquiry", "feedback", "message"];

    private static readonly (string[] NamePatterns, string InputType, string AutocompleteValue)[] LoginFieldMappings =
    [
        (["username", "user", "login", "userid", "user-id"], "text", "username"),
        (["password", "passwd", "pass", "pwd"], "password", "current-password"),
        (["new-password", "newpassword", "confirm-password"], "password", "new-password"),
    ];

    private static readonly (string[] NamePatterns, string AutocompleteValue)[] ContactFieldMappings =
    [
        (["email", "e-mail"], "email"),
        (["name", "full-name", "fullname"], "name"),
        (["phone", "tel", "telephone"], "tel"),
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        var forms = document.DocumentNode.SelectNodes("//form");
        if (forms == null) return issues;

        foreach (var form in forms)
        {
            var formId = form.GetAttributeValue("id", "").ToLowerInvariant();
            var formClass = form.GetAttributeValue("class", "").ToLowerInvariant();
            var formAction = form.GetAttributeValue("action", "").ToLowerInvariant();
            var formText = $"{formId} {formClass} {formAction}";

            var isLoginForm = LoginFormIndicators.Any(i => formText.Contains(i));
            var isContactForm = ContactFormIndicators.Any(i => formText.Contains(i));

            if (!isLoginForm && !isContactForm)
            {
                // Also detect by contained input types
                var hasPasswordField = form.SelectSingleNode(".//input[@type='password']") != null;
                if (hasPasswordField) isLoginForm = true;
            }

            if (isLoginForm)
                CheckFormFields(form, LoginFieldMappings, issues);

            if (isContactForm)
                CheckContactFormFields(form, issues);
        }

        return issues;
    }

    private void CheckFormFields(HtmlNode form, (string[] NamePatterns, string InputType, string AutocompleteValue)[] mappings, List<AccessibilityIssue> issues)
    {
        var inputs = form.SelectNodes(".//input");
        if (inputs == null) return;

        foreach (var input in inputs)
        {
            var type = input.GetAttributeValue("type", "text").ToLowerInvariant();
            if (type is "hidden" or "submit" or "button" or "reset" or "image" or "checkbox" or "radio")
                continue;

            var autocomplete = input.GetAttributeValue("autocomplete", "");
            if (!string.IsNullOrEmpty(autocomplete)) continue;

            var name = input.GetAttributeValue("name", "").ToLowerInvariant();
            var id = input.GetAttributeValue("id", "").ToLowerInvariant();

            var match = mappings.FirstOrDefault(m =>
                m.NamePatterns.Any(p => name.Contains(p) || id.Contains(p)));

            if (match.NamePatterns != null)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Login form input is missing autocomplete attribute (suggested: autocomplete=\"{match.AutocompleteValue}\").",
                    Category = AccessibilityCategory.Forms,
                    Level = WcagLevel.AA,
                    WcagCriterion = "1.3.5",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(input),
                    Selector = BuildSelector(input),
                    Recommendation = $"Add autocomplete=\"{match.AutocompleteValue}\" to support password managers and autofill."
                });
            }
        }
    }

    private void CheckContactFormFields(HtmlNode form, List<AccessibilityIssue> issues)
    {
        var inputs = form.SelectNodes(".//input|.//textarea");
        if (inputs == null) return;

        foreach (var input in inputs)
        {
            var type = input.GetAttributeValue("type", "text").ToLowerInvariant();
            if (type is "hidden" or "submit" or "button" or "reset" or "image" or "checkbox" or "radio")
                continue;

            var autocomplete = input.GetAttributeValue("autocomplete", "");
            if (!string.IsNullOrEmpty(autocomplete)) continue;

            var name = input.GetAttributeValue("name", "").ToLowerInvariant();
            var id = input.GetAttributeValue("id", "").ToLowerInvariant();

            var match = ContactFieldMappings.FirstOrDefault(m =>
                m.NamePatterns.Any(p => name.Contains(p) || id.Contains(p)));

            if (match.NamePatterns != null)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Contact form input is missing autocomplete attribute (suggested: autocomplete=\"{match.AutocompleteValue}\").",
                    Category = AccessibilityCategory.Forms,
                    Level = WcagLevel.AA,
                    WcagCriterion = "1.3.5",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(input),
                    Selector = BuildSelector(input),
                    Recommendation = $"Add autocomplete=\"{match.AutocompleteValue}\" to help users fill in contact details."
                });
            }
        }
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
