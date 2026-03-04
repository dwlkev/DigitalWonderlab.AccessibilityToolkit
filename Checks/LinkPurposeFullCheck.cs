using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.4.9 – Link Purpose (Link Only) (Level AAA)
/// Detects links with text less than 4 chars or single-word non-descriptive text.
/// </summary>
public class LinkPurposeFullCheck : IAccessibilityCheck
{
    public string RuleId => "link-purpose-full";
    public WcagLevel MinimumLevel => WcagLevel.AAA;

    private static readonly HashSet<string> NonDescriptiveWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "go", "ok", "yes", "no", "see", "view", "open", "show", "get", "buy",
        "try", "use", "add", "new", "top", "next", "prev", "back", "home",
        "edit", "save", "send", "help", "menu", "page", "site", "web", "link",
        "url", "file", "data", "info", "post", "blog"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var links = document.DocumentNode.SelectNodes("//a[@href]");

        if (links == null) return issues;

        foreach (var link in links)
        {
            var ariaLabel = link.GetAttributeValue("aria-label", "");
            var text = !string.IsNullOrEmpty(ariaLabel) ? ariaLabel : (link.InnerText?.Trim() ?? "");

            if (string.IsNullOrWhiteSpace(text)) continue; // Caught by LinkTextCheck

            // Skip links that are clearly icon-only with aria-label
            if (!string.IsNullOrEmpty(ariaLabel) && ariaLabel.Length >= 4)
                continue;

            // Flag very short link text (< 4 chars)
            if (text.Length > 0 && text.Length < 4 && !text.Contains("..."))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Link text is very short (\"{text}\") and may not convey purpose without context.",
                    Category = AccessibilityCategory.Links,
                    Level = WcagLevel.AAA,
                    WcagCriterion = "2.4.9",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(link),
                    Selector = BuildSelector(link),
                    Recommendation = "Use descriptive link text that makes sense without surrounding context."
                });
                continue;
            }

            // Flag single-word non-descriptive text
            var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (words.Length == 1 && NonDescriptiveWords.Contains(words[0].TrimEnd('.', ',', '!', '?')))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Link text \"{text}\" is a single non-descriptive word that doesn't convey purpose alone.",
                    Category = AccessibilityCategory.Links,
                    Level = WcagLevel.AAA,
                    WcagCriterion = "2.4.9",
                    Impact = "minor",
                    Element = TruncateOuterHtml(link),
                    Selector = BuildSelector(link),
                    Recommendation = "Make the link text self-descriptive, e.g. \"View product details\" instead of \"View\"."
                });
            }
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode link)
    {
        var id = link.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"a#{id}";
        var href = link.GetAttributeValue("href", "");
        if (!string.IsNullOrEmpty(href)) return $"a[href=\"{href}\"]";
        return "a";
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
