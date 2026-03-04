using DigitalWonderlab.AccessibilityToolkit.Models;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public interface IAccessibilityCheck
{
    string RuleId { get; }
    WcagLevel MinimumLevel { get; }
    IEnumerable<AccessibilityIssue> Run(HtmlDocument document);
}
