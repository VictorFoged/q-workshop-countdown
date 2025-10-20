# AWS Countdown Timer Extension

An AWS-themed Chrome extension that displays a countdown timer overlay on web pages and automatically disables form elements when the timer expires.

## Features

- 10-minute countdown timer with AWS branding
- Appears on any `/task/*` URL, countdown starts on `/task/1`
- Timer continues across ALL task pages (`/task/1`, `/task/2`, `/task/3`, etc.)
- Timer tracks total time spent across all tasks (10 minutes total)
- Timer reset when navigating to `/task/1` from non-task pages
- Form element disabling when timer expires (on ALL task pages)
- AWS design system styling with orange (#FF9900) and dark blue (#232F3E) colors

## Installation

### Quick Start
1. Generate PNG icons from the SVG source (see INSTALLATION.md for details)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `aws-countdown-extension` folder
5. The extension will be installed and ready to use

### Detailed Instructions
See [INSTALLATION.md](INSTALLATION.md) for comprehensive installation instructions, troubleshooting, and icon generation steps.

## Usage

The extension appears on any URL containing `/task/*` patterns:

- **`/task/1`**: Shows countdown timer starting at 10 minutes
- **`/task/2`, `/task/3`, etc.**: Shows same countdown timer continuing (if started on `/task/1`)
- **`/task/2`, `/task/3`, etc. (no timer)**: Shows "Navigate to /task/1 to start countdown" message
- **Other URLs**: Extension remains hidden

### Timer Behavior
- **Cross-task continuity**: Timer continues running across ALL task pages (`/task/1`, `/task/2`, `/task/3`, etc.)
- **Total time tracking**: Users have 10 minutes total to complete as many tasks as possible
- **Timer reset**: Timer resets to 10:00 when navigating to `/task/1` from non-task pages
- **Form disabling**: Occurs on ALL task pages when timer expires

### Testing
Use the included `test-task-pages.html` file to test different navigation scenarios and verify the timer reset behavior.

## Development

This extension uses Manifest V3 and includes:
- `manifest.json` - Extension configuration
- `content-script.js` - Main countdown logic
- `styles.css` - AWS-themed styling
- `icons/` - Extension icons (16px, 48px, 128px)

### Validation
Run the validation script to check if all required files are present:
```bash
node validate-extension.js
```

### Packaging
The extension is ready for local distribution. All files are organized for Chrome extension loading:
- Core extension files in root directory
- Icons in `icons/` subdirectory
- Installation instructions in `INSTALLATION.md`

## Requirements

- Chrome 88+ (Manifest V3 support)
- PNG icon files (generated from provided SVG)
- No special permissions required beyond content script injection