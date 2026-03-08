import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";

export default class AccessibilityToolkitView extends UmbElementMixin(HTMLElement) {
    #notificationContext;
    #workspaceContext;
    #nodeKey = null;
    #result = null;
    #loading = false;
    #level = "AA";
    #pageHistory = [];
    #visualChecksEnabled = false;

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.#render();
        this.#loadStyles();
        this.#initContexts();
    }

    #initContexts() {
        this.consumeContext(UMB_NOTIFICATION_CONTEXT, (instance) => {
            this.#notificationContext = instance;
        });

        this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, (context) => {
            this.#workspaceContext = context;
            this.observe(context.unique, (unique) => {
                this.#nodeKey = unique;
                // Load page history once we know the node key
                if (this.#nodeKey) {
                    this.#loadPageHistory();
                }
            });
        });

        this.#loadFeatures();
    }

    #loadStyles() {
        const link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", "/App_Plugins/AccessibilityToolkit/accessibility-toolkit-style.css");
        this.shadowRoot.appendChild(link);
    }

    async #loadFeatures() {
        try {
            const response = await fetch("/umbraco/AccessibilityToolkit/Accessibility/GetFeatures");
            if (!response.ok) return;
            const data = await response.json();
            this.#visualChecksEnabled = data.visualChecks === true;
        } catch {
            // Silently ignore — defaults to locked
        }
    }

    #render() {
        const container = document.createElement("div");
        container.classList.add("a11y-wrapper");
        container.innerHTML = `
            <uui-box class="a11y-header-box">
                <div class="a11y-header">
                    <div class="a11y-header-text">
                        <h2>Accessibility Check</h2>
                        <p>Run WCAG accessibility checks against the published version of this page.</p>
                    </div>
                    <div class="a11y-controls">
                        <div class="a11y-control-group">
                            <label for="a11y-level-select">WCAG Level</label>
                            <select id="a11y-level-select">
                                <option value="A">Level A</option>
                                <option value="AA" selected>Level AA</option>
                                <option value="AAA">Level AAA</option>
                            </select>
                        </div>
                        <uui-button label="Run Check" id="a11y-run-btn" look="primary" color="positive"></uui-button>
                    </div>
                </div>
            </uui-box>

            <div id="a11y-loading" class="a11y-loading" style="display:none;">
                <span class="a11y-spinner"></span> <span class="a11y-loading-text">Analysing page accessibility...</span>
            </div>

            <div id="a11y-error" class="a11y-error" style="display:none;"></div>

            <div id="a11y-results" style="display:none;">
                <uui-box class="a11y-score-box">
                    <div class="a11y-score-section">
                        <div class="a11y-gauge-container">
                            <div id="a11y-gauge" class="a11y-gauge">
                                <span id="a11y-score-value" class="a11y-score-value">0</span>
                            </div>
                            <div id="a11y-score-label" class="a11y-score-label">Score</div>
                        </div>
                        <div class="a11y-impact-summary">
                            <div class="a11y-impact-badge a11y-impact-critical">
                                <span id="a11y-count-critical">0</span> Critical
                            </div>
                            <div class="a11y-impact-badge a11y-impact-serious">
                                <span id="a11y-count-serious">0</span> Serious
                            </div>
                            <div class="a11y-impact-badge a11y-impact-moderate">
                                <span id="a11y-count-moderate">0</span> Moderate
                            </div>
                            <div class="a11y-impact-badge a11y-impact-minor">
                                <span id="a11y-count-minor">0</span> Minor
                            </div>
                        </div>
                        <div class="a11y-meta">
                            <span id="a11y-checks-run">0 checks run</span>
                            &middot;
                            <span id="a11y-url"></span>
                        </div>
                    </div>
                </uui-box>

                <uui-box class="a11y-issues-box">
                    <div class="a11y-issues-header">
                        <h3 id="a11y-issues-title">Issues</h3>
                        <div class="a11y-issues-actions">
                            <select id="a11y-filter-category">
                                <option value="">All Categories</option>
                            </select>
                            <uui-button label="Print Report" id="a11y-report-btn" look="secondary"></uui-button>
                            <uui-button label="Export CSV" id="a11y-export-btn" look="secondary"></uui-button>
                        </div>
                    </div>

                    <div id="a11y-no-issues" class="a11y-no-issues" style="display:none;">
                        No accessibility issues found. Great work!
                    </div>

                    <div class="a11y-table-wrapper">
                        <table class="a11y-table" id="a11y-issues-table" style="display:none;">
                            <thead>
                                <tr>
                                    <th class="a11y-th-sortable" data-sort="impact">Impact</th>
                                    <th class="a11y-th-sortable" data-sort="category">Category</th>
                                    <th>Description</th>
                                    <th>WCAG</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="a11y-issues-body"></tbody>
                        </table>
                    </div>
                </uui-box>
            </div>

            <uui-box id="a11y-page-history-box" class="a11y-page-history-box" style="display:none;">
                <div class="a11y-dashboard-section-header">
                    <h3>Scan History</h3>
                </div>
                <div id="a11y-page-sparkline-container" class="a11y-sparkline-container" style="display:none;">
                    <div id="a11y-page-sparkline" class="a11y-sparkline-chart"></div>
                    <div id="a11y-page-sparkline-labels" class="a11y-sparkline-labels"></div>
                </div>
                <div id="a11y-page-history-empty" class="a11y-dashboard-empty" style="display:none;">
                    No scan history for this page yet.
                </div>
                <div class="a11y-table-wrapper">
                    <table class="a11y-table" id="a11y-page-history-table" style="display:none;">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Score</th>
                                <th>Level</th>
                                <th>Issues</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="a11y-page-history-tbody"></tbody>
                    </table>
                </div>
            </uui-box>

            <div class="a11y-copy">Created with care by <a href="https://digitalwonderlab.com" target="_blank">Digital Wonderlab</a></div>
        `;

        this.shadowRoot.appendChild(container);

        requestAnimationFrame(() => this.#bindEvents());
    }

    #bindEvents() {
        const runBtn = this.shadowRoot.getElementById("a11y-run-btn");
        const levelSelect = this.shadowRoot.getElementById("a11y-level-select");
        const exportBtn = this.shadowRoot.getElementById("a11y-export-btn");
        const filterCategory = this.shadowRoot.getElementById("a11y-filter-category");

        const reportBtn = this.shadowRoot.getElementById("a11y-report-btn");

        runBtn?.addEventListener("click", () => this.#runCheck());
        levelSelect?.addEventListener("change", (e) => { this.#level = e.target.value; });
        exportBtn?.addEventListener("click", () => this.#exportCsv());
        reportBtn?.addEventListener("click", () => this.#openPageReport());
        filterCategory?.addEventListener("change", () => this.#renderIssuesTable());

        this.shadowRoot.querySelectorAll(".a11y-th-sortable").forEach((th) => {
            th.addEventListener("click", () => this.#sortBy(th.dataset.sort));
        });
    }

    async #runCheck() {
        if (!this.#nodeKey) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "No content", message: "Could not determine the current content node." },
            });
            return;
        }

        this.#showLoading(true, "Analysing HTML...");
        this.#hideError();
        this.shadowRoot.getElementById("a11y-results").style.display = "none";

        try {
            const response = await fetch(
                `/umbraco/AccessibilityToolkit/Accessibility/Check?nodeKey=${this.#nodeKey}&level=${this.#level}`
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            this.#result = await response.json();

            // Run visual checks if enabled
            if (this.#visualChecksEnabled && this.#result.url) {
                this.#showLoading(true, "Running visual checks...");
                try {
                    const visualIssues = await this.#runVisualChecksOnPage(this.#result.url);
                    if (visualIssues.length > 0) {
                        this.#mergeVisualIssues(visualIssues);
                    }
                } catch (vErr) {
                    console.warn("Visual checks failed, continuing with HTML results only", vErr);
                }
            }

            this.#showLoading(true, "Complete");
            this.#renderResults();

            this.#notificationContext?.peek("positive", {
                data: {
                    headline: "Check complete",
                    message: `Score: ${this.#result.score}/100 with ${this.#result.totalIssues} issue(s) found.`,
                },
            });

            // Refresh page history after a successful check
            this.#loadPageHistory();
        } catch (error) {
            console.error("Accessibility check failed", error);
            this.#showError(error.message);
            this.#notificationContext?.peek("danger", {
                data: { headline: "Check failed", message: error.message },
            });
        } finally {
            this.#showLoading(false);
        }
    }

    /** Run visual contrast checks via iframe */
    async #runVisualChecksOnPage(url) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:1280px;height:900px;border:none;opacity:0;pointer-events:none;";
            iframe.setAttribute("sandbox", "allow-same-origin");

            const timeout = setTimeout(() => {
                iframe.remove();
                reject(new Error("Visual check timed out after 15 seconds."));
            }, 15000);

            iframe.addEventListener("load", async () => {
                clearTimeout(timeout);
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!doc || !doc.body) {
                        iframe.remove();
                        resolve([]);
                        return;
                    }

                    const issues = this.#analyzeContrastInDocument(doc);
                    iframe.remove();
                    resolve(issues);
                } catch (err) {
                    iframe.remove();
                    if (err.name === "SecurityError") {
                        resolve([]);
                    } else {
                        reject(err);
                    }
                }
            });

            iframe.addEventListener("error", () => {
                clearTimeout(timeout);
                iframe.remove();
                resolve([]);
            });

            iframe.src = url;
            document.body.appendChild(iframe);
        });
    }

    /** Merge visual issues into the main result */
    #mergeVisualIssues(visualIssues) {
        const result = this.#result;
        if (!result) return;

        for (const vi of visualIssues) {
            vi.source = "visual";
            result.issues.push(vi);
        }

        // Recalculate counts
        result.totalIssues = result.issues.length;
        result.criticalCount = result.issues.filter(i => i.impact === "critical").length;
        result.seriousCount = result.issues.filter(i => i.impact === "serious").length;
        result.moderateCount = result.issues.filter(i => i.impact === "moderate").length;
        result.minorCount = result.issues.filter(i => i.impact === "minor").length;

        // Update categorySummary
        for (const vi of visualIssues) {
            const cat = vi.category || "Color";
            result.categorySummary[cat] = (result.categorySummary[cat] || 0) + 1;
        }

        // Recalculate score (deduct points for visual issues)
        const totalDeduction = visualIssues.reduce((sum, i) => {
            const weights = { critical: 5, serious: 3, moderate: 2, minor: 1 };
            return sum + (weights[i.impact] || 1);
        }, 0);
        result.score = Math.max(0, result.score - totalDeduction);
    }

    // --- Page History ---

    async #loadPageHistory() {
        if (!this.#nodeKey) return;

        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/GetHistory?nodeKey=${this.#nodeKey}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.#pageHistory = await response.json();
            this.#renderPageHistory();
        } catch (err) {
            console.error("Failed to load page history", err);
        }
    }

    #renderPageHistory() {
        const box = this.shadowRoot.getElementById("a11y-page-history-box");
        const table = this.shadowRoot.getElementById("a11y-page-history-table");
        const tbody = this.shadowRoot.getElementById("a11y-page-history-tbody");
        const empty = this.shadowRoot.getElementById("a11y-page-history-empty");

        box.style.display = "block";
        tbody.innerHTML = "";

        if (this.#pageHistory.length === 0) {
            table.style.display = "none";
            empty.style.display = "block";
            const sparkContainer = this.shadowRoot.getElementById("a11y-page-sparkline-container");
            if (sparkContainer) sparkContainer.style.display = "none";
            return;
        }

        table.style.display = "";
        empty.style.display = "none";

        // Render sparkline
        this.#renderPageSparkline();

        for (const entry of this.#pageHistory) {
            const tr = document.createElement("tr");
            const scoreClass = entry.overallScore >= 90 ? "a11y-score-good"
                : entry.overallScore >= 70 ? "a11y-score-ok"
                : "a11y-score-poor";

            const dateStr = new Date(entry.scannedAt).toLocaleString();

            tr.innerHTML = `
                <td class="a11y-dashboard-date">${dateStr}</td>
                <td><span class="a11y-dashboard-score ${scoreClass}">${entry.overallScore}</span></td>
                <td>${this.#escapeHtml(entry.wcagLevel)}</td>
                <td>${entry.totalIssues}</td>
                <td>
                    <button class="a11y-history-view-btn" data-id="${entry.id}" title="View Report">Report</button>
                    <button class="a11y-dashboard-delete-btn" data-id="${entry.id}" title="Delete">&times;</button>
                </td>
            `;

            const viewBtn = tr.querySelector(".a11y-history-view-btn");
            viewBtn?.addEventListener("click", () => this.#viewHistoryReport(entry.id, entry.wcagLevel));

            const deleteBtn = tr.querySelector(".a11y-dashboard-delete-btn");
            deleteBtn?.addEventListener("click", () => this.#deleteHistoryEntry(entry.id));

            tbody.appendChild(tr);
        }
    }

    async #deleteHistoryEntry(id) {
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/DeleteHistory?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.#pageHistory = this.#pageHistory.filter(r => r.id !== id);
            this.#renderPageHistory();
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Delete failed", message: err.message },
            });
        }
    }

    async #viewHistoryReport(id, wcagLevel) {
        try {
            const response = await fetch(`/umbraco/AccessibilityToolkit/Accessibility/ExportResult?id=${id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const savedResult = JSON.parse(data.resultJson);

            // Temporarily swap result and level, open report, then restore
            const prevResult = this.#result;
            const prevLevel = this.#level;
            this.#result = savedResult;
            this.#level = wcagLevel || "AA";
            this.#openPageReport();
            this.#result = prevResult;
            this.#level = prevLevel;
        } catch (err) {
            this.#notificationContext?.peek("danger", {
                data: { headline: "Report failed", message: err.message },
            });
        }
    }

    // --- Results rendering ---

    #renderResults() {
        const result = this.#result;
        if (!result) return;

        const resultsDiv = this.shadowRoot.getElementById("a11y-results");
        resultsDiv.style.display = "block";

        const score = result.score;
        const gauge = this.shadowRoot.getElementById("a11y-gauge");
        const scoreValue = this.shadowRoot.getElementById("a11y-score-value");
        const scoreLabel = this.shadowRoot.getElementById("a11y-score-label");

        scoreValue.textContent = score;
        gauge.className = "a11y-gauge";
        if (score >= 90) {
            gauge.classList.add("a11y-gauge-green");
            scoreLabel.textContent = "Excellent";
        } else if (score >= 70) {
            gauge.classList.add("a11y-gauge-orange");
            scoreLabel.textContent = "Needs Improvement";
        } else {
            gauge.classList.add("a11y-gauge-red");
            scoreLabel.textContent = "Poor";
        }

        this.shadowRoot.getElementById("a11y-count-critical").textContent = result.criticalCount;
        this.shadowRoot.getElementById("a11y-count-serious").textContent = result.seriousCount;
        this.shadowRoot.getElementById("a11y-count-moderate").textContent = result.moderateCount;
        this.shadowRoot.getElementById("a11y-count-minor").textContent = result.minorCount;

        this.shadowRoot.getElementById("a11y-checks-run").textContent = `${result.totalChecks} checks run`;
        this.shadowRoot.getElementById("a11y-url").textContent = result.url;

        const filterCategory = this.shadowRoot.getElementById("a11y-filter-category");
        filterCategory.innerHTML = '<option value="">All Categories</option>';
        if (result.categorySummary) {
            Object.keys(result.categorySummary).sort().forEach((cat) => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = `${cat} (${result.categorySummary[cat]})`;
                filterCategory.appendChild(opt);
            });
        }

        this.#renderIssuesTable();
    }

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
        return AccessibilityToolkitView.#ISSUE_GROUP_MAP[ruleId] || "Code";
    }

    #groupIssues(issues) {
        const groups = new Map();
        for (const issue of issues) {
            const key = `${issue.ruleId}|||${issue.description}`;
            if (!groups.has(key)) {
                groups.set(key, { ...issue, instances: [issue], count: 1 });
            } else {
                const group = groups.get(key);
                group.instances.push(issue);
                group.count++;
            }
        }
        return [...groups.values()];
    }

    #renderIssuesTable() {
        const result = this.#result;
        if (!result) return;

        const tbody = this.shadowRoot.getElementById("a11y-issues-body");
        const table = this.shadowRoot.getElementById("a11y-issues-table");
        const noIssues = this.shadowRoot.getElementById("a11y-no-issues");
        const filterCategory = this.shadowRoot.getElementById("a11y-filter-category");
        const titleEl = this.shadowRoot.getElementById("a11y-issues-title");

        const filterValue = filterCategory.value;
        let issues = result.issues || [];
        if (filterValue) {
            issues = issues.filter((i) => i.category === filterValue);
        }

        const totalCount = issues.length;
        const grouped = this.#groupIssues(issues);

        titleEl.textContent = `Issues (${totalCount}${grouped.length !== totalCount ? ` in ${grouped.length} groups` : ""})`;
        tbody.innerHTML = "";

        if (totalCount === 0) {
            table.style.display = "none";
            noIssues.style.display = "block";
            return;
        }

        table.style.display = "";
        noIssues.style.display = "none";

        // Split into Content / Code / Design groups
        const groupOrder = ["Content", "Code", "Design"];
        const byGroup = { Content: [], Code: [], Design: [] };
        for (const g of grouped) {
            const grp = this.#getIssueGroup(g.ruleId);
            (byGroup[grp] || byGroup.Code).push(g);
        }

        let idx = 0;
        for (const groupName of groupOrder) {
            const items = byGroup[groupName];
            if (items.length === 0) continue;

            // Group header row
            const headerTr = document.createElement("tr");
            headerTr.className = "a11y-group-header-row";
            const issueCount = items.reduce((s, g) => s + g.count, 0);
            headerTr.innerHTML = `<td colspan="5"><span class="a11y-group-icon a11y-group-icon-${groupName.toLowerCase()}"></span> <strong>${groupName}</strong> <span class="a11y-group-count">${issueCount} issue${issueCount === 1 ? "" : "s"}</span></td>`;
            tbody.appendChild(headerTr);

            for (const group of items) {
                const countBadge = group.count > 1
                    ? ` <span class="a11y-count-badge">${group.count}x</span>`
                    : "";

                const tr = document.createElement("tr");
                tr.classList.add("a11y-issue-row");
                tr.innerHTML = `
                    <td><span class="a11y-badge a11y-badge-${this.#escapeHtml(group.impact)}">${this.#escapeHtml(group.impact)}</span>${countBadge}</td>
                    <td>${this.#escapeHtml(group.category)}</td>
                    <td class="a11y-desc-cell">${this.#escapeHtml(group.description)}</td>
                    <td>${group.wcagUrl ? `<a href="${this.#escapeHtml(group.wcagUrl)}" target="_blank" rel="noopener" title="WCAG guidance" class="a11y-wcag-link"><code>${this.#escapeHtml(group.wcagCriterion)}</code></a>` : `<code>${this.#escapeHtml(group.wcagCriterion)}</code>`}</td>
                    <td><button class="a11y-expand-btn" data-idx="${idx}" title="Show details">&#9660;</button></td>
                `;

                const detailTr = document.createElement("tr");
                detailTr.classList.add("a11y-detail-row");
                detailTr.style.display = "none";

                let instancesHtml = "";
                if (group.count > 1) {
                    const maxShow = 5;
                    const shown = group.instances.slice(0, maxShow);
                    instancesHtml = `
                        <div class="a11y-detail-field">
                            <strong>Instances (${group.count}):</strong>
                            <div class="a11y-instances-list">
                                ${shown.map((inst, i) => `
                                    <div class="a11y-instance">
                                        <span class="a11y-instance-num">${i + 1}.</span>
                                        ${inst.element ? `<code>${this.#escapeHtml(inst.element)}</code>` : `<code>${this.#escapeHtml(inst.selector)}</code>`}
                                    </div>
                                `).join("")}
                                ${group.count > maxShow ? `<div class="a11y-instance-more">...and ${group.count - maxShow} more</div>` : ""}
                            </div>
                        </div>
                    `;
                } else {
                    instancesHtml = group.element
                        ? `<div class="a11y-detail-field"><strong>Element:</strong> <code>${this.#escapeHtml(group.element)}</code></div>`
                        : "";
                    instancesHtml += group.selector
                        ? `<div class="a11y-detail-field"><strong>Selector:</strong> <code>${this.#escapeHtml(group.selector)}</code></div>`
                        : "";
                }

                detailTr.innerHTML = `
                    <td colspan="5">
                        <div class="a11y-detail">
                            ${instancesHtml}
                            <div class="a11y-detail-field"><strong>Recommendation:</strong> ${this.#escapeHtml(group.recommendation)}</div>
                            <div class="a11y-detail-field"><strong>Rule:</strong> ${this.#escapeHtml(group.ruleId)} &middot; <strong>Level:</strong> ${this.#escapeHtml(group.level)} &middot; <strong>WCAG:</strong> ${group.wcagUrl ? `<a href="${this.#escapeHtml(group.wcagUrl)}" target="_blank" rel="noopener" class="a11y-wcag-link">${this.#escapeHtml(group.wcagCriterion)}</a>` : this.#escapeHtml(group.wcagCriterion)}</div>
                        </div>
                    </td>
                `;

                tbody.appendChild(tr);
                tbody.appendChild(detailTr);

                tr.querySelector(".a11y-expand-btn").addEventListener("click", () => {
                    const isVisible = detailTr.style.display !== "none";
                    detailTr.style.display = isVisible ? "none" : "";
                    tr.querySelector(".a11y-expand-btn").innerHTML = isVisible ? "&#9660;" : "&#9650;";
                });

                idx++;
            }
        }
    }

    #sortBy(field) {
        if (!this.#result || !this.#result.issues) return;

        const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };

        this.#result.issues.sort((a, b) => {
            if (field === "impact") {
                return (impactOrder[a.impact] ?? 4) - (impactOrder[b.impact] ?? 4);
            }
            if (field === "category") {
                return (a.category || "").localeCompare(b.category || "");
            }
            return 0;
        });

        this.#renderIssuesTable();
    }

    #exportCsv() {
        if (!this.#result || !this.#result.issues || this.#result.issues.length === 0) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "No data", message: "Run a check first to export results." },
            });
            return;
        }

        const pageUrl = this.#result.url || "";
        const headers = ["Page URL", "Impact", "Category", "Description", "WCAG Criterion", "Level", "Rule ID", "Element", "Selector", "Recommendation"];
        const rows = this.#result.issues.map((i) => [
            pageUrl,
            i.impact,
            i.category,
            i.description,
            i.wcagCriterion,
            i.level,
            i.ruleId,
            i.element,
            i.selector,
            i.recommendation,
        ]);

        const csvContent = [headers, ...rows]
            .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `accessibility-report-${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
        URL.revokeObjectURL(url);
    }

    // --- Visual contrast analysis ---

    #analyzeContrastInDocument(doc) {
        const issues = [];
        const win = doc.defaultView || window;
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);

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
            const aaaPassed = isLargeText ? ratio >= 4.5 : ratio >= 7.0;

            if (ratio < requiredRatio) {
                const impact = ratio < 2.0 ? "critical" : ratio < 3.0 ? "serious" : "moderate";
                issues.push({
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
                });
            } else if (!aaaPassed) {
                // AAA failure is minor info only
                issues.push({
                    ruleId: "visual-color-contrast-enhanced",
                    description: `Text meets AA but fails AAA enhanced contrast — ratio ${ratio.toFixed(2)}:1 (AAA requires ${isLargeText ? "4.5" : "7.0"}:1)`,
                    category: "Color",
                    level: "AAA",
                    wcagCriterion: "1.4.6",
                    impact: "minor",
                    element: this.#truncateHtml(el),
                    selector: this.#buildCssSelector(el),
                    recommendation: `For AAA compliance, increase contrast ratio to at least ${isLargeText ? "4.5" : "7.0"}:1.`,
                    wcagUrl: "https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html",
                    fgColor: { r: fgColor.r, g: fgColor.g, b: fgColor.b },
                    bgColor: { r: bgColor.r, g: bgColor.g, b: bgColor.b },
                    contrastRatio: ratio,
                });
            }
        }
        return issues;
    }

    #hasDirectText(el) {
        for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
                return true;
            }
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
            if (bg && bg.a > 0) {
                layers.push(bg);
            }
            current = current.parentElement;
        }

        // Start with white and composite from bottom (last) to top (first)
        let result = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = layers.length - 1; i >= 0; i--) {
            result = this.#alphaComposite(layers[i], result);
        }
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
        return 0.2126 * this.#srgbToLinear(color.r)
             + 0.7152 * this.#srgbToLinear(color.g)
             + 0.0722 * this.#srgbToLinear(color.b);
    }

    #contrastRatio(fg, bg) {
        const l1 = this.#relativeLuminance(fg);
        const l2 = this.#relativeLuminance(bg);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    #buildCssSelector(el) {
        if (el.id) return `#${el.id}`;
        const parts = [];
        let current = el;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                parts.unshift(`#${current.id}`);
                break;
            }
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

    // --- Sparkline ---

    #renderPageSparkline() {
        const container = this.shadowRoot.getElementById("a11y-page-sparkline");
        const labels = this.shadowRoot.getElementById("a11y-page-sparkline-labels");
        const wrapper = this.shadowRoot.getElementById("a11y-page-sparkline-container");

        if (!container || !labels || !wrapper) return;

        // Reverse so oldest is first
        const dataPoints = [...this.#pageHistory]
            .reverse()
            .map(e => ({ score: e.overallScore, date: e.scannedAt }));

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

    #openPageReport() {
        if (!this.#result || !this.#result.issues) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "No data", message: "Run a check first to generate a report." },
            });
            return;
        }

        const result = this.#result;
        const esc = (s) => this.#escapeHtml(s);
        const date = result.checkedAt ? new Date(result.checkedAt).toLocaleDateString() : new Date().toLocaleDateString();
        const scoreColor = result.score >= 90 ? "good" : result.score >= 70 ? "ok" : "poor";

        let bodyHtml = `
            <div class="report-header">
                <h1>Accessibility Report</h1>
                <div class="report-meta">
                    <span>Date: ${esc(date)}</span>
                    <span>WCAG Level: ${esc(this.#level)}</span>
                    <span>URL: ${esc(result.url)}</span>
                </div>
            </div>
        `;

        // Summary
        bodyHtml += `
            <div class="report-summary">
                <div class="report-stat">
                    <span class="report-stat-value report-score-${scoreColor}">${result.score}</span>
                    <span class="report-stat-label">Score</span>
                </div>
                <div class="report-stat">
                    <span class="report-stat-value">${result.totalIssues}</span>
                    <span class="report-stat-label">Total Issues</span>
                </div>
                <div class="report-stat">
                    <span class="report-stat-value">${result.totalChecks}</span>
                    <span class="report-stat-label">Checks Run</span>
                </div>
            </div>
        `;

        // Impact summary
        bodyHtml += `<div class="report-impact-row">`;
        if (result.criticalCount) bodyHtml += `<span class="report-badge-critical">${result.criticalCount} Critical</span>`;
        if (result.seriousCount) bodyHtml += `<span class="report-badge-serious">${result.seriousCount} Serious</span>`;
        if (result.moderateCount) bodyHtml += `<span class="report-badge-moderate">${result.moderateCount} Moderate</span>`;
        if (result.minorCount) bodyHtml += `<span class="report-badge-minor">${result.minorCount} Minor</span>`;
        bodyHtml += `</div>`;

        // Category distribution
        if (result.categorySummary && Object.keys(result.categorySummary).length > 0) {
            const sortedCats = Object.entries(result.categorySummary).sort((a, b) => b[1] - a[1]);
            const maxCat = sortedCats[0][1];
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
        }

        // Issues table — grouped by Content / Code / Design
        if (result.issues.length > 0) {
            const impactOrder = ["critical", "serious", "moderate", "minor"];
            const groupOrder = ["Content", "Code", "Design"];
            const groupColors = { Content: "#2563eb", Code: "#7c3aed", Design: "#d97706" };
            const byGroup = { Content: [], Code: [], Design: [] };

            for (const issue of result.issues) {
                const grp = this.#getIssueGroup(issue.ruleId);
                (byGroup[grp] || byGroup.Code).push(issue);
            }

            for (const groupName of groupOrder) {
                const items = byGroup[groupName];
                if (items.length === 0) continue;

                items.sort((a, b) => (impactOrder.indexOf(a.impact) ?? 4) - (impactOrder.indexOf(b.impact) ?? 4));

                bodyHtml += `
                    <h2 style="border-bottom-color:${groupColors[groupName]};">${groupName} Issues (${items.length})</h2>
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
                            ${items.map(i => {
                                const elementHtml = this.#buildElementPreview(i);
                                return `<tr>
                                    <td><span class="report-badge-${esc(i.impact)}">${esc(i.impact)}</span></td>
                                    <td>${i.wcagCriterion ? `<code>${esc(i.wcagCriterion)}</code>` : ""}</td>
                                    <td>${esc(i.description)}</td>
                                    <td class="report-element-cell">${elementHtml}</td>
                                    <td class="report-recommendation">${esc(i.recommendation)}</td>
                                </tr>`;
                            }).join("")}
                        </tbody>
                    </table>
                `;
            }
        } else {
            bodyHtml += `<p style="color:#16a34a;font-weight:600;text-align:center;padding:20px;">No accessibility issues found. Great work!</p>`;
        }

        this.#openPrintReport(bodyHtml, `Accessibility Report - ${result.url} - ${date}`);
    }

    /** Build element preview HTML for a single issue */
    #buildElementPreview(issue) {
        const esc = (s) => this.#escapeHtml(s);
        let html = "";

        if (issue.selector) {
            html += `<div class="report-selector"><code>${esc(issue.selector)}</code></div>`;
        }

        // Color contrast swatch (visual or server-side)
        if (issue.ruleId === "color-contrast" || issue.ruleId === "enhanced-contrast" ||
            issue.ruleId === "visual-color-contrast" || issue.ruleId === "visual-color-contrast-enhanced") {
            const ratioMatch = issue.description?.match(/([\d.]+):1/);
            const ratio = ratioMatch ? ratioMatch[1] : null;

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
                    </div>`;
                return html;
            }
        }

        // Image preview
        if ((issue.ruleId === "image-alt-text" || issue.category === "Images") && issue.element) {
            const srcMatch = issue.element.match(/src=["']([^"']+)["']/i);
            if (srcMatch) {
                html += `<img class="report-element-img" src="${esc(srcMatch[1])}" alt="Element preview" onerror="this.style.display='none'">`;
            }
        }

        if (issue.element) {
            html += `<pre class="report-code">${esc(issue.element)}</pre>`;
        }

        return html || `<span class="report-no-element">No element captured</span>`;
    }

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

    #openPrintReport(bodyHtml, title) {
        const win = window.open("", "_blank");
        if (!win) {
            this.#notificationContext?.peek("warning", {
                data: { headline: "Popup blocked", message: "Please allow popups for this site to view the report." },
            });
            return;
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
    }

    #getReportStyles() {
        return `
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px; color: #1f2937; line-height: 1.5; }
            h1 { font-size: 1.8em; margin: 0 0 8px 0; }
            h2 { font-size: 1.3em; margin: 24px 0 12px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
            .report-actions { text-align: right; margin-bottom: 20px; }
            .report-actions button { padding: 8px 20px; border: 1px solid #2563eb; border-radius: 6px; background: #2563eb; color: white; font-size: 0.9em; font-weight: 600; cursor: pointer; }
            .report-actions button:hover { background: #1d4ed8; }
            .report-meta { display: flex; gap: 20px; color: #666; font-size: 0.9em; margin-top: 4px; flex-wrap: wrap; }
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
            .report-recommendation { font-size: 0.92em; color: #4b5563; }
            .report-badge-critical { background: #fef2f2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }
            .report-badge-serious { background: #fff7ed; color: #9a3412; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }
            .report-badge-moderate { background: #fffbeb; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }
            .report-badge-minor { background: #f0fdf4; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; white-space: nowrap; }
            .report-category-chart { margin-bottom: 20px; }
            .report-cat-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
            .report-cat-label { width: 120px; font-size: 0.85em; font-weight: 600; text-align: right; flex-shrink: 0; }
            .report-cat-bar-bg { flex: 1; height: 18px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
            .report-cat-bar { height: 100%; background: #3b82f6; border-radius: 4px; }
            .report-cat-count { width: 40px; font-size: 0.85em; font-weight: 700; color: #374151; }
            .report-element-cell { max-width: 350px; }
            .report-selector { margin-bottom: 4px; }
            .report-selector code { font-size: 0.8em; color: #6b21a8; background: #f5f3ff; }
            .report-code { background: #f8f8f8; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; font-size: 0.78em; line-height: 1.4; overflow-x: auto; max-height: 120px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin: 4px 0; font-family: "SF Mono", Consolas, "Liberation Mono", Menlo, monospace; }
            .report-no-element { color: #9ca3af; font-size: 0.85em; font-style: italic; }
            .report-contrast-preview { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
            .report-swatch { display: inline-block; width: 60px; height: 36px; border-radius: 4px; text-align: center; line-height: 36px; font-weight: bold; font-size: 16px; border: 1px solid #d1d5db; flex-shrink: 0; }
            .report-contrast-info { display: flex; flex-direction: column; gap: 1px; font-size: 0.8em; }
            .report-contrast-info code { font-size: 0.9em; }
            .report-element-img { max-width: 120px; max-height: 80px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 4px; display: block; }
            .report-issues-table { page-break-inside: auto; }
            .report-issues-table tr { page-break-inside: avoid; }
            .report-footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 12px; }
            code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 0.85em; word-break: break-all; }
            @media print {
                .report-actions { display: none !important; }
                body { padding: 0; margin: 0; }
                .report-footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #999; }
            }
        `;
    }

    #showLoading(show, text) {
        const el = this.shadowRoot.getElementById("a11y-loading");
        el.style.display = show ? "flex" : "none";
        if (text) {
            const textSpan = el.querySelector(".a11y-loading-text");
            if (textSpan) textSpan.textContent = text;
        }
    }

    #showError(message) {
        const el = this.shadowRoot.getElementById("a11y-error");
        el.textContent = message;
        el.style.display = "block";
    }

    #hideError() {
        this.shadowRoot.getElementById("a11y-error").style.display = "none";
    }

    #escapeHtml(str) {
        if (str == null) return "";
        const div = document.createElement("div");
        div.textContent = String(str);
        return div.innerHTML;
    }
}

customElements.define("accessibility-toolkit-view", AccessibilityToolkitView);
