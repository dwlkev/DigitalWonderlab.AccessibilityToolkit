using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public class AccessibilityLicenceService : IAccessibilityLicenceService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AccessibilityLicenceService> _logger;

    public AccessibilityLicenceService(
        IConfiguration configuration,
        ILogger<AccessibilityLicenceService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsVisualChecksEnabled()
    {
        return GetLicenceInfo().IsProEnabled;
    }

    public LicenceInfo GetLicenceInfo()
    {
        // Transitional, config-driven model:
        // - No embedded signing secret in package
        // - No in-package key generation
        // - Explicit license shape for UI/API consumers
        var configuredType = _configuration["AccessibilityToolkit:Licensing:LicenseType"];
        var licenseType = NormalizeLicenseType(configuredType);
        var status = NormalizeStatus(_configuration["AccessibilityToolkit:Licensing:Status"]);
        var domain = _configuration["AccessibilityToolkit:Licensing:Domain"] ?? "*";
        var visualChecksEnabled = _configuration.GetValue<bool?>("AccessibilityToolkit:VisualChecks:Enabled") ?? true;

        DateTime? expiresAt = null;
        var expiresRaw = _configuration["AccessibilityToolkit:Licensing:ExpiresAt"];
        if (!string.IsNullOrWhiteSpace(expiresRaw) && DateTime.TryParse(expiresRaw, out var parsed))
        {
            expiresAt = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
        }

        string? validationError = null;
        if (expiresAt.HasValue && expiresAt.Value < DateTime.UtcNow && !string.Equals(status, "Invalid", StringComparison.OrdinalIgnoreCase))
        {
            status = "Expired";
            validationError = $"Licence expired on {expiresAt.Value:yyyy-MM-dd}.";
        }

        // Legacy key path is intentionally removed from runtime package.
        var legacyKey = _configuration["AccessibilityToolkit:LicenceKey"];
        if (!string.IsNullOrWhiteSpace(legacyKey))
        {
            _logger.LogInformation("Legacy AccessibilityToolkit:LicenceKey is present but key validation is disabled in runtime package.");
            validationError ??= "Legacy key validation is disabled; use AccessibilityToolkit:Licensing:* settings.";
        }

        var isProEnabled = visualChecksEnabled;
        if (string.Equals(status, "Expired", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(status, "Invalid", StringComparison.OrdinalIgnoreCase))
        {
            isProEnabled = false;
        }

        return new LicenceInfo
        {
            LicenseType = licenseType,
            Status = status,
            Domain = domain,
            IsProEnabled = isProEnabled,
            ExpiresAt = expiresAt,
            ValidationError = validationError
        };
    }

    private static string NormalizeLicenseType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "Free";
        return value.Trim().ToLowerInvariant() switch
        {
            "free" => "Free",
            "protrial" => "ProTrial",
            "pro" => "Pro",
            _ => "Free"
        };
    }

    private static string NormalizeStatus(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "Active";
        return value.Trim().ToLowerInvariant() switch
        {
            "active" => "Active",
            "expired" => "Expired",
            "invalid" => "Invalid",
            _ => "Active"
        };
    }
}
