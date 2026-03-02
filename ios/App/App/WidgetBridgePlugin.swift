import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateDailyProgress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingDeepLink", returnType: CAPPluginReturnPromise)
    ]

    private enum Storage {
        static let appGroups = [
            "group.com.sundaymorningsios.app.shared",
            "group.com.sundaymornings.app.shared"
        ]
        static let widgetKind = "DailyCaloriesWidget"
        static let consumedKey = "widget_consumed_calories"
        static let targetKey = "widget_target_calories"
        static let dateKey = "widget_date_key"
        static let updatedAtKey = "widget_last_updated_at"
    }

    @objc func updateDailyProgress(_ call: CAPPluginCall) {
        guard let consumedCalories = call.getInt("consumedCalories"),
              let targetCalories = call.getInt("targetCalories"),
              let dateKey = call.getString("dateKey"),
              !dateKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            call.reject("consumedCalories, targetCalories, and dateKey are required.")
            return
        }

        let defaultsTargets = Storage.appGroups.compactMap { UserDefaults(suiteName: $0) }
        guard !defaultsTargets.isEmpty else {
            call.reject("Unable to access shared app-group defaults.")
            return
        }

        for defaults in defaultsTargets {
            defaults.set(max(0, consumedCalories), forKey: Storage.consumedKey)
            defaults.set(max(0, targetCalories), forKey: Storage.targetKey)
            defaults.set(dateKey, forKey: Storage.dateKey)
            defaults.set(Date().timeIntervalSince1970, forKey: Storage.updatedAtKey)
            defaults.synchronize()
        }

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadTimelines(ofKind: Storage.widgetKind)
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve()
    }

    @objc func consumePendingDeepLink(_ call: CAPPluginCall) {
        let key = "dn_pending_deep_link_url"
        let defaults = UserDefaults.standard
        let url = defaults.string(forKey: key)
        defaults.removeObject(forKey: key)
        if let url = url, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            call.resolve([
                "url": url
            ])
            return
        }
        call.resolve([:])
    }
}
