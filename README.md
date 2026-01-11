# Vivaldi Clear Tabs Mod (Vertical Tabs Layout)

A custom UI modification for the Vivaldi browser designed specifically for **Vertical Tabs**. It adds a convenient button to close all unpinned tabs instantly, visualizing the separation between your pinned and unpinned tabs to help keep your workspace clean.

## Features

-   **Vertical Tabs Optimized**: Designed exclusively for the vertical tab layout to integrate seamlessly.
-   **"Clear" Button**: Adds a `↓ Clear` button to the tab strip.
-   **Smart Hiding**: Automatically hides button if no unpinned tabs are present.
-   **One-Click Cleanup**: Instantly closes all unpinned tabs in the current window when clicked.
-   **Optimistic UI**: Immediately hides tabs upon clicking for a responsive feel, while the background process handles the actual tab removal.
-   **Automated Installer**: Includes a Python script to handle file copying and patching of Vivaldi's `window.html`.

## Installation

### Automated Installation (Recommended)

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/thomasboyle/vivaldicleartabs.git
    cd vivaldicleartabs
    ```

2.  **Run the installer**:
    Ensure you have Python 3 installed, then run:
    ```bash
    python install.py
    ```
    This script will:
    *   Locate your Vivaldi installation.
    *   Backup your existing `window.html`.
    *   Copy `custom.js` and `custom.css` to the Vivaldi resources directory.
    *   Patch `window.html` to load the mod.

3.  **Restart Vivaldi**: Changes will take effect after a browser restart.

### Manual Installation

If you prefer to install manually or the script fails:

1.  Locate your Vivaldi application directory (usually `%LOCALAPPDATA%\Vivaldi\Application\<version>\resources\vivaldi`).
2.  Copy `custom.js` and `custom.css` from this repo into that folder.
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
