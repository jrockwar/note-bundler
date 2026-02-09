import { Notice, normalizePath, Platform, Plugin, PluginSettingTab, Setting, TFile, TFolder } from "obsidian";

interface BundleDefinition {
  name: string;
  description?: string;
  filters: Record<string, unknown>[];
  schedule?: string;
  outputPath?: string;
}

type FilterOperator = "AND" | "OR";
type FilterRuleType = "tagRegexInclude" | "tagRegexExclude" | "directoryInclude" | "directoryExclude";

interface FilterRule {
  id: string;
  type: FilterRuleType;
  value: string;
  operator: FilterOperator;
}

interface FilterDefinition {
  id: string;
  name: string;
  rules: FilterRule[];
}

interface NoteBundlerSettings {
  bundles: BundleDefinition[];
  lastRun?: string | null;
  defaultOutputPath: string;
  autoExportEnabled: boolean;
  filters: FilterDefinition[];
  autoExportFrequencyMinutes: number;
  silentMode: boolean;
}

const DEFAULT_SETTINGS: NoteBundlerSettings = {
  bundles: [],
  lastRun: null,
  defaultOutputPath: "",
  autoExportEnabled: false,
  filters: [],
  autoExportFrequencyMinutes: 60,
  silentMode: false,
};

interface LegacyFilterDefinition extends FilterDefinition {
  operator?: FilterOperator;
  rules: Array<FilterRule & { operator?: FilterOperator }>;
}

export default class NoteBundlerPlugin extends Plugin {
  settings: NoteBundlerSettings = DEFAULT_SETTINGS;
  private autoExportIntervalId: number | null = null;

  async onload() {
    await this.loadSettings();
    await this.migrateFilterStructure();

    await this.updateAutoExportSchedule();

    this.addSettingTab(new NoteBundlerSettingTab(this.app, this));

    this.addCommand({
      id: "open-settings",
      name: "Open settings",
      callback: () => {
        // Obsidian's typings omit app.setting, so we cast to reach the settings tab API.
        const settings = (this.app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting;
        settings.open();
        settings.openTabById(this.manifest.id);
      },
    });

  }

  onunload() {
    this.clearAutoExportSchedule();
  }

  async loadSettings() {
    const data = await this.loadData();
    const deviceId = this.getDeviceId();
    // Fallback to root data for backward compatibility with pre-device-ID settings
    const deviceData = data[deviceId] || data;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, deviceData);
  }

  async saveSettings() {
    const currentData = await this.loadData() || {};
    const deviceId = this.getDeviceId();
    currentData[deviceId] = this.settings;
    await this.saveData(currentData);
  }

  private getDeviceId(): string {
    // Create a unique device identifier using available platform info
    const platform = Platform.isMobile ? "mobile" : "desktop";
    const os = Platform.isMacOS
      ? "mac"
      : Platform.isWin
        ? "windows"
        : Platform.isLinux
          ? "linux"
          : "unknown";
    const timestamp = this.app.vault.adapter.basePath || '';
    
    // Create a hash from device-specific info
    // Used for per-device settings
    const deviceString = `${platform}-${os}-${timestamp}`;
    return btoa(deviceString).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  }

  private clearAutoExportSchedule() {
    if (this.autoExportIntervalId !== null) {
      window.clearInterval(this.autoExportIntervalId);
      this.autoExportIntervalId = null;
    }
  }

  private async updateAutoExportSchedule() {
    this.clearAutoExportSchedule();
    if (!this.settings.autoExportEnabled) {
      return;
    }

    const intervalMs = Math.max(1, this.settings.autoExportFrequencyMinutes) * 60 * 1000;
    const lastRun = this.settings.lastRun ? Date.parse(this.settings.lastRun) : null;
    // Run catch-up export immediately if interval has elapsed since last run
    if (!lastRun || Number.isNaN(lastRun) || Date.now() - lastRun >= intervalMs) {
      await this.exportAllFilters();
    }
    this.autoExportIntervalId = window.setInterval(() => {
      void this.exportAllFilters();
    }, intervalMs);
  }

  private sanitizeFilename(value: string) {
    // Convert to lowercase, replace non-alphanumeric with hyphens, trim edges, cap at 80 chars
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "filter";
  }

  private matchesFilter(filePath: string, filter: FilterDefinition): boolean {
    if (filter.rules.length === 0) {
      return false;
    }

    // Exclude our own export files to prevent infinite loops
    const fileName = filePath.split("/").pop() || "";
    if (fileName.startsWith("note-bundler-export-") && fileName.endsWith(".md")) {
      return false;
    }

    const cache = this.app.metadataCache.getCache(filePath);
    // Extract tags from both inline tags (#tag) and frontmatter YAML
    const frontmatterTags = cache?.frontmatter?.tags;
    const frontmatterList = Array.isArray(frontmatterTags)
      ? frontmatterTags
      : typeof frontmatterTags === "string"
        ? frontmatterTags.split(/[\s,]+/).filter(Boolean)
        : [];
    const tagValues = [
      ...(cache?.tags ?? []).map((tag) => tag.tag),
      ...frontmatterList.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
    ];
    // Store both original and normalized (lowercase, no #) for flexible matching
    const normalizedTags = tagValues.map((tag) => tag.replace(/^#/, "").toLowerCase());

    // Evaluate rules sequentially: each rule's operator determines how it combines with previous results
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

  private evaluateRule(rule: FilterRule, filePath: string, tagValues: string[], normalizedTags: string[]): boolean {
    if (!rule.value) {
      return false;
    }
    if (rule.type === "directoryInclude" || rule.type === "directoryExclude") {
      const normalizedValue = rule.value.trim().replace(/^[\\/]+/, "").replace(/[\\/]+$/, "");
      if (!normalizedValue) {
        return false;
      }
      // Match exact directory or any file within it (recursive)
      const directoryHit = filePath === normalizedValue || filePath.startsWith(`${normalizedValue}/`);
      return rule.type === "directoryExclude" ? !directoryHit : directoryHit;
    }

    let regex: RegExp | null = null;
    try {
      regex = new RegExp(rule.value, "i");
    } catch {
      // Silently fail on invalid regex patterns
      return false;
    }

    // Test against both original tags (#tag) and normalized (tag) for flexibility
    const tagHit = tagValues.some((tag) => regex?.test(tag))
      || normalizedTags.some((tag) => regex?.test(tag));
    
    if (rule.type === "tagRegexExclude") {
      return !tagHit;
    }
    return tagHit;
  }

  private async migrateFilterStructure() {
    // Migrate filters from v0.0.2 (filter-level operator) to v0.0.3+ (per-rule operators)
    let needsSave = false;
    
    this.settings.filters.forEach((filter) => {
      if ('operator' in filter) {
        const oldFilter = filter as LegacyFilterDefinition;
        if (oldFilter.rules && oldFilter.rules.length > 0) {
          oldFilter.rules.forEach((rule, index) => {
            if (index === 0) {
              rule.operator = oldFilter.operator || "AND";
            } else {
              rule.operator = rule.operator || "AND";
            }
          });
        }
        delete (oldFilter as LegacyFilterDefinition).operator;
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
      await this.saveSettings();
    }
  }

  async exportAllFilters() {
    // Strip trailing slashes to avoid double-slash in output paths
    const outputFolder = this.settings.defaultOutputPath.replace(/[\\/]+$/, "");
    if (!outputFolder) {
      new Notice("Set a default output folder before exporting.");
      return;
    }

    if (!this.settings.filters.length) {
      new Notice("No filters configured yet.");
      return;
    }

    // Ensure output directory exists using Obsidian's Vault API
    try {
      const existingFolder = this.app.vault.getAbstractFileByPath(outputFolder);
      if (!existingFolder) {
        await this.app.vault.createFolder(outputFolder);
      } else if (!(existingFolder instanceof TFolder)) {
        new Notice("Output path exists but is not a folder.");
        return;
      }
    } catch {
      new Notice("Failed to create output directory. Check path permissions.");
      return;
    }

    const files = this.app.vault.getMarkdownFiles();
    for (const filter of this.settings.filters) {
      // Sort alphabetically by basename for consistent output ordering
      const matchingFiles = files
        .filter((file) => this.matchesFilter(file.path, filter))
        .sort((a, b) => a.basename.localeCompare(b.basename));
      const combinedParts: string[] = [];
      const timestamp = new Date().toString();
      combinedParts.push(`# Notes combined on: ${timestamp}`);

      for (const file of matchingFiles) {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        // Use frontmatter title if available, otherwise fall back to filename
        const noteTitle = (cache?.frontmatter?.title as string | undefined)?.trim() || file.basename;
        combinedParts.push(
          `---\n\n# Note title: ${noteTitle}\n\n${content.trim()}`
        );
      }

      const output = combinedParts.join("\n\n");
      const filename = `note-bundler-export-${this.sanitizeFilename(filter.name)}.md`;
      const outputPath = `${outputFolder}/${filename}`;
      
      try {
        await this.app.vault.create(outputPath, output);
      } catch (createError) {
        // File might already exist, try modifying it
        try {
          const existingFile = this.app.vault.getAbstractFileByPath(outputPath);
          if (existingFile instanceof TFile) {
            await this.app.vault.modify(existingFile, output);
          } else {
            throw createError;
          }
        } catch (error) {
          new Notice(`Failed to write export file: ${filename}`);
          console.error("Note bundler export error:", error);
        }
      }
    }

    this.settings.lastRun = new Date().toISOString();
    await this.saveSettings();

    if (!this.settings.silentMode) {
      new Notice("Note bundler: filters exported.");
    }
  }
}

class NoteBundlerSettingTab extends PluginSettingTab {
  plugin: NoteBundlerPlugin;

  constructor(app: NoteBundlerPlugin["app"], plugin: NoteBundlerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    // Generate unique IDs using timestamp + random hex for filter/rule identification
    const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ruleTypeOptions: Record<FilterRuleType, string> = {
      tagRegexInclude: "Match tags by regex",
      tagRegexExclude: "Exclude tags matching regex",
      directoryInclude: "Include directory (recursive)",
      directoryExclude: "Exclude directory (recursive)",
    };
    const getRulePlaceholder = (ruleType: FilterRuleType) => (
      ruleType === "directoryInclude" || ruleType === "directoryExclude"
        ? "Directory path (e.g., journals/)"
        : "Regex pattern"
    );

    containerEl.empty();

    new Setting(containerEl)
      .setName("Default output folder")
      .setDesc(
        "Vault-relative path to export bundles (e.g., 'Exports/' or 'docs/bundles/')."
      )
      .addText((text) =>
        text
          .setPlaceholder("Exports/")
          .setValue(this.plugin.settings.defaultOutputPath)
          .onChange(async (value) => {
            this.plugin.settings.defaultOutputPath = normalizePath(value.trim());
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable auto-export")
      .setDesc("Automatically export filters at the specified frequency.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoExportEnabled)
          .onChange(async (value) => {
            this.plugin.settings.autoExportEnabled = value;
            await this.plugin.saveSettings();
            void this.plugin.updateAutoExportSchedule();
          })
      );

    new Setting(containerEl)
      .setName("Auto-export frequency")
      .setDesc("How often filters are exported when auto-export is enabled.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("1", "Every minute")
          .addOption("5", "Every 5 minutes")
          .addOption("15", "Every 15 minutes")
          .addOption("30", "Every 30 minutes")
          .addOption("60", "Every hour")
          .addOption("240", "Every 4 hours")
          .addOption("1440", "Every day")
          .setValue(String(this.plugin.settings.autoExportFrequencyMinutes))
          .onChange(async (value) => {
            this.plugin.settings.autoExportFrequencyMinutes = Number(value);
            await this.plugin.saveSettings();
            void this.plugin.updateAutoExportSchedule();
          })
      );

    new Setting(containerEl)
      .setName("Silent mode")
      .setDesc("Disable export notifications (useful for high-frequency exports).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.silentMode)
          .onChange(async (value) => {
            this.plugin.settings.silentMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Export now")
      .setDesc("Run exports immediately to validate output.")
      .addButton((button) => {
        button.setButtonText("Export now");
        button.setCta();
        button.onClick(async () => {
          await this.plugin.exportAllFilters();
        });
      });

    new Setting(containerEl)
      .setName("Filters")
      .setHeading();
    const addFilterSetting = new Setting(containerEl)
      .setName("Create new filter")
      .setDesc("Filters are reusable rule groups for bundles.");
    addFilterSetting.addButton((button) => {
      button.setButtonText("+");
      button.onClick(async () => {
        const nextIndex = this.plugin.settings.filters.length + 1;
        this.plugin.settings.filters.push({
          id: createId(),
          name: `Filter ${nextIndex}`,
          rules: [],
        });
        await this.plugin.saveSettings();
        this.display();
      });
    });

    this.plugin.settings.filters.forEach((filter) => {
      const filterContainer = containerEl.createDiv({ cls: "note-bundler-filter" });
      const filterHeader = new Setting(filterContainer)
        .setName(filter.name)
        .setDesc("Define rules for this filter.")
        .addText((text) =>
          text
            .setPlaceholder("Filter name")
            .setValue(filter.name)
            .onChange(async (value) => {
              const nextName = value.trim() || filter.name;
              filter.name = nextName;
              filterHeader.setName(nextName);
              await this.plugin.saveSettings();
            })
        )
        .addButton((button) => {
          button.setButtonText("Duplicate");
          button.onClick(async () => {
            const clone: FilterDefinition = {
              ...filter,
              id: createId(),
              name: `${filter.name} Copy`,
              rules: filter.rules.map((rule) => ({
                ...rule,
                id: createId(),
              })),
            };
            this.plugin.settings.filters.push(clone);
            await this.plugin.saveSettings();
            this.display();
          });
        })
        .addButton((button) => {
          button.setButtonText("Delete");
          button.onClick(async () => {
            this.plugin.settings.filters = this.plugin.settings.filters.filter((item) => item.id !== filter.id);
            await this.plugin.saveSettings();
            this.display();
          });
        });

      const rulesContainer = filterContainer.createDiv({ cls: "note-bundler-filter-rules" });
      rulesContainer.createEl("div", { text: "Rules", cls: "note-bundler-filter-rules-title" });
      rulesContainer.createEl("div", {
        text: "Directory rules are vault-relative and apply recursively.",
        cls: "note-bundler-filter-rules-help",
      });

      filter.rules.forEach((rule, index) => {
        const ruleSetting = new Setting(rulesContainer);
        
        if (index > 0) {
          ruleSetting
            .setName(`Rule ${index + 1}`)
            .addDropdown((dropdown) =>
              dropdown
                .addOption("AND", "AND")
                .addOption("OR", "OR")
                .setValue(rule.operator)
                .onChange(async (value) => {
                  rule.operator = value as FilterOperator;
                  await this.plugin.saveSettings();
                })
            );
        } else {
          // First rule defaults to AND, but we still need to set it
          rule.operator = rule.operator || "AND";
          ruleSetting.setName(`Rule ${index + 1}`);
        }
        
        let ruleValueInput: { setPlaceholder: (value: string) => void } | null = null;

        ruleSetting
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(ruleTypeOptions)
              .setValue(rule.type)
              .onChange(async (value) => {
                rule.type = value as FilterRuleType;
                ruleValueInput?.setPlaceholder(getRulePlaceholder(rule.type));
                await this.plugin.saveSettings();
              })
          )
          .addText((text) => {
            ruleValueInput = text;
            text
              .setPlaceholder(getRulePlaceholder(rule.type))
              .setValue(rule.value)
              .onChange(async (value) => {
                rule.value = value;
                await this.plugin.saveSettings();
              });
          })
          .addButton((button) => {
            button.setButtonText("Remove");
            button.onClick(async () => {
              filter.rules = filter.rules.filter((item) => item.id !== rule.id);
              await this.plugin.saveSettings();
              this.display();
            });
          });
      });

      const addRuleSetting = new Setting(rulesContainer)
        .setName("Add rule")
        .setDesc("Append another rule to this filter.");
      addRuleSetting.addButton((button) => {
        button.setButtonText("+");
        button.onClick(async () => {
          filter.rules.push({
            id: createId(),
            type: "tagRegexInclude",
            value: "",
            operator: "AND",
          });
          await this.plugin.saveSettings();
          this.display();
        });
      });
    });
  }
}
