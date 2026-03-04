using DigitalWonderlab.AccessibilityToolkit.Models;
using DigitalWonderlab.AccessibilityToolkit.Services;
using HtmlAgilityPack;

namespace DigitalWonderlab.AccessibilityToolkit.Checks;

public class AriaAttributeCheck : IAccessibilityCheck
{
    public string RuleId => "aria-attributes";
    public WcagLevel MinimumLevel => WcagLevel.A;

    private static readonly HashSet<string> ValidRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "alert", "alertdialog", "application", "article", "banner", "button", "cell",
        "checkbox", "columnheader", "combobox", "complementary", "contentinfo", "definition",
        "dialog", "directory", "document", "feed", "figure", "form", "grid", "gridcell",
        "group", "heading", "img", "link", "list", "listbox", "listitem", "log", "main",
        "marquee", "math", "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio",
        "meter", "navigation", "none", "note", "option", "presentation", "progressbar",
        "radio", "radiogroup", "region", "row", "rowgroup", "rowheader", "scrollbar",
        "search", "searchbox", "separator", "slider", "spinbutton", "status", "switch",
        "tab", "table", "tablist", "tabpanel", "term", "textbox", "timer", "toolbar",
        "tooltip", "tree", "treegrid", "treeitem"
    };

    private static readonly HashSet<string> FocusableElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "button", "input", "select", "textarea"
    };

    public IEnumerable<AccessibilityIssue> Run(HtmlDocument document)
    {
        var issues = new List<AccessibilityIssue>();

        // Check aria-labelledby references
        var labelledByNodes = document.DocumentNode.SelectNodes("//*[@aria-labelledby]");
        if (labelledByNodes != null)
        {
            foreach (var node in labelledByNodes)
            {
                var ids = node.GetAttributeValue("aria-labelledby", "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var id in ids)
                {
                    var target = document.DocumentNode.SelectSingleNode($"//*[@id='{id}']");
                    if (target == null)
                    {
                        issues.Add(new AccessibilityIssue
                        {
                            RuleId = RuleId,
                            Description = $"aria-labelledby references non-existent id \"{id}\".",
                            Category = AccessibilityCategory.Aria,
                            Level = WcagLevel.A,
                            WcagCriterion = "4.1.2",
                            Impact = "serious",
                            Element = TruncateOuterHtml(node),
                            Selector = BuildSelector(node),
                            Recommendation = "Ensure the referenced id exists in the document."
                        });
                    }
                }
            }
        }

        // Check aria-describedby references
        var describedByNodes = document.DocumentNode.SelectNodes("//*[@aria-describedby]");
        if (describedByNodes != null)
        {
            foreach (var node in describedByNodes)
            {
                var ids = node.GetAttributeValue("aria-describedby", "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var id in ids)
                {
                    var target = document.DocumentNode.SelectSingleNode($"//*[@id='{id}']");
                    if (target == null)
                    {
                        issues.Add(new AccessibilityIssue
                        {
                            RuleId = RuleId,
                            Description = $"aria-describedby references non-existent id \"{id}\".",
                            Category = AccessibilityCategory.Aria,
                            Level = WcagLevel.A,
                            WcagCriterion = "4.1.2",
                            Impact = "serious",
                            Element = TruncateOuterHtml(node),
                            Selector = BuildSelector(node),
                            Recommendation = "Ensure the referenced id exists in the document."
                        });
                    }
                }
            }
        }

        // Check for invalid roles
        var roleNodes = document.DocumentNode.SelectNodes("//*[@role]");
        if (roleNodes != null)
        {
            foreach (var node in roleNodes)
            {
                var role = node.GetAttributeValue("role", "").Trim();
                if (!string.IsNullOrEmpty(role) && !ValidRoles.Contains(role))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = $"Invalid ARIA role: \"{role}\".",
                        Category = AccessibilityCategory.Aria,
                        Level = WcagLevel.A,
                        WcagCriterion = "4.1.2",
                        Impact = "serious",
                        Element = TruncateOuterHtml(node),
                        Selector = BuildSelector(node),
                        Recommendation = "Use a valid WAI-ARIA role. See https://www.w3.org/TR/wai-aria-1.2/#role_definitions"
                    });
                }
            }
        }

        // Check aria-hidden on focusable elements
        var ariaHiddenNodes = document.DocumentNode.SelectNodes("//*[@aria-hidden='true']");
        if (ariaHiddenNodes != null)
        {
            foreach (var node in ariaHiddenNodes)
            {
                // Check if the element itself is focusable
                if (IsFocusable(node))
                {
                    issues.Add(new AccessibilityIssue
                    {
                        RuleId = RuleId,
                        Description = "aria-hidden=\"true\" is set on a focusable element.",
                        Category = AccessibilityCategory.Aria,
                        Level = WcagLevel.A,
                        WcagCriterion = "4.1.2",
                        Impact = "critical",
                        Element = TruncateOuterHtml(node),
                        Selector = BuildSelector(node),
                        Recommendation = "Remove aria-hidden from focusable elements, or make the element non-focusable."
                    });
                }

                // Check if it contains focusable descendants
                var focusableDescendants = node.SelectNodes(".//*[self::a or self::button or self::input or self::select or self::textarea]");
                if (focusableDescendants != null)
                {
                    foreach (var desc in focusableDescendants)
                    {
                        if (IsFocusable(desc))
                        {
                            issues.Add(new AccessibilityIssue
                            {
                                RuleId = RuleId,
                                Description = "aria-hidden=\"true\" container contains a focusable element.",
                                Category = AccessibilityCategory.Aria,
                                Level = WcagLevel.A,
                                WcagCriterion = "4.1.2",
                                Impact = "critical",
                                Element = TruncateOuterHtml(desc),
                                Selector = BuildSelector(desc),
                                Recommendation = "Remove focusable elements from aria-hidden containers, or remove aria-hidden."
                            });
                        }
                    }
                }
            }
        }

        return issues;
    }

    private static bool IsFocusable(HtmlNode node)
    {
        if (FocusableElements.Contains(node.Name))
        {
            // Disabled elements are not focusable
            if (node.GetAttributeValue("disabled", null!) != null)
                return false;
            // Links need href to be focusable
            if (node.Name == "a" && string.IsNullOrEmpty(node.GetAttributeValue("href", "")))
                return false;
            return true;
        }

        var tabindex = node.GetAttributeValue("tabindex", "");
        if (!string.IsNullOrEmpty(tabindex) && int.TryParse(tabindex, out var idx) && idx >= 0)
            return true;

        return false;
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
