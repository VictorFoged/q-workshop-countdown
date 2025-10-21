# Q Challenge Timer Extension

An AWS-themed Chrome extension that displays a countdown timer overlay on web pages and automatically disables form elements when the timer expires.

## Features

- 10-minute countdown timer
- Appears on any `/task/*` URL, countdown starts on `/task/1`
- Timer continues across ALL task pages (`/task/1`, `/task/2`, `/task/3`, etc.)
- Timer tracks total time spent across all tasks (10 minutes total)
- Form element disabling when timer expires (on ALL task pages)

## Installation

### Quick Start
1. Generate PNG icons from the SVG source (see INSTALLATION.md for details)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `aws-countdown-extension` folder
5. The extension will be installed and ready to use


### Packaging
The extension is ready for local distribution. All files are organized for Chrome extension loading:
- Core extension files in root directory
- Icons in `icons/` subdirectory

## Requirements
- Chrome 88+ (Manifest V3 support)
- No special permissions required beyond content script injection
