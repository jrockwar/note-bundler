# Changelog

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
