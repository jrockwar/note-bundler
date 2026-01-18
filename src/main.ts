import { Notice, Plugin } from "obsidian";

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
}

const DEFAULT_SETTINGS: NoteBundlerSettings = {
  bundles: [],
  lastRun: null,
};

export default class NoteBundlerPlugin extends Plugin {
  settings: NoteBundlerSettings = DEFAULT_SETTINGS;

  async onload() {
    console.log("Note Bundler: loading");
    await this.loadSettings();

    this.addCommand({
      id: "note-bundler-export-all",
      name: "Export bundles now",
      callback: () => this.exportAllBundles(),
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
