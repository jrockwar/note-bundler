# Changelog

## 0.1.5 - 2026-02-16
- **Code Review Fix**: Removed unnecessary type assertion in migration code.

## 0.1.4 - 2026-02-09
- **Review Fixes**: Adjusted command label, removed navigator usage, tightened types, and ensured awaited async migrations.
- **Release**: Version bump for review feedback.

## 0.1.3 - 2026-02-08
- **Documentation**: Updated settings screenshot to reflect latest UI.
- **Release**: Version bump for documentation refresh.

## 0.1.2 - 2026-02-02
- **Plugin Guidelines Compliance**: Fixed all Obsidian plugin guideline violations.
  - Removed hardcoded inline styling, added `styles.css` with CSS variables
  - Added `normalizePath()` for user-defined output paths
  - Changed to `setHeading()` for settings headings instead of HTML elements
  - Removed debug console.log statements
  - Switched to Vault API (`create`, `modify`, `createFolder`) instead of Adapter API for better performance and safety

## 0.1.1 - 2026-02-02
- **Documentation**: Added settings screenshot to README.
- **Documentation**: Cleaned up Development section, removed internal architecture notes.

## 0.1.0 - 2026-02-02
- **Publishing Release**: First public release ready for community distribution.
- **Code Quality**: Removed LLM-generated patterns, added strategic comments for maintainability.
- **Semver**: Moving from initial development (0.0.x) to functional pre-stable (0.x.0).

## 0.0.8 - 2026-01-31
- **Bugfix**: Normalize output folder path to avoid double slashes in export paths.

## 0.0.7 - 2026-01-31
- **Directory Rules**: Added include/exclude directory rules with recursive matching for vault-relative paths.
- **UI Copy**: Renamed tag exclusion rule label to "Exclude tags matching regex" for clarity.
- **Documentation**: Updated README to cover directory rules and new label.

## 0.0.6 - 2026-01-19
- **UX Improvement**: AND/OR operators now appear before rules (instead of after) for better readability.
- **Documentation**: Streamlined README - removed verbose sections and condensed content by ~53%.
- **License**: Added GPL-3.0 license to prevent proprietary commercialization while allowing forks.

## 0.0.5 - 2026-01-19
- **Device-Specific Settings**: Each device now maintains completely separate plugin settings using unique device identifiers.
- **Multi-Computer Support**: Perfect for users with work laptops, home desktops, and mobile devices - each can have independent configurations.
- **Zero-Friction UX**: Device isolation happens automatically with no user configuration required.
- **True Independence**: Settings changes on one device never affect another, regardless of Obsidian sync settings.

## 0.0.4 - 2026-01-19
- **Critical Safety Fix**: Added exclusion logic to prevent infinite loops by filtering out note-bundler-export files from being processed.

## 0.0.3 - 2026-01-19
- **UX Improvement**: Moved AND/OR operators from filter-level to rule-level, enabling complex rule combinations (e.g., "Rule 1 AND Rule 2 OR Rule 3").
- **Silent Mode**: Added toggle to disable export notifications for high-frequency exports (1-minute intervals).
- **Code Cleanup**: Removed unused folder picker and Electron API dependencies for cleaner cross-platform support.
- **Documentation**: Enhanced README with comprehensive installation guide, usage examples, and troubleshooting section.
- **Migration**: Automatic migration of existing filters to new per-rule operator structure.
- **Stability**: Improved filter evaluation logic with sequential rule processing.

## 0.0.2 - 2026-01-18
- Added filter builder UI with AND/OR operators and tag regex rules.
- Added per-filter export with timestamp header, filename sorting, and frontmatter title fallback.
- Added settings-based "Export now" button; removed command palette export.
- Added auto-export scheduling with frequency picker (including every minute) and catch-up on app load.
- Improved tag matching to include frontmatter tags and case-insensitive regex.

## 0.0.1 - 2026-01-18
- Initial plugin scaffold with settings tab and export placeholder.
