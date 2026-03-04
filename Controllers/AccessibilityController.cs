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

    public AccessibilityController(
        IAccessibilityAnalyzer analyzer,
        IUmbracoContextAccessor umbracoContextAccessor)
    {
        _analyzer = analyzer;
        _umbracoContextAccessor = umbracoContextAccessor;
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
}
