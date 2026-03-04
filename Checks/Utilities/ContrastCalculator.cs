using System.Text.RegularExpressions;

namespace DigitalWonderlab.AccessibilityToolkit.Checks.Utilities;

/// <summary>
/// Shared colour parsing and WCAG contrast ratio calculation.
/// </summary>
public static class ContrastCalculator
{
    private static readonly Regex HexRegex = new(@"^#([0-9a-fA-F]{3,8})$", RegexOptions.Compiled);
    private static readonly Regex RgbRegex = new(@"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", RegexOptions.Compiled);

    private static readonly Dictionary<string, (int R, int G, int B)> NamedColors = new(StringComparer.OrdinalIgnoreCase)
    {
        ["white"] = (255, 255, 255), ["black"] = (0, 0, 0),
        ["red"] = (255, 0, 0), ["green"] = (0, 128, 0), ["blue"] = (0, 0, 255),
        ["yellow"] = (255, 255, 0), ["gray"] = (128, 128, 128), ["grey"] = (128, 128, 128),
        ["silver"] = (192, 192, 192), ["orange"] = (255, 165, 0),
        ["lightgray"] = (211, 211, 211), ["lightgrey"] = (211, 211, 211),
        ["darkgray"] = (169, 169, 169), ["darkgrey"] = (169, 169, 169),
    };

    public static (int R, int G, int B)? ParseColor(string value)
    {
        value = value.Trim().TrimEnd('!').Replace("!important", "").Trim();

        if (NamedColors.TryGetValue(value, out var named))
            return named;

        var hexMatch = HexRegex.Match(value);
        if (hexMatch.Success)
        {
            var hex = hexMatch.Groups[1].Value;
            if (hex.Length == 3)
                hex = $"{hex[0]}{hex[0]}{hex[1]}{hex[1]}{hex[2]}{hex[2]}";
            if (hex.Length >= 6)
            {
                return (
                    Convert.ToInt32(hex[..2], 16),
                    Convert.ToInt32(hex[2..4], 16),
                    Convert.ToInt32(hex[4..6], 16)
                );
            }
        }

        var rgbMatch = RgbRegex.Match(value);
        if (rgbMatch.Success)
        {
            return (
                int.Parse(rgbMatch.Groups[1].Value),
                int.Parse(rgbMatch.Groups[2].Value),
                int.Parse(rgbMatch.Groups[3].Value)
            );
        }

        return null;
    }

    public static double CalculateContrastRatio((int R, int G, int B) fg, (int R, int G, int B) bg)
    {
        var l1 = RelativeLuminance(fg);
        var l2 = RelativeLuminance(bg);
        var lighter = Math.Max(l1, l2);
        var darker = Math.Min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    public static double RelativeLuminance((int R, int G, int B) color)
    {
        var r = SrgbToLinear(color.R / 255.0);
        var g = SrgbToLinear(color.G / 255.0);
        var b = SrgbToLinear(color.B / 255.0);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private static double SrgbToLinear(double c)
    {
        return c <= 0.03928 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
    }
}
