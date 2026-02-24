import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNativeIos = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

const runIfSupported = async (operation: () => Promise<void>): Promise<void> => {
  if (!isNativeIos()) return;

  try {
    await operation();
  } catch {
    // Ignore haptics failures so meal logging/planning flows still succeed.
  }
};

export const triggerMealSubmitHaptic = async (): Promise<void> => {
  await runIfSupported(() => Haptics.impact({ style: ImpactStyle.Light }));
};

export const triggerMealLoggedSuccessHaptic = async (): Promise<void> => {
  await runIfSupported(() => Haptics.notification({ type: NotificationType.Success }));
};

export const triggerSubmitHaptic = triggerMealSubmitHaptic;
export const triggerSuccessHaptic = triggerMealLoggedSuccessHaptic;
