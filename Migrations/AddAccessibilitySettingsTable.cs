using Microsoft.Extensions.Logging;
using NPoco;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace DigitalWonderlab.AccessibilityToolkit.Migrations;

public class AddAccessibilitySettingsTable : MigrationBase
{
    public AddAccessibilitySettingsTable(IMigrationContext context) : base(context)
    {
    }

    protected override void Migrate()
    {
        Logger.LogInformation("Running AccessibilityToolkit migration: AddAccessibilitySettingsTable");

        if (!TableExists("dwAccessibilitySettings"))
        {
            Create.Table<AccessibilitySettingsSchema>().Do();
        }
    }

    [TableName("dwAccessibilitySettings")]
    [PrimaryKey("Id", AutoIncrement = true)]
    [ExplicitColumns]
    private class AccessibilitySettingsSchema
    {
        [Column("Id")]
        [PrimaryKeyColumn(AutoIncrement = true)]
        public int Id { get; set; }

        [Column("SettingKey")]
        [Length(100)]
        public string SettingKey { get; set; } = string.Empty;

        [Column("SettingValue")]
        [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
        public string SettingValue { get; set; } = string.Empty;
    }
}
