namespace DigitalWonderlab.AccessibilityToolkit.Models;

public class SaveExclusionsRequest
{
    public string[]? ExcludedDocumentTypes { get; set; }
    public Guid[]? ExcludedNodeKeys { get; set; }
}
