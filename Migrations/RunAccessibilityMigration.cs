using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Migrations;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Infrastructure.Migrations.Upgrade;

namespace DigitalWonderlab.AccessibilityToolkit.Migrations;

public class RunAccessibilityMigration : INotificationHandler<UmbracoApplicationStartingNotification>
{
    private readonly IMigrationPlanExecutor _migrationPlanExecutor;
    private readonly ICoreScopeProvider _coreScopeProvider;
    private readonly IKeyValueService _keyValueService;
    private readonly IRuntimeState _runtimeState;
    private readonly ILogger<RunAccessibilityMigration> _logger;

    public RunAccessibilityMigration(
        IMigrationPlanExecutor migrationPlanExecutor,
        ICoreScopeProvider coreScopeProvider,
        IKeyValueService keyValueService,
        IRuntimeState runtimeState,
        ILogger<RunAccessibilityMigration> logger)
    {
        _migrationPlanExecutor = migrationPlanExecutor;
        _coreScopeProvider = coreScopeProvider;
        _keyValueService = keyValueService;
        _runtimeState = runtimeState;
        _logger = logger;
    }

    public void Handle(UmbracoApplicationStartingNotification notification)
    {
        if (_runtimeState.Level < RuntimeLevel.Run)
            return;

        var migrationPlan = new MigrationPlan("AccessibilityToolkit");
        migrationPlan.From(string.Empty)
            .To<AddAccessibilityResultsTable>("accessibilitytoolkit-001")
            .To<AddAccessibilityAuditsTable>("accessibilitytoolkit-002")
            .To<AddRootNodeNameColumn>("accessibilitytoolkit-003")
            .To<AddAccessibilitySettingsTable>("accessibilitytoolkit-004")
            .To<AddDatabaseIndexes>("accessibilitytoolkit-005");

        var upgrader = new Upgrader(migrationPlan);
        upgrader.Execute(_migrationPlanExecutor, _coreScopeProvider, _keyValueService);

        _logger.LogInformation("AccessibilityToolkit migration plan executed.");
    }
}
