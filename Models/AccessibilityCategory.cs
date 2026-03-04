using System.Text.Json.Serialization;

namespace DigitalWonderlab.AccessibilityToolkit.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AccessibilityCategory
{
    Structure,
    Images,
    Forms,
    Links,
    Language,
    Aria,
    Semantics,
    Tables,
    Meta,
    Media,
    Interactivity,
    Navigation,
    Keyboard
}
