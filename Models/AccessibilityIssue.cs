namespace DigitalWonderlab.AccessibilityToolkit.Models;

public class AccessibilityIssue
{
    public string RuleId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public AccessibilityCategory Category { get; set; }
    public WcagLevel Level { get; set; }
    public string WcagCriterion { get; set; } = string.Empty;
    public string Impact { get; set; } = string.Empty; // critical, serious, moderate, minor
    public string Element { get; set; } = string.Empty;
    public string Selector { get; set; } = string.Empty;
    public string Recommendation { get; set; } = string.Empty;
}
