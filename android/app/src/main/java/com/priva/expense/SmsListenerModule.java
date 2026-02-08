package com.priva.expense;

import android.content.IntentFilter;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import androidx.annotation.NonNull;

/**
 * React Native bridge module for SMS listening functionality.
 */
public class SmsListenerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SmsListenerModule";
    private static final String MODULE_NAME = "SmsListenerModule";
    
    private final ReactApplicationContext reactContext;
    private SmsBroadcastReceiver smsReceiver;
    private boolean isListening = false;
    
    public SmsListenerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        
        // Set context for the static receiver
        SmsBroadcastReceiver.setReactContext(reactContext);
    }
    
    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    /**
     * Start listening for incoming SMS (dynamic registration for foreground)
     */
    @ReactMethod
    public void startListening(Promise promise) {
        try {
            if (isListening) {
                promise.resolve("Already listening");
                return;
            }
            
            smsReceiver = new SmsBroadcastReceiver();
            IntentFilter filter = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
            filter.setPriority(IntentFilter.SYSTEM_HIGH_PRIORITY);
            
            reactContext.registerReceiver(smsReceiver, filter);
            isListening = true;
            
            Log.d(TAG, "SMS listener started (dynamic)");
            promise.resolve("Listening started");
        } catch (Exception e) {
            Log.e(TAG, "Error starting listener: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }
    
    /**
     * Stop listening for SMS
     */
    @ReactMethod
    public void stopListening(Promise promise) {
        try {
            if (smsReceiver != null && isListening) {
                reactContext.unregisterReceiver(smsReceiver);
                smsReceiver = null;
                isListening = false;
                Log.d(TAG, "SMS listener stopped");
            }
            promise.resolve("Listening stopped");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping listener: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }
    
    /**
     * Check if currently listening
     */
    @ReactMethod
    public void isListening(Promise promise) {
        promise.resolve(isListening);
    }
    
    /**
     * Required for RN event emission
     */
    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for RN event system
    }
    
    @ReactMethod
    public void removeListeners(Integer count) {
        // Keep: Required for RN event system
    }
}
