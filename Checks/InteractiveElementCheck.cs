using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// Covers empty interactive elements and icon-only buttons missing accessible names.
/// WCAG 4.1.2 – Name, Role, Value (Level A)
/// </summary>
public class InteractiveElementCheck : IAccessibilityCheck
{
    public string RuleId => "interactive-element-name";
    public WcagLevel MinimumLevel => WcagLevel.A;

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        CheckButtons(document, issues);
        CheckIconOnlyButtons(document, issues);

        return issues;
    }

    private void CheckButtons(HtmlDocument document, List<AccessibilityIssue> issues)
    {
        var buttons = document.DocumentNode.SelectNodes("//button");
        if (buttons == null) return;

        foreach (var btn in buttons)
        {
            if (HasAccessibleName(btn)) continue;

            issues.Add(new AccessibilityIssue
            {
                RuleId = RuleId,
                Description = "Button has no accessible name.",
                Category = AccessibilityCategory.Interactivity,
                Level = WcagLevel.A,
                WcagCriterion = "4.1.2",
                Impact = "critical",
                Element = TruncateOuterHtml(btn),
                Selector = BuildSelector(btn),
                Recommendation = "Add text content, aria-label, or aria-labelledby to the button."
            });
        }

        // Also check input[type=button] and [role=button]
        var roleButtons = document.DocumentNode.SelectNodes("//*[@role='button']");
        if (roleButtons != null)
        {
            foreach (var btn in roleButtons)
            {
                if (btn.Name == "button") continue; // Already checked above
                if (HasAccessibleName(btn)) continue;

                issues.Add(new AccessibilityIssue
                {
                    RuleId = RuleId,
                    Description = $"Element with role=\"button\" has no accessible name.",
                    Category = AccessibilityCategory.Interactivity,
                    Level = WcagLevel.A,
                    WcagCriterion = "4.1.2",
                    Impact = "critical",
                    Element = TruncateOuterHtml(btn),
                    Selector = BuildSelector(btn),
                    Recommendation = "Add text content, aria-label, or aria-labelledby to the interactive element."
                });
            }
        }
    }

    private void CheckIconOnlyButtons(HtmlDocument document, List<AccessibilityIssue> issues)
    {
        var buttons = document.DocumentNode.SelectNodes("//button");
        if (buttons == null) return;

        foreach (var btn in buttons)
        {
            var textContent = GetDirectTextContent(btn).Trim();
            if (!string.IsNullOrEmpty(textContent)) continue; // Has visible text

            // Check if it contains SVG, <i>, or <span> with icon classes (icon-only pattern)
            var hasSvg = btn.SelectSingleNode(".//svg") != null;
            var hasIconElement = btn.SelectSingleNode(".//*[contains(@class,'icon') or contains(@class,'fa-') or contains(@class,'bi-') or contains(@class,'material-icons')]") != null;

            if (!hasSvg && !hasIconElement) continue;

            // It's icon-only - check if it has an accessible name via aria
            var ariaLabel = btn.GetAttributeValue("aria-label", "");
            var ariaLabelledBy = btn.GetAttributeValue("aria-labelledby", "");
            var title = btn.GetAttributeValue("title", "");

            if (!string.IsNullOrEmpty(ariaLabel) || !string.IsNullOrEmpty(ariaLabelledBy) || !string.IsNullOrEmpty(title))
                continue;

            // Check for visually hidden text inside
            var srOnly = btn.SelectSingleNode(".//*[contains(@class,'sr-only') or contains(@class,'visually-hidden') or contains(@class,'screen-reader')]");
            if (srOnly != null && !string.IsNullOrWhiteSpace(srOnly.InnerText)) continue;

            issues.Add(new AccessibilityIssue
            {
                RuleId = "icon-only-button",
                Description = "Icon-only button has no accessible name.",
                Category = AccessibilityCategory.Interactivity,
                Level = WcagLevel.A,
                WcagCriterion = "4.1.2",
                Impact = "critical",
                Element = TruncateOuterHtml(btn),
                Selector = BuildSelector(btn),
                Recommendation = "Add aria-label, a visually hidden text span, or title attribute to describe the button's purpose."
            });
        }
    }

    private static bool HasAccessibleName(HtmlNode node)
    {
        // aria-label or aria-labelledby
        if (!string.IsNullOrWhiteSpace(node.GetAttributeValue("aria-label", ""))) return true;
        if (!string.IsNullOrWhiteSpace(node.GetAttributeValue("aria-labelledby", ""))) return true;
        if (!string.IsNullOrWhiteSpace(node.GetAttributeValue("title", ""))) return true;

        // Text content
        var text = node.InnerText?.Trim() ?? "";
        if (!string.IsNullOrEmpty(text)) return true;

        // img with alt inside
        var img = node.SelectSingleNode(".//img[@alt]");
        if (img != null && !string.IsNullOrWhiteSpace(img.GetAttributeValue("alt", ""))) return true;

        return false;
    }

    private static string GetDirectTextContent(HtmlNode node)
    {
        var text = "";
        foreach (var child in node.ChildNodes)
        {
            if (child.NodeType == HtmlNodeType.Text)
                text += child.InnerText;
        }
        return text;
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
