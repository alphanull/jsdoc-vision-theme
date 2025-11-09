# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org) and follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

---

## [1.2.0] - 2025-11-09

### Added

- Templates: Added a `canonical` option to emit `<link rel="canonical">` tags for all generated HTML pages.
- Individual meta description is now generated for pages containing source code.
- Main page and tutorials receive auto-generated meta descriptions based on their content (the configured template description overrides the index page when present).
- Added `showTitleOnHomepage` option to hide the generated `<h1>` on the main page when your README already supplies a top-level heading.
- Search index now ships with an inline fallback so the search popup also works when the docs are opened directly via `file://`.

### Changed

- Updated (dev) dependencies
- Updated base CSS

### Fixed

- Fixed duplicate or missing pages titles.
- Meta descriptions escapes critical characters, preventing attribute breakage when quotes or special symbols appear.

---

## [1.1.2] – 2025-10-19

### Changed

- Updated (dev) dependencies

### Fixed

- CSS: Fixed preventing selection of menuitem under a scrolling indicator

---

## [1.1.1] – 2025-10-05

### Fixed

- Regression caused submenus to not appear

---

## [1.1.0] – 2025-10-05

### Added

- Scrolling indicators for dropdown menus (when no scrollbar is present)

### Changed

- Updated (dev) dependencies
- Optimized scrollbar handling

### Fixed

- Improved scrolling lock when using overlays like the mobile menu

---

## [1.0.0] – 2025-07-06

### Added

- This marks the first release of **JSDoc VisionTheme**
- A modern, clean, fast, responsive, accessible, and highly customizable documentation theme for JSDoc — designed for 2025 and beyond.
