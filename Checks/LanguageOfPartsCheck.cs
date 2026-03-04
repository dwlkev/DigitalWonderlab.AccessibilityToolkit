using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 3.1.2 – Language of Parts (Level AA)
/// Detects common non-English words/patterns without lang attribute.
/// </summary>
public class LanguageOfPartsCheck : IAccessibilityCheck
{
    public string RuleId => "language-of-parts";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    // Common foreign phrases that should have a lang attribute
    private static readonly (string Phrase, string Lang)[] ForeignPhrases =
    [
        ("vis-à-vis", "fr"), ("tête-à-tête", "fr"), ("rendez-vous", "fr"),
        ("raison d'être", "fr"), ("coup de grâce", "fr"), ("je ne sais quoi", "fr"),
        ("laissez-faire", "fr"), ("crème de la crème", "fr"), ("c'est la vie", "fr"),
        ("bon appétit", "fr"), ("carte blanche", "fr"), ("fait accompli", "fr"),
        ("schadenfreude", "de"), ("zeitgeist", "de"), ("kindergarten", "de"),
        ("wanderlust", "de"), ("doppelgänger", "de"), ("angst", "de"),
        ("ad hoc", "la"), ("bona fide", "la"), ("carpe diem", "la"),
        ("et cetera", "la"), ("per se", "la"), ("vice versa", "la"),
        ("status quo", "la"), ("quid pro quo", "la"), ("modus operandi", "la"),
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Check elements with explicit lang attributes for validity
        var langNodes = document.DocumentNode.SelectNodes("//*[@lang]");
        if (langNodes != null)
        {
            var langRegex = new Regex(@"^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$", RegexOptions.Compiled);
            foreach (var node in langNodes)
            {
                var lang = node.GetAttributeValue("lang", "").Trim();
                if (!string.IsNullOrEmpty(lang) && !langRegex.IsMatch(lang))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = $"Invalid lang attribute value: \"{lang}\".",
                        Category = AccessibilityCategory.Language,
                        Level = WcagLevel.AA,
                        WcagCriterion = "3.1.2",
                        Impact = "moderate",
                        Element = TruncateOuterHtml(node),
                        Selector = BuildSelector(node),
                        Recommendation = "Use a valid BCP 47 language tag (e.g., \"fr\", \"de\", \"es\")."
                    });
                }
            }
        }

        // Scan text content for foreign phrases without lang attribute
        var pageLang = document.DocumentNode.SelectSingleNode("//html")?.GetAttributeValue("lang", "en") ?? "en";
        var textNodes = document.DocumentNode.SelectNodes("//body//*[not(self::script) and not(self::style)]/text()[normalize-space()]");
        if (textNodes == null) return issues;

        var reportedPhrases = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var textNode in textNodes)
        {
            var text = textNode.InnerText;
            if (string.IsNullOrWhiteSpace(text)) continue;

            // Check if any ancestor has a different lang set
            var parentLangs = textNode.Ancestors()
                .Where(a => !string.IsNullOrEmpty(a.GetAttributeValue("lang", "")))
                .Select(a => a.GetAttributeValue("lang", ""))
                .ToList();

            foreach (var (phrase, lang) in ForeignPhrases)
            {
                if (text.Contains(phrase, StringComparison.OrdinalIgnoreCase) && !reportedPhrases.Contains(phrase))
                {
                    // Check if already wrapped in correct lang
                    var hasCorrectLang = parentLangs.Any(l => l.StartsWith(lang, StringComparison.OrdinalIgnoreCase));
                    if (hasCorrectLang) continue;

                    reportedPhrases.Add(phrase);
                    var parentElement = textNode.ParentNode;

                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = $"Foreign phrase \"{phrase}\" ({lang}) found without a lang attribute on its container.",
                        Category = AccessibilityCategory.Language,
                        Level = WcagLevel.AA,
                        WcagCriterion = "3.1.2",
                        Impact = "minor",
                        Element = TruncateOuterHtml(parentElement),
                        Selector = BuildSelector(parentElement),
                        Recommendation = $"Wrap the phrase in a <span lang=\"{lang}\"> element."
                    });
                }
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
