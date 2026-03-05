using Microsoft.Extensions.Logging;
using NPoco;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace DigitalWonderlab.AccessibilityToolkit.Migrations;

public class AddAccessibilityResultsTable : MigrationBase
{
    public AddAccessibilityResultsTable(IMigrationContext context) : base(context)
    {
    }

    protected override void Migrate()
    {
        Logger.LogInformation("Running AccessibilityToolkit migration: AddAccessibilityResultsTable");

        if (!TableExists("dwAccessibilityResults"))
        {
            Create.Table<AccessibilityResultsSchema>().Do();
        }
    }

    [TableName("dwAccessibilityResults")]
    [PrimaryKey("Id", AutoIncrement = true)]
    [ExplicitColumns]
    private class AccessibilityResultsSchema
    {
        [Column("Id")]
        [PrimaryKeyColumn(AutoIncrement = true)]
        public int Id { get; set; }

        [Column("ContentNodeKey")]
        public Guid ContentNodeKey { get; set; }

        [Column("Url")]
        public string Url { get; set; } = string.Empty;

        [Column("WcagLevel")]
        [Length(10)]
        public string WcagLevel { get; set; } = "AA";

        [Column("OverallScore")]
        public int OverallScore { get; set; }

        [Column("TotalIssues")]
        public int TotalIssues { get; set; }

        [Column("CriticalCount")]
        public int CriticalCount { get; set; }

        [Column("SeriousCount")]
        public int SeriousCount { get; set; }

        [Column("ModerateCount")]
        public int ModerateCount { get; set; }

        [Column("MinorCount")]
        public int MinorCount { get; set; }

        [Column("ResultJson")]
        [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
        public string ResultJson { get; set; } = string.Empty;

        [Column("ScannedAt")]
        public DateTime ScannedAt { get; set; }
    }
}
