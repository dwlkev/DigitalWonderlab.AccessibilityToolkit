using Microsoft.Extensions.Logging;
using Umbraco.Cms.Infrastructure.Migrations;

namespace DigitalWonderlab.AccessibilityToolkit.Migrations;

public class AddDatabaseIndexes : MigrationBase
{
    public AddDatabaseIndexes(IMigrationContext context) : base(context)
    {
    }

    protected override void Migrate()
    {
        Logger.LogInformation("Running AccessibilityToolkit migration: AddDatabaseIndexes");

        if (TableExists("dwAccessibilityResults"))
        {
            if (!IndexExists("IX_dwAccessibilityResults_ContentNodeKey_ScannedAt"))
            {
                Create.Index("IX_dwAccessibilityResults_ContentNodeKey_ScannedAt")
                    .OnTable("dwAccessibilityResults")
                    .OnColumn("ContentNodeKey").Ascending()
                    .OnColumn("ScannedAt").Descending()
                    .WithOptions().NonClustered();
            }
        }

        if (TableExists("dwAccessibilityAudits"))
        {
            if (!IndexExists("IX_dwAccessibilityAudits_RootNodeKey_ScannedAt"))
            {
                Create.Index("IX_dwAccessibilityAudits_RootNodeKey_ScannedAt")
                    .OnTable("dwAccessibilityAudits")
                    .OnColumn("RootNodeKey").Ascending()
                    .OnColumn("ScannedAt").Descending()
                    .WithOptions().NonClustered();
            }
        }
    }
}
