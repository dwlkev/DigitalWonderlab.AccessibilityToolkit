import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/modal";
import { UMB_DOCUMENT_PICKER_MODAL } from "@umbraco-cms/backoffice/document";

export default class AccessibilityToolkitDashboard extends UmbElementMixin(HTMLElement) {
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
            this.#loadLicenceStatus();
        }
    }

    // --- Licence Status ---

    async #loadLicenceStatus() {
        const container = this.shadowRoot.getElementById("a11y-licence-status");
        if (!container) return;

        try {
            const response = await fetch("/umbraco/AccessibilityToolkit/Accessibility/GetFeatures");
            if (!response.ok) return;
            const data = await response.json();

            if (data.visualChecks === true) {
                container.innerHTML = `
                    <div class="a11y-licence-active">
                        <span class="a11y-licence-badge a11y-licence-pro">PRO</span>
                        <div>
                            <strong>Licence Active</strong>
                            <p>Visual checks and premium features are enabled.</p>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="a11y-licence-inactive">
                        <span class="a11y-licence-badge a11y-licence-free">FREE</span>
                        <div>
                            <strong>Community Edition</strong>
                            <p>Place your licence file at <code>umbraco/Licenses/DigitalWonderlab.AccessibilityToolkit.lic</code> to enable PRO features.</p>
                        </div>
                    </div>
                `;
            }
        } catch {
            container.innerHTML = `<p class="a11y-settings-desc">Could not load licence status.</p>`;
        }
    }

    // --- Settings ---

    async #loadSettings() {
        const loading = this.shadowRoot.getElementById("a11y-settings-loading");
        const body = this.shadowRoot.getElementById("a11y-settings-body");
        loading.style.display = "flex";
        body.style.display = "none";

        try {
            const [exclusionsResp, docTypesResp] = await Promise.all([
                fetch("/umbraco/AccessibilityToolkit/Accessibility/GetExclusions"),
                fetch("/umbraco/AccessibilityToolkit/Accessibility/GetDocumentTypes"),
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

            this.#settingsLoaded = true;
            this.#renderDocTypeList();
            this.#renderExcludedPagesList();
        } catch (err) {
            console.error("Failed to load settings", err);
        } finally {
            loading.style.display = "none";
            body.style.display = "block";
        }
    }

    #renderDocTypeList() {
        const container = this.shadowRoot.getElementById("a11y-doctype-list");
        container.innerHTML = "";

        if (this.#allDocumentTypes.length === 0) {
            container.innerHTML = `<p class="a11y-settings-desc">No document types found.</p>`;
            return;
        }

        for (const dt of this.#allDocumentTypes) {
            const checkbox = document.createElement("uui-checkbox");
            checkbox.setAttribute("label", `${dt.name} (${dt.alias})`);
            checkbox.checked = this.#excludedDocTypes.includes(dt.alias);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    if (!this.#excludedDocTypes.includes(dt.alias)) {
                        this.#excludedDocTypes.push(dt.alias);
                    }
                } else {
                    this.#excludedDocTypes = this.#excludedDocTypes.filter(a => a !== dt.alias);
                }
            });

            container.appendChild(checkbox);
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
            const resp = await fetch("/umbraco/AccessibilityToolkit/Accessibility/SaveExclusions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    excludedDocumentTypes: this.#excludedDocTypes,
                    excludedNodeKeys: this.#excludedNodeKeys.map(n => n.key),
                }),
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            savedLabel.style.display = "inline";
            setTimeout(() => { savedLabel.style.display = "none"; }, 2000);

            this.#notificationContext?.peek("positive", {
                data: { headline: "Settings saved", message: "Audit exclusion settings have been saved." },
            });
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Save failed", message: err.message },
            });
        }
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
                data: { headline: "Not ready", message: "Modal manager not available. Paste a GUID instead." },
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

                // Clear the fallback input since picker was used
                const input = this.shadowRoot.getElementById("a11y-audit-nodekey");
                if (input) input.value = "";
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
                <td><span class="a11y-dashboard-score ${scoreClass}">${entry.overallScore}</span></td>
                <td>${this.#escapeHtml(entry.wcagLevel)}</td>
                <td>${entry.totalIssues}</td>
                <td class="a11y-dashboard-date">${dateStr}</td>
                <td><button class="a11y-dashboard-delete-btn" data-id="${entry.id}" title="Delete">&times;</button></td>
            `;

            const deleteBtn = tr.querySelector(".a11y-dashboard-delete-btn");
            deleteBtn?.addEventListener("click", () => this.#deleteEntry(entry.id));

            tbody.appendChild(tr);
        }

        this.#renderPagination();
    }

    async #deleteEntry(id) {
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
            const sparkContainer = this.shadowRoot.getElementById("a11y-audit-sparkline-container");
            if (sparkContainer) sparkContainer.style.display = "none";
            return;
        }

        table.style.display = "";
        empty.style.display = "none";

        // Render sparkline
        this.#renderAuditSparkline();

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
                <td>${this.#escapeHtml(audit.wcagLevel)}</td>
                <td>${audit.totalPages}</td>
                <td><span class="a11y-dashboard-score ${scoreClass}">${audit.averageScore}</span></td>
                <td>${audit.totalIssues}</td>
                <td class="a11y-audit-history-actions">
                    <button class="a11y-audit-history-report-btn" data-id="${audit.id}" title="Print Report">Report</button>
                    <button class="a11y-audit-history-export-btn" data-id="${audit.id}" title="Export CSV">CSV</button>
                    <button class="a11y-dashboard-delete-btn" data-id="${audit.id}" title="Delete">&times;</button>
                </td>
            `;

            const reportBtn = tr.querySelector(".a11y-audit-history-report-btn");
            reportBtn?.addEventListener("click", () => this.#openAuditReport(audit.id));

            const exportBtn = tr.querySelector(".a11y-audit-history-export-btn");
            exportBtn?.addEventListener("click", () => this.#exportAuditFromHistory(audit.id));

            const deleteBtn = tr.querySelector(".a11y-dashboard-delete-btn");
            deleteBtn?.addEventListener("click", () => this.#deleteAudit(audit.id));

            tbody.appendChild(tr);
        }
    }

    #renderAuditSparkline() {
        const container = this.shadowRoot.getElementById("a11y-audit-sparkline");
        const labels = this.shadowRoot.getElementById("a11y-audit-sparkline-labels");
        const wrapper = this.shadowRoot.getElementById("a11y-audit-sparkline-container");

        if (!container || !labels || !wrapper) return;

        // Reverse so oldest is first
        const dataPoints = [...this.#auditHistory]
            .reverse()
            .map(a => ({ score: a.averageScore, date: a.scannedAt }));

        if (dataPoints.length < 2) {
            wrapper.style.display = "none";
            return;
        }

        wrapper.style.display = "flex";
        this.#renderSparkline(container, dataPoints, { width: 300, height: 50 });

        const scores = dataPoints.map(d => d.score);
        const current = scores[scores.length - 1];
        const best = Math.max(...scores);
        const worst = Math.min(...scores);
        labels.innerHTML = `
            <span><strong>Current:</strong> ${current}</span>
            <span><strong>Best:</strong> ${best}</span>
            <span><strong>Worst:</strong> ${worst}</span>
        `;
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
        const nodeKeyInput = this.shadowRoot.getElementById("a11y-audit-nodekey");
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

        // Use picker selection first, fall back to manual input
        const nodeKey = this.#selectedNodeKey || nodeKeyInput?.value?.trim();
        if (!nodeKey) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Missing input", message: "Pick a content node or enter a node key to audit." },
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
                        `/umbraco/AccessibilityToolkit/Accessibility/Check?nodeKey=${encodeURIComponent(page.nodeKey)}&level=${level}`
                    );

                    if (!checkResp.ok) {
                        const err = await checkResp.json().catch(() => ({ error: checkResp.statusText }));
                        this.#appendProgressLog(progressLog, page.name, null, null, err.error || `HTTP ${checkResp.status}`);
                        results.push({ nodeKey: page.nodeKey, url: page.url, score: -1, totalIssues: -1 });
                        continue;
                    }

                    const result = await checkResp.json();
                    results.push({
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
                    });
                    totalScore += result.score;
                    totalIssues += result.totalIssues;
                    scannedCount++;
                    this.#appendProgressLog(progressLog, page.name, result.score, result.totalIssues, null);
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

            await fetch("/umbraco/AccessibilityToolkit/Accessibility/SaveAudit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rootNodeKey: nodeKey,
                    wcagLevel: level,
                    totalPages: scannedCount,
                    averageScore,
                    totalIssues,
                    resultJson: JSON.stringify(auditData)
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

        summary.innerHTML = `
            <div class="a11y-dashboard-audit-stats">
                <div class="a11y-dashboard-stat">
                    <span class="a11y-dashboard-stat-value">${data.summary.totalPages}</span>
                    <span class="a11y-dashboard-stat-label">Pages Scanned</span>
                </div>
                <div class="a11y-dashboard-stat">
                    <span class="a11y-dashboard-stat-value">${data.summary.averageScore}</span>
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
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/ExportAudit?id=${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            const data = JSON.parse(result.resultJson);

            const audit = this.#auditHistory.find(a => a.id === id);
            const date = audit ? new Date(audit.scannedAt).toLocaleDateString() : new Date().toLocaleDateString();
            const level = audit?.wcagLevel || "AA";
            const rootName = audit?.rootNodeName || "Site";

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

                    // Group issues by impact for this page
                    const impactOrder = ["critical", "serious", "moderate", "minor"];
                    const sortedIssues = [...p.issues].sort((a, b) => {
                        return (impactOrder.indexOf(a.impact) ?? 4) - (impactOrder.indexOf(b.impact) ?? 4);
                    });

                    bodyHtml += `
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

                    for (const issue of sortedIssues) {
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

                    bodyHtml += `</tbody></table></div>`;
                }

                // --- Screenshot capture section ---
                bodyHtml += `
                    <div class="report-screenshot-section" id="screenshot-section">
                        <h2>Visual Context</h2>
                        <p class="report-screenshot-desc">Capture visual screenshots of flagged elements directly from the live pages. Screenshots are embedded as images in the report — nothing is saved externally.</p>
                        <button id="capture-screenshots-btn" class="report-capture-btn">Capture Element Screenshots</button>
                        <div id="capture-progress" style="display:none;">
                            <div class="report-capture-progress-bar"><div id="capture-fill" class="report-capture-fill"></div></div>
                            <span id="capture-status">Starting...</span>
                        </div>
                        <div id="screenshot-results"></div>
                    </div>
                `;
            }

            const reportWin = this.#openPrintReport(bodyHtml, `Accessibility Audit Report - ${rootName} - ${date}`);

            // Wire up screenshot capture in the popup
            if (reportWin && hasIssueDetail) {
                this.#initScreenshotCapture(reportWin, sortedPages);
            }

        } catch (err) {
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
        if (issue.ruleId === "color-contrast" || issue.ruleId === "enhanced-contrast") {
            const ratioMatch = issue.description?.match(/([\d.]+):1/);
            const ratio = ratioMatch ? ratioMatch[1] : null;
            const colors = this.#extractColorsFromElement(issue.element || "");
            if (colors.fg && colors.bg) {
                html += `
                    <div class="report-contrast-preview">
                        <span class="report-swatch" style="background:${colors.bg};color:${colors.fg};">Aa</span>
                        <div class="report-contrast-info">
                            <span>FG: <code>${esc(colors.fg)}</code></span>
                            <span>BG: <code>${esc(colors.bg)}</code></span>
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

    /** Initialize screenshot capture in the report popup window */
    #initScreenshotCapture(win, pages) {
        const btn = win.document.getElementById("capture-screenshots-btn");
        if (!btn) return;

        btn.addEventListener("click", async () => {
            btn.disabled = true;
            btn.textContent = "Capturing...";
            const progressDiv = win.document.getElementById("capture-progress");
            const fillBar = win.document.getElementById("capture-fill");
            const statusSpan = win.document.getElementById("capture-status");
            const resultsDiv = win.document.getElementById("screenshot-results");
            progressDiv.style.display = "block";

            // Load html2canvas from CDN
            try {
                await new Promise((resolve, reject) => {
                    const script = win.document.createElement("script");
                    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
                    script.onload = resolve;
                    script.onerror = () => reject(new Error("Failed to load html2canvas"));
                    win.document.head.appendChild(script);
                });
            } catch {
                statusSpan.textContent = "Failed to load screenshot library. Check internet connection.";
                btn.disabled = false;
                btn.textContent = "Retry";
                return;
            }

            const pagesWithIssues = pages.filter(p => p.issues && p.issues.length > 0 && p.score >= 0);
            let captured = 0;
            let totalCaptures = 0;

            for (let pi = 0; pi < pagesWithIssues.length; pi++) {
                const page = pagesWithIssues[pi];
                const pct = Math.round(((pi + 1) / pagesWithIssues.length) * 100);
                fillBar.style.width = `${pct}%`;
                statusSpan.textContent = `Page ${pi + 1}/${pagesWithIssues.length}: ${page.name || page.url}`;

                // Create hidden iframe
                const iframe = win.document.createElement("iframe");
                iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1280px;height:900px;border:none;";
                win.document.body.appendChild(iframe);

                try {
                    await new Promise((resolve, reject) => {
                        iframe.onload = resolve;
                        iframe.onerror = reject;
                        iframe.src = page.url;
                        setTimeout(reject, 15000); // 15s timeout
                    });

                    // Wait a bit for rendering
                    await new Promise(r => setTimeout(r, 1000));

                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!iframeDoc) { iframe.remove(); continue; }

                    // Capture up to 5 unique selectors per page
                    const selectors = [...new Set(page.issues.map(i => i.selector).filter(Boolean))].slice(0, 5);
                    let pageHtml = "";

                    for (const selector of selectors) {
                        try {
                            const el = iframeDoc.querySelector(selector);
                            if (!el) continue;

                            el.scrollIntoView({ block: "center" });
                            await new Promise(r => setTimeout(r, 200));

                            // Highlight the element
                            const oldOutline = el.style.outline;
                            const oldOutlineOffset = el.style.outlineOffset;
                            el.style.outline = "3px solid #dc2626";
                            el.style.outlineOffset = "2px";

                            const canvas = await win.html2canvas(el, {
                                scale: 1,
                                useCORS: true,
                                allowTaint: true,
                                width: Math.min(el.scrollWidth + 20, 600),
                                height: Math.min(el.scrollHeight + 20, 300),
                                logging: false
                            });

                            el.style.outline = oldOutline;
                            el.style.outlineOffset = oldOutlineOffset;

                            const dataUrl = canvas.toDataURL("image/png");
                            const matchingIssue = page.issues.find(i => i.selector === selector);
                            pageHtml += `
                                <div class="report-screenshot-item">
                                    <div class="report-screenshot-meta">
                                        <code>${this.#escapeHtml(selector)}</code>
                                        ${matchingIssue ? `<span class="report-badge-${this.#escapeHtml(matchingIssue.impact)}">${this.#escapeHtml(matchingIssue.impact)}</span>` : ""}
                                        <span>${this.#escapeHtml(matchingIssue?.description || "")}</span>
                                    </div>
                                    <img src="${dataUrl}" class="report-screenshot-img" alt="Screenshot of ${this.#escapeHtml(selector)}">
                                </div>
                            `;
                            captured++;
                            totalCaptures++;
                        } catch { /* skip this element */ }
                    }

                    if (pageHtml) {
                        resultsDiv.innerHTML += `
                            <div class="report-screenshot-page">
                                <h3>${this.#escapeHtml(page.name || page.url)}</h3>
                                ${pageHtml}
                            </div>
                        `;
                    }
                } catch { /* skip this page */ }

                iframe.remove();
            }

            statusSpan.textContent = `Done! Captured ${totalCaptures} element screenshot${totalCaptures === 1 ? "" : 's'} across ${pagesWithIssues.length} page${pagesWithIssues.length === 1 ? '' : 's'}.`;
            btn.style.display = "none";
        });
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

            /* Screenshot capture */
            .report-screenshot-section { margin-top: 30px; page-break-before: always; }
            .report-screenshot-desc { color: #6b7280; font-size: 0.9em; margin-bottom: 12px; }
            .report-capture-btn { padding: 10px 24px; border: 1px solid #2563eb; border-radius: 6px; background: #2563eb; color: white; font-size: 0.9em; font-weight: 600; cursor: pointer; }
            .report-capture-btn:hover { background: #1d4ed8; }
            .report-capture-btn:disabled { background: #9ca3af; border-color: #9ca3af; cursor: wait; }
            .report-capture-progress-bar { height: 6px; background: #e5e7eb; border-radius: 3px; margin: 12px 0 6px; overflow: hidden; }
            .report-capture-fill { height: 100%; background: #2563eb; border-radius: 3px; width: 0; transition: width 0.3s; }
            .report-screenshot-page { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
            .report-screenshot-item { margin: 10px 0; padding: 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
            .report-screenshot-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.85em; flex-wrap: wrap; }
            .report-screenshot-img { max-width: 100%; border: 1px solid #d1d5db; border-radius: 4px; }

            .report-issues-table { page-break-inside: auto; }
            .report-issues-table tr { page-break-inside: avoid; }
            .report-footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 12px; }
            code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 0.85em; word-break: break-all; }
            @media print {
                .report-actions, .report-screenshot-section { display: none !important; }
                .report-capture-btn { display: none !important; }
                body { padding: 0; margin: 0; }
                .report-page-section { page-break-before: always; }
                .report-footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #999; }
            }
        `;
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
