import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { otpRequestContext } from "@/services/otp-context";
import { smsEthiopiaService } from "@/services/sms-ethiopia.service";
import { toSmsEthiopiaMsisdn } from "@/utils/phone";

export interface OtpSender {
	sendOtp(phone: string, code: string): Promise<void>;
}

export class SmsEthiopiaOtpSender implements OtpSender {
	async sendOtp(phone: string, code: string): Promise<void> {
		let msisdn: string;
		try {
			msisdn = toSmsEthiopiaMsisdn(phone);
		} catch (error) {
			throw new AppError(
				error instanceof Error ? error.message : "Invalid phone number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		const tenantName =
			otpRequestContext.getStore()?.tenantName?.trim() || "Nexa";
		const clinic = tenantName.slice(0, 40);

		await smsEthiopiaService.sendSms({
			msisdn,
			text: `Your ${clinic} verification code is ${code}. Do not share this code.`,
		});
	}
}

export const smsEthiopiaOtpSender = new SmsEthiopiaOtpSender();
