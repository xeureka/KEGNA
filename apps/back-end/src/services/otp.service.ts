import { otpRepository } from "@/repositories/otp.repository";
import { type OtpSender, SmsEthiopiaOtpSender } from "./otp-sender.interface";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

export class OtpService {
	constructor(private otpSender: OtpSender = new SmsEthiopiaOtpSender()) {}

	setOtpSender(sender: OtpSender): void {
		this.otpSender = sender;
	}

	async generateAndSendOtp(phone: string): Promise<string> {
		const code = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

		await otpRepository.saveOtp(phone, code, expiresAt);
		await this.otpSender.sendOtp(phone, code);

		return code;
	}

	async verifyOtp(phone: string, code: string): Promise<boolean> {
		const record = await otpRepository.findValidOtp(phone, code);
		if (!record) {
			throw new AppError(
				"Invalid or expired OTP code",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		await otpRepository.deleteOtp(phone);
		return true;
	}
}

export const otpService = new OtpService();
