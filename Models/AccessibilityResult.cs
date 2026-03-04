namespace DigitalWonderlab.AccessibilityToolkit.Models;

public class AccessibilityResult
{
    public string Url { get; set; } = string.Empty;
    public DateTime CheckedAt { get; set; }
    public WcagLevel LevelChecked { get; set; }
    public int Score { get; set; }
    public int TotalChecks { get; set; }
    public int TotalPassed { get; set; }
    public int TotalIssues { get; set; }
    public int CriticalCount { get; set; }
    public int SeriousCount { get; set; }
    public int ModerateCount { get; set; }
    public int MinorCount { get; set; }
    public List<AccessibilityIssue> Issues { get; set; } = new();
    public Dictionary<string, int> CategorySummary { get; set; } = new();
}
