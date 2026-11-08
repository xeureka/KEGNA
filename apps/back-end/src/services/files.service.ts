import { readBeverageReceipt } from "@/services/beverage.service";
import { saveImage } from "@/services/storage.service";
export async function uploadImage(file: File) { return saveImage(file); }
export async function readIssueFile(actor: { id: string; role?: string | null }, key: string) { return readBeverageReceipt(actor, key); }
