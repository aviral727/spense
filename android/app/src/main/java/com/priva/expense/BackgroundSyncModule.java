package com.priva.expense;

import android.content.Intent;
import android.os.Build;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class BackgroundSyncModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "BackgroundSyncModule";
    
    public BackgroundSyncModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    
    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    @ReactMethod
    public void startBackgroundSync(Promise promise) {
        try {
            Intent serviceIntent = new Intent(getReactApplicationContext(), SmsBackgroundService.class);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getReactApplicationContext().startForegroundService(serviceIntent);
            } else {
                getReactApplicationContext().startService(serviceIntent);
            }
            
            promise.resolve("Background sync started");
        } catch (Exception e) {
            promise.reject("START_ERROR", "Failed to start background sync: " + e.getMessage());
        }
    }
    
    @ReactMethod
    public void stopBackgroundSync(Promise promise) {
        try {
            Intent serviceIntent = new Intent(getReactApplicationContext(), SmsBackgroundService.class);
            getReactApplicationContext().stopService(serviceIntent);
            promise.resolve("Background sync stopped");
        } catch (Exception e) {
            promise.reject("STOP_ERROR", "Failed to stop background sync: " + e.getMessage());
        }
    }
}
