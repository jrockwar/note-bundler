import { Notice, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";

interface BundleDefinition {
  name: string;
  description?: string;
  filters: Record<string, unknown>[];
  schedule?: string;
  outputPath?: string;
}

type FilterOperator = "AND" | "OR";
type FilterRuleType = "tagRegexInclude" | "tagRegexExclude";

interface FilterRule {
  id: string;
  type: FilterRuleType;
  value: string;
}

interface FilterDefinition {
  id: string;
  name: string;
  operator: FilterOperator;
  rules: FilterRule[];
}

interface NoteBundlerSettings {
  bundles: BundleDefinition[];
  lastRun?: string | null;
  defaultOutputPath: string;
  autoExportEnabled: boolean;
  filters: FilterDefinition[];
  autoExportFrequencyMinutes: number;
}

const DEFAULT_SETTINGS: NoteBundlerSettings = {
  bundles: [],
  lastRun: null,
  defaultOutputPath: "",
  autoExportEnabled: false,
  filters: [],
  autoExportFrequencyMinutes: 60,
};

export default class NoteBundlerPlugin extends Plugin {
  settings: NoteBundlerSettings = DEFAULT_SETTINGS;
  private autoExportIntervalId: number | null = null;

  async onload() {
    console.log("Note Bundler: loading");
    await this.loadSettings();

    await this.updateAutoExportSchedule();

    this.addSettingTab(new NoteBundlerSettingTab(this.app, this));

    this.addCommand({
      id: "note-bundler-open-settings",
      name: "Open Note Bundler settings",
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
    console.log("Note Bundler: unloaded");
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
    if (!lastRun || Number.isNaN(lastRun) || Date.now() - lastRun >= intervalMs) {
      await this.exportAllFilters();
    }
    this.autoExportIntervalId = window.setInterval(() => {
      void this.exportAllFilters();
    }, intervalMs);
  }

  async exportAllBundles() {
    // Placeholder: wiring for export pipeline will follow.
    new Notice("Note Bundler: export not yet implemented");
  }

  private sanitizeFilename(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "filter";
  }

  private matchesFilter(filePath: string, filter: FilterDefinition): boolean {
    const cache = this.app.metadataCache.getCache(filePath);
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
    const normalizedTags = tagValues.map((tag) => tag.replace(/^#/, "").toLowerCase());

    const ruleMatches = filter.rules.map((rule) => {
      if (!rule.value) {
        return false;
      }
      let regex: RegExp | null = null;
      try {
        regex = new RegExp(rule.value, "i");
      } catch (error) {
        return false;
      }

      const tagHit = tagValues.some((tag) => regex?.test(tag))
        || normalizedTags.some((tag) => regex?.test(tag));
      if (rule.type === "tagRegexExclude") {
        return !tagHit;
      }
      return tagHit;
    });

    if (filter.operator === "AND") {
      return ruleMatches.length > 0 && ruleMatches.every(Boolean);
    }
    return ruleMatches.some(Boolean);
  }

  async exportAllFilters() {
    if (!this.settings.defaultOutputPath) {
      new Notice("Set a default output folder before exporting.");
      return;
    }

    if (!this.settings.filters.length) {
      new Notice("No filters configured yet.");
      return;
    }

    const windowRequire = (window as unknown as { require?: (module: string) => any }).require;
    const fs = windowRequire?.("fs");
    const path = windowRequire?.("path");
    if (!fs || !path) {
      new Notice("File system access is unavailable in this environment.");
      return;
    }

    await fs.promises.mkdir(this.settings.defaultOutputPath, { recursive: true });

    const files = this.app.vault.getMarkdownFiles();
    for (const filter of this.settings.filters) {
      const matchingFiles = files
        .filter((file) => this.matchesFilter(file.path, filter))
        .sort((a, b) => a.basename.localeCompare(b.basename));
      const combinedParts: string[] = [];
      const timestamp = new Date().toString();
      combinedParts.push(`# Notes combined on: ${timestamp}`);

      for (const file of matchingFiles) {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        const noteTitle = (cache?.frontmatter?.title as string | undefined)?.trim() || file.basename;
        combinedParts.push(
          `---\n\n# Note title: ${noteTitle}\n\n${content.trim()}`
        );
      }

      const output = combinedParts.join("\n\n");
      const filename = `note-bundler-export-${this.sanitizeFilename(filter.name)}.md`;
      const outputPath = path.join(this.settings.defaultOutputPath, filename);
      await fs.promises.writeFile(outputPath, output, "utf8");
    }

    this.settings.lastRun = new Date().toISOString();
    await this.saveSettings();

    new Notice("Note Bundler: filters exported.");
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
    const isDesktop = Platform.isDesktopApp;
    const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ruleTypeOptions: Record<FilterRuleType, string> = {
      tagRegexInclude: "Match tags by regex",
      tagRegexExclude: "Don't match tags by regex",
    };

    containerEl.empty();
    containerEl.createEl("h2", { text: "Note Bundler Settings" });

    let outputPathInput: { setValue: (value: string) => void } | null = null;
    const outputPathSetting = new Setting(containerEl)
      .setName("Default output folder")
      .setDesc(
        isDesktop
          ? "Absolute path to export bundles (external folders supported)."
          : "Absolute path to export bundles. Note: mobile platforms may restrict access to external folders."
      )
      .addText((text) => {
        outputPathInput = text;
        text
          .setPlaceholder("/Users/you/Exports")
          .setValue(this.plugin.settings.defaultOutputPath)
          .onChange(async (value) => {
            this.plugin.settings.defaultOutputPath = value.trim();
            await this.plugin.saveSettings();
          });
      });

    outputPathSetting.addButton((button) => {
      button.setButtonText("Choose folder");
      if (!isDesktop) {
        button.setDisabled(true);
        return;
      }
      button.onClick(async () => {
        const windowRequire = (window as unknown as { require?: (module: string) => any }).require;
        const electron = windowRequire?.("electron");
        const dialog = electron?.remote?.dialog ?? electron?.dialog;
        if (!dialog?.showOpenDialog) {
          new Notice("Folder picker is unavailable in this environment.");
          return;
        }

        const result = await dialog.showOpenDialog({
          properties: ["openDirectory"],
        });

        if (result?.canceled || !result?.filePaths?.length) {
          return;
        }

        const selectedPath = result.filePaths[0];
        const fs = windowRequire?.("fs");
        if (fs?.promises?.access) {
          try {
            await fs.promises.access(selectedPath, fs.constants?.W_OK ?? fs.constants?.F_OK);
          } catch (error) {
            new Notice("Selected folder is not writable. Choose another folder.");
            return;
          }
        }

        this.plugin.settings.defaultOutputPath = selectedPath;
        await this.plugin.saveSettings();
        outputPathInput?.setValue(selectedPath);
      });
    });

    new Setting(containerEl)
      .setName("Enable auto-export")
      .setDesc("Turns on scheduled exports once scheduling is implemented.")
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
      .setName("Export now")
      .setDesc("Run exports immediately to validate output.")
      .addButton((button) => {
        button.setButtonText("Export now");
        button.setCta();
        button.onClick(async () => {
          await this.plugin.exportAllFilters();
        });
      });

    containerEl.createEl("h3", { text: "Filters" });
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
          operator: "AND",
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
      rulesContainer.style.marginLeft = "16px";
      rulesContainer.style.borderLeft = "1px solid var(--background-modifier-border)";
      rulesContainer.style.paddingLeft = "12px";
      rulesContainer.createEl("div", { text: "Rules", cls: "note-bundler-filter-rules-title" });

      new Setting(rulesContainer)
        .setName("Match rules with")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("AND", "All (AND)")
            .addOption("OR", "Any (OR)")
            .setValue(filter.operator)
            .onChange(async (value) => {
              filter.operator = value as FilterOperator;
              await this.plugin.saveSettings();
            })
        );

      filter.rules.forEach((rule) => {
        new Setting(rulesContainer)
          .setName("Rule")
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(ruleTypeOptions)
              .setValue(rule.type)
              .onChange(async (value) => {
                rule.type = value as FilterRuleType;
                await this.plugin.saveSettings();
              })
          )
          .addText((text) =>
            text
              .setPlaceholder("Regex pattern")
              .setValue(rule.value)
              .onChange(async (value) => {
                rule.value = value;
                await this.plugin.saveSettings();
              })
          )
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
          });
          await this.plugin.saveSettings();
          this.display();
        });
      });
    });
  }
}
