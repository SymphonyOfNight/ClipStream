import Foundation
import AppKit

struct ClipItem: Identifiable, Codable, Equatable {
    var id = UUID()
    var text: String
    var timestamp: Date
}

class ClipboardManager: ObservableObject {
    @Published var history: [ClipItem] = []
    private let pasteboard = NSPasteboard.general
    private var lastChangeCount: Int = 0
    private var timer: Timer?

    init() {
        lastChangeCount = pasteboard.changeCount
        loadHistory()
        startMonitoring()
    }

    func startMonitoring() {
        // Poll the pasteboard every 0.5 seconds
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.checkForChanges()
        }
    }

    func checkForChanges() {
        guard pasteboard.changeCount != lastChangeCount else { return }
        lastChangeCount = pasteboard.changeCount

        if let newString = pasteboard.string(forType: .string) {
            let trimmedString = newString.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedString.isEmpty { return }

            DispatchQueue.main.async {
                // Avoid consecutive duplicates
                if let first = self.history.first, first.text == newString { return }
                
                let item = ClipItem(text: newString, timestamp: Date())
                self.history.insert(item, at: 0)
                
                // Keep only last 100 items
                if self.history.count > 100 {
                    self.history.removeLast()
                }
                self.saveHistory()
            }
        }
    }

    func copyToPasteboard(item: ClipItem) {
        pasteboard.clearContents()
        pasteboard.setString(item.text, forType: .string)
        lastChangeCount = pasteboard.changeCount
        
        // Move item to top
        if let index = history.firstIndex(where: { $0.id == item.id }) {
            var updatedItem = history.remove(at: index)
            updatedItem.timestamp = Date()
            history.insert(updatedItem, at: 0)
            saveHistory()
        }
    }
    
    func clearHistory() {
        history.removeAll()
        saveHistory()
    }
    
    // MARK: - Persistence
    private let saveKey = "ClipStreamHistory"
    
    private func saveHistory() {
        if let encoded = try? JSONEncoder().encode(history) {
            UserDefaults.standard.set(encoded, forKey: saveKey)
        }
    }
    
    private func loadHistory() {
        if let data = UserDefaults.standard.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode([ClipItem].self, from: data) {
            self.history = decoded
        }
    }
}
