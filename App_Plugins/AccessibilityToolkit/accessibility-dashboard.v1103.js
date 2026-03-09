import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/modal";
import { UMB_DOCUMENT_PICKER_MODAL } from "@umbraco-cms/backoffice/document";

export default class AccessibilityToolkitDashboard extends UmbElementMixin(HTMLElement) {
    static #ISSUE_GROUP_MAP = {
        // Content
        "image-alt-text": "Content", "link-text": "Content", "link-purpose-full": "Content",
        "heading-hierarchy": "Content", "page-title": "Content", "lang-attribute": "Content",
        "language-of-parts": "Content", "abbreviations": "Content", "reading-level": "Content",
        "section-headings": "Content", "target-blank": "Content",
        // Code
        "aria-attributes": "Code", "semantic-html": "Code", "form-labels": "Code",
        "form-grouping": "Code", "table-structure": "Code", "duplicate-ids": "Code",
        "interactive-elements": "Code", "meta-viewport": "Code", "iframe-title": "Code",
        "list-structure": "Code", "bypass-blocks": "Code", "tabindex": "Code",
        "keyboard-events": "Code", "label-in-name": "Code", "autocomplete": "Code",
        "media": "Code", "media-alternative": "Code", "error-identification": "Code",
        "status-messages": "Code", "text-spacing": "Code", "reflow": "Code",
        "input-purpose": "Code", "focus-not-restricted": "Code",
        // Design
        "color-contrast": "Design", "enhanced-contrast": "Design", "target-size": "Design",
        "visual-color-contrast": "Design", "visual-color-contrast-enhanced": "Design"
    };

    #getIssueGroup(ruleId) {
        return AccessibilityToolkitDashboard.#ISSUE_GROUP_MAP[ruleId] || "Code";
    }

    #notificationContext;
    #modalManager;
    #recentResults = [];
    #auditHistory = [];
    #selectedNodeKey = null;
    #currentPage = 1;
    #pageSize = 10;
    #lastAuditData = null;
    #pagesExpanded = false;
    #settingsLoaded = false;
    #excludedDocTypes = [];
    #excludedNodeKeys = [];
    #allDocumentTypes = [];
    #licenseInfo = null;
    #telemetryEnabled = true;
    #telemetryAcknowledged = false;
    #telemetryLoaded = false;
    #servicesUrl = "https://digitalwonderlab.com/contact/";

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.#loadTemplate();
        this.#loadStyles();
        this.#initContexts();
    }

    #initContexts() {
        this.consumeContext(UMB_NOTIFICATION_CONTEXT, (instance) => {
            this.#notificationContext = instance;
        });
        this.consumeContext(UMB_MODAL_MANAGER_CONTEXT, (instance) => {
            this.#modalManager = instance;
        });
    }

    #loadStyles() {
        const link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", "/App_Plugins/AccessibilityToolkit/accessibility-toolkit-style.css");
        this.shadowRoot.appendChild(link);
    }

    async #loadTemplate() {
        try {
            const response = await fetch("/App_Plugins/AccessibilityToolkit/accessibility-dashboard-template.html");
            const html = await response.text();
            const container = document.createElement("div");
            container.innerHTML = html;

            while (container.firstChild) {
                this.shadowRoot.appendChild(container.firstChild);
            }

            requestAnimationFrame(() => {
                this.#bindEvents();
                this.#loadRecentReports();
                this.#initTelemetryNotice();
            });
        } catch (err) {
            console.error("Failed to load dashboard template", err);
            this.shadowRoot.innerHTML = `<p style="padding:20px;color:red;">Failed to load dashboard template.</p>`;
        }
    }

    #bindEvents() {
        const refreshBtn = this.shadowRoot.getElementById("a11y-dashboard-refresh");
        refreshBtn?.addEventListener("click", () => this.#loadRecentReports());

        const auditBtn = this.shadowRoot.getElementById("a11y-audit-btn");
        auditBtn?.addEventListener("click", () => this.#runAudit());

        const pickBtn = this.shadowRoot.getElementById("a11y-audit-pick-btn");
        pickBtn?.addEventListener("click", () => this.#openNodePicker());

        const prevBtn = this.shadowRoot.getElementById("a11y-page-prev");
        prevBtn?.addEventListener("click", () => this.#changePage(-1));

        const nextBtn = this.shadowRoot.getElementById("a11y-page-next");
        nextBtn?.addEventListener("click", () => this.#changePage(1));

        const toggleBtn = this.shadowRoot.getElementById("a11y-audit-toggle-pages");
        toggleBtn?.addEventListener("click", () => this.#togglePages());

        // Tab switching
        this.shadowRoot.querySelectorAll("uui-tab").forEach((tab) => {
            tab.addEventListener("click", () => this.#switchTab(tab.getAttribute("label")));
        });

        // Save settings
        const saveSettingsBtn = this.shadowRoot.getElementById("a11y-save-settings-btn");
        saveSettingsBtn?.addEventListener("click", () => this.#saveSettings());

        // Add excluded page
        const addPageBtn = this.shadowRoot.getElementById("a11y-add-excluded-page-btn");
        addPageBtn?.addEventListener("click", () => this.#pickExcludedPage());

        // Clear all data
        const clearBtn = this.shadowRoot.getElementById("a11y-clear-data-btn");
        clearBtn?.addEventListener("click", () => this.#clearAllData());

        const servicesTabBtn = this.shadowRoot.getElementById("a11y-services-tab-btn");
        servicesTabBtn?.addEventListener("click", () => this.#openServicesPage());
        const faqHelpLink = this.shadowRoot.getElementById("a11y-faq-help-link");
        faqHelpLink?.addEventListener("click", (e) => {
            e.preventDefault();
            this.#switchTab("help-services");
        });

    }

    #openServicesPage() {
        window.open(this.#servicesUrl, "_blank", "noopener");
    }

    // --- Tabs ---

    #switchTab(tabName) {
        this.shadowRoot.querySelectorAll("uui-tab").forEach((tab) => {
            if (tab.getAttribute("label") === tabName) {
                tab.setAttribute("active", "");
            } else {
                tab.removeAttribute("active");
            }
        });

        this.shadowRoot.querySelectorAll(".a11y-tab-content").forEach((div) => {
            const isTarget = div.id === `a11y-tab-${tabName}`;
            div.style.display = isTarget ? "" : "none";
            div.classList.toggle("a11y-tab-visible", isTarget);
        });

        // Lazy load audit history when switching to site audit tab
        if (tabName === "site-audit" && this.#auditHistory.length === 0) {
            this.#loadAuditHistory();
        }

        // Lazy load settings when switching to settings tab
        if (tabName === "settings" && !this.#settingsLoaded) {
            this.#loadSettings();
        }
    }

    // --- Settings ---

    async #loadSettings() {
        const loading = this.shadowRoot.getElementById("a11y-settings-loading");
        const body = this.shadowRoot.getElementById("a11y-settings-body");
        loading.style.display = "flex";
        body.style.display = "none";

        try {
            const [exclusionsResp, docTypesResp, featuresResp, telemetryResp] = await Promise.all([
                fetch("/umbraco/AccessibilityToolkit/Accessibility/GetExclusions"),
                fetch("/umbraco/AccessibilityToolkit/Accessibility/GetDocumentTypes"),
                fetch("/umbraco/AccessibilityToolkit/Accessibility/GetFeatures"),
                fetch("/umbraco/AccessibilityToolkit/Accessibility/GetTelemetrySettings"),
            ]);

            if (exclusionsResp.ok) {
                const data = await exclusionsResp.json();
                this.#excludedDocTypes = data.excludedDocumentTypes || [];
                this.#excludedNodeKeys = (data.excludedNodeKeys || []).map(n => ({
                    key: n.key,
                    name: n.name
                }));
            }

            if (docTypesResp.ok) {
                this.#allDocumentTypes = await docTypesResp.json();
            }

            if (featuresResp.ok) {
                this.#licenseInfo = await featuresResp.json();
            }

            if (telemetryResp.ok) {
                const telemetry = await telemetryResp.json();
                this.#telemetryEnabled = telemetry.enabled !== false;
                this.#telemetryAcknowledged = telemetry.acknowledged === true;
                this.#telemetryLoaded = true;
            }

            this.#settingsLoaded = true;
            this.#renderLicenseInfo();
            this.#renderTelemetrySettings();
            this.#renderDocTypeList();
            this.#renderExcludedPagesList();
        } catch (err) {
            console.error("Failed to load settings", err);
        } finally {
            loading.style.display = "none";
            body.style.display = "block";
        }
    }

    #renderDocTypeList(filterText = "") {
        const container = this.shadowRoot.getElementById("a11y-doctype-list");
        container.innerHTML = "";

        if (this.#allDocumentTypes.length === 0) {
            container.innerHTML = `<p class="a11y-settings-desc">No document types found.</p>`;
            return;
        }

        // Wire up filter input (only once)
        const filterInput = this.shadowRoot.getElementById("a11y-doctype-filter");
        if (filterInput && !filterInput.dataset.bound) {
            filterInput.dataset.bound = "1";
            filterInput.addEventListener("input", () => this.#renderDocTypeList(filterInput.value));
        }

        const filter = filterText.toLowerCase();

        // Show excluded (checked) items first, then unchecked, both filtered
        const sorted = [...this.#allDocumentTypes].sort((a, b) => {
            const aExcl = this.#excludedDocTypes.includes(a.alias) ? 0 : 1;
            const bExcl = this.#excludedDocTypes.includes(b.alias) ? 0 : 1;
            if (aExcl !== bExcl) return aExcl - bExcl;
            return a.name.localeCompare(b.name);
        });

        let visibleCount = 0;
        for (const dt of sorted) {
            const labelText = `${dt.name} (${dt.alias})`;
            if (filter && !labelText.toLowerCase().includes(filter)) continue;
            visibleCount++;

            const isChecked = this.#excludedDocTypes.includes(dt.alias);
            const label = document.createElement("label");
            label.className = "a11y-doctype-label" + (isChecked ? " a11y-doctype-checked" : "");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = isChecked;
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    if (!this.#excludedDocTypes.includes(dt.alias)) {
                        this.#excludedDocTypes.push(dt.alias);
                    }
                    label.classList.add("a11y-doctype-checked");
                } else {
                    this.#excludedDocTypes = this.#excludedDocTypes.filter(a => a !== dt.alias);
                    label.classList.remove("a11y-doctype-checked");
                }
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(" " + labelText));
            container.appendChild(label);
        }

        if (visibleCount === 0 && filter) {
            container.innerHTML = `<p class="a11y-settings-desc" style="margin:0;">No document types match "${this.#escapeHtml(filter)}".</p>`;
        }
    }

    #renderExcludedPagesList() {
        const container = this.shadowRoot.getElementById("a11y-excluded-pages-list");
        container.innerHTML = "";

        if (this.#excludedNodeKeys.length === 0) {
            container.innerHTML = `<p class="a11y-settings-desc" style="margin:0;">No pages excluded.</p>`;
            return;
        }

        for (const node of this.#excludedNodeKeys) {
            const item = document.createElement("div");
            item.className = "a11y-excluded-page-item";
            item.innerHTML = `
                <span class="a11y-excluded-page-name">${this.#escapeHtml(node.name)}</span>
                <button class="a11y-excluded-page-remove" title="Remove">&times;</button>
            `;

            item.querySelector(".a11y-excluded-page-remove").addEventListener("click", () => {
                this.#excludedNodeKeys = this.#excludedNodeKeys.filter(n => n.key !== node.key);
                this.#renderExcludedPagesList();
            });

            container.appendChild(item);
        }
    }

    async #pickExcludedPage() {
        if (!this.#modalManager) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Not ready", message: "Modal manager not available." },
            });
            return;
        }

        try {
            const modal = this.#modalManager.open(this, UMB_DOCUMENT_PICKER_MODAL, {
                data: { multiple: false },
            });

            const result = await modal.onSubmit();
            if (result?.selection?.length > 0) {
                const key = result.selection[0];
                // Check if already excluded
                if (this.#excludedNodeKeys.some(n => n.key === key)) {
                    this.#notificationContext?.peek("warning", {
                        data: { headline: "Already excluded", message: "This page is already in the exclusion list." },
                    });
                    return;
                }

                // Resolve name
                let name = key.substring(0, 8) + "...";
                try {
                    const resp = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/GetNodeName?nodeKey=${encodeURIComponent(key)}`);
                    if (resp.ok) {
                        const data = await resp.json();
                        name = data.name || name;
                    }
                } catch { /* fallback to truncated GUID */ }

                this.#excludedNodeKeys.push({ key, name });
                this.#renderExcludedPagesList();
            }
        } catch {
            // User cancelled
        }
    }

    async #saveSettings() {
        const savedLabel = this.shadowRoot.getElementById("a11y-settings-saved");

        try {
            const telemetryCheckbox = this.shadowRoot.getElementById("a11y-telemetry-enabled");
            this.#telemetryEnabled = telemetryCheckbox ? telemetryCheckbox.checked : this.#telemetryEnabled;

            const [exclusionsResp, telemetryResp] = await Promise.all([
                fetch("/umbraco/AccessibilityToolkit/Accessibility/SaveExclusions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        excludedDocumentTypes: this.#excludedDocTypes,
                        excludedNodeKeys: this.#excludedNodeKeys.map(n => n.key),
                    }),
                }),
                this.#saveTelemetrySettings(this.#telemetryEnabled, true),
            ]);

            if (!exclusionsResp.ok) throw new Error(`SaveExclusions HTTP ${exclusionsResp.status}`);
            if (!telemetryResp.ok) throw new Error(`SaveTelemetrySettings HTTP ${telemetryResp.status}`);

            savedLabel.style.display = "inline";
            setTimeout(() => { savedLabel.style.display = "none"; }, 2000);

            this.#telemetryAcknowledged = true;
            this.#renderTelemetryNotice();
            this.#renderTelemetrySettings();

            this.#notificationContext?.peek("positive", {
                data: { headline: "Settings saved", message: "Audit and telemetry settings have been saved." },
            });
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Save failed", message: err.message },
            });
        }
    }

    async #initTelemetryNotice() {
        await this.#loadTelemetrySettings();
        this.#renderTelemetryNotice();
    }

    async #loadTelemetrySettings() {
        if (this.#telemetryLoaded) return;
        try {
            const resp = await fetch("/umbraco/AccessibilityToolkit/Accessibility/GetTelemetrySettings");
            if (resp.ok) {
                const data = await resp.json();
                this.#telemetryEnabled = data.enabled !== false;
                this.#telemetryAcknowledged = data.acknowledged === true;
            }
        } catch {
            // Keep defaults if fetch fails.
        } finally {
            this.#telemetryLoaded = true;
        }
    }

    #renderTelemetryNotice() {
        const notice = this.shadowRoot.getElementById("a11y-telemetry-notice");
        if (!notice) return;
        if (this.#telemetryAcknowledged) {
            notice.style.display = "none";
            return;
        }
        notice.style.display = "";
        this.#acknowledgeTelemetryNotice();
    }

    #renderTelemetrySettings() {
        const toggle = this.shadowRoot.getElementById("a11y-telemetry-enabled");
        const status = this.shadowRoot.getElementById("a11y-telemetry-status");
        if (toggle) toggle.checked = this.#telemetryEnabled;
        if (status) {
            status.textContent = this.#telemetryEnabled
                ? "Telemetry is currently enabled."
                : "Telemetry is currently disabled.";
        }
    }

    async #acknowledgeTelemetryNotice() {
        if (this.#telemetryAcknowledged) return;
        this.#telemetryAcknowledged = true;

        const resp = await this.#saveTelemetrySettings(this.#telemetryEnabled, true);
        if (!resp.ok) {
            this.#telemetryAcknowledged = false;
        }
    }

    async #saveTelemetrySettings(enabled, acknowledged) {
        return fetch("/umbraco/AccessibilityToolkit/Accessibility/SaveTelemetrySettings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled, acknowledged }),
        });
    }

    // --- Clear All Data ---

    async #clearAllData() {
        if (!confirm("This will permanently delete all scan results and audit history. Continue?")) {
            return;
        }

        try {
            const resp = await fetch("/umbraco/AccessibilityToolkit/Accessibility/ClearAllData", {
                method: "POST",
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            this.#recentResults = [];
            this.#auditHistory = [];
            this.#lastAuditData = null;
            this.#renderRecentTable();
            this.#renderAuditHistory();

            // Hide audit results if showing
            const resultsDiv = this.shadowRoot.getElementById("a11y-audit-results");
            if (resultsDiv) resultsDiv.style.display = "none";

            this.#notificationContext?.peek("positive", {
                data: { headline: "Data cleared", message: "All scan results and audit history have been removed." },
            });
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Clear failed", message: err.message },
            });
        }
    }

    // --- Node Picker ---

    async #openNodePicker() {
        if (!this.#modalManager) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Not ready", message: "Modal manager not available right now. Please try again." },
            });
            return;
        }

        try {
            const modal = this.#modalManager.open(this, UMB_DOCUMENT_PICKER_MODAL, {
                data: { multiple: false },
            });

            const result = await modal.onSubmit();
            if (result?.selection?.length > 0) {
                this.#selectedNodeKey = result.selection[0];
                const display = this.shadowRoot.getElementById("a11y-audit-node-display");
                display.textContent = this.#selectedNodeKey;
                display.classList.add("a11y-node-selected");

            }
        } catch {
            // User cancelled the modal — do nothing
        }
    }

    // --- Pagination ---

    #changePage(delta) {
        const totalPages = Math.ceil(this.#recentResults.length / this.#pageSize);
        const newPage = this.#currentPage + delta;
        if (newPage < 1 || newPage > totalPages) return;
        this.#currentPage = newPage;
        this.#renderRecentTable();
    }

    #renderPagination() {
        const pagination = this.shadowRoot.getElementById("a11y-dashboard-pagination");
        const totalPages = Math.ceil(this.#recentResults.length / this.#pageSize);

        if (totalPages <= 1) {
            pagination.style.display = "none";
            return;
        }

        pagination.style.display = "flex";

        const prevBtn = this.shadowRoot.getElementById("a11y-page-prev");
        const nextBtn = this.shadowRoot.getElementById("a11y-page-next");
        const info = this.shadowRoot.getElementById("a11y-page-info");

        prevBtn.disabled = this.#currentPage <= 1;
        nextBtn.disabled = this.#currentPage >= totalPages;
        info.textContent = `Page ${this.#currentPage} of ${totalPages}`;
    }

    // --- Recent Reports ---

    async #loadRecentReports() {
        const loading = this.shadowRoot.getElementById("a11y-dashboard-loading");
        const table = this.shadowRoot.getElementById("a11y-dashboard-table");
        const empty = this.shadowRoot.getElementById("a11y-dashboard-empty");

        loading.style.display = "flex";
        table.style.display = "none";
        empty.style.display = "none";

        try {
            const response = await fetch("/umbraco/AccessibilityToolkit/Accessibility/GetRecentHistory?count=100");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.#recentResults = await response.json();
            this.#currentPage = 1;
            this.#renderRecentTable();
        } catch (err) {
            console.error("Failed to load recent reports", err);
            this.#notificationContext?.peek("danger", {
                data: { headline: "Load failed", message: err.message },
            });
        } finally {
            loading.style.display = "none";
        }
    }

    #renderRecentTable() {
        const table = this.shadowRoot.getElementById("a11y-dashboard-table");
        const tbody = this.shadowRoot.getElementById("a11y-dashboard-tbody");
        const empty = this.shadowRoot.getElementById("a11y-dashboard-empty");

        tbody.innerHTML = "";

        if (this.#recentResults.length === 0) {
            table.style.display = "none";
            empty.style.display = "block";
            this.shadowRoot.getElementById("a11y-dashboard-pagination").style.display = "none";
            return;
        }

        table.style.display = "";
        empty.style.display = "none";

        // Paginate
        const start = (this.#currentPage - 1) * this.#pageSize;
        const end = start + this.#pageSize;
        const pageSlice = this.#recentResults.slice(start, end);

        for (const entry of pageSlice) {
            const tr = document.createElement("tr");
            const scoreClass = entry.overallScore >= 90 ? "a11y-score-good"
                : entry.overallScore >= 70 ? "a11y-score-ok"
                : "a11y-score-poor";

            const dateStr = new Date(entry.scannedAt).toLocaleString();
            const shortUrl = this.#truncateUrl(entry.url, 50);
            const editLink = `/umbraco/section/content/workspace/document/edit/${entry.contentNodeKey}`;

            tr.innerHTML = `
                <td title="${this.#escapeHtml(entry.url)}"><a href="${editLink}" class="a11y-page-link">${this.#escapeHtml(shortUrl)}</a></td>
                <td class="a11y-col-score"><span class="a11y-dashboard-score ${scoreClass}">${entry.overallScore}</span></td>
                <td class="a11y-col-level">${this.#escapeHtml(entry.wcagLevel)}</td>
                <td class="a11y-col-issues">${entry.totalIssues}</td>
                <td class="a11y-dashboard-date">${dateStr}</td>
                <td class="a11y-audit-history-actions">
                    <button class="a11y-audit-history-report-btn" data-id="${entry.id}" title="Export Report">Export</button>
                    <button class="a11y-audit-history-export-btn" data-id="${entry.id}" title="Export CSV">CSV</button>
                    <button class="a11y-dashboard-delete-btn" data-id="${entry.id}" title="Delete result">&times;</button>
                </td>
            `;

            const reportBtn = tr.querySelector(".a11y-audit-history-report-btn");
            reportBtn?.addEventListener("click", () => this.#openRecentReport(entry.id, entry.wcagLevel));

            const csvBtn = tr.querySelector(".a11y-audit-history-export-btn");
            csvBtn?.addEventListener("click", () => this.#exportRecentCsv(entry.id));

            const deleteBtn = tr.querySelector(".a11y-dashboard-delete-btn");
            deleteBtn?.addEventListener("click", () => this.#deleteEntry(entry.id));

            tbody.appendChild(tr);
        }

        this.#renderPagination();
    }

    #renderLicenseInfo() {
        const info = this.#licenseInfo || {};
        const setText = (id, value) => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.textContent = value ?? "-";
        };

        const hasKey = info.licenseType && info.licenseType !== "Free" && info.licenseType !== "None";
        setText("a11y-license-type", hasKey ? info.licenseType : "Development (all features enabled)");
        setText("a11y-license-status", info.status || "Active");
        setText("a11y-license-pro", hasKey ? (info.isProEnabled ? "Yes" : "No") : "All enabled");
        setText("a11y-license-domain", info.domain || (hasKey ? "-" : "Any (dev mode)"));

        const expires = info.expiresAt ? new Date(info.expiresAt).toLocaleString() : "No expiry";
        setText("a11y-license-expires", expires);

        const statusEl = this.shadowRoot.getElementById("a11y-license-status");
        if (statusEl) {
            statusEl.classList.remove("a11y-license-status-active", "a11y-license-status-expired", "a11y-license-status-invalid");
            const status = String(info.status || "Active").toLowerCase();
            if (status === "expired") statusEl.classList.add("a11y-license-status-expired");
            else if (status === "invalid") statusEl.classList.add("a11y-license-status-invalid");
            else statusEl.classList.add("a11y-license-status-active");
        }

        const errorEl = this.shadowRoot.getElementById("a11y-license-error");
        if (errorEl) {
            if (info.validationError) {
                errorEl.textContent = info.validationError;
                errorEl.style.display = "block";
            } else {
                errorEl.textContent = "";
                errorEl.style.display = "none";
            }
        }
    }

    async #deleteEntry(id) {
        if (!confirm("Delete this scan result?")) return;
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/DeleteHistory?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.#recentResults = this.#recentResults.filter(r => r.id !== id);
            // Adjust current page if the deletion emptied it
            const totalPages = Math.ceil(this.#recentResults.length / this.#pageSize) || 1;
            if (this.#currentPage > totalPages) this.#currentPage = totalPages;
            this.#renderRecentTable();
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Delete failed", message: err.message },
            });
        }
    }

    async #openRecentReport(id, wcagLevel) {
        const win = this.#openReportWindow("Accessibility Scan Report");
        if (!win) return;
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/ExportResult?id=${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const savedResult = JSON.parse(data.resultJson);

            const date = new Date(data.scannedAt || Date.now()).toLocaleDateString();
            const level = wcagLevel || "AA";
            const score = savedResult.score ?? 0;
            const scoreClass = score >= 90 ? "good" : score >= 70 ? "ok" : "poor";
            const esc = (s) => this.#escapeHtml(s);

            let bodyHtml = `
                <div class="report-header">
                    <h1>Accessibility Scan Report</h1>
                    <div class="report-meta">
                        <span>URL: ${esc(savedResult.url || data.url || "-")}</span>
                        <span>Date: ${date}</span>
                        <span>WCAG Level: ${level}</span>
                    </div>
                </div>
                <div class="report-summary">
                    <div class="report-stat">
                        <div class="report-stat-value score-${scoreClass}">${score}</div>
                        <div class="report-stat-label">Score</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-value">${savedResult.totalIssues ?? 0}</div>
                        <div class="report-stat-label">Issues</div>
                    </div>
                </div>
            `;

            const issues = savedResult.issues || [];
            if (issues.length > 0) {
                bodyHtml += `<h2>Issues</h2><table class="report-table"><thead><tr><th>Impact</th><th>Category</th><th>Description</th><th>WCAG</th><th>Element</th></tr></thead><tbody>`;
                for (const i of issues) {
                    bodyHtml += `<tr>
                        <td><span class="impact-badge impact-${esc(i.impact)}">${esc(i.impact)}</span></td>
                        <td>${esc(i.category)}</td>
                        <td>${esc(i.description)}</td>
                        <td>${esc(i.wcagCriterion || "")}</td>
                        <td><code>${esc(i.element || i.selector || "")}</code></td>
                    </tr>`;
                }
                bodyHtml += `</tbody></table>`;
            } else {
                bodyHtml += `<p class="no-issues">No issues found.</p>`;
            }

            this.#populateReportWindow(win, bodyHtml);
        } catch (err) {
            win.document.body.innerHTML = `<p style="color:red;">Failed to load report: ${this.#escapeHtml(err.message)}</p>`;
        }
    }

    async #exportRecentCsv(id) {
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/ExportResult?id=${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const savedResult = JSON.parse(data.resultJson);

            const issues = savedResult.issues || [];
            if (issues.length === 0) {
                this.#notificationContext?.peek("warning", { data: { headline: "No data", message: "No issues to export." } });
                return;
            }

            const headers = ["Impact", "WCAG", "Category", "Description", "Element", "Selector", "Recommendation"];
            const rows = issues.map(i => [
                i.impact || "", i.wcagCriterion || "", i.category || "",
                i.description || "", i.element || "", i.selector || "", i.recommendation || ""
            ]);

            const csvContent = [headers, ...rows]
                .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
                .join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `accessibility-scan-${id}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            this.#notificationContext?.peek("danger", { data: { headline: "Export failed", message: err.message } });
        }
    }

    // --- Audit History ---

    async #loadAuditHistory() {
        const loading = this.shadowRoot.getElementById("a11y-audit-history-loading");
        const table = this.shadowRoot.getElementById("a11y-audit-history-table");
        const empty = this.shadowRoot.getElementById("a11y-audit-history-empty");

        loading.style.display = "flex";
        table.style.display = "none";
        empty.style.display = "none";

        try {
            const response = await fetch("/umbraco/AccessibilityToolkit/Accessibility/GetRecentAudits?count=20");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.#auditHistory = await response.json();
            this.#renderAuditHistory();
        } catch (err) {
            console.error("Failed to load audit history", err);
        } finally {
            loading.style.display = "none";
        }
    }

    #renderAuditHistory() {
        const table = this.shadowRoot.getElementById("a11y-audit-history-table");
        const tbody = this.shadowRoot.getElementById("a11y-audit-history-tbody");
        const empty = this.shadowRoot.getElementById("a11y-audit-history-empty");

        tbody.innerHTML = "";

        if (this.#auditHistory.length === 0) {
            table.style.display = "none";
            empty.style.display = "block";
            return;
        }

        table.style.display = "";
        empty.style.display = "none";

        // Group audits by rootNodeKey for per-scope sparklines
        const byScope = {};
        for (const audit of this.#auditHistory) {
            const key = audit.rootNodeKey;
            if (!byScope[key]) byScope[key] = [];
            byScope[key].push(audit);
        }

        for (const audit of this.#auditHistory) {
            const tr = document.createElement("tr");
            const dateStr = new Date(audit.scannedAt).toLocaleString();
            const scoreClass = audit.averageScore >= 90 ? "a11y-score-good"
                : audit.averageScore >= 70 ? "a11y-score-ok"
                : "a11y-score-poor";
            const editLink = `/umbraco/section/content/workspace/document/edit/${audit.rootNodeKey}`;
            const displayName = audit.rootNodeName || String(audit.rootNodeKey).substring(0, 8) + "...";

            tr.innerHTML = `
                <td class="a11y-dashboard-date">${dateStr}</td>
                <td><a href="${editLink}" class="a11y-page-link" title="${this.#escapeHtml(audit.rootNodeKey)}">${this.#escapeHtml(displayName)}</a></td>
                <td class="a11y-col-level">${this.#escapeHtml(audit.wcagLevel)}</td>
                <td class="a11y-col-pages">${audit.totalPages}</td>
                <td class="a11y-col-score"><span class="a11y-dashboard-score ${scoreClass}">${audit.averageScore}</span></td>
                <td class="a11y-audit-sparkline-cell"></td>
                <td class="a11y-col-issues">${audit.totalIssues}</td>
                <td class="a11y-audit-history-actions">
                    <button class="a11y-audit-history-report-btn" data-id="${audit.id}" title="Export Report">Export</button>
                    <button class="a11y-audit-history-export-btn" data-id="${audit.id}" title="Export CSV">CSV</button>
                    <button class="a11y-dashboard-delete-btn" data-id="${audit.id}" title="Delete audit">&times;</button>
                </td>
            `;

            // Render inline sparkline for this scope
            const scopeAudits = byScope[audit.rootNodeKey] || [];
            const sparkCell = tr.querySelector(".a11y-audit-sparkline-cell");
            if (sparkCell && scopeAudits.length >= 2) {
                const dataPoints = [...scopeAudits]
                    .reverse()
                    .map(a => ({ score: a.averageScore, date: a.scannedAt }));
                this.#renderSparkline(sparkCell, dataPoints, { width: 80, height: 24 });
            }

            const reportBtn = tr.querySelector(".a11y-audit-history-report-btn");
            reportBtn?.addEventListener("click", () => this.#openAuditReport(audit.id));

            const exportBtn = tr.querySelector(".a11y-audit-history-export-btn");
            exportBtn?.addEventListener("click", () => this.#exportAuditFromHistory(audit.id));

            const deleteBtn = tr.querySelector(".a11y-dashboard-delete-btn");
            deleteBtn?.addEventListener("click", () => this.#deleteAudit(audit.id));

            tbody.appendChild(tr);
        }
    }

    async #exportAuditFromHistory(id) {
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/ExportAudit?id=${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            const data = JSON.parse(result.resultJson);
            this.#exportAuditCsv(data);
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Export failed", message: err.message },
            });
        }
    }

    async #deleteAudit(id) {
        if (!confirm("Delete this audit run?")) return;
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/DeleteAudit?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.#auditHistory = this.#auditHistory.filter(a => a.id !== id);
            this.#renderAuditHistory();
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Delete failed", message: err.message },
            });
        }
    }

    // --- Collapsible Pages Toggle ---

    #togglePages() {
        const container = this.shadowRoot.getElementById("a11y-audit-pages-container");
        const btn = this.shadowRoot.getElementById("a11y-audit-toggle-pages");
        this.#pagesExpanded = !this.#pagesExpanded;

        if (this.#pagesExpanded) {
            container.style.display = "block";
            btn.innerHTML = `Hide pages &#9650;`;
        } else {
            container.style.display = "none";
            const count = this.#lastAuditData?.pages?.length || 0;
            btn.innerHTML = `Show all ${count} pages &#9660;`;
        }
    }

    // --- Audit ---

    async #runAudit() {
        const levelSelect = this.shadowRoot.getElementById("a11y-audit-level");
        const loading = this.shadowRoot.getElementById("a11y-audit-loading");
        const loadingText = this.shadowRoot.querySelector(".a11y-loading-text");
        const resultsDiv = this.shadowRoot.getElementById("a11y-audit-results");
        const progressDiv = this.shadowRoot.getElementById("a11y-audit-progress");
        const progressCount = this.shadowRoot.getElementById("a11y-audit-progress-count");
        const progressFill = this.shadowRoot.getElementById("a11y-audit-progress-fill");
        const progressText = this.shadowRoot.getElementById("a11y-audit-progress-text");
        const progressLog = this.shadowRoot.getElementById("a11y-audit-progress-log");
        const auditBtn = this.shadowRoot.getElementById("a11y-audit-btn");

        const nodeKey = this.#selectedNodeKey;
        if (!nodeKey) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Missing input", message: "Pick a content node to audit." },
            });
            return;
        }

        auditBtn.disabled = true;
        loading.style.display = "flex";
        if (loadingText) loadingText.textContent = "Discovering pages...";
        resultsDiv.style.display = "none";
        progressDiv.style.display = "none";
        progressLog.innerHTML = "";

        const level = levelSelect?.value || "AA";
        const visualEnabled = await this.#checkVisualEnabled();
        const auditStartedAt = Date.now();

        try {
            // Step 1: Discover pages
            const discoverResp = await fetch(
                `/umbraco/AccessibilityToolkit/Accessibility/GetDescendantPages?nodeKey=${encodeURIComponent(nodeKey)}`
            );
            if (!discoverResp.ok) {
                const err = await discoverResp.json().catch(() => ({ error: discoverResp.statusText }));
                throw new Error(err.error || `HTTP ${discoverResp.status}`);
            }
            const { pages } = await discoverResp.json();

            if (pages.length === 0) {
                throw new Error("No published pages found under this node.");
            }

            // Step 2: Show progress UI
            loading.style.display = "none";
            progressDiv.style.display = "block";
            progressCount.textContent = `Found ${pages.length} page${pages.length === 1 ? "" : "s"} to scan`;
            progressFill.style.width = "0%";
            progressText.textContent = "Starting...";

            // Step 3: Scan each page
            const results = [];
            let totalIssues = 0;
            let totalScore = 0;
            let scannedCount = 0;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const pct = ((i + 1) / pages.length) * 100;
                progressFill.style.width = `${pct}%`;
                progressText.textContent = `Scanning page ${i + 1} of ${pages.length}: ${page.name}...`;

                try {
                    const checkResp = await fetch(
                        `/umbraco/AccessibilityToolkit/Accessibility/Check?nodeKey=${encodeURIComponent(page.nodeKey)}&level=${level}&emitTelemetry=false`
                    );

                    if (!checkResp.ok) {
                        const err = await checkResp.json().catch(() => ({ error: checkResp.statusText }));
                        this.#appendProgressLog(progressLog, page.name, null, null, err.error || `HTTP ${checkResp.status}`);
                        results.push({ nodeKey: page.nodeKey, url: page.url, score: -1, totalIssues: -1 });
                        continue;
                    }

                    const result = await checkResp.json();
                    const pageResult = {
                        nodeKey: page.nodeKey,
                        name: page.name,
                        url: result.url || page.url,
                        score: result.score,
                        totalIssues: result.totalIssues,
                        criticalCount: result.criticalCount || 0,
                        seriousCount: result.seriousCount || 0,
                        moderateCount: result.moderateCount || 0,
                        minorCount: result.minorCount || 0,
                        issues: result.issues || [],
                        categorySummary: result.categorySummary || {}
                    };

                    // Run visual checks if enabled
                    if (visualEnabled && pageResult.url) {
                        progressText.textContent = `Visual checks for page ${i + 1}: ${page.name}...`;
                        try {
                            const visualIssues = await this.#runVisualChecksOnPage(pageResult.url);
                            this.#mergeVisualIssuesIntoResult(pageResult, visualIssues);
                        } catch (vErr) {
                            await this.#trackVisualCheckFailure(this.#classifyVisualCheckError(vErr));
                        }
                    }

                    results.push(pageResult);
                    totalScore += pageResult.score;
                    totalIssues += pageResult.totalIssues;
                    scannedCount++;
                    this.#appendProgressLog(progressLog, page.name, pageResult.score, pageResult.totalIssues, null);
                } catch (err) {
                    this.#appendProgressLog(progressLog, page.name, null, null, err.message);
                    results.push({ nodeKey: page.nodeKey, url: page.url, score: -1, totalIssues: -1 });
                }
            }

            progressText.textContent = "Saving audit...";

            // Step 4: Aggregate and save
            const averageScore = scannedCount > 0 ? Math.round(totalScore / scannedCount) : 0;
            const totalCritical = results.reduce((s, r) => s + (r.criticalCount || 0), 0);
            const totalSerious = results.reduce((s, r) => s + (r.seriousCount || 0), 0);
            const totalModerate = results.reduce((s, r) => s + (r.moderateCount || 0), 0);
            const totalMinor = results.reduce((s, r) => s + (r.minorCount || 0), 0);
            const auditData = {
                pages: results,
                summary: {
                    totalPages: scannedCount, averageScore, totalIssues,
                    criticalCount: totalCritical, seriousCount: totalSerious,
                    moderateCount: totalModerate, minorCount: totalMinor
                }
            };

            // Strip screenshot base64 data from stored audit JSON to keep DB size reasonable
            const storageData = {
                ...auditData,
                pages: auditData.pages.map(p => ({
                    ...p,
                    issues: (p.issues || []).map(i => {
                        if (i.screenshot) {
                            const { screenshot, ...rest } = i;
                            return { ...rest, screenshotStatus: "stored-separately" };
                        }
                        return i;
                    })
                }))
            };

            await fetch("/umbraco/AccessibilityToolkit/Accessibility/SaveAudit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rootNodeKey: nodeKey,
                    wcagLevel: level,
                    totalPages: scannedCount,
                    averageScore,
                    totalIssues,
                    durationMs: Math.max(0, Math.round(Date.now() - auditStartedAt)),
                    resultJson: JSON.stringify(storageData)
                })
            });

            // Step 5: Show results
            progressDiv.style.display = "none";
            this.#lastAuditData = auditData;
            this.#pagesExpanded = false;
            this.#renderAuditResults(auditData);

            this.#notificationContext?.peek("positive", {
                data: {
                    headline: "Audit complete",
                    message: `Scanned ${scannedCount} page(s) with an average score of ${averageScore}.`,
                },
            });

            this.#loadRecentReports();
            this.#loadAuditHistory();
        } catch (err) {
            console.error("Audit failed", err);
            progressDiv.style.display = "none";
            this.#notificationContext?.peek("danger", {
                data: { headline: "Audit failed", message: err.message },
            });
        } finally {
            loading.style.display = "none";
            auditBtn.disabled = false;
        }
    }

    #appendProgressLog(container, pageName, score, issues, error) {
        const entry = document.createElement("div");
        entry.className = "a11y-progress-log-entry";

        if (error) {
            entry.innerHTML = `<span class="a11y-progress-error">&#10008;</span>
                <span class="a11y-progress-page-name">${this.#escapeHtml(pageName)}</span>
                <span class="a11y-progress-error-text">${this.#escapeHtml(error)}</span>`;
        } else {
            const scoreClass = score >= 90 ? "a11y-score-good" : score >= 70 ? "a11y-score-ok" : "a11y-score-poor";
            entry.innerHTML = `<span class="a11y-progress-ok">&#10004;</span>
                <span class="a11y-progress-page-name">${this.#escapeHtml(pageName)}</span>
                <span class="a11y-dashboard-score ${scoreClass}">${score}</span>
                <span class="a11y-progress-issues">${issues} issue${issues === 1 ? "" : "s"}</span>`;
        }

        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }

    #renderAuditResults(data) {
        const resultsDiv = this.shadowRoot.getElementById("a11y-audit-results");
        const summary = this.shadowRoot.getElementById("a11y-audit-summary");
        const tbody = this.shadowRoot.getElementById("a11y-audit-tbody");
        const pagesContainer = this.shadowRoot.getElementById("a11y-audit-pages-container");
        const toggleBtn = this.shadowRoot.getElementById("a11y-audit-toggle-pages");

        resultsDiv.style.display = "block";
        pagesContainer.style.display = "none";
        toggleBtn.innerHTML = `Show all ${data.pages.length} pages &#9660;`;

        const avgScore = data.summary.averageScore;
        const avgScoreClass = avgScore >= 90 ? "a11y-score-good" : avgScore >= 70 ? "a11y-score-ok" : "a11y-score-poor";

        summary.innerHTML = `
            <div class="a11y-dashboard-audit-stats">
                <div class="a11y-dashboard-stat">
                    <span class="a11y-dashboard-stat-value">${data.summary.totalPages}</span>
                    <span class="a11y-dashboard-stat-label">Pages Scanned</span>
                </div>
                <div class="a11y-dashboard-stat">
                    <span class="a11y-dashboard-stat-value ${avgScoreClass}">${avgScore}</span>
                    <span class="a11y-dashboard-stat-label">Average Score</span>
                </div>
                <div class="a11y-dashboard-stat">
                    <span class="a11y-dashboard-stat-value">${data.summary.totalIssues}</span>
                    <span class="a11y-dashboard-stat-label">Total Issues</span>
                </div>
                <div class="a11y-dashboard-stat a11y-dashboard-stat-export">
                    <uui-button label="Export CSV" id="a11y-audit-export-btn" look="secondary"></uui-button>
                </div>
            </div>
        `;

        // Bind export button
        const exportBtn = this.shadowRoot.getElementById("a11y-audit-export-btn");
        exportBtn?.addEventListener("click", () => this.#exportAuditCsv(data));

        tbody.innerHTML = "";
        for (const page of data.pages) {
            const tr = document.createElement("tr");
            const scoreDisplay = page.score === -1 ? "Error" : page.score;
            const scoreClass = page.score >= 90 ? "a11y-score-good"
                : page.score >= 70 ? "a11y-score-ok"
                : "a11y-score-poor";

            const shortUrl = this.#escapeHtml(this.#truncateUrl(page.url, 50));
            const editLink = page.nodeKey ? `/umbraco/section/content/workspace/document/edit/${page.nodeKey}` : "";

            const urlCell = page.nodeKey
                ? `<a href="${editLink}" class="a11y-page-link" title="${this.#escapeHtml(page.url)}">${shortUrl}</a>`
                : `<span title="${this.#escapeHtml(page.url)}">${shortUrl}</span>`;

            tr.innerHTML = `
                <td>${urlCell}</td>
                <td><span class="a11y-dashboard-score ${page.score >= 0 ? scoreClass : ''}">${scoreDisplay}</span></td>
                <td>${page.totalIssues === -1 ? "N/A" : page.totalIssues}</td>
            `;

            tbody.appendChild(tr);
        }
    }

    // --- Audit CSV Export ---

    #exportAuditCsv(data) {
        if (!data || !data.pages || data.pages.length === 0) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "No data", message: "No audit results to export." },
            });
            return;
        }

        const hasIssueDetail = data.pages.some(p => p.issues && p.issues.length > 0);

        let csvContent;
        if (hasIssueDetail) {
            // Detailed CSV with one row per issue
            const headers = ["Page URL", "Page Score", "Impact", "WCAG", "Category", "Description", "Element", "Selector", "Recommendation"];
            const rows = [];
            for (const p of data.pages) {
                if (p.issues && p.issues.length > 0) {
                    for (const i of p.issues) {
                        rows.push([
                            p.url,
                            p.score === -1 ? "Error" : p.score,
                            i.impact || "",
                            i.wcagCriterion || "",
                            i.category || "",
                            i.description || "",
                            i.element || "",
                            i.selector || "",
                            i.recommendation || ""
                        ]);
                    }
                } else if (p.score >= 0 && p.totalIssues === 0) {
                    rows.push([p.url, p.score, "", "", "", "No issues found", "", "", ""]);
                } else {
                    rows.push([p.url, p.score === -1 ? "Error" : p.score, "", "", "", p.score === -1 ? "Page could not be scanned" : "", "", "", ""]);
                }
            }
            csvContent = [headers, ...rows]
                .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
                .join("\n");
        } else {
            // Summary CSV (legacy format for old audits without issue detail)
            const headers = ["Page URL", "Score", "Issues", "Node Key"];
            const rows = data.pages.map((p) => [
                p.url,
                p.score === -1 ? "Error" : p.score,
                p.totalIssues === -1 ? "N/A" : p.totalIssues,
                p.nodeKey || "",
            ]);
            csvContent = [headers, ...rows]
                .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
                .join("\n");
        }

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `accessibility-audit-${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
        URL.revokeObjectURL(url);
    }

    // --- Audit Print Report ---

    async #openAuditReport(id) {
        // Open popup immediately with loading state
        const audit = this.#auditHistory.find(a => a.id === id);
        const rootName = audit?.rootNodeName || "Site";
        const win = this.#openReportWindow(`Accessibility Audit Report - ${rootName}`);
        if (!win) return;

        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/ExportAudit?id=${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            const data = JSON.parse(result.resultJson);

            const date = audit ? new Date(audit.scannedAt).toLocaleDateString() : new Date().toLocaleDateString();
            const level = audit?.wcagLevel || "AA";

            const hasIssueDetail = data.pages?.some(p => p.issues && p.issues.length > 0);
            const esc = (s) => this.#escapeHtml(s);

            // --- Header ---
            let bodyHtml = `
                <div class="report-header">
                    <h1>Accessibility Audit Report</h1>
                    <div class="report-meta">
                        <span>Date: ${esc(date)}</span>
                        <span>WCAG Level: ${esc(level)}</span>
                        <span>Root: ${esc(rootName)}</span>
                    </div>
                </div>
            `;

            // --- Executive Summary ---
            const s = data.summary || {};
            const avgScoreColor = s.averageScore >= 90 ? "good" : s.averageScore >= 70 ? "ok" : "poor";
            bodyHtml += `
                <div class="report-summary">
                    <div class="report-stat">
                        <span class="report-stat-value">${s.totalPages || 0}</span>
                        <span class="report-stat-label">Pages Scanned</span>
                    </div>
                    <div class="report-stat">
                        <span class="report-stat-value report-score-${avgScoreColor}">${s.averageScore || 0}</span>
                        <span class="report-stat-label">Average Score</span>
                    </div>
                    <div class="report-stat">
                        <span class="report-stat-value">${s.totalIssues || 0}</span>
                        <span class="report-stat-label">Total Issues</span>
                    </div>
                </div>
            `;

            // Support CTA
            bodyHtml += `
                <div class="report-services-cta">
                    <strong>Need help fixing these issues?</strong>
                    <span>Book a manual accessibility audit and remediation plan from Digital Wonderlab.</span>
                    <a href="${this.#escapeHtml(this.#servicesUrl)}" target="_blank" rel="noopener">Contact our accessibility team</a>
                </div>
            `;

            // --- Impact Breakdown ---
            if (hasIssueDetail) {
                const crit = s.criticalCount || data.pages.reduce((t, p) => t + (p.criticalCount || 0), 0);
                const ser = s.seriousCount || data.pages.reduce((t, p) => t + (p.seriousCount || 0), 0);
                const mod = s.moderateCount || data.pages.reduce((t, p) => t + (p.moderateCount || 0), 0);
                const min = s.minorCount || data.pages.reduce((t, p) => t + (p.minorCount || 0), 0);

                bodyHtml += `<div class="report-impact-row">`;
                if (crit) bodyHtml += `<span class="report-badge-critical">${crit} Critical</span>`;
                if (ser) bodyHtml += `<span class="report-badge-serious">${ser} Serious</span>`;
                if (mod) bodyHtml += `<span class="report-badge-moderate">${mod} Moderate</span>`;
                if (min) bodyHtml += `<span class="report-badge-minor">${min} Minor</span>`;
                bodyHtml += `</div>`;

                // --- Category Distribution ---
                const catTotals = {};
                for (const page of data.pages) {
                    for (const issue of (page.issues || [])) {
                        const cat = issue.category || "Other";
                        catTotals[cat] = (catTotals[cat] || 0) + 1;
                    }
                }
                const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
                const maxCat = sortedCats.length > 0 ? sortedCats[0][1] : 1;

                bodyHtml += `<h2>Issue Distribution by Category</h2><div class="report-category-chart">`;
                for (const [cat, count] of sortedCats) {
                    const pct = Math.round((count / maxCat) * 100);
                    bodyHtml += `
                        <div class="report-cat-row">
                            <span class="report-cat-label">${esc(cat)}</span>
                            <div class="report-cat-bar-bg"><div class="report-cat-bar" style="width:${pct}%"></div></div>
                            <span class="report-cat-count">${count}</span>
                        </div>`;
                }
                bodyHtml += `</div>`;

                // --- Top Issues Across All Pages ---
                const issueGroups = {};
                for (const page of data.pages) {
                    for (const issue of (page.issues || [])) {
                        const key = issue.ruleId || issue.description;
                        if (!issueGroups[key]) {
                            issueGroups[key] = {
                                ruleId: issue.ruleId,
                                description: issue.description,
                                impact: issue.impact,
                                wcagCriterion: issue.wcagCriterion,
                                recommendation: issue.recommendation,
                                wcagUrl: issue.wcagUrl,
                                count: 0,
                                pages: new Set()
                            };
                        }
                        issueGroups[key].count++;
                        issueGroups[key].pages.add(page.url);
                    }
                }
                const topIssues = Object.values(issueGroups)
                    .sort((a, b) => {
                        const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
                        const impactDiff = (impactOrder[a.impact] ?? 4) - (impactOrder[b.impact] ?? 4);
                        return impactDiff !== 0 ? impactDiff : b.count - a.count;
                    })
                    .slice(0, 20);

                bodyHtml += `
                    <h2>Top Issues Across All Pages</h2>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Impact</th>
                                <th>Group</th>
                                <th>WCAG</th>
                                <th>Issue</th>
                                <th>Occurrences</th>
                                <th>Pages Affected</th>
                                <th>Recommendation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topIssues.map(i => `<tr>
                                <td><span class="report-badge-${esc(i.impact)}">${esc(i.impact)}</span></td>
                                <td><span class="report-group-badge report-group-${this.#getIssueGroup(i.ruleId).toLowerCase()}">${this.#getIssueGroup(i.ruleId)}</span></td>
                                <td>${i.wcagCriterion ? `<code>${esc(i.wcagCriterion)}</code>` : ""}</td>
                                <td>${esc(i.description)}</td>
                                <td class="report-center">${i.count}</td>
                                <td class="report-center">${i.pages.size} / ${s.totalPages || data.pages.length}</td>
                                <td class="report-recommendation">${esc(i.recommendation)}</td>
                            </tr>`).join("")}
                        </tbody>
                    </table>
                `;
            }

            // --- Pages Overview ---
            const sortedPages = [...(data.pages || [])].sort((a, b) => a.score - b.score);
            bodyHtml += `
                <h2>Pages Overview</h2>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Page URL</th>
                            <th>Score</th>
                            ${hasIssueDetail ? `<th>Critical</th><th>Serious</th><th>Moderate</th><th>Minor</th>` : ""}
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedPages.map((p, idx) => {
                            const sc = p.score >= 90 ? "good" : p.score >= 70 ? "ok" : "poor";
                            return `<tr>
                                <td>${hasIssueDetail && p.score >= 0 ? `<a href="#page-${idx}">${esc(p.url)}</a>` : esc(p.url)}</td>
                                <td><span class="report-score-${p.score >= 0 ? sc : ''}">${p.score === -1 ? "Error" : p.score}</span></td>
                                ${hasIssueDetail ? `
                                    <td class="report-center">${p.criticalCount || 0}</td>
                                    <td class="report-center">${p.seriousCount || 0}</td>
                                    <td class="report-center">${p.moderateCount || 0}</td>
                                    <td class="report-center">${p.minorCount || 0}</td>
                                ` : ""}
                                <td class="report-center">${p.totalIssues === -1 ? "N/A" : p.totalIssues}</td>
                            </tr>`;
                        }).join("")}
                    </tbody>
                </table>
            `;

            // --- Per-Page Detail Sections ---
            if (hasIssueDetail) {
                for (let idx = 0; idx < sortedPages.length; idx++) {
                    const p = sortedPages[idx];
                    if (p.score === -1 || !p.issues || p.issues.length === 0) continue;

                    const sc = p.score >= 90 ? "good" : p.score >= 70 ? "ok" : "poor";
                    const pageName = p.name || p.url;

                    bodyHtml += `
                        <div class="report-page-section" id="page-${idx}">
                            <h2>${esc(pageName)}</h2>
                            <div class="report-page-meta">
                                <span class="report-page-url">${esc(p.url)}</span>
                                <span class="report-score-${sc}" style="margin-left:auto;">${p.score}/100</span>
                            </div>
                            <div class="report-impact-row" style="margin-bottom:12px;">
                                ${p.criticalCount ? `<span class="report-badge-critical">${p.criticalCount} Critical</span>` : ""}
                                ${p.seriousCount ? `<span class="report-badge-serious">${p.seriousCount} Serious</span>` : ""}
                                ${p.moderateCount ? `<span class="report-badge-moderate">${p.moderateCount} Moderate</span>` : ""}
                                ${p.minorCount ? `<span class="report-badge-minor">${p.minorCount} Minor</span>` : ""}
                            </div>
                    `;

                    // Group issues by Content / Code / Design
                    const impactOrder = ["critical", "serious", "moderate", "minor"];
                    const groupOrder = ["Content", "Code", "Design"];
                    const groupColors = { Content: "#2563eb", Code: "#7c3aed", Design: "#d97706" };
                    const byGroup = { Content: [], Code: [], Design: [] };

                    for (const issue of p.issues) {
                        const grp = this.#getIssueGroup(issue.ruleId);
                        (byGroup[grp] || byGroup.Code).push(issue);
                    }

                    for (const groupName of groupOrder) {
                        const items = byGroup[groupName];
                        if (items.length === 0) continue;

                        items.sort((a, b) => (impactOrder.indexOf(a.impact) ?? 4) - (impactOrder.indexOf(b.impact) ?? 4));

                        bodyHtml += `
                            <h3 style="color:${groupColors[groupName]};margin:12px 0 6px;">${groupName} Issues (${items.length})</h3>
                            <table class="report-table report-issues-table">
                                <thead>
                                    <tr>
                                        <th style="width:70px">Impact</th>
                                        <th style="width:60px">WCAG</th>
                                        <th>Description</th>
                                        <th style="width:35%">Element &amp; Context</th>
                                        <th>Recommendation</th>
                                    </tr>
                                </thead>
                                <tbody>
                        `;

                        for (const issue of items) {
                            const elementHtml = this.#buildElementPreview(issue);
                            bodyHtml += `
                                <tr>
                                    <td><span class="report-badge-${esc(issue.impact)}">${esc(issue.impact)}</span></td>
                                    <td>${issue.wcagCriterion ? `<code>${esc(issue.wcagCriterion)}</code>` : ""}</td>
                                    <td>${esc(issue.description)}</td>
                                    <td class="report-element-cell">${elementHtml}</td>
                                    <td class="report-recommendation">${esc(issue.recommendation)}</td>
                                </tr>
                            `;
                        }

                        bodyHtml += `</tbody></table>`;
                    }

                    bodyHtml += `</div>`;
                }

                // Screenshots are now inline in issue tables via issue.screenshot
            }

            // Write content into the already-open window
            this.#populateReportWindow(win, bodyHtml);

        } catch (err) {
            if (win && !win.closed) {
                const errDiv = win.document.getElementById("report-loading");
                if (errDiv) {
                    errDiv.innerHTML = `<p style="color:#dc2626;font-size:1.1em;">Failed to load report: ${this.#escapeHtml(err.message)}</p>`;
                }
            }
            this.#notificationContext?.peek("danger", {
                data: { headline: "Report failed", message: err.message },
            });
        }
    }

    /** Build element preview HTML for a single issue */
    #buildElementPreview(issue) {
        const esc = (s) => this.#escapeHtml(s);
        let html = "";

        // Selector
        if (issue.selector) {
            html += `<div class="report-selector"><code>${esc(issue.selector)}</code></div>`;
        }

        // Color contrast swatch
        if (issue.ruleId === "color-contrast" || issue.ruleId === "enhanced-contrast" ||
            issue.ruleId === "visual-color-contrast" || issue.ruleId === "visual-color-contrast-enhanced") {
            const ratioMatch = issue.description?.match(/([\d.]+):1/);
            const ratio = ratioMatch ? ratioMatch[1] : null;

            // Screenshot thumbnail (click to expand)
            if (issue.screenshot && issue.screenshotStatus === "ok") {
                html += `<div class="report-screenshot-container">
                    <img class="report-screenshot-thumb" src="${issue.screenshot}" alt="Contrast preview"
                         onclick="this.classList.toggle('report-screenshot-expanded')" title="Click to expand">
                </div>`;
            } else if (issue.screenshotStatus === "unavailable" || issue.screenshotStatus === "capped") {
                html += `<div class="report-screenshot-fallback">${issue.screenshotStatus === "capped" ? "Screenshot limit reached" : (issue.screenshotError || "Screenshot unavailable")}</div>`;
            }

            // Use fgColor/bgColor from visual checks if available
            let fg = null, bg = null;
            if (issue.fgColor && issue.bgColor) {
                fg = this.#rgbToHex(issue.fgColor);
                bg = this.#rgbToHex(issue.bgColor);
            } else {
                const colors = this.#extractColorsFromElement(issue.element || "");
                fg = colors.fg;
                bg = colors.bg;
            }

            if (fg && bg) {
                html += `
                    <div class="report-contrast-preview">
                        <span class="report-swatch" style="background:${bg};color:${fg};">Aa</span>
                        <div class="report-contrast-info">
                            <span>FG: <code>${esc(fg)}</code></span>
                            <span>BG: <code>${esc(bg)}</code></span>
                            ${ratio ? `<span>Ratio: <strong>${ratio}:1</strong></span>` : ""}
                        </div>
                    </div>
                `;
                return html;
            }
        }

        // Image preview
        if ((issue.ruleId === "image-alt-text" || issue.category === "Images") && issue.element) {
            const srcMatch = issue.element.match(/src=["']([^"']+)["']/i);
            if (srcMatch) {
                const src = srcMatch[1];
                html += `<img class="report-element-img" src="${esc(src)}" alt="Element preview" onerror="this.style.display='none'">`;
            }
        }

        // HTML snippet
        if (issue.element) {
            html += `<pre class="report-code">${esc(issue.element)}</pre>`;
        }

        return html || `<span class="report-no-element">No element captured</span>`;
    }

    /** Extract fg/bg colors from an inline style string in an element HTML snippet */
    #extractColorsFromElement(elementHtml) {
        const styleMatch = elementHtml.match(/style=["']([^"']+)["']/i);
        if (!styleMatch) return {};
        const style = styleMatch[1];
        const fgMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
        return {
            fg: fgMatch ? fgMatch[1].trim() : null,
            bg: bgMatch ? bgMatch[1].trim() : null
        };
    }

    // --- Sparkline ---

    #renderSparkline(container, dataPoints, { width = 200, height = 40 } = {}) {
        if (!dataPoints || dataPoints.length < 2) {
            container.innerHTML = "";
            return;
        }

        const padding = 4;
        const w = width - padding * 2;
        const h = height - padding * 2;
        const n = dataPoints.length;

        const xStep = w / (n - 1);
        const points = dataPoints.map((d, i) => ({
            x: padding + i * xStep,
            y: padding + h - (d.score / 100) * h,
            score: d.score,
            date: d.date,
        }));

        const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

        // Trend color: compare last to first
        const first = dataPoints[0].score;
        const last = dataPoints[dataPoints.length - 1].score;
        const color = last > first + 5 ? "#16a34a" : last < first - 5 ? "#dc2626" : "#6b7280";

        const dots = points.map(p => {
            const dotColor = p.score >= 90 ? "#16a34a" : p.score >= 70 ? "#d97706" : "#dc2626";
            return `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${dotColor}" stroke="white" stroke-width="1">
                <title>${p.score}/100 — ${new Date(p.date).toLocaleDateString()}</title>
            </circle>`;
        }).join("");

        container.innerHTML = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="a11y-sparkline">
                <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                ${dots}
            </svg>
        `;
    }

    // --- Print Report ---

    /** Open a report popup immediately with a loading spinner */
    #openReportWindow(title) {
        const win = window.open("", "_blank");
        if (!win) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Popup blocked", message: "Please allow popups for this site to view the report." },
            });
            return null;
        }
        win.document.write(`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${this.#escapeHtml(title)}</title>
            <style>${this.#getReportStyles()}</style>
        </head>
        <body>
            <div id="report-loading" class="report-loading-state">
                <div class="report-loading-spinner"></div>
                <p>Building report...</p>
                <p class="report-loading-sub">Preparing issue details, charts, and element previews</p>
            </div>
            <div id="report-content" style="display:none;"></div>
        </body>
        </html>`);
        win.document.close();
        return win;
    }

    /** Replace loading spinner with actual report content */
    #populateReportWindow(win, bodyHtml) {
        if (!win || win.closed) return;
        const loading = win.document.getElementById("report-loading");
        const content = win.document.getElementById("report-content");
        if (loading) loading.style.display = "none";
        if (content) {
            content.innerHTML = `
                <div class="report-actions">
                    <button onclick="window.print()">Print Report</button>
                </div>
                ${bodyHtml}
                <div class="report-footer">
                    Generated by Accessibility Toolkit &mdash; digitalwonderlab.com
                </div>
            `;
            content.style.display = "block";
        }
    }

    #openPrintReport(bodyHtml, title) {
        const win = window.open("", "_blank");
        if (!win) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Popup blocked", message: "Please allow popups for this site to view the report." },
            });
            return null;
        }
        win.document.write(`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${this.#escapeHtml(title)}</title>
            <style>${this.#getReportStyles()}</style>
        </head>
        <body>
            <div class="report-actions">
                <button onclick="window.print()">Print Report</button>
            </div>
            ${bodyHtml}
            <div class="report-footer">
                Generated by Accessibility Toolkit &mdash; digitalwonderlab.com
            </div>
        </body>
        </html>`);
        win.document.close();
        return win;
    }

    #getReportStyles() {
        return `
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px; color: #1f2937; line-height: 1.5; }
            h1 { font-size: 1.8em; margin: 0 0 8px 0; }
            h2 { font-size: 1.3em; margin: 24px 0 12px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
            h3 { font-size: 1.1em; margin: 16px 0 8px 0; color: #374151; }
            a { color: #2563eb; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .report-actions { text-align: right; margin-bottom: 20px; }
            .report-actions button { padding: 8px 20px; border: 1px solid #2563eb; border-radius: 6px; background: #2563eb; color: white; font-size: 0.9em; font-weight: 600; cursor: pointer; }
            .report-actions button:hover { background: #1d4ed8; }
            .report-meta { display: flex; gap: 20px; color: #666; font-size: 0.9em; margin-top: 4px; }
            .report-summary { display: flex; gap: 20px; margin: 20px 0; }
            .report-stat { display: flex; flex-direction: column; align-items: center; padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; min-width: 140px; }
            .report-stat-value { font-size: 2em; font-weight: 800; color: #1f2937; }
            .report-stat-label { font-size: 0.8em; color: #888; margin-top: 4px; }
            .report-score-good { background: #f0fdf4; color: #16a34a; padding: 2px 10px; border-radius: 4px; font-weight: 700; }
            .report-score-ok { background: #fffbeb; color: #d97706; padding: 2px 10px; border-radius: 4px; font-weight: 700; }
            .report-score-poor { background: #fef2f2; color: #dc2626; padding: 2px 10px; border-radius: 4px; font-weight: 700; }
            .report-impact-row { display: flex; gap: 10px; margin: 12px 0; flex-wrap: wrap; }
            .report-services-cta { margin: 14px 0 18px; padding: 10px 12px; border-radius: 8px; border: 1px solid #dbeafe; background: #eff6ff; display: flex; gap: 8px; flex-direction: column; }
            .report-services-cta strong { color: #1e3a8a; }
            .report-services-cta span { color: #1f2937; font-size: 0.92em; }
            .report-services-cta a { font-weight: 600; }
            .report-table { width: 100%; border-collapse: collapse; font-size: 0.82em; margin-bottom: 20px; }
            .report-table th { background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left; padding: 8px 6px; font-weight: 700; text-transform: uppercase; font-size: 0.8em; }
            .report-table td { padding: 8px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
            .report-table tbody tr:nth-child(even) { background: #fafafa; }
            .report-center { text-align: center; }
            .report-recommendation { font-size: 0.92em; color: #4b5563; }
            .report-badge-critical { background: #fef2f2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }
            .report-badge-serious { background: #fff7ed; color: #9a3412; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }
            .report-badge-moderate { background: #fffbeb; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }
            .report-badge-minor { background: #f0fdf4; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }

            /* Category chart */
            .report-category-chart { margin-bottom: 20px; }
            .report-cat-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
            .report-cat-label { width: 120px; font-size: 0.85em; font-weight: 600; text-align: right; flex-shrink: 0; }
            .report-cat-bar-bg { flex: 1; height: 18px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
            .report-cat-bar { height: 100%; background: #3b82f6; border-radius: 4px; transition: width 0.3s; }
            .report-cat-count { width: 40px; font-size: 0.85em; font-weight: 700; color: #374151; }

            /* Per-page sections */
            .report-page-section { page-break-before: always; margin-top: 30px; }
            .report-page-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; color: #666; font-size: 0.85em; }
            .report-page-url { word-break: break-all; }

            /* Element preview */
            .report-element-cell { max-width: 350px; }
            .report-selector { margin-bottom: 4px; }
            .report-selector code { font-size: 0.8em; color: #6b21a8; background: #f5f3ff; }
            .report-code { background: #f8f8f8; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; font-size: 0.78em; line-height: 1.4; overflow-x: auto; max-height: 120px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin: 4px 0; font-family: "SF Mono", Consolas, "Liberation Mono", Menlo, monospace; }
            .report-no-element { color: #9ca3af; font-size: 0.85em; font-style: italic; }

            /* Contrast swatches */
            .report-contrast-preview { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
            .report-swatch { display: inline-block; width: 60px; height: 36px; border-radius: 4px; text-align: center; line-height: 36px; font-weight: bold; font-size: 16px; border: 1px solid #d1d5db; flex-shrink: 0; }
            .report-contrast-info { display: flex; flex-direction: column; gap: 1px; font-size: 0.8em; }
            .report-contrast-info code { font-size: 0.9em; }

            /* Image preview */
            .report-element-img { max-width: 120px; max-height: 80px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 4px; display: block; }

            /* Screenshot thumbnails */
            .report-screenshot-container { margin: 4px 0; }
            .report-screenshot-thumb { max-width: 200px; max-height: 60px; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; transition: max-width 0.2s, max-height 0.2s; }
            .report-screenshot-thumb.report-screenshot-expanded { max-width: 400px; max-height: 120px; }
            .report-screenshot-fallback { font-size: 0.75em; color: #9ca3af; font-style: italic; margin: 2px 0; }

            .report-group-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
            .report-group-content { background: #eff6ff; color: #1d4ed8; }
            .report-group-code { background: #f5f3ff; color: #6d28d9; }
            .report-group-design { background: #fffbeb; color: #b45309; }

            .report-issues-table { page-break-inside: auto; }
            .report-issues-table tr { page-break-inside: avoid; }
            .report-footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 12px; }
            code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 0.85em; word-break: break-all; }

            /* Loading state */
            .report-loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; color: #6b7280; }
            .report-loading-state p { margin: 12px 0 0; font-size: 1.1em; font-weight: 600; }
            .report-loading-sub { font-size: 0.85em !important; font-weight: 400 !important; color: #9ca3af; }
            .report-loading-spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: report-spin 0.8s linear infinite; }
            @keyframes report-spin { to { transform: rotate(360deg); } }

            @media print {
                .report-actions { display: none !important; }
                body { padding: 0; margin: 0; }
                .report-page-section { page-break-before: always; }
                .report-footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #999; }
            }
        `;
    }

    // --- Visual Checks for Audits ---

    static #MAX_SCREENSHOTS_PER_PAGE = 20;

    #visualChecksEnabled = null;

    async #checkVisualEnabled() {
        if (this.#visualChecksEnabled !== null) return this.#visualChecksEnabled;
        try {
            const resp = await fetch("/umbraco/AccessibilityToolkit/Accessibility/GetFeatures");
            if (!resp.ok) { this.#visualChecksEnabled = false; return false; }
            const data = await resp.json();
            this.#visualChecksEnabled = data.visualChecks === true;
        } catch {
            this.#visualChecksEnabled = false;
        }
        return this.#visualChecksEnabled;
    }

    async #runVisualChecksOnPage(url) {
        return new Promise((resolve) => {
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:1280px;height:900px;border:none;opacity:0;pointer-events:none;";
            iframe.setAttribute("sandbox", "allow-same-origin");

            const timeout = setTimeout(() => { iframe.remove(); resolve([]); }, 15000);

            iframe.addEventListener("load", async () => {
                clearTimeout(timeout);
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!doc || !doc.body) { iframe.remove(); resolve([]); return; }
                    const issues = this.#analyzeContrastInDocument(doc);
                    iframe.remove();
                    resolve(issues);
                } catch {
                    iframe.remove();
                    resolve([]);
                }
            });

            iframe.addEventListener("error", () => { clearTimeout(timeout); iframe.remove(); resolve([]); });
            iframe.src = url;
            document.body.appendChild(iframe);
        });
    }

    async #trackVisualCheckFailure(errorCode) {
        try {
            await fetch("/umbraco/AccessibilityToolkit/Accessibility/TrackVisualCheckFailure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ errorCode }),
            });
        } catch {
            // Never block audits on telemetry transport failures.
        }
    }

    #classifyVisualCheckError(error) {
        if (!error) return "visual_check_failed";
        const text = String(error.message || error).toLowerCase();
        if (text.includes("timed out")) return "visual_check_timeout";
        if (text.includes("security")) return "visual_check_security_error";
        return "visual_check_failed";
    }

    #analyzeContrastInDocument(doc) {
        const issues = [];
        const win = doc.defaultView || window;
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
        let screenshotCount = 0;

        while (walker.nextNode()) {
            const el = walker.currentNode;
            if (!this.#hasDirectText(el)) continue;

            const style = win.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;

            const fgColor = this.#parseRgba(style.color);
            if (!fgColor) continue;

            const bgColor = this.#getEffectiveBackground(el, win);
            const ratio = this.#contrastRatio(fgColor, bgColor);
            const fontSize = parseFloat(style.fontSize);
            const fontWeight = parseInt(style.fontWeight, 10) || 400;
            const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
            const requiredRatio = isLargeText ? 3.0 : 4.5;

            if (ratio < requiredRatio) {
                const impact = ratio < 2.0 ? "critical" : ratio < 3.0 ? "serious" : "moderate";
                const issue = {
                    ruleId: "visual-color-contrast",
                    description: `Text has insufficient contrast ratio ${ratio.toFixed(2)}:1 (requires ${requiredRatio}:1 for ${isLargeText ? "large" : "normal"} text)`,
                    category: "Color",
                    level: "AA",
                    wcagCriterion: "1.4.3",
                    impact,
                    element: this.#truncateHtml(el),
                    selector: this.#buildCssSelector(el),
                    recommendation: `Increase contrast ratio to at least ${requiredRatio}:1. Current foreground: ${this.#rgbToHex(fgColor)}, background: ${this.#rgbToHex(bgColor)}.`,
                    wcagUrl: "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html",
                    fgColor: { r: fgColor.r, g: fgColor.g, b: fgColor.b },
                    bgColor: { r: bgColor.r, g: bgColor.g, b: bgColor.b },
                    contrastRatio: ratio,
                    source: "visual"
                };

                // Capture screenshot for top issues (cap at limit)
                if (screenshotCount < AccessibilityToolkitDashboard.#MAX_SCREENSHOTS_PER_PAGE) {
                    const shot = this.#captureElementScreenshot(el, win, fgColor, bgColor, style);
                    if (shot) {
                        issue.screenshot = shot;
                        issue.screenshotStatus = "ok";
                        screenshotCount++;
                    } else {
                        issue.screenshotStatus = "unavailable";
                        issue.screenshotError = "Canvas capture failed";
                    }
                } else {
                    issue.screenshotStatus = "capped";
                }

                issues.push(issue);
            }
        }
        return issues;
    }

    /** Capture a synthetic screenshot of an element showing text with its fg/bg colors */
    #captureElementScreenshot(el, win, fgColor, bgColor, style) {
        try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const maxW = 400, maxH = 120;
            canvas.width = maxW;
            canvas.height = maxH;

            // Draw background
            ctx.fillStyle = `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`;
            ctx.fillRect(0, 0, maxW, maxH);

            // Draw text using computed styles
            const fontSize = Math.min(Math.max(parseFloat(style.fontSize) || 16, 12), 48);
            const fontWeight = style.fontWeight || "400";
            const fontFamily = style.fontFamily || "sans-serif";

            ctx.fillStyle = `rgb(${fgColor.r},${fgColor.g},${fgColor.b})`;
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.textBaseline = "middle";

            const text = (el.textContent || "").trim().substring(0, 80) || "Sample text";
            const words = text.split(/\s+/);
            let line = "";
            let y = fontSize + 8;
            const lineHeight = fontSize * 1.3;
            const maxLines = Math.floor((maxH - 16) / lineHeight);
            let lineCount = 0;

            for (const word of words) {
                const testLine = line ? `${line} ${word}` : word;
                if (ctx.measureText(testLine).width > maxW - 24 && line) {
                    ctx.fillText(line, 12, y);
                    line = word;
                    y += lineHeight;
                    lineCount++;
                    if (lineCount >= maxLines) break;
                } else {
                    line = testLine;
                }
            }
            if (line && lineCount < maxLines) {
                ctx.fillText(line, 12, y);
            }

            return canvas.toDataURL("image/jpeg", 0.7);
        } catch {
            return null;
        }
    }

    #hasDirectText(el) {
        for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) return true;
        }
        return false;
    }

    #parseRgba(str) {
        if (!str) return null;
        const match = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
        if (!match) return null;
        return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a: match[4] !== undefined ? parseFloat(match[4]) : 1 };
    }

    #getEffectiveBackground(el, win) {
        const layers = [];
        let current = el;
        while (current && current !== el.ownerDocument.documentElement) {
            const style = win.getComputedStyle(current);
            const bg = this.#parseRgba(style.backgroundColor);
            if (bg && bg.a > 0) layers.push(bg);
            current = current.parentElement;
        }
        let result = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = layers.length - 1; i >= 0; i--) result = this.#alphaComposite(layers[i], result);
        return result;
    }

    #alphaComposite(fg, bg) {
        const a = fg.a + bg.a * (1 - fg.a);
        if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
        return {
            r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
            g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
            b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
            a,
        };
    }

    #srgbToLinear(c) {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }

    #relativeLuminance(color) {
        return 0.2126 * this.#srgbToLinear(color.r) + 0.7152 * this.#srgbToLinear(color.g) + 0.0722 * this.#srgbToLinear(color.b);
    }

    #contrastRatio(fg, bg) {
        const l1 = this.#relativeLuminance(fg);
        const l2 = this.#relativeLuminance(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    #buildCssSelector(el) {
        if (el.id) return `#${el.id}`;
        const parts = [];
        let current = el;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();
            if (current.id) { parts.unshift(`#${current.id}`); break; }
            if (current.className && typeof current.className === "string") {
                const classes = current.className.trim().split(/\s+/).slice(0, 2).join(".");
                if (classes) selector += `.${classes}`;
            }
            parts.unshift(selector);
            current = current.parentElement;
        }
        return parts.join(" > ");
    }

    #truncateHtml(el) {
        const html = el.outerHTML || "";
        return html.length > 200 ? html.substring(0, 200) + "..." : html;
    }

    #rgbToHex(color) {
        const hex = (v) => v.toString(16).padStart(2, "0");
        return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
    }

    #mergeVisualIssuesIntoResult(pageResult, visualIssues) {
        if (!visualIssues || visualIssues.length === 0) return;
        pageResult.issues = [...(pageResult.issues || []), ...visualIssues];
        pageResult.totalIssues = pageResult.issues.length;
        pageResult.criticalCount = pageResult.issues.filter(i => i.impact === "critical").length;
        pageResult.seriousCount = pageResult.issues.filter(i => i.impact === "serious").length;
        pageResult.moderateCount = pageResult.issues.filter(i => i.impact === "moderate").length;
        pageResult.minorCount = pageResult.issues.filter(i => i.impact === "minor").length;
        const totalDeduction = visualIssues.reduce((sum, i) => {
            const weights = { critical: 5, serious: 3, moderate: 2, minor: 1 };
            return sum + (weights[i.impact] || 1);
        }, 0);
        pageResult.score = Math.max(0, pageResult.score - totalDeduction);
    }

    // --- Helpers ---

    #truncateUrl(url, maxLen) {
        if (!url) return "";
        if (url.length <= maxLen) return url;
        return url.substring(0, maxLen - 3) + "...";
    }

    #escapeHtml(str) {
        if (str == null) return "";
        const div = document.createElement("div");
        div.textContent = String(str);
        return div.innerHTML;
    }
}

customElements.define("accessibility-toolkit-dashboard", AccessibilityToolkitDashboard);
