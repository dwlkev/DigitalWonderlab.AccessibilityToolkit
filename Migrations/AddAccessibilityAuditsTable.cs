using Microsoft.Extensions.Logging;
using NPoco;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace DigitalWonderlab.AccessibilityToolkit.Migrations;

public class AddAccessibilityAuditsTable : MigrationBase
{
    public AddAccessibilityAuditsTable(IMigrationContext context) : base(context)
    {
    }

    protected override void Migrate()
    {
        Logger.LogInformation("Running AccessibilityToolkit migration: AddAccessibilityAuditsTable");

        if (!TableExists("dwAccessibilityAudits"))
        {
            Create.Table<AccessibilityAuditsSchema>().Do();
        }
    }

    [TableName("dwAccessibilityAudits")]
    [PrimaryKey("Id", AutoIncrement = true)]
    [ExplicitColumns]
    private class AccessibilityAuditsSchema
    {
        [Column("Id")]
        [PrimaryKeyColumn(AutoIncrement = true)]
        public int Id { get; set; }

        [Column("RootNodeKey")]
        public Guid RootNodeKey { get; set; }

        [Column("WcagLevel")]
        [Length(10)]
        public string WcagLevel { get; set; } = "AA";

        [Column("TotalPages")]
        public int TotalPages { get; set; }

        [Column("AverageScore")]
        public int AverageScore { get; set; }

        [Column("TotalIssues")]
        public int TotalIssues { get; set; }

        [Column("ResultJson")]
        [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
        public string ResultJson { get; set; } = string.Empty;

        [Column("ScannedAt")]
        public DateTime ScannedAt { get; set; }
    }
}
