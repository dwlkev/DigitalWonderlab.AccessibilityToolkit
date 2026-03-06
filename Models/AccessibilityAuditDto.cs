using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace DigitalWonderlab.AccessibilityToolkit.Models;

[TableName("dwAccessibilityAudits")]
[PrimaryKey("Id", AutoIncrement = true)]
[ExplicitColumns]
public class AccessibilityAuditDto
{
    [Column("Id")]
    [PrimaryKeyColumn(AutoIncrement = true)]
    public int Id { get; set; }

    [Column("RootNodeKey")]
    public Guid RootNodeKey { get; set; }

    [Column("WcagLevel")]
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

    [Column("RootNodeName")]
    [NullSetting(NullSetting = NullSettings.Null)]
    public string? RootNodeName { get; set; }

    [Column("ScannedAt")]
    public DateTime ScannedAt { get; set; }
}
