using System.Text.Json;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core.Web;
using Umbraco.Extensions;

namespace DigitalWonderlab.AccessibilityToolkit.Controllers;

[ApiController]
[Route("umbraco/api/accessibilitytoolkit")]
public class AccessibilityController : ControllerBase
{
    private readonly IAccessibilityAnalyzer _analyzer;
    private readonly IUmbracoContextAccessor _umbracoContextAccessor;
    private readonly IAccessibilityResultStore _resultStore;
    private readonly IAccessibilityLicenceService _licenceService;

    public AccessibilityController(
        IAccessibilityAnalyzer analyzer,
        IUmbracoContextAccessor umbracoContextAccessor,
        IAccessibilityResultStore resultStore,
        IAccessibilityLicenceService licenceService)
    {
        _analyzer = analyzer;
        _umbracoContextAccessor = umbracoContextAccessor;
        _resultStore = resultStore;
        _licenceService = licenceService;
    }

    [HttpGet("check/{nodeKey:guid}")]
    public async Task<IActionResult> Check(Guid nodeKey, [FromQuery] string level = "AA")
    {
        if (!Enum.TryParse<WcagLevel>(level, ignoreCase: true, out var wcagLevel))
            return BadRequest(new { error = $"Invalid WCAG level: {level}. Use A, AA, or AAA." });

        if (!_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
            return StatusCode(503, new { error = "Umbraco context is not available." });

        var content = umbracoContext.Content?.GetById(nodeKey);
        if (content == null)
            return NotFound(new { error = "Content not found or not published." });

        var url = content.Url(mode: Umbraco.Cms.Core.Models.PublishedContent.UrlMode.Absolute);
        if (string.IsNullOrEmpty(url) || url == "#")
            return BadRequest(new { error = "Could not resolve a published URL for this content. Ensure the page is published and has a valid hostname configured." });

        try
        {
            var result = await _analyzer.AnalyzeAsync(url, wcagLevel);

            // Save result to history
            SaveResultToHistory(nodeKey, result, wcagLevel);

            return Ok(result);
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

    [HttpGet("history/{nodeKey:guid}")]
    public IActionResult GetHistory(Guid nodeKey)
    {
        var history = _resultStore.GetHistoryForNode(nodeKey)
            .Select(MapToHistoryEntry);
        return Ok(history);
    }

    [HttpGet("history/recent")]
    public IActionResult GetRecentHistory([FromQuery] int count = 20)
    {
        if (count < 1) count = 1;
        if (count > 100) count = 100;

        var history = _resultStore.GetRecentResults(count)
            .Select(MapToHistoryEntry);
        return Ok(history);
    }

    [HttpDelete("history/{id:int}")]
    public IActionResult DeleteHistory(int id)
    {
        _resultStore.DeleteResult(id);
        return Ok(new { success = true });
    }

    [HttpPost("audit/{nodeKey:guid}")]
    public async Task<IActionResult> Audit(Guid nodeKey, [FromQuery] string level = "AA")
    {
        if (!Enum.TryParse<WcagLevel>(level, ignoreCase: true, out var wcagLevel))
            return BadRequest(new { error = $"Invalid WCAG level: {level}. Use A, AA, or AAA." });

        if (!_umbracoContextAccessor.TryGetUmbracoContext(out var umbracoContext))
            return StatusCode(503, new { error = "Umbraco context is not available." });

        var rootContent = umbracoContext.Content?.GetById(nodeKey);
        if (rootContent == null)
            return NotFound(new { error = "Content not found or not published." });

        // Collect root + all published descendants
        var allContent = new[] { rootContent }
            .Concat(rootContent.Descendants())
            .ToList();

        var pages = new List<object>();
        var totalIssues = 0;
        var totalScore = 0;
        var scannedCount = 0;

        foreach (var content in allContent)
        {
            var url = content.Url(mode: Umbraco.Cms.Core.Models.PublishedContent.UrlMode.Absolute);
            if (string.IsNullOrEmpty(url) || url == "#")
                continue;

            try
            {
                var result = await _analyzer.AnalyzeAsync(url, wcagLevel);
                SaveResultToHistory(content.Key, result, wcagLevel);

                pages.Add(new
                {
                    nodeKey = content.Key,
                    url = result.Url,
                    score = result.Score,
                    totalIssues = result.TotalIssues
                });

                totalIssues += result.TotalIssues;
                totalScore += result.Score;
                scannedCount++;
            }
            catch
            {
                // Skip pages that can't be fetched
                pages.Add(new
                {
                    nodeKey = content.Key,
                    url,
                    score = -1,
                    totalIssues = -1
                });
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
                totalIssues
            }
        };

        // Save the full audit record
        var auditDto = new AccessibilityAuditDto
        {
            RootNodeKey = nodeKey,
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

    [HttpGet("audit/recent")]
    public IActionResult GetRecentAudits([FromQuery] int count = 20)
    {
        if (count < 1) count = 1;
        if (count > 100) count = 100;

        var audits = _resultStore.GetRecentAudits(count)
            .Select(a => new
            {
                id = a.Id,
                rootNodeKey = a.RootNodeKey,
                wcagLevel = a.WcagLevel,
                totalPages = a.TotalPages,
                averageScore = a.AverageScore,
                totalIssues = a.TotalIssues,
                scannedAt = a.ScannedAt
            });
        return Ok(audits);
    }

    [HttpGet("audit/{id:int}/export")]
    public IActionResult ExportAudit(int id)
    {
        var audit = _resultStore.GetAuditById(id);
        if (audit == null)
            return NotFound(new { error = "Audit not found." });

        return Ok(new { resultJson = audit.ResultJson });
    }

    [HttpDelete("audit/{id:int}")]
    public IActionResult DeleteAudit(int id)
    {
        _resultStore.DeleteAudit(id);
        return Ok(new { success = true });
    }

    [HttpGet("features")]
    public IActionResult GetFeatures()
    {
        return Ok(new { visualChecks = _licenceService.IsVisualChecksEnabled() });
    }

    private void SaveResultToHistory(Guid nodeKey, AccessibilityResult result, WcagLevel wcagLevel)
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
