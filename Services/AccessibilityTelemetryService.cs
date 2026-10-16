using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.Telemetry;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

/// <summary>
/// Records scan/audit outcomes as in-memory counters. Nothing is sent from here: the shared
/// telemetry heartbeat reports the counters (as bands) once a day, see <see cref="AccessibilityTelemetryContributor"/>.
/// Up to 1.10.x this POSTed every event to the telemetry API from a fire-and-forget task.
/// </summary>
internal class AccessibilityTelemetryService : IAccessibilityTelemetryService
{
    private readonly TelemetryCounters _counters;

    public AccessibilityTelemetryService(TelemetryCounters counters)
    {
        _counters = counters;
    }

    public Task TrackEventAsync(AccessibilityTelemetryEvent telemetryEvent, CancellationToken cancellationToken = default)
    {
        var counter = (telemetryEvent.EventName, telemetryEvent.ErrorCode) switch
        {
            ("scan_completed", _) => AccessibilityTelemetryContributor.ScansCompleted,
            ("audit_completed", _) => AccessibilityTelemetryContributor.AuditsCompleted,
            ("scan_failed", _) => AccessibilityTelemetryContributor.ScansFailed,
            ("visual_check_failed", "visual_check_timeout") => AccessibilityTelemetryContributor.VisualCheckTimeout,
            ("visual_check_failed", "visual_check_security_error") => AccessibilityTelemetryContributor.VisualCheckSecurityError,
            ("visual_check_failed", _) => AccessibilityTelemetryContributor.VisualCheckFailed,
            _ => null
        };

        if (counter != null)
            _counters.Increment(counter);

        if (telemetryEvent.Success && telemetryEvent.WcagLevel is "A" or "AA" or "AAA")
            _counters.Increment(AccessibilityTelemetryContributor.LevelCounterPrefix + telemetryEvent.WcagLevel);

        return Task.CompletedTask;
    }
}
