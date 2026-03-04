using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

/// <summary>
/// WCAG 2.1.1 – Keyboard (Level A)
/// Detects mouse-only inline event handlers without keyboard equivalents.
/// </summary>
public class KeyboardEventCheck : IAccessibilityCheck
{
    public string RuleId => "keyboard-event";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly (string Mouse, string[] Keyboard)[] EventPairs =
    [
        ("onclick", ["onkeydown", "onkeyup", "onkeypress"]),
        ("onmousedown", ["onkeydown"]),
        ("onmouseup", ["onkeyup"]),
        ("onmouseover", ["onfocus"]),
        ("onmouseout", ["onblur"]),
        ("ondblclick", ["onkeydown", "onkeyup", "onkeypress"]),
    ];

    private static readonly HashSet<string> NativeKeyboardElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "button", "input", "select", "textarea", "summary"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        foreach (var (mouseEvent, keyboardEvents) in EventPairs)
        {
            var nodes = document.DocumentNode.SelectNodes($"//*[@{mouseEvent}]");
            if (nodes == null) continue;

            foreach (var node in nodes)
            {
                // Native interactive elements handle keyboard events inherently for onclick
                if (mouseEvent == "onclick" && NativeKeyboardElements.Contains(node.Name))
                    continue;

                // Check if any matching keyboard handler is present
                var hasKeyboardHandler = keyboardEvents.Any(ke =>
                    !string.IsNullOrEmpty(node.GetAttributeValue(ke, "")));

                // Also check for role + tabindex (common pattern for custom widgets)
                var role = node.GetAttributeValue("role", "");
                var hasRole = role is "button" or "link" or "menuitem" or "tab" or "checkbox" or "radio";

                if (!hasKeyboardHandler && !hasRole)
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = $"Element has {mouseEvent} handler but no keyboard equivalent ({string.Join("/", keyboardEvents)}).",
                        Category = AccessibilityCategory.Keyboard,
                        Level = WcagLevel.A,
                        WcagCriterion = "2.1.1",
                        Impact = "critical",
                        Element = TruncateOuterHtml(node),
                        Selector = BuildSelector(node),
                        Recommendation = $"Add a keyboard event handler ({keyboardEvents[0]}) or use a native interactive element like <button>."
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
