using Microsoft.Extensions.Configuration;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public class AccessibilityLicenceService : IAccessibilityLicenceService
{
    private readonly IConfiguration _configuration;

    public AccessibilityLicenceService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public bool IsVisualChecksEnabled()
    {
        return _configuration.GetValue<bool>("AccessibilityToolkit:VisualChecks:Enabled");
    }
}
