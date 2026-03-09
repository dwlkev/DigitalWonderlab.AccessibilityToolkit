namespace DigitalWonderlab.AccessibilityToolkit.Models;

public class AccessibilityTelemetryEvent
{
    public string EventName { get; set; } = string.Empty;
    public string? WcagLevel { get; set; }
    public DateTime? TimestampUtc { get; set; }
    public int? DurationMs { get; set; }
    public int? PagesScanned { get; set; }
    public int? Score { get; set; }
    public int? AverageScore { get; set; }
    public string? ScoreBand { get; set; }
    public bool Success { get; set; }
    public string? ErrorCode { get; set; }
}
