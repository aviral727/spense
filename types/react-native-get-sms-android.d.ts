declare module 'react-native-get-sms-android' {
    export interface SmsFilter {
        box?: string;
        minDate?: number;
        maxDate?: number;
        maxCount?: number;
    }

    export interface SmsMessage {
        _id: string;
        address: string;
        body: string;
        date: number;
        read: number;
        type: number;
    }

    const SmsAndroid: {
        list(
            filter: string,
            fail: (error: string) => void,
            success: (count: number, smsList: string) => void
        ): void;
    };

    export default SmsAndroid;
}
