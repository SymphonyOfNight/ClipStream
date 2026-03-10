# ClipStream 📋

A sleek, fast, and modern clipboard manager built with Electron, React, and Tailwind CSS. ClipStream keeps track of your copied text and images, allowing you to search through your history and paste items instantly with a single keystroke.

![ClipStream](public/icon.png)

## ✨ Features

*   **📝 Text & Image Support:** Automatically saves your copied text snippets and images.
*   **🔍 Quick Search:** Instantly find past clippings with a fast, real-time search bar.
*   **⌨️ Global Shortcuts:** Access your clipboard history from anywhere using a global hotkey (Default: `Cmd+Shift+V` or `Ctrl+Shift+V`).
*   **⚙️ Highly Customizable:** 
    *   Adjust window positioning (Follow mouse, Top Right, Bottom Left, etc.).
    *   Set maximum history items and display lines.
    *   Toggle Dock and Menu Bar (Tray) visibility.
*   **🌍 Internationalization (i18n):** Fully supports English and Simplified Chinese.
*   **🚀 Auto-launch:** Option to start automatically at system login.
*   **🎨 Modern UI:** Beautiful, minimalist interface built with Tailwind CSS and smooth animations.

## 🛠️ Tech Stack

*   **Framework:** [Electron](https://www.electronjs.org/)
*   **Frontend:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
*   **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Database:** IndexedDB / SQLite

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/clipstream.git
   cd clipstream
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run electron:dev
   ```

### Building for Production

To build the application for your current operating system:

```bash
npm run electron:build
```

The compiled application will be available in the `dist-electron/` or `release/` directory.

## 🍏 Mac App Store (MAS) Deployment

ClipStream is configured to support Mac App Store deployment with App Sandbox enabled. 

To build for MAS, you need to:
1. Obtain your `3rd Party Mac Developer Application` and `3rd Party Mac Developer Installer` certificates from the Apple Developer Portal.
2. Create a Provisioning Profile for your App ID, download it, rename it to `embedded.provisionprofile`, and place it in the `build/` directory.
3. Update the `TEAM_ID` in `build/entitlements.mas.plist` with your actual Apple Team ID.
4. Run the build command:
   ```bash
   npm run electron:build
   ```

*Note: The app uses `osascript` (System Events) to simulate the `Cmd+V` keystroke for automatic pasting. This requires the `com.apple.security.temporary-exception.apple-events` entitlement, which may require explanation during the App Store review process.*

## 📄 License

This project is licensed under the MIT License.
