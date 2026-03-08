using System.Text.Json;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;
using Umbraco.Cms.Web.Common.Attributes;
using Umbraco.Cms.Web.Common.Controllers;
using Umbraco.Extensions;

namespace DigitalWonderlab.AccessibilityToolkit.Controllers;

[PluginController("AccessibilityToolkit")]
public class AccessibilityController : UmbracoApiController
{
    private readonly IAccessibilityAnalyzer _analyzer;
    private readonly IUmbracoContextAccessor _umbracoContextAccessor;
    private readonly IAccessibilityResultStore _resultStore;
    private readonly IAccessibilityLicenceService _licenceService;
    private readonly IContentTypeService _contentTypeService;
    private readonly ILogger<AccessibilityController> _logger;

    public AccessibilityController(
        IAccessibilityAnalyzer analyzer,
        IUmbracoContextAccessor umbracoContextAccessor,
        IAccessibilityResultStore resultStore,
        IAccessibilityLicenceService licenceService,
        IContentTypeService contentTypeService,
        ILogger<AccessibilityController> logger)
    {
        _analyzer = analyzer;
        _umbracoContextAccessor = umbracoContextAccessor;
        _resultStore = resultStore;
        _licenceService = licenceService;
        _contentTypeService = contentTypeService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Check(Guid nodeKey, string level = "AA")
    {
        if (!Enum.TryParse<WcagLevel>(level, ignoreCase: true, out var wcagLevel))
            return BadRequest(new { error = $"Invalid WCAG level: {level}. Use A, AA, or AAA." });

        if (!_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
            return StatusCode(503, new { error = "Umbraco context is not available." });

        var content = umbracoContext.Content?.GetById(nodeKey);
        if (content == null)
            return NotFound(new { error = "Content not found or not published." });

        var url = content.Url(mode: UrlMode.Absolute);
        if (string.IsNullOrEmpty(url) || url == "#")
            return BadRequest(new { error = "Could not resolve a published URL for this content. Ensure the page is published and has a valid hostname configured." });

        try
        {
            var result = await _analyzer.AnalyzeAsync(url, wcagLevel);

            // Save result to history
            var savedId = SaveResultToHistory(nodeKey, result, wcagLevel);

            return Ok(new { result.Url, result.Score, result.TotalChecks, result.TotalIssues,
                result.CriticalCount, result.SeriousCount, result.ModerateCount, result.MinorCount,
                result.Issues, result.CategorySummary, result.CheckedAt, resultId = savedId });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { error = $"Failed to fetch page HTML: {ex.Message}", url });
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, new { error = "Request to fetch page HTML timed out.", url });
        }
    }

    [HttpGet]
    public IActionResult GetHistory(Guid nodeKey)
    {
        var history = _resultStore.GetHistoryForNode(nodeKey)
            .Select(MapToHistoryEntry);
        return Ok(history);
    }

    [HttpGet]
    public IActionResult GetRecentHistory(int count = 20)
    {
        if (count < 1) count = 1;
        if (count > 100) count = 100;

        var history = _resultStore.GetRecentResults(count)
            .Select(MapToHistoryEntry);
        return Ok(history);
    }

    [HttpDelete]
    public IActionResult DeleteHistory(int id)
    {
        _resultStore.DeleteResult(id);
        return Ok(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> RunAudit(Guid nodeKey, string level = "AA")
    {
        if (!Enum.TryParse<WcagLevel>(level, ignoreCase: true, out var wcagLevel))
            return BadRequest(new { error = $"Invalid WCAG level: {level}. Use A, AA, or AAA." });

        if (!_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
            return StatusCode(503, new { error = "Umbraco context is not available." });

        var rootContent = umbracoContext.Content?.GetById(nodeKey);
        if (rootContent == null)
            return NotFound(new { error = "Content not found or not published." });

        // Collect root + all published descendants, then apply exclusions
        var allContent = new[] { rootContent }
            .Concat(rootContent.Descendants())
            .ToList();
        allContent = ApplyExclusions(allContent);

        var pages = new List<object>();
        var totalIssues = 0;
        var totalScore = 0;
        var scannedCount = 0;
        var totalCritical = 0;
        var totalSerious = 0;
        var totalModerate = 0;
        var totalMinor = 0;

        foreach (var content in allContent)
        {
            var url = content.Url(mode: UrlMode.Absolute);
            if (string.IsNullOrEmpty(url) || url == "#")
                continue;

            try
            {
                var result = await _analyzer.AnalyzeAsync(url, wcagLevel);
                SaveResultToHistory(content.Key, result, wcagLevel);

                pages.Add(new
                {
                    nodeKey = content.Key,
                    name = content.Name,
                    url = result.Url,
                    score = result.Score,
                    totalIssues = result.TotalIssues,
                    criticalCount = result.CriticalCount,
                    seriousCount = result.SeriousCount,
                    moderateCount = result.ModerateCount,
                    minorCount = result.MinorCount,
                    issues = result.Issues.Select(i => new
                    {
                        ruleId = i.RuleId,
                        description = i.Description,
                        category = i.Category.ToString(),
                        wcagCriterion = i.WcagCriterion,
                        impact = i.Impact,
                        element = i.Element,
                        selector = i.Selector,
                        recommendation = i.Recommendation,
                        wcagUrl = i.WcagUrl
                    }),
                    categorySummary = result.CategorySummary
                });

                totalIssues += result.TotalIssues;
                totalScore += result.Score;
                totalCritical += result.CriticalCount;
                totalSerious += result.SeriousCount;
                totalModerate += result.ModerateCount;
                totalMinor += result.MinorCount;
                scannedCount++;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Failed to fetch page HTML for {Url} during audit", url);
                pages.Add(new { nodeKey = content.Key, name = content.Name, url, score = -1, totalIssues = -1 });
            }
            catch (TaskCanceledException ex)
            {
                _logger.LogWarning(ex, "Request timed out for {Url} during audit", url);
                pages.Add(new { nodeKey = content.Key, name = content.Name, url, score = -1, totalIssues = -1 });
            }
        }

        var averageScore = scannedCount > 0 ? totalScore / scannedCount : 0;

        var responseData = new
        {
            pages,
            summary = new
            {
                totalPages = scannedCount,
                averageScore,
                totalIssues,
                criticalCount = totalCritical,
                seriousCount = totalSerious,
                moderateCount = totalModerate,
                minorCount = totalMinor
            }
        };

        // Save the full audit record
        var auditDto = new AccessibilityAuditDto
        {
            RootNodeKey = nodeKey,
            RootNodeName = rootContent.Name,
            WcagLevel = wcagLevel.ToString(),
            TotalPages = scannedCount,
            AverageScore = averageScore,
            TotalIssues = totalIssues,
            ResultJson = JsonSerializer.Serialize(responseData),
            ScannedAt = DateTime.UtcNow
        };
        _resultStore.SaveAudit(auditDto);

        return Ok(responseData);
    }

    [HttpGet]
    public IActionResult GetRecentAudits(int count = 20)
    {
        if (count < 1) count = 1;
        if (count > 100) count = 100;

        var audits = _resultStore.GetRecentAudits(count)
            .Select(a => new
            {
                id = a.Id,
                rootNodeKey = a.RootNodeKey,
                rootNodeName = a.RootNodeName,
                wcagLevel = a.WcagLevel,
                totalPages = a.TotalPages,
                averageScore = a.AverageScore,
                totalIssues = a.TotalIssues,
                scannedAt = a.ScannedAt
            });
        return Ok(audits);
    }

    [HttpGet]
    public IActionResult ExportAudit(int id)
    {
        var audit = _resultStore.GetAuditById(id);
        if (audit == null)
            return NotFound(new { error = "Audit not found." });

        return Ok(new { resultJson = audit.ResultJson });
    }

    [HttpPost]
    public IActionResult UpdateResult(int id, [FromBody] UpdateResultRequest request)
    {
        if (request == null)
            return BadRequest(new { error = "Request body is required." });

        var existing = _resultStore.GetResultById(id);
        if (existing == null)
            return NotFound(new { error = "Result not found." });

        existing.OverallScore = request.Score;
        existing.TotalIssues = request.TotalIssues;
        existing.CriticalCount = request.CriticalCount;
        existing.SeriousCount = request.SeriousCount;
        existing.ModerateCount = request.ModerateCount;
        existing.MinorCount = request.MinorCount;
        existing.ResultJson = request.ResultJson ?? existing.ResultJson;

        _resultStore.UpdateResult(existing);
        return Ok(new { success = true });
    }

    [HttpGet]
    public IActionResult ExportResult(int id)
    {
        var result = _resultStore.GetResultById(id);
        if (result == null)
            return NotFound(new { error = "Result not found." });

        return Ok(new { resultJson = result.ResultJson });
    }

    [HttpDelete]
    public IActionResult DeleteAudit(int id)
    {
        _resultStore.DeleteAudit(id);
        return Ok(new { success = true });
    }

    [HttpGet]
    public IActionResult GetPageUrl(Guid nodeKey)
    {
        if (!_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
            return StatusCode(503, new { error = "Umbraco context is not available." });

        var content = umbracoContext.Content?.GetById(nodeKey);
        if (content == null)
            return NotFound(new { error = "Content not found or not published." });

        var url = content.Url(mode: UrlMode.Absolute);
        if (string.IsNullOrEmpty(url) || url == "#")
            return BadRequest(new { error = "Could not resolve a published URL for this content." });

        return Ok(new { url });
    }

    [HttpGet]
    public IActionResult GetDescendantPages(Guid nodeKey)
    {
        if (!_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
            return StatusCode(503, new { error = "Umbraco context is not available." });

        var rootContent = umbracoContext.Content?.GetById(nodeKey);
        if (rootContent == null)
            return NotFound(new { error = "Content not found or not published." });

        var allContent = new[] { rootContent }
            .Concat(rootContent.Descendants())
            .ToList();
        allContent = ApplyExclusions(allContent);

        var pages = new List<object>();
        foreach (var content in allContent)
        {
            var url = content.Url(mode: UrlMode.Absolute);
            if (string.IsNullOrEmpty(url) || url == "#")
                continue;

            pages.Add(new
            {
                nodeKey = content.Key,
                name = content.Name,
                url
            });
        }

        return Ok(new { pages, totalCount = pages.Count });
    }

    [HttpPost]
    public IActionResult SaveAudit([FromBody] SaveAuditRequest request)
    {
        if (request == null)
            return BadRequest(new { error = "Request body is required." });

        // Resolve root node name from published cache
        string? rootNodeName = null;
        if (_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
        {
            rootNodeName = umbracoContext.Content?.GetById(request.RootNodeKey)?.Name;
        }

        var auditDto = new AccessibilityAuditDto
        {
            RootNodeKey = request.RootNodeKey,
            RootNodeName = rootNodeName,
            WcagLevel = request.WcagLevel ?? "AA",
            TotalPages = request.TotalPages,
            AverageScore = request.AverageScore,
            TotalIssues = request.TotalIssues,
            ResultJson = request.ResultJson ?? "{}",
            ScannedAt = DateTime.UtcNow
        };
        _resultStore.SaveAudit(auditDto);

        return Ok(new { success = true });
    }

    [HttpGet]
    public IActionResult GetFeatures()
    {
        var info = _licenceService.GetLicenceInfo();
        return Ok(new
        {
            visualChecks = info.IsProEnabled,
            licenseType = info.LicenseType,
            status = info.Status,
            domain = info.Domain,
            isProEnabled = info.IsProEnabled,
            expiresAt = info.ExpiresAt,
            validationError = info.ValidationError
        });
    }

    [HttpGet]
    public IActionResult GetExclusions()
    {
        var docTypesJson = _resultStore.GetSetting("ExcludedDocumentTypes");
        var nodeKeysJson = _resultStore.GetSetting("ExcludedNodeKeys");

        var excludedDocTypes = !string.IsNullOrEmpty(docTypesJson)
            ? JsonSerializer.Deserialize<string[]>(docTypesJson) ?? []
            : Array.Empty<string>();

        var excludedNodeKeys = !string.IsNullOrEmpty(nodeKeysJson)
            ? JsonSerializer.Deserialize<Guid[]>(nodeKeysJson) ?? []
            : Array.Empty<Guid>();

        // Resolve node names
        var nodeKeysWithNames = new List<object>();
        if (excludedNodeKeys.Length > 0 && _umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
        {
            foreach (var key in excludedNodeKeys)
            {
                var name = umbracoContext.Content?.GetById(key)?.Name ?? key.ToString().Substring(0, 8) + "...";
                nodeKeysWithNames.Add(new { key, name });
            }
        }
        else
        {
            foreach (var key in excludedNodeKeys)
            {
                nodeKeysWithNames.Add(new { key, name = key.ToString().Substring(0, 8) + "..." });
            }
        }

        return Ok(new
        {
            excludedDocumentTypes = excludedDocTypes,
            excludedNodeKeys = nodeKeysWithNames
        });
    }

    [HttpPost]
    public IActionResult SaveExclusions([FromBody] SaveExclusionsRequest request)
    {
        if (request == null)
            return BadRequest(new { error = "Request body is required." });

        _resultStore.SaveSetting("ExcludedDocumentTypes",
            JsonSerializer.Serialize(request.ExcludedDocumentTypes ?? []));
        _resultStore.SaveSetting("ExcludedNodeKeys",
            JsonSerializer.Serialize(request.ExcludedNodeKeys ?? []));

        return Ok(new { success = true });
    }

    [HttpPost]
    public IActionResult ClearAllData()
    {
        _resultStore.ClearAllData();
        return Ok(new { success = true });
    }

    [HttpGet]
    public IActionResult GetDocumentTypes()
    {
        var types = _contentTypeService.GetAll()
            .Where(t => !t.IsElement)
            .Select(t => new { alias = t.Alias, name = t.Name })
            .OrderBy(t => t.name);

        return Ok(types);
    }

    [HttpGet]
    public IActionResult GetNodeName(Guid nodeKey)
    {
        if (!_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
            return StatusCode(503, new { error = "Umbraco context is not available." });

        var content = umbracoContext.Content?.GetById(nodeKey);
        if (content == null)
            return NotFound(new { error = "Content not found or not published." });

        return Ok(new { name = content.Name });
    }

    private List<IPublishedContent> ApplyExclusions(List<IPublishedContent> allContent)
    {
        var docTypesJson = _resultStore.GetSetting("ExcludedDocumentTypes");
        var nodeKeysJson = _resultStore.GetSetting("ExcludedNodeKeys");

        var excludedDocTypes = !string.IsNullOrEmpty(docTypesJson)
            ? JsonSerializer.Deserialize<string[]>(docTypesJson) ?? []
            : Array.Empty<string>();

        var excludedNodeKeys = !string.IsNullOrEmpty(nodeKeysJson)
            ? JsonSerializer.Deserialize<Guid[]>(nodeKeysJson) ?? []
            : Array.Empty<Guid>();

        if (excludedDocTypes.Length == 0 && excludedNodeKeys.Length == 0)
            return allContent;

        return allContent
            .Where(c => !excludedDocTypes.Contains(c.ContentType.Alias))
            .Where(c => !excludedNodeKeys.Contains(c.Key))
            .ToList();
    }

    private int SaveResultToHistory(Guid nodeKey, AccessibilityResult result, WcagLevel wcagLevel)
    {
        var dto = new AccessibilityResultDto
        {
            ContentNodeKey = nodeKey,
            Url = result.Url,
            WcagLevel = wcagLevel.ToString(),
            OverallScore = result.Score,
            TotalIssues = result.TotalIssues,
            CriticalCount = result.CriticalCount,
            SeriousCount = result.SeriousCount,
            ModerateCount = result.ModerateCount,
            MinorCount = result.MinorCount,
            ResultJson = JsonSerializer.Serialize(result),
            ScannedAt = result.CheckedAt
        };

        _resultStore.SaveResult(dto);
        return dto.Id;
    }

    private static object MapToHistoryEntry(AccessibilityResultDto dto) => new
    {
        id = dto.Id,
        contentNodeKey = dto.ContentNodeKey,
        url = dto.Url,
        wcagLevel = dto.WcagLevel,
        overallScore = dto.OverallScore,
        totalIssues = dto.TotalIssues,
        criticalCount = dto.CriticalCount,
        seriousCount = dto.SeriousCount,
        moderateCount = dto.ModerateCount,
        minorCount = dto.MinorCount,
        scannedAt = dto.ScannedAt
    };
}
