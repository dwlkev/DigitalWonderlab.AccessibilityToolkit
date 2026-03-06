using Microsoft.AspNetCore.Hosting;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public class AccessibilityLicenceService : IAccessibilityLicenceService
{
    private readonly IWebHostEnvironment _webHostEnvironment;
    private bool? _cachedResult;

    public AccessibilityLicenceService(IWebHostEnvironment webHostEnvironment)
    {
        _webHostEnvironment = webHostEnvironment;
    }

    public bool IsVisualChecksEnabled()
    {
        if (_cachedResult.HasValue)
            return _cachedResult.Value;

        var licencePath = Path.Combine(
            _webHostEnvironment.ContentRootPath,
            "umbraco", "Licenses", "DigitalWonderlab.AccessibilityToolkit.lic");

        _cachedResult = File.Exists(licencePath);
        return _cachedResult.Value;
    }
}
