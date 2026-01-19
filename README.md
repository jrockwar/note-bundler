# Note Bundler

Bundle notes from your Obsidian vault into organized Markdown files using flexible filters - perfect for creating LLM context, documentation exports, or curated note collections.

## Overview

Note Bundler helps you create targeted exports of your Obsidian notes by defining reusable filters. Each filter generates a single consolidated Markdown file containing all matching notes, making it ideal for:
- Preparing context for AI/LLM tools
- Creating documentation packages
- Exporting project-specific notes
- Building knowledge bases for sharing

## Features

### 🎯 **Smart Filtering**
- **Tag-based filtering** with regex support (include/exclude patterns)
- **Case-insensitive matching** for tags in both note content and frontmatter
- **AND/OR logic** to combine multiple rules flexibly
- **Extensible rule system** designed for future filter types

### 📁 **Flexible Export Management**
- **One file per filter** with sanitized, descriptive filenames
- **Configurable output paths** - vault-relative (`Exports/`) or absolute paths
- **Cross-platform compatibility** using Obsidian's Vault APIs
- **Automatic filename sorting** with frontmatter title fallbacks

### ⏰ **Automated Scheduling**
- **Manual export trigger** from settings for immediate validation
- **Scheduled auto-exports** with configurable intervals
- **Catch-up exports** that run when Obsidian launches after missed schedules
- **Safe defaults** to prevent overwhelming exports

### 🛠️ **User-Friendly Interface**
- **Settings-based configuration** with intuitive filter builder
- **Real-time export validation** through settings panel
- **Persistent filter profiles** saved per vault

## Installation

### Manual Installation
1. Clone or download this repository
2. Install dependencies: `npm install`
3. Build the plugin: `npm run build`
4. Create a folder named `note-bundler` in your vault's `.obsidian/plugins/` directory
5. Copy `main.js`, `manifest.json`, and `styles.css` (if present) into the plugin folder
6. Enable **Note Bundler** in Obsidian → Settings → Community plugins

### Development Installation
For development or testing, you can symlink the repository folder into `.obsidian/plugins/note-bundler` and run `npm run dev` for live reloading.

## Usage Guide

### 1. Configure Output Location
Navigate to **Settings → Note Bundler → Default output folder**:
- **Vault-relative paths**: `Exports/`, `docs/bundles/`, etc.
- All platforms support vault-relative paths for maximum compatibility

### 2. Create Export Filters
In **Settings → Note Bundler → Filters**:

1. Click **Create new filter**
2. **Name your filter** descriptively (e.g., "Project Notes", "Research Papers")
3. **Add rules** using the available types:
   - **Match tags by regex** - Include notes with tags matching the pattern
   - **Don't match tags by regex** - Exclude notes with tags matching the pattern
4. **Set rule combination**:
   - **All (AND)** - Notes must match ALL rules to be included
   - **Any (OR)** - Notes matching ANY rule will be included

#### Tag Regex Examples
- `#project` - Match exact tag
- `#project.*` - Match tags starting with #project
- `#(important|urgent)` - Match multiple specific tags
- `(?<!#)draft` - Match "draft" without leading # (frontmatter tags)

### 3. Export Your Notes
**Manual Export:**
- Click **Export now** in the Note Bundler settings
- Files are created immediately: `note-bundler-export-<filter-name>.md`

**Automatic Export:**
- Toggle **Enable auto-export**
- Choose your preferred frequency:
  - Every minute
  - Every hour  
  - Every day
- Exports run automatically and catch up on app launch if missed

### 4. Review Exported Files
Each export creates a structured Markdown file with:
- **Timestamp header** showing when the export was created
- **Individual note sections** with clear separators
- **Note titles** extracted from frontmatter or filename
- **Full note content** preserving formatting and links

## Output Format

```markdown
# Notes combined on: 2026-01-19 12:00:00

---

# Note title: Project Overview

Project overview content with **formatting** and [[links]] preserved.

---

# Note title: Research Notes

Research findings and citations...
```

## Configuration Storage

Plugin settings are stored per vault in:
- **Filter definitions**: Name, rules, and logic operators
- **Export preferences**: Output paths and scheduling
- **Auto-export state**: Last run timestamp for catch-up logic

## Development

### Build Commands
```bash
npm run dev      # Development build with file watching
npm run build    # Production build
npm run version  # Bump version and update changelog
```

### Project Structure
```
├── src/
│   └── main.ts          # Main plugin logic
├── memory-bank/         # Development documentation
├── manifest.json        # Plugin manifest
├── package.json         # Dependencies and scripts
├── styles.css           # Plugin styles (if any)
└── README.md           # This file
```

### Architecture Notes
- **Bundle Definition**: `{name, filters, ordering, outputPath, schedule, options}`
- **Filter Evaluation**: Composable include/exclude logic before assembly
- **Export Pipeline**: Collect → Sort → Concatenate → Write
- **Cross-Platform**: Uses Obsidian Vault APIs for maximum compatibility

## Troubleshooting

### Common Issues
- **Export fails**: Check output path permissions and disk space
- **No notes exported**: Verify filter rules and tag spelling
- **Auto-export not running**: Ensure plugin has necessary permissions
- **Mobile limitations**: Use vault-relative paths on mobile devices

### Debugging
- Check Obsidian developer console for error messages
- Verify filter rules with manual export first
- Test with simple tag patterns before complex regex

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate tests
4. Submit a pull request with clear description

## License

[Add your license information here]

## Changelog

See `CHANGELOG.md` for version history and updates.
