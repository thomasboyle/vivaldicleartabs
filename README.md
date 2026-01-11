# Vivaldi Clear Tabs Mod (Vertical Tabs Layout)

A custom UI modification for the Vivaldi browser designed specifically for **Vertical Tabs**. It adds a convenient button to close all unpinned tabs instantly, visualizing the separation between your pinned and unpinned tabs to help keep your workspace clean.

<img width="262" height="223" alt="image" src="https://github.com/user-attachments/assets/90339451-48bf-4c32-b336-dc075bba0470" />


## Features

-   **Vertical Tabs Optimized**: Designed exclusively for the vertical tab layout to integrate seamlessly.
-   **"Clear" Button**: Adds a `↓ Clear` button to the tab strip.
-   **Smart Hiding**: Automatically hides button if no unpinned tabs are present.
-   **One-Click Cleanup**: Instantly closes all unpinned tabs in the current window when clicked.

## Installation

### 1. Enable Custom CSS (Recommended)
Vivaldi has built-in support for custom CSS, which is the cleanest way to apply the styling.

1.  Open Vivaldi **Settings**.
2.  Go to **Appearance** > **Custom UI Modifications**.
3.  Click **Select Folder...** and choose the folder where you downloaded these files (the folder containing `custom.css`).
    *   *Note: This ensures Vivaldi loads the latest CSS directly from your folder.*

### 2. Install the JavaScript Mod
The functionality (closing tabs) requires a JavaScript file that Vivaldi doesn't load by default. You must install this part.

#### Option A: Automated (Python Script)
Run the included installer to copy the JS file and patch Vivaldi's `window.html`:

```bash
python install.py
```

*   The script will backup your `window.html`, copy `custom.js` to Vivaldi's internal resources, and apply the necessary patch.

#### Option B: Manual JS Installation
1.  Locate your Vivaldi application directory (e.g., `%LOCALAPPDATA%\Vivaldi\Application\<version>\resources\vivaldi`).
2.  Copy `custom.js` from this repository into that folder.
3.  Open `window.html` in a text editor.
4.  Add `<script src="custom.js"></script>` just before the closing `</body>` tag.
5.  Save and restart Vivaldi.

## Usage

Once installed, you will see a small "Clear" button in your vertical tab bar (if you use vertical tabs) or positioned within the tab strip.

-   **Click**: Closes all tabs that are **not pinned**. Pinned tabs remain safe.

## Uninstallation

To remove the mod:

1.  Run the installer again (it doesn't have an uninstall mode yet, so you'll have to do this manually for now).
2.  **Or**, go to the Vivaldi resources folder.
3.  Delete `window.html` and rename `window.html.bak` to `window.html` (if you used the installer).
4.  Alternatively, edit `window.html` and remove the `<script src="custom.js"></script>` line.

## Disclaimer

This mod modifies internal Vivaldi browser files. While safe, updates to Vivaldi will overwrite `window.html`, requiring you to re-run the installation script to restore the mod. Always back up your data.
