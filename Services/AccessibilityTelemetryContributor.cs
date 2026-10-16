using DigitalWonderlab.Telemetry;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NPoco;
using Umbraco.Cms.Infrastructure.Scoping;

namespace DigitalWonderlab.AccessibilityToolkit.Services;

/// <summary>What the Accessibility Toolkit reports in its daily heartbeat. See README "Telemetry".</summary>
internal class AccessibilityTelemetryContributor : ITelemetryContributor
{
    public const string ScansCompleted = "scansCompleted";
    public const string AuditsCompleted = "auditsCompleted";
    public const string ScansFailed = "scansFailed";
    public const string VisualCheckFailed = "visualCheckFailed";
    public const string VisualCheckTimeout = "visualCheckTimeout";
    public const string VisualCheckSecurityError = "visualCheckSecurityError";
    public const string LevelCounterPrefix = "level.";

    private static readonly string[] ReportedCounters =
        [ScansCompleted, AuditsCompleted, ScansFailed, VisualCheckFailed, VisualCheckTimeout, VisualCheckSecurityError];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IScopeProvider _scopeProvider;
    private readonly IAccessibilityLicenceService _licence;
    private readonly TelemetryCounters _counters;
    private readonly IConfiguration _configuration;

    public AccessibilityTelemetryContributor(IServiceScopeFactory scopeFactory, IScopeProvider scopeProvider,
        IAccessibilityLicenceService licence, TelemetryCounters counters, IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _scopeProvider = scopeProvider;
        _licence = licence;
        _counters = counters;
        _configuration = configuration;
    }

    public string ProductId => "accessibility-toolkit";

    public string? PackageVersion => TelemetryPayloadBuilder.VersionOf(typeof(AccessibilityTelemetryContributor).Assembly);

    public bool IsEnabled()
    {
        if (_configuration.GetValue<bool?>("AccessibilityToolkit:Telemetry:Enabled") == false)
            return false;

        using var serviceScope = _scopeFactory.CreateScope();
        var store = serviceScope.ServiceProvider.GetRequiredService<IAccessibilityResultStore>();
        return !bool.TryParse(store.GetSetting("TelemetryEnabled"), out var enabled) || enabled;
    }

    public void Contribute(TelemetryReport report)
    {
        using (var scope = _scopeProvider.CreateScope(autoComplete: true))
        {
            var pages = scope.Database.ExecuteScalar<long>(new Sql("SELECT COUNT(DISTINCT ContentNodeKey) FROM dwAccessibilityResults"));
            report.SizeBand["pagesChecked"] = TelemetryBand.Of(pages);
        }

        var licence = _licence.GetLicenceInfo();
        report.Features["licensed"] = licence.IsProEnabled;
        report.Features["visualChecks"] = licence.IsProEnabled;
        foreach (var level in new[] { "A", "AA", "AAA" })
            report.Features["level" + level] = _counters.Peek(LevelCounterPrefix + level) > 0;

        _counters.AddTo(report, ReportedCounters);
    }

    // Level usage is reported as features, so it resets with the daily counters.
    public void OnSent() => _counters.Reset(LevelCounterPrefix + "A", LevelCounterPrefix + "AA", LevelCounterPrefix + "AAA");
}
