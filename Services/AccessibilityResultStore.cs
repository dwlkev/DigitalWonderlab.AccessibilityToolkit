using DigitalWonderlab.AccessibilityToolkit.Models;
using NPoco;
using Umbraco.Cms.Infrastructure.Scoping;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public class AccessibilityResultStore : IAccessibilityResultStore
{
    private readonly IScopeProvider _scopeProvider;

    public AccessibilityResultStore(IScopeProvider scopeProvider)
    {
        _scopeProvider = scopeProvider;
    }

    public IEnumerable<AccessibilityResultDto> GetHistoryForNode(Guid nodeKey)
    {
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        return scope.Database.Fetch<AccessibilityResultDto>(
            new Sql("SELECT * FROM dwAccessibilityResults WHERE ContentNodeKey = @0 ORDER BY ScannedAt DESC", nodeKey));
    }

    public IEnumerable<AccessibilityResultDto> GetRecentResults(int count)
    {
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        return scope.Database.Fetch<AccessibilityResultDto>(
            new Sql("SELECT * FROM dwAccessibilityResults ORDER BY ScannedAt DESC"))
            .Take(count).ToList();
    }

    public AccessibilityResultDto? GetResultById(int id)
    {
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        return scope.Database.FirstOrDefault<AccessibilityResultDto>(
            new Sql("SELECT * FROM dwAccessibilityResults WHERE Id = @0", id));
    }

    public void SaveResult(AccessibilityResultDto dto)
    {
        using var scope = _scopeProvider.CreateScope();
        scope.Database.Insert(dto);
        scope.Complete();
    }

    public void UpdateResult(AccessibilityResultDto dto)
    {
        using var scope = _scopeProvider.CreateScope();
        scope.Database.Update(dto);
        scope.Complete();
    }

    public void DeleteResult(int id)
    {
        using var scope = _scopeProvider.CreateScope();
        scope.Database.Delete<AccessibilityResultDto>(id);
        scope.Complete();
    }

    public void SaveAudit(AccessibilityAuditDto dto)
    {
        using var scope = _scopeProvider.CreateScope();
        scope.Database.Insert(dto);
        scope.Complete();
    }

    public IEnumerable<AccessibilityAuditDto> GetRecentAudits(int count)
    {
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        return scope.Database.Fetch<AccessibilityAuditDto>(
            new Sql("SELECT Id, RootNodeKey, WcagLevel, TotalPages, AverageScore, TotalIssues, RootNodeName, ScannedAt FROM dwAccessibilityAudits ORDER BY ScannedAt DESC"))
            .Take(count).ToList();
    }

    public AccessibilityAuditDto? GetAuditById(int id)
    {
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        return scope.Database.FirstOrDefault<AccessibilityAuditDto>(
            new Sql("SELECT * FROM dwAccessibilityAudits WHERE Id = @0", id));
    }

    public void DeleteAudit(int id)
    {
        using var scope = _scopeProvider.CreateScope();
        scope.Database.Delete<AccessibilityAuditDto>(id);
        scope.Complete();
    }

    public string? GetSetting(string key)
    {
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        var result = scope.Database.FirstOrDefault<AccessibilitySettingsDto>(
            new Sql("SELECT * FROM dwAccessibilitySettings WHERE SettingKey = @0", key));
        return result?.SettingValue;
    }

    public void SaveSetting(string key, string value)
    {
        using var scope = _scopeProvider.CreateScope();
        var existing = scope.Database.FirstOrDefault<AccessibilitySettingsDto>(
            new Sql("SELECT * FROM dwAccessibilitySettings WHERE SettingKey = @0", key));

        if (existing != null)
        {
            existing.SettingValue = value;
            scope.Database.Update(existing);
        }
        else
        {
            scope.Database.Insert(new AccessibilitySettingsDto { SettingKey = key, SettingValue = value });
        }

        scope.Complete();
    }

    public void ClearAllData()
    {
        using var scope = _scopeProvider.CreateScope();
        scope.Database.Execute(new Sql("DELETE FROM dwAccessibilityResults"));
        scope.Database.Execute(new Sql("DELETE FROM dwAccessibilityAudits"));
        scope.Complete();
    }
}
