# AWS Countdown Extension - Installation Guide

## Prerequisites

- Google Chrome browser (version 88 or later for Manifest V3 support)
- The extension files (this directory)

## Installation Steps

### Method 1: Load Unpacked Extension (Recommended for Development)

1. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or go to Chrome menu → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner
   - This will reveal additional options

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to and select the `aws-countdown-extension` folder
   - Click "Select Folder"

4. **Verify Installation**
   - The extension should appear in your extensions list
   - You should see "AWS Countdown Timer" with version 1.0.0
   - The extension icon should be visible in the Chrome toolbar

## Icon Setup (Required)

The extension requires icon files in PNG format. Convert the provided SVG to PNG:

1. **Convert SVG to PNG icons:**
   ```bash
   # Using ImageMagick (if installed)
   convert icons/icon.svg -resize 16x16 icons/icon16.png
   convert icons/icon.svg -resize 48x48 icons/icon48.png
   convert icons/icon.svg -resize 128x128 icons/icon128.png
   ```

2. **Alternative: Online conversion**
   - Use online SVG to PNG converters
   - Upload `icons/icon.svg`
   - Download as 16x16, 48x48, and 128x128 PNG files
   - Save as `icon16.png`, `icon48.png`, and `icon128.png` in the `icons/` folder

## Expected Behavior

After installation, the extension will:

1. **Appear on any `/task/*` URL** - Shows on all task pages
2. **Start countdown on `/task/1`** - Timer begins automatically when navigating to `/task/1`
3. **Show waiting state on other task pages** - Displays "Navigate to /task/1 to start countdown" on `/task/2`, `/task/3`, etc.
4. **Display countdown in MM:SS format** (e.g., "10:00", "09:59", "00:30")
5. **Change to red color** during the final 60 seconds
6. **Disable form elements** when the timer expires (only on `/task/1`)
7. **Persist timer state** across navigation within task pages
8. **Reset timer** when navigating to `/task/1` from non-task pages (e.g., from home page, other sections)

## Testing the Extension

1. **Test on different task URLs:**
   - `/task/1` - Should show countdown timer
   - `/task/2`, `/task/3`, etc. - Should show waiting message
   - Other URLs - Extension should not appear

2. **Use the test page:**
   - Open `test-task-pages.html` in your browser
   - Use the navigation links to test different URL patterns
   - Verify countdown starts only on `/task/1`

3. **Verify functionality:**
   - Timer should start at 10:00 and count down on `/task/1`
   - AWS orange and dark blue styling should be visible
   - Form elements should be disabled when timer expires
   - Timer should reset to 10:00 when navigating to `/task/1` from non-task pages

## Troubleshooting

### Extension Not Loading
- Ensure all required files are present:
  - `manifest.json`
  - `content-script.js`
  - `styles.css`
  - `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
- Check Chrome console for error messages

### Timer Not Appearing
- Verify the URL contains "/task/1" in the path
- Check browser console (F12) for JavaScript errors
- Ensure the extension is enabled in chrome://extensions/

### Icons Not Displaying
- Verify PNG icon files exist in the `icons/` directory
- Check file names match exactly: `icon16.png`, `icon48.png`, `icon128.png`
- Reload the extension after adding icon files

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "AWS Countdown Timer"
3. Click "Remove"
4. Confirm removal

## File Structure

```
aws-countdown-extension/
├── manifest.json          # Extension configuration
├── content-script.js      # Main countdown logic
├── styles.css            # AWS-themed styling
├── README.md             # Project documentation
├── INSTALLATION.md       # This file
└── icons/               # Extension icons
    ├── icon.svg         # Source SVG icon
    ├── icon16.png       # 16x16 PNG icon (required)
    ├── icon48.png       # 48x48 PNG icon (required)
    └── icon128.png      # 128x128 PNG icon (required)
```

## Support

For issues or questions, refer to the main README.md file or check the browser console for error messages.