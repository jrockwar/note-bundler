import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";

interface BundleDefinition {
  name: string;
  description?: string;
  filters: Record<string, unknown>[];
  schedule?: string;
  outputPath?: string;
}

interface NoteBundlerSettings {
  bundles: BundleDefinition[];
  lastRun?: string | null;
  defaultOutputPath: string;
  autoExportEnabled: boolean;
}

const DEFAULT_SETTINGS: NoteBundlerSettings = {
  bundles: [],
  lastRun: null,
  defaultOutputPath: "",
  autoExportEnabled: false,
};

export default class NoteBundlerPlugin extends Plugin {
  settings: NoteBundlerSettings = DEFAULT_SETTINGS;

  async onload() {
    console.log("Note Bundler: loading");
    await this.loadSettings();

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
    console.log("Note Bundler: unloaded");
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async exportAllBundles() {
    // Placeholder: wiring for export pipeline will follow.
    new Notice("Note Bundler: export not yet implemented");
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

    containerEl.empty();
    containerEl.createEl("h2", { text: "Note Bundler Settings" });

    new Setting(containerEl)
      .setName("Default output path")
      .setDesc("Vault-relative path for bundle exports (e.g., Exports/)")
      .addText((text) =>
        text
          .setPlaceholder("Exports/")
          .setValue(this.plugin.settings.defaultOutputPath)
          .onChange(async (value) => {
            this.plugin.settings.defaultOutputPath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable auto-export")
      .setDesc("Turns on scheduled exports once scheduling is implemented.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoExportEnabled)
          .onChange(async (value) => {
            this.plugin.settings.autoExportEnabled = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
