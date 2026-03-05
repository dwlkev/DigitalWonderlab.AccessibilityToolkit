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
                this.#loadAuditHistory();
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
            const response = await fetch("/umbraco/api/accessibilitytoolkit/history/recent?count=100");
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
            const response = await fetch(`/umbraco/api/accessibilitytoolkit/history/${id}`, { method: "DELETE" });
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
            const response = await fetch("/umbraco/api/accessibilitytoolkit/audit/recent?count=20");
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

        for (const audit of this.#auditHistory) {
            const tr = document.createElement("tr");
            const dateStr = new Date(audit.scannedAt).toLocaleString();
            const scoreClass = audit.averageScore >= 90 ? "a11y-score-good"
                : audit.averageScore >= 70 ? "a11y-score-ok"
                : "a11y-score-poor";
            const editLink = `/umbraco/section/content/workspace/document/edit/${audit.rootNodeKey}`;
            const shortKey = String(audit.rootNodeKey).substring(0, 8) + "...";

            tr.innerHTML = `
                <td class="a11y-dashboard-date">${dateStr}</td>
                <td><a href="${editLink}" class="a11y-page-link" title="${this.#escapeHtml(audit.rootNodeKey)}">${this.#escapeHtml(shortKey)}</a></td>
                <td>${this.#escapeHtml(audit.wcagLevel)}</td>
                <td>${audit.totalPages}</td>
                <td><span class="a11y-dashboard-score ${scoreClass}">${audit.averageScore}</span></td>
                <td>${audit.totalIssues}</td>
                <td class="a11y-audit-history-actions">
                    <button class="a11y-audit-history-export-btn" data-id="${audit.id}" title="Export CSV">Export</button>
                    <button class="a11y-dashboard-delete-btn" data-id="${audit.id}" title="Delete">&times;</button>
                </td>
            `;

            const exportBtn = tr.querySelector(".a11y-audit-history-export-btn");
            exportBtn?.addEventListener("click", () => this.#exportAuditFromHistory(audit.id));

            const deleteBtn = tr.querySelector(".a11y-dashboard-delete-btn");
            deleteBtn?.addEventListener("click", () => this.#deleteAudit(audit.id));

            tbody.appendChild(tr);
        }
    }

    async #exportAuditFromHistory(id) {
        try {
            const response = await fetch(`/umbraco/api/accessibilitytoolkit/audit/${id}/export`);
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
            const response = await fetch(`/umbraco/api/accessibilitytoolkit/audit/${id}`, { method: "DELETE" });
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
            const count = this.#lastAuditData?.pages?.length || 0;
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
        const resultsDiv = this.shadowRoot.getElementById("a11y-audit-results");

        // Use picker selection first, fall back to manual input
        const nodeKey = this.#selectedNodeKey || nodeKeyInput?.value?.trim();
        if (!nodeKey) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Missing input", message: "Pick a content node or enter a node key to audit." },
            });
            return;
        }

        loading.style.display = "flex";
        resultsDiv.style.display = "none";

        try {
            const level = levelSelect?.value || "AA";
            const response = await fetch(
                `/umbraco/api/accessibilitytoolkit/audit/${encodeURIComponent(nodeKey)}?level=${level}`,
                { method: "POST" }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            this.#lastAuditData = data;
            this.#pagesExpanded = false;
            this.#renderAuditResults(data);

            this.#notificationContext?.peek("positive", {
                data: {
                    headline: "Audit complete",
                    message: `Scanned ${data.summary.totalPages} page(s) with an average score of ${data.summary.averageScore}.`,
                },
            });

            this.#loadRecentReports();
            this.#loadAuditHistory();
        } catch (err) {
            console.error("Audit failed", err);
            this.#notificationContext?.peek("danger", {
                data: { headline: "Audit failed", message: err.message },
            });
        } finally {
            loading.style.display = "none";
        }
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

        const headers = ["Page URL", "Score", "Issues", "Node Key"];
        const rows = data.pages.map((p) => [
            p.url,
            p.score === -1 ? "Error" : p.score,
            p.totalIssues === -1 ? "N/A" : p.totalIssues,
            p.nodeKey || "",
        ]);

        const csvContent = [headers, ...rows]
            .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `accessibility-audit-${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
        URL.revokeObjectURL(url);
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
