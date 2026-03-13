using DigitalWonderlab.AccessibilityToolkit.Checks.Utilities;
using DigitalWonderlab.AccessibilityToolkit.Models;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public class AccessibilityAnalyzer : IAccessibilityAnalyzer
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IEnumerable<IAccessibilityCheck> _checks;

    public AccessibilityAnalyzer(IHttpClientFactory httpClientFactory, IEnumerable<IAccessibilityCheck> checks)
    {
        _httpClientFactory = httpClientFactory;
        _checks = checks;
    }

    public async Task<AccessibilityResult> AnalyzeAsync(string url, WcagLevel level)
    {
        var client = _httpClientFactory.CreateClient("AccessibilityToolkit");
        var html = await client.GetStringAsync(url);

        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        var applicableChecks = _checks
            .Where(c => c.MinimumLevel <= level)
            .ToList();

        var allIssues = new List<AccessibilityIssue>();
        foreach (var check in applicableChecks)
        {
            var issues = check.Run(doc);
            allIssues.AddRange(issues);
        }

        // Filter individual issues by level (a check may emit issues above its MinimumLevel)
        allIssues = allIssues.Where(i => i.Level <= level).ToList();

        // Populate WCAG guidance URLs
        foreach (var issue in allIssues)
            issue.WcagUrl = WcagReference.GetUnderstandingUrl(issue.WcagCriterion);

        var score = CalculateScore(allIssues);

        var categorySummary = allIssues
            .GroupBy(i => i.Category.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        return new AccessibilityResult
        {
            Url = url,
            CheckedAt = DateTime.UtcNow,
            LevelChecked = level,
            Score = score,
            TotalChecks = applicableChecks.Count,
            TotalPassed = applicableChecks.Count - allIssues.Select(i => i.RuleId).Distinct().Count(),
            TotalIssues = allIssues.Count,
            CriticalCount = allIssues.Count(i => i.Impact == "critical"),
            SeriousCount = allIssues.Count(i => i.Impact == "serious"),
            ModerateCount = allIssues.Count(i => i.Impact == "moderate"),
            MinorCount = allIssues.Count(i => i.Impact == "minor"),
            Issues = allIssues,
            CategorySummary = categorySummary
        };
    }

    private static int CalculateScore(List<AccessibilityIssue> issues)
    {
        var deductionsByRule = issues
            .GroupBy(i => i.RuleId)
            .ToDictionary(g => g.Key, g =>
            {
                var ruleDeduction = g.Sum(issue => issue.Impact switch
                {
                    "critical" => 10,
                    "serious" => 5,
                    "moderate" => 2,
                    "minor" => 1,
                    _ => 1
                });
                return Math.Min(ruleDeduction, 25); // cap per rule
            });

        var totalDeduction = deductionsByRule.Values.Sum();
        return (int)Math.Round(100 * Math.Exp(-totalDeduction / 80.0));
    }
}
