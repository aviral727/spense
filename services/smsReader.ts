import SmsAndroid from 'react-native-get-sms-android';
import { PermissionsAndroid, Platform } from 'react-native';
import { isTransactionSMS, parseSMSTransaction, ParsedTransaction } from '../utils/smsParser';

export async function requestSMSPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
        console.log('SMS reading is only available on Android');
        return false;
    }

    try {
        // Check if the native module is available (won't be in Expo Go)
        if (!SmsAndroid || typeof SmsAndroid.list !== 'function') {
            throw new Error('EXPO_GO_LIMITATION');
        }

        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            {
                title: 'SMS Permission',
                message: 'Spense needs access to your SMS messages to automatically detect bank transactions.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
            }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err: any) {
        if (err.message === 'EXPO_GO_LIMITATION') {
            console.error('SMS features require a development build. Not available in Expo Go.');
        } else {
            console.error('Error requesting SMS permission:', err);
        }
        return false;
    }
}

export async function checkSMSPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
        return granted;
    } catch (err) {
        console.error('Error checking SMS permission:', err);
        return false;
    }
}

export interface ReadSMSOptions {
    daysBack?: number;
    startDate?: number;
}

export function readSMSMessages(options: ReadSMSOptions | number = 30): Promise<ParsedTransaction[]> {
    return new Promise((resolve, reject) => {
        if (Platform.OS !== 'android') {
            reject(new Error('SMS reading is only available on Android'));
            return;
        }

        const daysBack = typeof options === 'number' ? options : (options.daysBack || 30);
        const minDate = (typeof options === 'object' && options.startDate)
            ? options.startDate
            : Date.now() - (daysBack * 24 * 60 * 60 * 1000);

        const filter = {
            box: 'inbox',
            minDate: minDate,
            maxCount: 3000, // Increased limit for longer ranges
        };

        SmsAndroid.list(
            JSON.stringify(filter),
            (fail: string) => {
                console.error('Failed to read SMS:', fail);
                reject(new Error(fail));
            },
            (count: number, smsList: string) => {
                try {
                    const messages = JSON.parse(smsList);
                    const parsedTransactions: ParsedTransaction[] = [];

                    messages.forEach((sms: any) => {
                        // Check if this is a transaction SMS
                        if (isTransactionSMS(sms.address, sms.body)) {
                            const parsed = parseSMSTransaction(sms.body, sms.date);
                            if (parsed) {
                                parsedTransactions.push(parsed);
                            }
                        }
                    });

                    console.log(`Found ${parsedTransactions.length} transactions from ${count} SMS messages`);
                    resolve(parsedTransactions);
                } catch (error) {
                    console.error('Error parsing SMS list:', error);
                    reject(error);
                }
            }
        );
    });
}
