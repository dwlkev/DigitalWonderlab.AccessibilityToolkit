using Microsoft.Extensions.Logging;
using Umbraco.Cms.Infrastructure.Migrations;

namespace DigitalWonderlab.AccessibilityToolkit.Migrations;

public class AddRootNodeNameColumn : MigrationBase
{
    public AddRootNodeNameColumn(IMigrationContext context) : base(context)
    {
    }

    protected override void Migrate()
    {
        Logger.LogInformation("Running AccessibilityToolkit migration: AddRootNodeNameColumn");

        if (!ColumnExists("dwAccessibilityAudits", "RootNodeName"))
        {
            Execute.Sql("ALTER TABLE dwAccessibilityAudits ADD RootNodeName NVARCHAR(500) NULL").Do();
        }
    }
}
