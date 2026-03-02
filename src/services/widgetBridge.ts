import { Capacitor, registerPlugin } from '@capacitor/core';

export const WIDGET_APP_SCHEME = 'sundaymornings';
export const WIDGET_DEEP_LINK_SOURCE_QUERY_KEY = 'source';
export const WIDGET_DEEP_LINK_SOURCE_VALUE = 'widget';
export const WIDGET_DEEP_LINK_ACTION_QUERY_KEY = 'widgetAction';
export const WIDGET_DEEP_LINK_DATE_QUERY_KEY = 'date';

export type WidgetLogAction = 'voice' | 'camera' | 'text';

export interface WidgetProgressPayload {
  consumedCalories: number;
  targetCalories: number;
  dateKey: string; // yyyy-MM-dd
}

interface WidgetBridgePlugin {
  updateDailyProgress(payload: WidgetProgressPayload): Promise<void>;
  consumePendingDeepLink(): Promise<{ url?: string }>;
}

const widgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

const isIOSNativeRuntime = (): boolean => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

export const syncWidgetDailyProgress = async (payload: WidgetProgressPayload): Promise<void> => {
  if (!isIOSNativeRuntime()) return;
  try {
    await widgetBridge.updateDailyProgress(payload);
  } catch (error) {
    // Non-fatal; widget sync should never block meal logging UX.
    console.warn('Unable to sync iOS widget progress.', error);
  }
};

export const normalizeWidgetLogAction = (value: string | null | undefined): WidgetLogAction | null => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'voice' || normalized === 'camera' || normalized === 'text') return normalized;
  return null;
};

export const consumePendingWidgetDeepLink = async (): Promise<string | null> => {
  if (!isIOSNativeRuntime()) return null;
  try {
    const response = await widgetBridge.consumePendingDeepLink();
    const url = response?.url?.trim();
    return url ? url : null;
  } catch (error) {
    console.warn('Unable to consume pending widget deep link.', error);
    return null;
  }
};
