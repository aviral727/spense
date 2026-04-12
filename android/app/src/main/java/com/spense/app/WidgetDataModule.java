package com.spense.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * React Native bridge module for updating the Spense home screen widget.
 *
 * JS Usage (services/budgetService.ts):
 *   import { NativeModules } from 'react-native';
 *   const { WidgetDataModule } = NativeModules;
 *   await WidgetDataModule?.updateWidgetData(
 *     safeToSpend,        // number — daily safe-to-spend amount
 *     monthlyRemaining,   // number — total remaining this period
 *     daysLeft,           // number — days left in budget period
 *     currency,           // string — e.g. "₹", "$"
 *     isOverBudget        // boolean
 *   );
 *
 * The module writes data to SharedPreferences (SpenseWidgetPrefs) and then
 * calls SpenseWidget.triggerUpdate() to re-render all active widget instances.
 */
public class WidgetDataModule extends ReactContextBaseJavaModule {

    private static final String TAG = "WidgetDataModule";
    private static final String MODULE_NAME = "WidgetDataModule";

    public WidgetDataModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Writes budget data to SharedPreferences and triggers a widget re-render.
     * Called from React Native every time the budget is recalculated.
     *
     * @param safeToSpend      Daily safe-to-spend amount (negative = over budget)
     * @param monthlyRemaining Total remaining budget for the period
     * @param daysLeft         Days remaining in the current budget period
     * @param currency         Currency symbol string (e.g. "₹")
     * @param isOverBudget     Whether the user has exceeded their budget
     * @param promise          Resolves true on success, rejects on error
     */
    @ReactMethod
    public void updateWidgetData(
            double safeToSpend,
            double monthlyRemaining,
            int daysLeft,
            String currency,
            boolean isOverBudget,
            Promise promise
    ) {
        try {
            Context context = getReactApplicationContext();

            // Write to SharedPreferences (read by SpenseWidget.java)
            SharedPreferences prefs = context.getSharedPreferences(
                    SpenseWidget.PREFS_NAME, Context.MODE_PRIVATE);

            prefs.edit()
                    .putFloat(SpenseWidget.KEY_SAFE_TO_SPEND,     (float) safeToSpend)
                    .putFloat(SpenseWidget.KEY_MONTHLY_REMAINING, (float) monthlyRemaining)
                    .putInt(SpenseWidget.KEY_DAYS_LEFT,           daysLeft)
                    .putString(SpenseWidget.KEY_CURRENCY,         currency)
                    .putBoolean(SpenseWidget.KEY_IS_OVER_BUDGET,  isOverBudget)
                    .apply();

            // Re-render all active widget instances
            SpenseWidget.triggerUpdate(context);

            Log.d(TAG, "Widget data updated — safeToSpend: " + safeToSpend
                    + " daysLeft: " + daysLeft + " currency: " + currency);

            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update widget data: " + e.getMessage());
            promise.reject("WIDGET_UPDATE_ERROR", e.getMessage());
        }
    }
}
