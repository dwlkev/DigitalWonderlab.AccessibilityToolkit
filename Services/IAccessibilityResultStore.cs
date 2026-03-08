using DigitalWonderlab.AccessibilityToolkit.Models;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public interface IAccessibilityResultStore
{
    IEnumerable<AccessibilityResultDto> GetHistoryForNode(Guid nodeKey);
    IEnumerable<AccessibilityResultDto> GetRecentResults(int count);
    AccessibilityResultDto? GetResultById(int id);
    void SaveResult(AccessibilityResultDto dto);
    void DeleteResult(int id);

    void SaveAudit(AccessibilityAuditDto dto);
    IEnumerable<AccessibilityAuditDto> GetRecentAudits(int count);
    AccessibilityAuditDto? GetAuditById(int id);
    void DeleteAudit(int id);

    string? GetSetting(string key);
    void SaveSetting(string key, string value);

    void ClearAllData();
}
