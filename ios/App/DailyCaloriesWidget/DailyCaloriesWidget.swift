import WidgetKit
import SwiftUI

private enum WidgetStorage {
    static let appGroups = [
        "group.com.sundaymorningsios.app.shared",
        "group.com.sundaymornings.app.shared"
    ]
    static let consumedKey = "widget_consumed_calories"
    static let targetKey = "widget_target_calories"
    static let dateKey = "widget_date_key"
}

private enum WidgetDeepLink {
    static let scheme = "sundaymornings"
    static let host = "log"
    static let sourceQueryKey = "source"
    static let sourceValue = "widget"
    static let actionQueryKey = "widgetAction"
    static let dateQueryKey = "date"
}

struct DailyCaloriesEntry: TimelineEntry {
    let date: Date
    let consumedCalories: Int
    let targetCalories: Int
    let dateKey: String

    var progress: Double {
        guard targetCalories > 0 else { return 0 }
        return min(max(Double(consumedCalories) / Double(targetCalories), 0), 1)
    }
}

struct DailyCaloriesProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyCaloriesEntry {
        DailyCaloriesEntry(
            date: Date(),
            consumedCalories: 1320,
            targetCalories: 2000,
            dateKey: Self.todayKey
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyCaloriesEntry) -> Void) {
        completion(loadEntry(fallbackDate: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyCaloriesEntry>) -> Void) {
        let entry = loadEntry(fallbackDate: Date())
        let refreshDate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(refreshDate)))
    }

    private func loadEntry(fallbackDate: Date) -> DailyCaloriesEntry {
        var defaultsWithData: UserDefaults? = nil
        var firstDefaults: UserDefaults? = nil
        for group in WidgetStorage.appGroups {
            guard let defaults = UserDefaults(suiteName: group) else { continue }
            if firstDefaults == nil {
                firstDefaults = defaults
            }
            if defaults.object(forKey: WidgetStorage.consumedKey) != nil ||
                defaults.object(forKey: WidgetStorage.targetKey) != nil ||
                defaults.object(forKey: WidgetStorage.dateKey) != nil {
                defaultsWithData = defaults
                break
            }
        }
        let defaults = defaultsWithData ?? firstDefaults

        let consumedCalories = defaults?.integer(forKey: WidgetStorage.consumedKey) ?? 0
        let targetCalories = defaults?.integer(forKey: WidgetStorage.targetKey) ?? 0
        let dateKey = (defaults?.string(forKey: WidgetStorage.dateKey) ?? Self.todayKey)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return DailyCaloriesEntry(
            date: fallbackDate,
            consumedCalories: max(0, consumedCalories),
            targetCalories: max(0, targetCalories),
            dateKey: dateKey.isEmpty ? Self.todayKey : dateKey
        )
    }

    private static var todayKey: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

struct DailyCaloriesWidgetEntryView: View {
    @Environment(\.widgetFamily) private var widgetFamily
    let entry: DailyCaloriesProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Today")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Text("\(Int(entry.progress * 100))%")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
            }

            Text("\(entry.consumedCalories) / \(entry.targetCalories) kcal")
                .font(.headline)
                .lineLimit(1)

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.gray.opacity(0.18))
                    Capsule()
                        .fill(progressColor)
                        .frame(width: max(4, geometry.size.width * entry.progress))
                }
            }
            .frame(height: 11)

            if widgetFamily == .systemSmall {
                HStack(spacing: 8) {
                    WidgetActionLink(
                        mode: "voice",
                        label: "Voice",
                        systemImage: "mic.fill",
                        dateKey: entry.dateKey,
                        showLabel: false
                    )
                    WidgetActionLink(
                        mode: "camera",
                        label: "Camera",
                        systemImage: "camera.fill",
                        dateKey: entry.dateKey,
                        showLabel: false
                    )
                    WidgetActionLink(
                        mode: "text",
                        label: "Text",
                        systemImage: "text.bubble.fill",
                        dateKey: entry.dateKey,
                        showLabel: false
                    )
                }
            } else {
                HStack(spacing: 6) {
                    WidgetActionLink(mode: "voice", label: "Voice", systemImage: "mic.fill", dateKey: entry.dateKey)
                    WidgetActionLink(mode: "camera", label: "Camera", systemImage: "camera.fill", dateKey: entry.dateKey)
                    WidgetActionLink(mode: "text", label: "Text", systemImage: "text.bubble.fill", dateKey: entry.dateKey)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(14)
        .widgetBackground()
    }

    private var progressColor: Color {
        if entry.targetCalories <= 0 { return .blue }
        return entry.consumedCalories > entry.targetCalories ? .orange : .green
    }
}

struct WidgetActionLink: View {
    let mode: String
    let label: String
    let systemImage: String
    let dateKey: String
    let showLabel: Bool

    var body: some View {
        Link(destination: actionURL) {
            HStack(spacing: showLabel ? 4 : 0) {
                Image(systemName: systemImage)
                    .font(.caption2)
                if showLabel {
                    Text(label)
                        .font(.caption2)
                        .fontWeight(.semibold)
                }
            }
            .lineLimit(1)
            .padding(.horizontal, showLabel ? 0 : 6)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background(Color.primary.opacity(0.09), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private var actionURL: URL {
        var components = URLComponents()
        components.scheme = WidgetDeepLink.scheme
        components.host = WidgetDeepLink.host
        components.queryItems = [
            URLQueryItem(name: WidgetDeepLink.sourceQueryKey, value: WidgetDeepLink.sourceValue),
            URLQueryItem(name: WidgetDeepLink.actionQueryKey, value: mode),
            URLQueryItem(name: WidgetDeepLink.dateQueryKey, value: dateKey)
        ]
        return components.url ?? URL(string: "\(WidgetDeepLink.scheme)://\(WidgetDeepLink.host)")!
    }
}

private extension WidgetActionLink {
    init(mode: String, label: String, systemImage: String, dateKey: String) {
        self.init(mode: mode, label: label, systemImage: systemImage, dateKey: dateKey, showLabel: true)
    }
}

struct DailyCaloriesWidget: Widget {
    let kind: String = "DailyCaloriesWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DailyCaloriesProvider()) { entry in
            DailyCaloriesWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Calories Progress")
        .description("Track today's calories and jump straight into voice, camera, or text logging.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private extension View {
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) {
                Color(.systemBackground)
            }
        } else {
            background(Color(.systemBackground))
        }
    }
}
