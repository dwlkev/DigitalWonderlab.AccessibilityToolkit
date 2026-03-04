using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 3.1.5 – Reading Level (Level AAA)
/// Basic readability heuristic: flags very long sentences and high syllable-per-word ratio.
/// </summary>
public class ReadingLevelCheck : IAccessibilityCheck
{
    public string RuleId => "reading-level";
    public WcagLevel MinimumLevel => WcagLevel.AAA;

    private const int MaxAverageSentenceLength = 25;
    private const double MaxAverageSyllablesPerWord = 2.0;
    private const int MinTextLength = 300;

    private static readonly Regex SentenceSplitter = new(@"[.!?]+\s+", RegexOptions.Compiled);
    private static readonly Regex WordSplitter = new(@"\s+", RegexOptions.Compiled);
    private static readonly Regex VowelGroup = new(@"[aeiouy]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Get main content text
        var mainNode = document.DocumentNode.SelectSingleNode("//main")
                    ?? document.DocumentNode.SelectSingleNode("//*[@role='main']")
                    ?? document.DocumentNode.SelectSingleNode("//body");

        if (mainNode == null) return issues;

        // Remove script/style/nav content
        var clone = mainNode.CloneNode(true);
        var removeNodes = clone.SelectNodes(".//script|.//style|.//nav|.//header|.//footer|.//aside");
        if (removeNodes != null)
        {
            foreach (var n in removeNodes) n.Remove();
        }

        var text = clone.InnerText?.Trim() ?? "";
        // Normalize whitespace
        text = Regex.Replace(text, @"\s+", " ");

        if (text.Length < MinTextLength) return issues;

        var sentences = SentenceSplitter.Split(text)
            .Where(s => s.Trim().Length > 0)
            .ToList();

        if (sentences.Count < 3) return issues;

        // Calculate average sentence length
        var totalWords = 0;
        var totalSyllables = 0;
        var longSentences = 0;

        foreach (var sentence in sentences)
        {
            var words = WordSplitter.Split(sentence.Trim())
                .Where(w => w.Length > 0)
                .ToList();

            totalWords += words.Count;

            if (words.Count > 40)
                longSentences++;

            foreach (var word in words)
            {
                totalSyllables += CountSyllables(word);
            }
        }

        if (totalWords == 0) return issues;

        var avgSentenceLength = (double)totalWords / sentences.Count;
        var avgSyllablesPerWord = (double)totalSyllables / totalWords;

        if (avgSentenceLength > MaxAverageSentenceLength)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = $"Content has a high average sentence length ({avgSentenceLength:F0} words), which may be difficult to read.",
                Category = AccessibilityCategory.Language,
                Level = WcagLevel.AAA,
                WcagCriterion = "3.1.5",
                Impact = "minor",
                Element = "",
                Selector = "main",
                Recommendation = "Consider simplifying content by using shorter sentences (aim for an average of 15-20 words per sentence)."
            });
        }

        if (avgSyllablesPerWord > MaxAverageSyllablesPerWord)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = $"Content uses complex vocabulary (average {avgSyllablesPerWord:F1} syllables per word).",
                Category = AccessibilityCategory.Language,
                Level = WcagLevel.AAA,
                WcagCriterion = "3.1.5",
                Impact = "minor",
                Element = "",
                Selector = "main",
                Recommendation = "Consider using simpler words where possible to improve readability."
            });
        }

        if (longSentences > sentences.Count / 4)
        {
            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = $"{longSentences} of {sentences.Count} sentences exceed 40 words.",
                Category = AccessibilityCategory.Language,
                Level = WcagLevel.AAA,
                WcagCriterion = "3.1.5",
                Impact = "minor",
                Element = "",
                Selector = "main",
                Recommendation = "Break long sentences into shorter, clearer sentences to improve comprehension."
            });
        }

        return issues;
    }

    private static int CountSyllables(string word)
    {
        word = word.Trim().ToLowerInvariant();
        word = Regex.Replace(word, @"[^a-z]", "");

        if (word.Length <= 2) return 1;

        // Remove silent e
        if (word.EndsWith("e") && !word.EndsWith("le"))
            word = word[..^1];

        var matches = VowelGroup.Matches(word);
        return Math.Max(1, matches.Count);
    }
}
