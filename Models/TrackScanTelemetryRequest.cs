namespace DigitalWonderlab.AccessibilityToolkit.Models;

public class TrackScanTelemetryRequest
{
    public string? WcagLevel { get; set; }
    public int? Score { get; set; }
    public int? DurationMs { get; set; }
    public string? ErrorCode { get; set; }
}
