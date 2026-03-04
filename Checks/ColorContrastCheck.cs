using System.Text.RegularExpressions;
using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// Basic colour contrast detection from inline styles.
/// WCAG 1.4.3 – Contrast (Minimum) (Level AA)
/// Only detects inline style colour pairs - cannot check external CSS.
/// </summary>
public class ColorContrastCheck : IAccessibilityCheck
{
    public string RuleId => "color-contrast";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    private static readonly Regex ColorRegex = new(@"(?:^|;)\s*color\s*:\s*([^;]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BgColorRegex = new(@"background(?:-color)?\s*:\s*([^;]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex HexRegex = new(@"^#([0-9a-fA-F]{3,8})$", RegexOptions.Compiled);
    private static readonly Regex RgbRegex = new(@"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", RegexOptions.Compiled);

    // Named colors that are commonly low contrast
    private static readonly Dictionary<string, (int R, int G, int B)> NamedColors = new(StringComparer.OrdinalIgnoreCase)
    {
        ["white"] = (255, 255, 255), ["black"] = (0, 0, 0),
        ["red"] = (255, 0, 0), ["green"] = (0, 128, 0), ["blue"] = (0, 0, 255),
        ["yellow"] = (255, 255, 0), ["gray"] = (128, 128, 128), ["grey"] = (128, 128, 128),
        ["silver"] = (192, 192, 192), ["orange"] = (255, 165, 0),
        ["lightgray"] = (211, 211, 211), ["lightgrey"] = (211, 211, 211),
        ["darkgray"] = (169, 169, 169), ["darkgrey"] = (169, 169, 169),
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var styledNodes = document.DocumentNode.SelectNodes("//*[@style]");

        if (styledNodes == null) return issues;

        foreach (var node in styledNodes)
        {
            var style = node.GetAttributeValue("style", "");
            if (string.IsNullOrEmpty(style)) continue;

            var fgMatch = ColorRegex.Match(style);
            var bgMatch = BgColorRegex.Match(style);

            // Only check if both foreground and background are set inline
            if (!fgMatch.Success || !bgMatch.Success) continue;

            var fg = ParseColor(fgMatch.Groups[1].Value.Trim());
            var bg = ParseColor(bgMatch.Groups[1].Value.Trim());

            if (fg == null || bg == null) continue;

            var ratio = CalculateContrastRatio(fg.Value, bg.Value);

            // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
            // We can't reliably detect font size from inline styles alone, so use 4.5:1
            if (ratio < 4.5)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Potential low contrast ratio ({ratio:F1}:1) between text colour and background colour.",
                    Category = AccessibilityCategory.Meta,
                    Level = WcagLevel.AA,
                    WcagCriterion = "1.4.3",
                    Impact = ratio < 3.0 ? "critical" : "serious",
                    Element = TruncateOuterHtml(node),
                    Selector = BuildSelector(node),
                    Recommendation = $"Ensure text has a contrast ratio of at least 4.5:1 for normal text (current: {ratio:F1}:1)."
                });
            }
        }

        return issues;
    }

    private static (int R, int G, int B)? ParseColor(string value)
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

    private static double CalculateContrastRatio((int R, int G, int B) fg, (int R, int G, int B) bg)
    {
        var l1 = RelativeLuminance(fg);
        var l2 = RelativeLuminance(bg);
        var lighter = Math.Max(l1, l2);
        var darker = Math.Min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    private static double RelativeLuminance((int R, int G, int B) color)
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

    private static string BuildSelector(HtmlNode node)
    {
        var id = node.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"#{id}";
        var cls = node.GetAttributeValue("class", "");
        if (!string.IsNullOrEmpty(cls)) return $"{node.Name}.{cls.Split(' ')[0]}";
        return node.Name;
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
