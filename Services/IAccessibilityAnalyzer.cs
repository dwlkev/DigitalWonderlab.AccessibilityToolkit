using DigitalWonderlab.AccessibilityToolkit.Models;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public interface IAccessibilityAnalyzer
{
    Task<AccessibilityResult> AnalyzeAsync(string url, WcagLevel level);
}
