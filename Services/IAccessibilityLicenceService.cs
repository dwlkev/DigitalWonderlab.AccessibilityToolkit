namespace DigitalWonderlab.AccessibilityToolkit.Services;

public interface IAccessibilityLicenceService
{
    bool IsVisualChecksEnabled();
    LicenceInfo GetLicenceInfo();
}

public class LicenceInfo
{
    public string Status { get; set; } = string.Empty;
    public string Domain { get; set; } = string.Empty;
    public bool IsProEnabled { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? ValidationError { get; set; }
}
