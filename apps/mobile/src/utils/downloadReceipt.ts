import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { tenantConfig } from "../config/tenant";

export async function downloadReceipt(
	input: {
		receipt?: string;
		patient?: string;
		service?: string;
		date?: string;
		total?: string;
		clinicName?: string;
	} = {},
) {
	const receipt = input.receipt ?? "Receipt";
	const patient = input.patient ?? "Patient";
	const service = input.service ?? "Dental service";
	const date = input.date ?? new Date().toLocaleDateString();
	const total = input.total ?? "0";
	const clinicName = input.clinicName ?? tenantConfig.displayName;
	const html = `<html><body style="font-family: sans-serif; padding: 40px"><h1>${clinicName} - Payment Receipt</h1><p>${receipt}</p><hr/><p><strong>Patient:</strong> ${patient}</p><p><strong>Service:</strong> ${service}</p><p><strong>Clinic:</strong> ${clinicName}</p><p><strong>Date:</strong> ${date}</p><h2>Total paid: ${total} ETB</h2></body></html>`;
	if (Platform.OS === "web") {
		const stream = `BT /F1 20 Tf 50 750 Td (${clinicName} - Payment Receipt) Tj 0 -40 Td /F1 12 Tf 50 710 Td (${receipt}) Tj 0 -30 Td (Patient: ${patient}) Tj 0 -24 Td (Service: ${service}) Tj 0 -24 Td (Clinic: ${clinicName}) Tj 0 -24 Td (Date: ${date}) Tj 0 -35 Td /F1 16 Tf (Total paid: ${total} ETB) Tj ET`;
		const objects = [
			"<< /Type /Catalog /Pages 2 0 R >>",
			"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
			"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
			`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
			"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		];
		let pdf = "%PDF-1.4\n";
		const offsets = [0];
		objects.forEach((object, index) => {
			offsets.push(pdf.length);
			pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
		});
		const xrefOffset = pdf.length;
		pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
			.slice(1)
			.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
			.join(
				"\n",
			)}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
		const url = URL.createObjectURL(
			new Blob([pdf], { type: "application/pdf" }),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = "tenadent-receipt.pdf";
		link.click();
		URL.revokeObjectURL(url);
		return;
	}
	const { uri } = await Print.printToFileAsync({ html });
	if (await Sharing.isAvailableAsync())
		await Sharing.shareAsync(uri, {
			mimeType: "application/pdf",
			dialogTitle: `Download ${clinicName} receipt`,
		});
}

export default downloadReceipt;
