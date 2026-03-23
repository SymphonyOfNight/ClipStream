import SwiftUI

@main
struct ClipStreamApp: App {
    @StateObject private var clipboardManager = ClipboardManager()

    var body: some Scene {
        // MenuBarExtra creates a native macOS menu bar application
        MenuBarExtra("ClipStream", systemImage: "doc.on.clipboard") {
            ContentView()
                .environmentObject(clipboardManager)
        }
        .menuBarExtraStyle(.window) // Renders the UI as a popover window
    }
}
