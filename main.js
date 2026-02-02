"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NoteBundlerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  bundles: [],
  lastRun: null,
  defaultOutputPath: "",
  autoExportEnabled: false,
  filters: [],
  autoExportFrequencyMinutes: 60,
  silentMode: false
};
var NoteBundlerPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.autoExportIntervalId = null;
  }
  async onload() {
    console.log("Note Bundler: loading");
    await this.loadSettings();
    this.migrateFilterStructure();
    await this.updateAutoExportSchedule();
    this.addSettingTab(new NoteBundlerSettingTab(this.app, this));
    this.addCommand({
      id: "open-settings",
      name: "Open Note Bundler settings",
      callback: () => {
        const settings = this.app.setting;
        settings.open();
        settings.openTabById(this.manifest.id);
      }
    });
  }
  onunload() {
    this.clearAutoExportSchedule();
    console.log("Note Bundler: unloaded");
  }
  async loadSettings() {
    const data = await this.loadData();
    const deviceId = this.getDeviceId();
    const deviceData = data[deviceId] || data;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, deviceData);
  }
  async saveSettings() {
    const currentData = await this.loadData() || {};
    const deviceId = this.getDeviceId();
    currentData[deviceId] = this.settings;
    await this.saveData(currentData);
  }
  getDeviceId() {
    const platform = import_obsidian.Platform.isMobile ? "mobile" : "desktop";
    const userAgent = navigator.userAgent || "";
    const timestamp = this.app.vault.adapter.basePath || "";
    const deviceString = `${platform}-${userAgent}-${timestamp}`;
    return btoa(deviceString).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  }
  clearAutoExportSchedule() {
    if (this.autoExportIntervalId !== null) {
      window.clearInterval(this.autoExportIntervalId);
      this.autoExportIntervalId = null;
    }
  }
  async updateAutoExportSchedule() {
    this.clearAutoExportSchedule();
    if (!this.settings.autoExportEnabled) {
      return;
    }
    const intervalMs = Math.max(1, this.settings.autoExportFrequencyMinutes) * 60 * 1e3;
    const lastRun = this.settings.lastRun ? Date.parse(this.settings.lastRun) : null;
    if (!lastRun || Number.isNaN(lastRun) || Date.now() - lastRun >= intervalMs) {
      await this.exportAllFilters();
    }
    this.autoExportIntervalId = window.setInterval(() => {
      void this.exportAllFilters();
    }, intervalMs);
  }
  async exportAllBundles() {
    new import_obsidian.Notice("Note Bundler: export not yet implemented");
  }
  sanitizeFilename(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "filter";
  }
  matchesFilter(filePath, filter) {
    if (filter.rules.length === 0) {
      return false;
    }
    const fileName = filePath.split("/").pop() || "";
    if (fileName.startsWith("note-bundler-export-") && fileName.endsWith(".md")) {
      return false;
    }
    const cache = this.app.metadataCache.getCache(filePath);
    const frontmatterTags = cache?.frontmatter?.tags;
    const frontmatterList = Array.isArray(frontmatterTags) ? frontmatterTags : typeof frontmatterTags === "string" ? frontmatterTags.split(/[\s,]+/).filter(Boolean) : [];
    const tagValues = [
      ...(cache?.tags ?? []).map((tag) => tag.tag),
      ...frontmatterList.map((tag) => tag.startsWith("#") ? tag : `#${tag}`)
    ];
    const normalizedTags = tagValues.map((tag) => tag.replace(/^#/, "").toLowerCase());
    let result = this.evaluateRule(filter.rules[0], filePath, tagValues, normalizedTags);
    for (let i = 1; i < filter.rules.length; i++) {
      const ruleResult = this.evaluateRule(filter.rules[i], filePath, tagValues, normalizedTags);
      const operator = filter.rules[i].operator;
      if (operator === "AND") {
        result = result && ruleResult;
      } else {
        result = result || ruleResult;
      }
    }
    return result;
  }
  evaluateRule(rule, filePath, tagValues, normalizedTags) {
    if (!rule.value) {
      return false;
    }
    if (rule.type === "directoryInclude" || rule.type === "directoryExclude") {
      const normalizedValue = rule.value.trim().replace(/^[\\/]+/, "").replace(/[\\/]+$/, "");
      if (!normalizedValue) {
        return false;
      }
      const directoryHit = filePath === normalizedValue || filePath.startsWith(`${normalizedValue}/`);
      return rule.type === "directoryExclude" ? !directoryHit : directoryHit;
    }
    let regex = null;
    try {
      regex = new RegExp(rule.value, "i");
    } catch (error) {
      return false;
    }
    const tagHit = tagValues.some((tag) => regex?.test(tag)) || normalizedTags.some((tag) => regex?.test(tag));
    if (rule.type === "tagRegexExclude") {
      return !tagHit;
    }
    return tagHit;
  }
  migrateFilterStructure() {
    let needsSave = false;
    this.settings.filters.forEach((filter) => {
      if ("operator" in filter) {
        const oldFilter = filter;
        if (oldFilter.rules && oldFilter.rules.length > 0) {
          oldFilter.rules.forEach((rule, index) => {
            if (index === 0) {
              rule.operator = oldFilter.operator || "AND";
            } else {
              rule.operator = rule.operator || "AND";
            }
          });
        }
        delete filter.operator;
        needsSave = true;
      } else {
        filter.rules.forEach((rule, index) => {
          if (!rule.operator) {
            rule.operator = index === 0 ? "AND" : "AND";
            needsSave = true;
          }
        });
      }
    });
    if (needsSave) {
      this.saveSettings();
    }
  }
  async exportAllFilters() {
    const outputFolder = this.settings.defaultOutputPath.replace(/[\\/]+$/, "");
    if (!outputFolder) {
      new import_obsidian.Notice("Set a default output folder before exporting.");
      return;
    }
    if (!this.settings.filters.length) {
      new import_obsidian.Notice("No filters configured yet.");
      return;
    }
    try {
      if (!await this.app.vault.adapter.exists(outputFolder)) {
        await this.app.vault.adapter.mkdir(outputFolder);
      }
    } catch (error) {
      new import_obsidian.Notice("Failed to create output directory. Check path permissions.");
      return;
    }
    const files = this.app.vault.getMarkdownFiles();
    for (const filter of this.settings.filters) {
      const matchingFiles = files.filter((file) => this.matchesFilter(file.path, filter)).sort((a, b) => a.basename.localeCompare(b.basename));
      const combinedParts = [];
      const timestamp = (/* @__PURE__ */ new Date()).toString();
      combinedParts.push(`# Notes combined on: ${timestamp}`);
      for (const file of matchingFiles) {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        const noteTitle = cache?.frontmatter?.title?.trim() || file.basename;
        combinedParts.push(
          `---

# Note title: ${noteTitle}

${content.trim()}`
        );
      }
      const output = combinedParts.join("\n\n");
      const filename = `note-bundler-export-${this.sanitizeFilename(filter.name)}.md`;
      const outputPath = `${outputFolder}/${filename}`;
      try {
        await this.app.vault.adapter.write(outputPath, output);
      } catch (error) {
        new import_obsidian.Notice(`Failed to write export file: ${filename}`);
        console.error("Note Bundler export error:", error);
      }
    }
    this.settings.lastRun = (/* @__PURE__ */ new Date()).toISOString();
    await this.saveSettings();
    if (!this.settings.silentMode) {
      new import_obsidian.Notice("Note Bundler: filters exported.");
    }
  }
};
var NoteBundlerSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ruleTypeOptions = {
      tagRegexInclude: "Match tags by regex",
      tagRegexExclude: "Exclude tags matching regex",
      directoryInclude: "Include directory (recursive)",
      directoryExclude: "Exclude directory (recursive)"
    };
    const getRulePlaceholder = (ruleType) => ruleType === "directoryInclude" || ruleType === "directoryExclude" ? "Directory path (e.g., journals/)" : "Regex pattern";
    containerEl.empty();
    containerEl.createEl("h2", { text: "Note Bundler Settings" });
    let outputPathInput = null;
    const outputPathSetting = new import_obsidian.Setting(containerEl).setName("Default output folder").setDesc(
      "Vault-relative path to export bundles (e.g., 'Exports/' or 'docs/bundles/')."
    ).addText((text) => {
      outputPathInput = text;
      text.setPlaceholder("Exports/").setValue(this.plugin.settings.defaultOutputPath).onChange(async (value) => {
        this.plugin.settings.defaultOutputPath = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Enable auto-export").setDesc("Turns on scheduled exports once scheduling is implemented.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoExportEnabled).onChange(async (value) => {
        this.plugin.settings.autoExportEnabled = value;
        await this.plugin.saveSettings();
        void this.plugin.updateAutoExportSchedule();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Auto-export frequency").setDesc("How often filters are exported when auto-export is enabled.").addDropdown(
      (dropdown) => dropdown.addOption("1", "Every minute").addOption("5", "Every 5 minutes").addOption("15", "Every 15 minutes").addOption("30", "Every 30 minutes").addOption("60", "Every hour").addOption("240", "Every 4 hours").addOption("1440", "Every day").setValue(String(this.plugin.settings.autoExportFrequencyMinutes)).onChange(async (value) => {
        this.plugin.settings.autoExportFrequencyMinutes = Number(value);
        await this.plugin.saveSettings();
        void this.plugin.updateAutoExportSchedule();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Silent mode").setDesc("Disable export notifications (useful for high-frequency exports).").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.silentMode).onChange(async (value) => {
        this.plugin.settings.silentMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Export now").setDesc("Run exports immediately to validate output.").addButton((button) => {
      button.setButtonText("Export now");
      button.setCta();
      button.onClick(async () => {
        await this.plugin.exportAllFilters();
      });
    });
    containerEl.createEl("h3", { text: "Filters" });
    const addFilterSetting = new import_obsidian.Setting(containerEl).setName("Create new filter").setDesc("Filters are reusable rule groups for bundles.");
    addFilterSetting.addButton((button) => {
      button.setButtonText("+");
      button.onClick(async () => {
        const nextIndex = this.plugin.settings.filters.length + 1;
        this.plugin.settings.filters.push({
          id: createId(),
          name: `Filter ${nextIndex}`,
          rules: []
        });
        await this.plugin.saveSettings();
        this.display();
      });
    });
    this.plugin.settings.filters.forEach((filter) => {
      const filterContainer = containerEl.createDiv({ cls: "note-bundler-filter" });
      const filterHeader = new import_obsidian.Setting(filterContainer).setName(filter.name).setDesc("Define rules for this filter.").addText(
        (text) => text.setPlaceholder("Filter name").setValue(filter.name).onChange(async (value) => {
          const nextName = value.trim() || filter.name;
          filter.name = nextName;
          filterHeader.setName(nextName);
          await this.plugin.saveSettings();
        })
      ).addButton((button) => {
        button.setButtonText("Duplicate");
        button.onClick(async () => {
          const clone = {
            ...filter,
            id: createId(),
            name: `${filter.name} Copy`,
            rules: filter.rules.map((rule) => ({
              ...rule,
              id: createId()
            }))
          };
          this.plugin.settings.filters.push(clone);
          await this.plugin.saveSettings();
          this.display();
        });
      }).addButton((button) => {
        button.setButtonText("Delete");
        button.onClick(async () => {
          this.plugin.settings.filters = this.plugin.settings.filters.filter((item) => item.id !== filter.id);
          await this.plugin.saveSettings();
          this.display();
        });
      });
      const rulesContainer = filterContainer.createDiv({ cls: "note-bundler-filter-rules" });
      rulesContainer.style.marginLeft = "16px";
      rulesContainer.style.borderLeft = "1px solid var(--background-modifier-border)";
      rulesContainer.style.paddingLeft = "12px";
      rulesContainer.createEl("div", { text: "Rules", cls: "note-bundler-filter-rules-title" });
      rulesContainer.createEl("div", {
        text: "Directory rules are vault-relative and apply recursively.",
        cls: "note-bundler-filter-rules-help"
      });
      filter.rules.forEach((rule, index) => {
        const ruleSetting = new import_obsidian.Setting(rulesContainer);
        if (index > 0) {
          ruleSetting.setName(`Rule ${index + 1}`).addDropdown(
            (dropdown) => dropdown.addOption("AND", "AND").addOption("OR", "OR").setValue(rule.operator).onChange(async (value) => {
              rule.operator = value;
              await this.plugin.saveSettings();
            })
          );
        } else {
          rule.operator = rule.operator || "AND";
          ruleSetting.setName(`Rule ${index + 1}`);
        }
        let ruleValueInput = null;
        ruleSetting.addDropdown(
          (dropdown) => dropdown.addOptions(ruleTypeOptions).setValue(rule.type).onChange(async (value) => {
            rule.type = value;
            ruleValueInput?.setPlaceholder(getRulePlaceholder(rule.type));
            await this.plugin.saveSettings();
          })
        ).addText((text) => {
          ruleValueInput = text;
          text.setPlaceholder(getRulePlaceholder(rule.type)).setValue(rule.value).onChange(async (value) => {
            rule.value = value;
            await this.plugin.saveSettings();
          });
        }).addButton((button) => {
          button.setButtonText("Remove");
          button.onClick(async () => {
            filter.rules = filter.rules.filter((item) => item.id !== rule.id);
            await this.plugin.saveSettings();
            this.display();
          });
        });
      });
      const addRuleSetting = new import_obsidian.Setting(rulesContainer).setName("Add rule").setDesc("Append another rule to this filter.");
      addRuleSetting.addButton((button) => {
        button.setButtonText("+");
        button.onClick(async () => {
          filter.rules.push({
            id: createId(),
            type: "tagRegexInclude",
            value: "",
            operator: "AND"
          });
          await this.plugin.saveSettings();
          this.display();
        });
      });
    });
  }
};
