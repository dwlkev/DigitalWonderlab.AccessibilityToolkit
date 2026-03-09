using DigitalWonderlab.AccessibilityToolkit.Models;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

public interface IAccessibilityTelemetryService
{
    Task TrackEventAsync(AccessibilityTelemetryEvent telemetryEvent, CancellationToken cancellationToken = default);
}
