package com.spense.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * BroadcastReceiver that listens for incoming SMS messages.
 * Works even when the app is closed/killed.
 */
public class SmsBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsBroadcastReceiver";
    private static final String SMS_RECEIVED = "android.provider.Telephony.SMS_RECEIVED";
    
    private static ReactApplicationContext reactContext;
    
    public static void setReactContext(ReactApplicationContext context) {
        reactContext = context;
    }
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction() == null || !intent.getAction().equals(SMS_RECEIVED)) {
            return;
        }
        
        Log.d(TAG, "SMS Received broadcast triggered");
        
        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;
        
        String format = bundle.getString("format");
        
        for (Object pdu : pdus) {
            SmsMessage smsMessage;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
            } else {
                smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
            }
            
            String sender = smsMessage.getDisplayOriginatingAddress();
            String messageBody = smsMessage.getMessageBody();
            long timestamp = smsMessage.getTimestampMillis();
            
            Log.d(TAG, "SMS from: " + sender + " | Body: " + messageBody.substring(0, Math.min(50, messageBody.length())));
            
            // Send to React Native if context is available
            if (reactContext != null && reactContext.hasActiveReactInstance()) {
                sendEventToJS(sender, messageBody, timestamp);
            } else {
                Log.d(TAG, "React context not available, SMS will be picked up on next app launch");
            }
        }
    }
    
    private void sendEventToJS(String sender, String body, long timestamp) {
        try {
            WritableMap params = Arguments.createMap();
            params.putString("sender", sender);
            params.putString("body", body);
            params.putDouble("timestamp", timestamp);
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("onSmsReceived", params);
            
            Log.d(TAG, "SMS event sent to React Native");
        } catch (Exception e) {
            Log.e(TAG, "Error sending event to JS: " + e.getMessage());
        }
    }
}
