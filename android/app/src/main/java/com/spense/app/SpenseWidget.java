package com.spense.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;
import android.widget.RemoteViews;

import java.util.Locale;

/**
 * Spense Home Screen Widget
 *
 * Displays:
 *   - "Safe to Spend Today" amount (updates from SharedPreferences written by WidgetDataModule)
 *   - Days remaining in budget period
 *   - [+] button that deep-links directly to the Add Expense screen (spense://add)
 *   - Tapping the card body opens the app home screen
 *
 * Data is written to SharedPreferences by WidgetDataModule.java (called from React Native)
 * whenever the budget is recalculated. The widget also auto-updates every 30 minutes via
 * the android:updatePeriodMillis in spense_widget_info.xml.
 */
public class SpenseWidget extends AppWidgetProvider {

    private static final String TAG = "SpenseWidget";

    // SharedPreferences file name — must match WidgetDataModule.java
    public static final String PREFS_NAME = "SpenseWidgetPrefs";

    // SharedPreferences keys — must match WidgetDataModule.java
    public static final String KEY_SAFE_TO_SPEND     = "safeToSpend";
    public static final String KEY_MONTHLY_REMAINING = "monthlyRemaining";
    public static final String KEY_DAYS_LEFT         = "daysLeft";
    public static final String KEY_CURRENCY          = "currency";
    public static final String KEY_IS_OVER_BUDGET    = "isOverBudget";

    // Deep link scheme (must match "scheme" in app.json + intent-filter in AndroidManifest)
    private static final String DEEP_LINK_ADD = "spense://add";
    private static final String DEEP_LINK_HOME = "spense://";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        Log.d(TAG, "onUpdate called for " + appWidgetIds.length + " widget(s)");
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onEnabled(Context context) {
        Log.d(TAG, "First widget added to home screen");
    }

    @Override
    public void onDisabled(Context context) {
        Log.d(TAG, "Last widget removed from home screen");
    }

    /**
     * Builds and applies the RemoteViews for one widget instance.
     * Called both by onUpdate (system scheduler) and by triggerUpdate (from JS).
     */
    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // ── Read budget data from SharedPreferences ──────────────────────────
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        float safeToSpend     = prefs.getFloat(KEY_SAFE_TO_SPEND, 0f);
        float monthlyRemaining = prefs.getFloat(KEY_MONTHLY_REMAINING, 0f);
        int   daysLeft        = prefs.getInt(KEY_DAYS_LEFT, 0);
        String currency       = prefs.getString(KEY_CURRENCY, "₹");
        boolean isOverBudget  = prefs.getBoolean(KEY_IS_OVER_BUDGET, false);

        // ── Build RemoteViews ─────────────────────────────────────────────────
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.spense_widget);

        // Amount — red if over budget, white otherwise
        String amountText = currency + formatAmount(Math.abs(safeToSpend));
        views.setTextViewText(R.id.widget_amount, isOverBudget ? "-" + amountText : amountText);
        views.setTextColor(R.id.widget_amount, isOverBudget ? 0xFFEF4444 : 0xFFFFFFFF);

        // Label
        views.setTextViewText(R.id.widget_label,
                isOverBudget ? "Over Budget" : "Safe to Spend Today");
        views.setTextColor(R.id.widget_label,
                isOverBudget ? 0xFFFCA5A5 : 0xFF9CA3AF);

        // Days left footer
        String footer;
        if (daysLeft <= 0) {
            footer = "Open app to set budget";
        } else {
            footer = daysLeft + (daysLeft == 1 ? " day left" : " days left");
        }
        views.setTextViewText(R.id.widget_days_left, footer);

        // ── PendingIntents ────────────────────────────────────────────────────

        // [+] button → deep-link to /add screen
        Intent addIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK_ADD));
        addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent addPendingIntent = PendingIntent.getActivity(
                context, 0, addIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_add_button, addPendingIntent);

        // Card body → open app home screen
        Intent homeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK_HOME));
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent homePendingIntent = PendingIntent.getActivity(
                context, 1, homeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, homePendingIntent);

        // ── Apply ─────────────────────────────────────────────────────────────
        appWidgetManager.updateAppWidget(appWidgetId, views);
        Log.d(TAG, "Widget updated — amount: " + amountText + " daysLeft: " + daysLeft);
    }

    /**
     * Called from WidgetDataModule after budget data is written to SharedPreferences.
     * Finds all active widget instances and re-renders them.
     */
    public static void triggerUpdate(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, SpenseWidget.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

        if (appWidgetIds.length == 0) {
            Log.d(TAG, "No active widgets, skipping update");
            return;
        }

        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
        Log.d(TAG, "Triggered update for " + appWidgetIds.length + " widget(s)");
    }

    /**
     * Formats a float amount for compact display:
     *   ≥ 1,00,000  → "1.2L"
     *   ≥  1,000    → "1,240"  (Indian number formatting via toLocaleString on JS side,
     *                            here we just round to nearest int)
     *   < 1,000     → "847"
     */
    private static String formatAmount(float amount) {
        if (amount >= 100000) {
            return String.format(Locale.US, "%.1fL", amount / 100000f);
        } else {
            return String.format(Locale.US, "%,.0f", amount);
        }
    }
}
