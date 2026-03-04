using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 1.2.1 – Audio-only and Video-only (Prerecorded) (Level A)
/// Detects audio/video elements without text alternatives or transcript links nearby.
/// </summary>
public class MediaAlternativeCheck : IAccessibilityCheck
{
    public string RuleId => "media-alternative";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly string[] TranscriptKeywords = [
        "transcript", "caption", "subtitle", "text version", "text alternative",
        "audio description", "described version"
    ];

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Check <audio> elements
        var audioNodes = document.DocumentNode.SelectNodes("//audio");
        if (audioNodes != null)
        {
            foreach (var audio in audioNodes)
            {
                if (!HasNearbyTranscriptLink(audio))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "Audio element has no transcript link or text alternative nearby.",
                        Category = AccessibilityCategory.Media,
                        Level = WcagLevel.A,
                        WcagCriterion = "1.2.1",
                        Impact = "serious",
                        Element = TruncateOuterHtml(audio),
                        Selector = BuildSelector(audio),
                        Recommendation = "Provide a transcript link near the audio element for users who cannot hear the content."
                    });
                }
            }
        }

        // Check <video> elements without <track>
        var videoNodes = document.DocumentNode.SelectNodes("//video");
        if (videoNodes != null)
        {
            foreach (var video in videoNodes)
            {
                var hasCaptionTrack = video.SelectSingleNode(".//track[@kind='captions' or @kind='subtitles']") != null;
                var hasDescriptionTrack = video.SelectSingleNode(".//track[@kind='descriptions']") != null;

                if (!hasCaptionTrack && !HasNearbyTranscriptLink(video))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "Video element has no captions track and no transcript link nearby.",
                        Category = AccessibilityCategory.Media,
                        Level = WcagLevel.A,
                        WcagCriterion = "1.2.1",
                        Impact = "critical",
                        Element = TruncateOuterHtml(video),
                        Selector = BuildSelector(video),
                        Recommendation = "Add a <track kind=\"captions\"> element or provide a transcript link near the video."
                    });
                }
            }
        }

        return issues;
    }

    private static bool HasNearbyTranscriptLink(HtmlNode mediaNode)
    {
        // Check siblings and parent's children for transcript links
        var parent = mediaNode.ParentNode;
        if (parent == null) return false;

        var parentText = parent.InnerText?.ToLowerInvariant() ?? "";
        if (TranscriptKeywords.Any(k => parentText.Contains(k)))
            return true;

        // Check aria-describedby pointing to a transcript
        var describedBy = mediaNode.GetAttributeValue("aria-describedby", "");
        if (!string.IsNullOrEmpty(describedBy))
            return true;

        // Check next sibling
        var nextSibling = mediaNode.NextSibling;
        while (nextSibling != null && nextSibling.NodeType != HtmlNodeType.Element)
            nextSibling = nextSibling.NextSibling;

        if (nextSibling != null)
        {
            var siblingText = nextSibling.InnerText?.ToLowerInvariant() ?? "";
            if (TranscriptKeywords.Any(k => siblingText.Contains(k)))
                return true;
        }

        return false;
    }

    private static string BuildSelector(HtmlNode node)
    {
        var id = node.GetAttributeValue("id", "");
        if (!string.IsNullOrEmpty(id)) return $"#{id}";
        var src = node.GetAttributeValue("src", "");
        if (!string.IsNullOrEmpty(src)) return $"{node.Name}[src=\"{src}\"]";
        return node.Name;
    }

    private static string TruncateOuterHtml(HtmlNode node)
    {
        var html = node.OuterHtml;
        return html.Length > 200 ? html[..200] + "..." : html;
    }
}
