using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public class AccessibilityLicenceService : IAccessibilityLicenceService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AccessibilityLicenceService> _logger;

    private LicenceInfo? _cachedInfo;
    private string? _cachedKey;

    // Signing secret — used to validate licence keys issued by Digital Wonderlab
    private static readonly byte[] SigningKey = Encoding.UTF8.GetBytes("DWL-A11Y-2024-SIGNING-KEY-V1");

    public AccessibilityLicenceService(
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AccessibilityLicenceService> logger)
    {
        _configuration = configuration;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public bool IsVisualChecksEnabled()
    {
        return GetLicenceInfo().IsProEnabled;
    }

    public LicenceInfo GetLicenceInfo()
    {
        var configKey = _configuration["AccessibilityToolkit:LicenceKey"];

        // If no key configured, all features enabled (development/community mode)
        if (string.IsNullOrWhiteSpace(configKey))
        {
            return new LicenceInfo
            {
                Status = "Community",
                Domain = "*",
                IsProEnabled = true,
                ExpiresAt = null,
                ValidationError = null
            };
        }

        // Return cached result if key hasn't changed
        if (_cachedInfo != null && _cachedKey == configKey)
            return _cachedInfo;

        _cachedKey = configKey;
        _cachedInfo = ValidateKey(configKey);
        return _cachedInfo;
    }

    private LicenceInfo ValidateKey(string key)
    {
        try
        {
            // Key format: {base64-payload}.{base64-signature}
            var parts = key.Split('.');
            if (parts.Length != 2)
                return InvalidLicence("Invalid licence key format.");

            var payloadBytes = Convert.FromBase64String(parts[0]);
            var signatureBytes = Convert.FromBase64String(parts[1]);

            // Verify HMAC-SHA256 signature
            using var hmac = new HMACSHA256(SigningKey);
            var expectedSignature = hmac.ComputeHash(payloadBytes);

            if (!CryptographicOperations.FixedTimeEquals(signatureBytes, expectedSignature))
                return InvalidLicence("Invalid licence key signature.");

            // Decode payload
            var payload = JsonSerializer.Deserialize<LicencePayload>(payloadBytes);
            if (payload == null)
                return InvalidLicence("Could not decode licence payload.");

            // Check expiry
            if (payload.Expires.HasValue && payload.Expires.Value < DateTime.UtcNow)
            {
                return new LicenceInfo
                {
                    Status = "Expired",
                    Domain = payload.Domain ?? "*",
                    IsProEnabled = false,
                    ExpiresAt = payload.Expires,
                    ValidationError = $"Licence expired on {payload.Expires.Value:yyyy-MM-dd}."
                };
            }

            // Check domain
            var requestHost = _httpContextAccessor.HttpContext?.Request.Host.Host ?? "localhost";
            if (!DomainMatches(payload.Domain, requestHost))
            {
                return new LicenceInfo
                {
                    Status = "Invalid Domain",
                    Domain = payload.Domain ?? "*",
                    IsProEnabled = false,
                    ExpiresAt = payload.Expires,
                    ValidationError = $"Licence is for domain '{payload.Domain}', but current host is '{requestHost}'."
                };
            }

            return new LicenceInfo
            {
                Status = "Active",
                Domain = payload.Domain ?? "*",
                IsProEnabled = payload.Pro,
                ExpiresAt = payload.Expires,
                ValidationError = null
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to validate licence key");
            return InvalidLicence("Failed to validate licence key.");
        }
    }

    private static LicenceInfo InvalidLicence(string error) => new()
    {
        Status = "Invalid",
        Domain = "",
        IsProEnabled = false,
        ExpiresAt = null,
        ValidationError = error
    };

    private static bool DomainMatches(string? licenceDomain, string requestHost)
    {
        if (string.IsNullOrEmpty(licenceDomain) || licenceDomain == "*")
            return true;

        // Exact match
        if (string.Equals(licenceDomain, requestHost, StringComparison.OrdinalIgnoreCase))
            return true;

        // Wildcard subdomain match: *.example.com matches anything.example.com
        if (licenceDomain.StartsWith("*."))
        {
            var baseDomain = licenceDomain[2..];
            return requestHost.EndsWith("." + baseDomain, StringComparison.OrdinalIgnoreCase)
                || string.Equals(requestHost, baseDomain, StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    /// <summary>
    /// Generate a signed licence key. Call from a separate admin tool, not from the package itself.
    /// This is here as a utility for Digital Wonderlab to issue keys.
    /// </summary>
    public static string GenerateKey(string domain, DateTime? expires, bool pro = true)
    {
        var payload = new LicencePayload
        {
            Domain = domain,
            Expires = expires,
            Pro = pro
        };

        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        using var hmac = new HMACSHA256(SigningKey);
        var signature = hmac.ComputeHash(payloadBytes);

        return Convert.ToBase64String(payloadBytes) + "." + Convert.ToBase64String(signature);
    }

    private class LicencePayload
    {
        public string? Domain { get; set; }
        public DateTime? Expires { get; set; }
        public bool Pro { get; set; }
    }
}
