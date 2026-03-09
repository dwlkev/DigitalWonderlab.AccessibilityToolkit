using DigitalWonderlab.AccessibilityToolkit.Checks;
using DigitalWonderlab.AccessibilityToolkit.Migrations;
using DigitalWonderlab.AccessibilityToolkit.Services;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;

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
        builder.Services.AddScoped<IAccessibilityResultStore, AccessibilityResultStore>();
        builder.Services.AddScoped<IAccessibilityTelemetryService, AccessibilityTelemetryService>();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddSingleton<IAccessibilityLicenceService, AccessibilityLicenceService>();
        builder.Services.AddHttpClient("AccessibilityToolkitTelemetry");

        builder.AddNotificationHandler<UmbracoApplicationStartingNotification, RunAccessibilityMigration>();

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

        // Level A – new checks
        builder.Services.AddScoped<IAccessibilityCheck, BypassBlocksCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, TabindexCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, KeyboardEventCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, LabelInNameCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, AutocompleteCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, MediaAlternativeCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, ErrorIdentificationCheck>();

        // Level AA – new checks
        builder.Services.AddScoped<IAccessibilityCheck, LanguageOfPartsCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, StatusMessageCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, TextSpacingCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, ReflowCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, InputPurposeCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, FocusNotRestrictedCheck>();

        // Level AAA – new checks
        builder.Services.AddScoped<IAccessibilityCheck, LinkPurposeFullCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, SectionHeadingsCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, EnhancedContrastCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, TargetSizeCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, AbbreviationsCheck>();
        builder.Services.AddScoped<IAccessibilityCheck, ReadingLevelCheck>();
    }
}
