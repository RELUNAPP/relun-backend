// SMS Service for sending OTP and other messages via Termii

interface SMSOptions {
  to: string;
  message: string;
}

interface TermiiResponse {
  code: string;
  message_id: string;
  message: string;
  balance: number;
  user: string;
}

const TERMII_API_URL = 'https://api.ng.termii.com/api/sms/send';

export const sendSMS = async (
  options: SMSOptions
): Promise<{ success: boolean; messageId: string }> => {
  try {
    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID || 'N-Alert';

    if (!apiKey) {
      console.warn('[SMS] TERMII_API_KEY not set, running in dev mode');
      console.log(`[SMS] Would send to ${options.to}: ${options.message}`);
      return { success: true, messageId: 'dev-mode' };
    }

    const payload = {
      to: options.to,
      from: senderId,
      sms: options.message,
      type: 'plain',
      channel: 'generic',
      api_key: apiKey,
    };

    const response = await fetch(TERMII_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as TermiiResponse;

    if (data.code === 'ok') {
      console.log(`[SMS] Successfully sent to ${options.to}, messageId: ${data.message_id}`);
      return { success: true, messageId: data.message_id };
    }

    console.error('[SMS] Termii error:', data.message);
    throw new Error(data.message || 'Failed to send SMS via Termii');
  } catch (error) {
    console.error('[SMS] Error sending SMS:', error);
    throw new Error('Failed to send SMS');
  }
};
