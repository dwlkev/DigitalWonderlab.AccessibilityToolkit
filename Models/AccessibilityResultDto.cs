using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace DigitalWonderlab.AccessibilityToolkit.Models;

[TableName("dwAccessibilityResults")]
[PrimaryKey("Id", AutoIncrement = true)]
[ExplicitColumns]
public class AccessibilityResultDto
{
    [Column("Id")]
    [PrimaryKeyColumn(AutoIncrement = true)]
    public int Id { get; set; }

    [Column("ContentNodeKey")]
    public Guid ContentNodeKey { get; set; }

    [Column("Url")]
    public string Url { get; set; } = string.Empty;

    [Column("WcagLevel")]
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
