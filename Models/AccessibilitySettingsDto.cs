using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace DigitalWonderlab.AccessibilityToolkit.Models;

[TableName("dwAccessibilitySettings")]
[PrimaryKey("Id", AutoIncrement = true)]
[ExplicitColumns]
public class AccessibilitySettingsDto
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
