namespace DigitalWonderlab.AccessibilityToolkit.Models;

public class UpdateResultRequest
{
    public int Score { get; set; }
    public int TotalIssues { get; set; }
    public int CriticalCount { get; set; }
    public int SeriousCount { get; set; }
    public int ModerateCount { get; set; }
    public int MinorCount { get; set; }
    public string? ResultJson { get; set; }
}
