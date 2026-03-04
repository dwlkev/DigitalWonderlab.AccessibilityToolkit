using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class PageTitleCheck : IAccessibilityCheck
{
    public string RuleId => "page-title";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var title = document.DocumentNode.SelectSingleNode("//head/title")
                    ?? document.DocumentNode.SelectSingleNode("//title");

        if (title == null)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page is missing a <title> element.",
                Category = AccessibilityCategory.Structure,
                Level = WcagLevel.A,
                WcagCriterion = "2.4.2",
                Impact = "serious",
                Element = "",
                Selector = "title",
                Recommendation = "Add a descriptive <title> element inside <head>."
            });
            return issues;
        }

        var text = title.InnerText?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(text))
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Page <title> element is empty.",
                Category = AccessibilityCategory.Structure,
                Level = WcagLevel.A,
                WcagCriterion = "2.4.2",
                Impact = "serious",
                Element = "<title></title>",
                Selector = "title",
                Recommendation = "Add meaningful text to the <title> element that describes the page content."
            });
        }
        else if (text.Length < 5)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = $"Page title is very short: \"{text}\".",
                Category = AccessibilityCategory.Structure,
                Level = WcagLevel.A,
                WcagCriterion = "2.4.2",
                Impact = "moderate",
                Element = $"<title>{HtmlEntity.Entitize(text)}</title>",
                Selector = "title",
                Recommendation = "Use a descriptive title that identifies the page content and site name."
            });
        }

        return issues;
    }
}
