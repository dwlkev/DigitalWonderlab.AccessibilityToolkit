namespace DigitalWonderlab.AccessibilityToolkit.Models;

public class SaveAuditRequest
{
    public Guid RootNodeKey { get; set; }
    public string? WcagLevel { get; set; }
    public int TotalPages { get; set; }
    public int AverageScore { get; set; }
    public int TotalIssues { get; set; }
    public string? ResultJson { get; set; }
}
