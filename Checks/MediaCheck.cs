using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// Covers video captions (WCAG 1.2.2) and autoplay without controls (WCAG 1.4.2).
/// </summary>
public class MediaCheck : IAccessibilityCheck
{
    public string RuleId => "media";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        CheckVideoCaptions(document, issues);
        CheckAutoplay(document, issues);

        return issues;
    }

    private void CheckVideoCaptions(HtmlDocument document, List<AccessibilityIssue> issues)
    {
        var videos = document.DocumentNode.SelectNodes("//video");
        if (videos == null) return;

        foreach (var video in videos)
        {
            var captionTrack = video.SelectSingleNode(".//track[@kind='captions']")
                               ?? video.SelectSingleNode(".//track[@kind='subtitles']");

            if (captionTrack == null)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = "video-captions",
                    Description = "Video element is missing caption tracks.",
                    Category = AccessibilityCategory.Media,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.2.2",
                    Impact = "critical",
                    Element = TruncateOuterHtml(video),
                    Selector = BuildSelector(video),
                    Recommendation = "Add a <track kind=\"captions\"> element with a captions file for the video content."
                });
            }
        }
    }

    private void CheckAutoplay(HtmlDocument document, List<AccessibilityIssue> issues)
    {
        // Check <video autoplay> and <audio autoplay>
        var autoplayMedia = document.DocumentNode.SelectNodes("//video[@autoplay]|//audio[@autoplay]");
        if (autoplayMedia == null) return;

        foreach (var media in autoplayMedia)
        {
            var hasControls = media.GetAttributeValue("controls", null!) != null;
            var isMuted = media.GetAttributeValue("muted", null!) != null;

            if (!hasControls)
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = "media-autoplay",
                    Description = $"<{media.Name}> has autoplay enabled without visible controls.",
                    Category = AccessibilityCategory.Media,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.4.2",
                    Impact = isMuted ? "moderate" : "critical",
                    Element = TruncateOuterHtml(media),
                    Selector = BuildSelector(media),
                    Recommendation = "Add the controls attribute so users can pause, stop, or adjust the media."
                });
            }

            if (!isMuted && media.Name == "video")
            {
                issues.Add(new AccessibilityIssue
                {
                    RuleId = "media-autoplay",
                    Description = $"<{media.Name}> autoplays with sound, which can disorient users.",
                    Category = AccessibilityCategory.Media,
                    Level = WcagLevel.A,
                    WcagCriterion = "1.4.2",
                    Impact = "serious",
                    Element = TruncateOuterHtml(media),
                    Selector = BuildSelector(media),
                    Recommendation = "Add the muted attribute or provide a mechanism to stop the audio within 3 seconds."
                });
            }
        }
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
