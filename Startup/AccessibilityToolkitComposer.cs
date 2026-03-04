using DigitalWonderlab.AccessibilityToolkit.Checks;
using DigitalWonderlab.AccessibilityToolkit.Services;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace DigitalWonderlab.AccessibilityToolkit.Startup;

public class AccessibilityToolkitComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddHttpClient("AccessibilityToolkit", client =>
        {
            client.DefaultRequestHeaders.Add("User-Agent", "DigitalWonderlab-AccessibilityToolkit/1.0");
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        builder.Services.AddScoped<IAccessibilityAnalyzer, AccessibilityAnalyzer>();

        // Register all accessibility checks
        builder.Services.AddScoped<IAccessibilityCheck, HeadingHierarchyCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, ImageAltTextCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, FormLabelCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, LinkTextCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, LangAttributeCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, AriaAttributeCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, SemanticHtmlCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, MetaViewportCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, TableStructureCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, PageTitleCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, DuplicateIdCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, InteractiveElementCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, ColorContrastCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, MediaCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, IframeTitleCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, ListStructureCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, FormGroupingCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, TargetBlankCheck>();
    }
}
