using System.Net.Http.Json;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using DigitalWonderlab.AccessibilityToolkit.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public class AccessibilityTelemetryService : IAccessibilityTelemetryService
{
    private const string DefaultTelemetryEndpoint = "https://dwl-umbraco-telemetry-api-h5h4axfnfua8atbd.uksouth-01.azurewebsites.net/api/telemetry/events";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IAccessibilityResultStore _resultStore;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AccessibilityTelemetryService> _logger;

    public AccessibilityTelemetryService(
        IHttpClientFactory httpClientFactory,
        IAccessibilityResultStore resultStore,
        IHttpContextAccessor httpContextAccessor,
        IConfiguration configuration,
        ILogger<AccessibilityTelemetryService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _resultStore = resultStore;
        _httpContextAccessor = httpContextAccessor;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task TrackEventAsync(AccessibilityTelemetryEvent telemetryEvent, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(telemetryEvent.EventName))
            return;

        if (!TryGetTelemetryConfig(out var endpoint, out var timeoutMs))
            return;

        try
        {
            var client = _httpClientFactory.CreateClient("AccessibilityToolkitTelemetry");
            client.Timeout = TimeSpan.FromMilliseconds(timeoutMs);

            var payload = new OutboundTelemetryEvent
            {
                EventName = telemetryEvent.EventName,
                WcagLevel = telemetryEvent.WcagLevel,
                TimestampUtc = telemetryEvent.TimestampUtc ?? DateTime.UtcNow,
                PackageVersion = GetPackageVersion(),
                UmbracoVersion = GetUmbracoVersion(),
                SiteIdHash = GetSiteIdHash(),
                DurationMs = telemetryEvent.DurationMs,
                PagesScanned = telemetryEvent.PagesScanned,
                Score = telemetryEvent.Score,
                AverageScore = telemetryEvent.AverageScore,
                ScoreBand = telemetryEvent.ScoreBand ?? BuildScoreBand(telemetryEvent.Score, telemetryEvent.AverageScore),
                Success = telemetryEvent.Success,
                ErrorCode = telemetryEvent.ErrorCode
            };

            using var response = await client.PostAsJsonAsync(endpoint, new[] { payload }, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogDebug("Telemetry endpoint returned {StatusCode} for event {EventName}",
                    (int)response.StatusCode, telemetryEvent.EventName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Telemetry send failed for event {EventName}", telemetryEvent.EventName);
        }
    }

    private bool TryGetTelemetryConfig(out string endpoint, out int timeoutMs)
    {
        endpoint = _configuration["AccessibilityToolkit:Telemetry:Endpoint"]?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(endpoint))
            endpoint = DefaultTelemetryEndpoint;
        timeoutMs = _configuration.GetValue<int?>("AccessibilityToolkit:Telemetry:TimeoutMs") ?? 3000;
        timeoutMs = Math.Clamp(timeoutMs, 500, 10000);

        var enabledByConfig = _configuration.GetValue<bool?>("AccessibilityToolkit:Telemetry:Enabled");
        if (enabledByConfig.HasValue && !enabledByConfig.Value)
            return false;

        var enabledRaw = _resultStore.GetSetting("TelemetryEnabled");
        var enabledByUser = !bool.TryParse(enabledRaw, out var parsed) || parsed;
        if (!enabledByUser)
            return false;

        if (string.IsNullOrWhiteSpace(endpoint))
            return false;

        return true;
    }

    private string? GetPackageVersion()
    {
        var assembly = typeof(AccessibilityTelemetryService).Assembly;
        return assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion?.Split('+')[0]
               ?? assembly.GetName().Version?.ToString();
    }

    private static string? GetUmbracoVersion() => typeof(Constants).Assembly.GetName().Version?.ToString();

    private string? GetSiteIdHash()
    {
        var host = _httpContextAccessor.HttpContext?.Request?.Host.Host;
        if (string.IsNullOrWhiteSpace(host))
            return null;

        var normalized = host.Trim().ToLowerInvariant();
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(bytes);
    }

    private static string BuildScoreBand(int? score, int? averageScore)
    {
        var value = score ?? averageScore;
        if (!value.HasValue) return "unknown";
        if (value.Value < 40) return "critical";
        if (value.Value < 60) return "poor";
        if (value.Value < 80) return "fair";
        if (value.Value < 90) return "good";
        return "excellent";
    }

    private class OutboundTelemetryEvent
    {
        public string EventName { get; set; } = string.Empty;
        public string? WcagLevel { get; set; }
        public DateTime TimestampUtc { get; set; }
        public string? PackageVersion { get; set; }
        public string? UmbracoVersion { get; set; }
        public string? SiteIdHash { get; set; }
        public int? DurationMs { get; set; }
        public int? PagesScanned { get; set; }
        public int? Score { get; set; }
        public int? AverageScore { get; set; }
        public string? ScoreBand { get; set; }
        public bool Success { get; set; }
        public string? ErrorCode { get; set; }
    }
}
