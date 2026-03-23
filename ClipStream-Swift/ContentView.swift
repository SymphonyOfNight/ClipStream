import SwiftUI

struct ContentView: View {
    @EnvironmentObject var clipboardManager: ClipboardManager
    @State private var searchText = ""

    var filteredHistory: [ClipItem] {
        if searchText.isEmpty {
            return clipboardManager.history
        } else {
            return clipboardManager.history.filter { $0.text.localizedCaseInsensitiveContains(searchText) }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("ClipStream")
                    .font(.headline)
                Spacer()
                Button(action: { clipboardManager.clearHistory() }) {
                    Image(systemName: "trash")
                }
                .buttonStyle(PlainButtonStyle())
                .help("Clear History")
                
                Button(action: { NSApplication.shared.terminate(nil) }) {
                    Image(systemName: "power")
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.leading, 8)
                .help("Quit")
            }
            .padding()
            
            // Search Bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search...", text: $searchText)
                    .textFieldStyle(PlainTextFieldStyle())
            }
            .padding(8)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)
            .padding(.horizontal)
            .padding(.bottom, 8)
            
            Divider()
            
            // List
            if filteredHistory.isEmpty {
                Text(searchText.isEmpty ? "No history yet" : "No results found")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding()
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filteredHistory) { item in
                            Button(action: {
                                clipboardManager.copyToPasteboard(item: item)
                                // Close popover and paste
                                NSApp.sendAction(#selector(NSPopover.performClose(_:)), to: nil, from: nil)
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                    PasteHelper.paste()
                                }
                            }) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.text)
                                        .lineLimit(3)
                                        .font(.system(size: 13))
                                        .foregroundColor(.primary)
                                        .multilineTextAlignment(.leading)
                                    Text(item.timestamp, style: .time)
                                        .font(.system(size: 10))
                                        .foregroundColor(.secondary)
                                }
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
                                .cornerRadius(6)
                                .padding(.horizontal)
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
        }
        .frame(width: 320, height: 450)
        .background(Color(NSColor.windowBackgroundColor))
    }
}
