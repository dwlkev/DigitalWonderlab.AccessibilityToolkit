using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class ImageAltTextCheck : IAccessibilityCheck
{
    public string RuleId => "image-alt-text";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly string[] FileExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".avif"];
    private static readonly string[] GenericAltTexts = ["image", "photo", "picture", "img", "graphic", "icon", "logo", "banner", "placeholder", "untitled"];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();
        var images = document.DocumentNode.SelectNodes("//img");

        if (images == null) return issues;

        foreach (var img in images)
        {
            var alt = img.GetAttributeValue("alt", null!);
            var src = img.GetAttributeValue("src", "") ?? "";
            var role = img.GetAttributeValue("role", "");

            // Decorative images with role="presentation" or empty alt are intentional
            if (role == "presentation" || role == "none")
                continue;

            if (alt == null)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = "Image is missing alt attribute.",
                    Category = AccessibilityCategory.Images,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.1.1",
                    Impact = "critical",
                    Element = TruncateOuterHtml(img),
                    Selector = BuildSelector(img, src),
                    Recommendation = "Add an alt attribute describing the image content, or alt=\"\" if decorative."
                });
                continue;
            }

            if (string.IsNullOrWhiteSpace(alt))
                continue; // Empty alt is valid for decorative images

            // Check for filename-as-alt
            var altLower = alt.Trim().ToLowerInvariant();
            if (FileExtensions.Any(ext => altLower.EndsWith(ext, StringComparison.OrdinalIgnoreCase))
                || altLower.Contains("dsc_") || altLower.Contains("img_") || altLower.Contains("screenshot"))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Image alt text appears to be a filename: \"{alt}\".",
                    Category = AccessibilityCategory.Images,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.1.1",
                    Impact = "serious",
                    Element = TruncateOuterHtml(img),
                    Selector = BuildSelector(img, src),
                    Recommendation = "Replace the filename with a meaningful description of the image content."
                });
                continue;
            }

            // Check for overly generic alt text
            if (GenericAltTexts.Contains(altLower))
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Image alt text is too generic: \"{alt}\".",
                    Category = AccessibilityCategory.Images,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.1.1",
                    Impact = "moderate",
                    Element = TruncateOuterHtml(img),
                    Selector = BuildSelector(img, src),
                    Recommendation = "Provide a descriptive alt text that conveys the meaning or purpose of the image."
                });
            }
        }

        return issues;
    }

    private static string BuildSelector(HtmlNode img, string src)
    {
        var id = img.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"img#{id}";
        if (!string.IsNullOrEmpty(src)) return $"img[src=\"{src}\"]";
        return "img";
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
