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
            });
        });
    }

    #loadStyles() {
        const link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", "/App_Plugins/AccessibilityToolkit/accessibility-toolkit-style.css");
        this.shadowRoot.appendChild(link);
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
                <span class="a11y-spinner"></span> Analysing page accessibility...
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

            <div class="a11y-copy">Created with care by <a href="https://digitalwonderlab.com" target="_blank">Digital Wonderlab</a></div>
        `;

        this.shadowRoot.appendChild(container);

        // Bind events after DOM is in shadowRoot
        requestAnimationFrame(() => this.#bindEvents());
    }

    #bindEvents() {
        const runBtn = this.shadowRoot.getElementById("a11y-run-btn");
        const levelSelect = this.shadowRoot.getElementById("a11y-level-select");
        const exportBtn = this.shadowRoot.getElementById("a11y-export-btn");
        const filterCategory = this.shadowRoot.getElementById("a11y-filter-category");

        runBtn?.addEventListener("click", () => this.#runCheck());
        levelSelect?.addEventListener("change", (e) => { this.#level = e.target.value; });
        exportBtn?.addEventListener("click", () => this.#exportCsv());
        filterCategory?.addEventListener("change", () => this.#renderIssuesTable());

        // Sortable headers
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

        this.#showLoading(true);
        this.#hideError();
        this.shadowRoot.getElementById("a11y-results").style.display = "none";

        try {
            const response = await fetch(
                `/umbraco/api/accessibilitytoolkit/check/${this.#nodeKey}?level=${this.#level}`
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            this.#result = await response.json();
            this.#renderResults();

            this.#notificationContext?.peek("positive", {
                data: {
                    headline: "Check complete",
                    message: `Score: ${this.#result.score}/100 with ${this.#result.totalIssues} issue(s) found.`,
                },
            });
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

    #renderResults() {
        const result = this.#result;
        if (!result) return;

        const resultsDiv = this.shadowRoot.getElementById("a11y-results");
        resultsDiv.style.display = "block";

        // Score gauge
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

        // Impact counts
        this.shadowRoot.getElementById("a11y-count-critical").textContent = result.criticalCount;
        this.shadowRoot.getElementById("a11y-count-serious").textContent = result.seriousCount;
        this.shadowRoot.getElementById("a11y-count-moderate").textContent = result.moderateCount;
        this.shadowRoot.getElementById("a11y-count-minor").textContent = result.minorCount;

        // Meta
        this.shadowRoot.getElementById("a11y-checks-run").textContent = `${result.totalChecks} checks run`;
        this.shadowRoot.getElementById("a11y-url").textContent = result.url;

        // Populate category filter
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

        grouped.forEach((group, idx) => {
            const countBadge = group.count > 1
                ? ` <span class="a11y-count-badge">${group.count}x</span>`
                : "";

            const tr = document.createElement("tr");
            tr.classList.add("a11y-issue-row");
            tr.innerHTML = `
                <td><span class="a11y-badge a11y-badge-${this.#escapeHtml(group.impact)}">${this.#escapeHtml(group.impact)}</span>${countBadge}</td>
                <td>${this.#escapeHtml(group.category)}</td>
                <td class="a11y-desc-cell">${this.#escapeHtml(group.description)}</td>
                <td><code>${this.#escapeHtml(group.wcagCriterion)}</code></td>
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
                        <div class="a11y-detail-field"><strong>Rule:</strong> ${this.#escapeHtml(group.ruleId)} &middot; <strong>Level:</strong> ${this.#escapeHtml(group.level)} &middot; <strong>WCAG:</strong> ${this.#escapeHtml(group.wcagCriterion)}</div>
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
        });
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

    #showLoading(show) {
        this.shadowRoot.getElementById("a11y-loading").style.display = show ? "flex" : "none";
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
