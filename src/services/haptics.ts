import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const HAPTICS_DEBUG_STORAGE_KEY = 'dn.debug.haptics';
let hasWarnedAboutUnsupportedPlatform = false;

const isNativeIos = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

const isDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(HAPTICS_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const debugLog = (...args: unknown[]): void => {
  if (!isDebugEnabled()) return;
  console.info('[haptics]', ...args);
};

const platformSummary = (): string => {
  try {
    return `platform=${Capacitor.getPlatform()} native=${String(Capacitor.isNativePlatform())}`;
  } catch {
    return 'platform=unknown';
  }
};

const runIfSupported = async (operation: () => Promise<void>): Promise<void> => {
  if (!isNativeIos()) {
    if (!hasWarnedAboutUnsupportedPlatform) {
      hasWarnedAboutUnsupportedPlatform = true;
      console.warn(`[haptics] skipped: ${platformSummary()}`);
    }
    return;
  }

  try {
    await operation();
  } catch (error) {
    // Keep UX flow resilient, but log failures for device debugging.
    console.warn('[haptics] trigger failed', error);
  }
};

export const triggerMealSubmitHaptic = async (): Promise<void> => {
  debugLog('trigger submit');
  await runIfSupported(() => Haptics.impact({ style: ImpactStyle.Light }));
};

export const triggerMealLoggedSuccessHaptic = async (): Promise<void> => {
  debugLog('trigger success');
  await runIfSupported(() => Haptics.notification({ type: NotificationType.Success }));
};

export const triggerSubmitHaptic = triggerMealSubmitHaptic;
export const triggerSuccessHaptic = triggerMealLoggedSuccessHaptic;
