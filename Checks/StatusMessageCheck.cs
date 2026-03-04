using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 4.1.3 – Status Messages (Level AA)
/// Detects elements with role=alert/status/log that are missing aria-live.
/// </summary>
public class StatusMessageCheck : IAccessibilityCheck
{
    public string RuleId => "status-message";
    public WcagLevel MinimumLevel => WcagLevel.AA;

    // Roles and their expected implicit aria-live values
    private static readonly Dictionary<string, string> RoleLiveMapping = new(StringComparer.OrdinalIgnoreCase)
    {
        ["alert"] = "assertive",
        ["status"] = "polite",
        ["log"] = "polite",
        ["marquee"] = "off",
        ["timer"] = "off",
        ["progressbar"] = "polite",
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        foreach (var (role, expectedLive) in RoleLiveMapping)
        {
            var nodes = document.DocumentNode.SelectNodes($"//*[@role='{role}']");
            if (nodes == null) continue;

            foreach (var node in nodes)
            {
                var ariaLive = node.GetAttributeValue("aria-live", "");
                var ariaAtomic = node.GetAttributeValue("aria-atomic", "");

                // role=alert/status implicitly set aria-live, but explicit is better for clarity
                // The real issue is when role is missing entirely on dynamic content containers
                // For now, flag containers that have role but might not be announced properly

                // Check for empty containers that might be populated dynamically
                var innerText = node.InnerText?.Trim() ?? "";
                if (string.IsNullOrEmpty(innerText) && string.IsNullOrEmpty(ariaLive))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = $"Empty element with role=\"{role}\" has no explicit aria-live attribute. Dynamic content may not be announced.",
                        Category = AccessibilityCategory.Aria,
                        Level = WcagLevel.AA,
                        WcagCriterion = "4.1.3",
                        Impact = "moderate",
                        Element = TruncateOuterHtml(node),
                        Selector = BuildSelector(node),
                        Recommendation = $"Add aria-live=\"{expectedLive}\" explicitly to ensure screen readers announce dynamic content changes."
                    });
                }
            }
        }

        // Check for common status/notification patterns without role or aria-live
        var potentialStatusContainers = document.DocumentNode.SelectNodes(
            "//*[contains(@class,'alert') or contains(@class,'notification') or contains(@class,'toast') or contains(@class,'status') or contains(@class,'error-message') or contains(@class,'success-message')]");

        if (potentialStatusContainers != null)
        {
            foreach (var node in potentialStatusContainers)
            {
                var role = node.GetAttributeValue("role", "");
                var ariaLive = node.GetAttributeValue("aria-live", "");

                if (string.IsNullOrEmpty(role) && string.IsNullOrEmpty(ariaLive))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "Element appears to be a status/notification container but has no role or aria-live attribute.",
                        Category = AccessibilityCategory.Aria,
                        Level = WcagLevel.AA,
                        WcagCriterion = "4.1.3",
                        Impact = "serious",
                        Element = TruncateOuterHtml(node),
                        Selector = BuildSelector(node),
                        Recommendation = "Add role=\"alert\" or role=\"status\" with appropriate aria-live to ensure screen reader announcement."
                    });
                }
            }
        }

        return issues;
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
