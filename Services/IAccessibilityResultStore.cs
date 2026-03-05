using DigitalWonderlab.AccessibilityToolkit.Models;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public interface IAccessibilityResultStore
{
    IEnumerable<AccessibilityResultDto> GetHistoryForNode(Guid nodeKey);
    IEnumerable<AccessibilityResultDto> GetRecentResults(int count);
    void SaveResult(AccessibilityResultDto dto);
    void DeleteResult(int id);

    void SaveAudit(AccessibilityAuditDto dto);
    IEnumerable<AccessibilityAuditDto> GetRecentAudits(int count);
    AccessibilityAuditDto? GetAuditById(int id);
    void DeleteAudit(int id);
}
