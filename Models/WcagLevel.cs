using System.Text.Json.Serialization;

namespace DigitalWonderlab.AccessibilityToolkit.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WcagLevel
{
    A,
    AA,
    AAA
}
