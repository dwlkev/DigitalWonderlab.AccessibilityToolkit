using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class LangAttributeCheck : IAccessibilityCheck
{
    public string RuleId => "lang-attribute";
    public WcagLevel MinimumLevel => WcagLevel.A;

    // BCP 47 primary language subtags (common ones)
    private static readonly HashSet<string> ValidPrimaryLangs = new(StringComparer.OrdinalIgnoreCase)
    {
        "af", "am", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de",
        "el", "en", "es", "et", "eu", "fa", "fi", "fr", "ga", "gl", "gu", "he", "hi",
        "hr", "hu", "hy", "id", "is", "it", "ja", "ka", "kk", "km", "kn", "ko", "ky",
        "lo", "lt", "lv", "mk", "ml", "mn", "mr", "ms", "mt", "my", "nb", "ne", "nl",
        "nn", "no", "pa", "pl", "ps", "pt", "ro", "ru", "si", "sk", "sl", "so", "sq",
        "sr", "sv", "sw", "ta", "te", "th", "tl", "tr", "uk", "ur", "uz", "vi", "zh",
        "zu"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var htmlElement = document.DocumentNode.SelectSingleNode("//html");

        if (htmlElement == null)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "No <html> element found in the document.",
                Category = AccessibilityCategory.Language,
                Level = WcagLevel.A,
                WcagCriterion = "3.1.1",
                Impact = "serious",
                Element = "",
                Selector = "html",
                Recommendation = "Ensure the page has a valid <html> element with a lang attribute."
            });
            return issues;
        }

        var lang = htmlElement.GetAttributeValue("lang", "");

        if (string.IsNullOrWhiteSpace(lang))
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "The <html> element is missing a lang attribute.",
                Category = AccessibilityCategory.Language,
                Level = WcagLevel.A,
                WcagCriterion = "3.1.1",
                Impact = "serious",
                Element = $"<html>",
                Selector = "html",
                Recommendation = "Add a lang attribute to the <html> element, e.g. <html lang=\"en\">."
            });
            return issues;
        }

        // Validate the lang value - extract primary language subtag
        var primaryLang = lang.Split('-')[0].Trim();
        if (!ValidPrimaryLangs.Contains(primaryLang))
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = $"The lang attribute value \"{lang}\" does not appear to be a valid BCP 47 language tag.",
                Category = AccessibilityCategory.Language,
                Level = WcagLevel.A,
                WcagCriterion = "3.1.1",
                Impact = "serious",
                Element = $"<html lang=\"{lang}\">",
                Selector = "html",
                Recommendation = "Use a valid BCP 47 language tag, e.g. \"en\", \"en-US\", \"fr\", \"de\"."
            });
        }

        return issues;
    }
}
