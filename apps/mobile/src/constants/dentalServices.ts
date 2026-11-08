import type { DentalService } from "../types";

export const dentalServices: DentalService[] = [
	{
		title: "Dental cleaning & polishing",
		description:
			"Remove plaque and surface stains for a fresher, healthier smile.",
		detailedDescription:
			"Full-mouth ultrasonic scaling and airflow polish designed to gently remove stubborn plaque, calculus (tartar), and surface stains. Concludes with a fluoride enamel treatment to reinforce tooth strength and refresh your breath.",
		duration: "45 mins",
		price: "1,200 ETB",
		features: [
			"Ultrasonic tartar scaling",
			"Airflow stain removal",
			"Protective fluoride glaze",
		],
		note: "Recommended twice a year for healthy gums and stain prevention.",
	},
	{
		title: "Routine dental checkup",
		description:
			"A careful examination to spot cavities, gum concerns, and early problems.",
		detailedDescription:
			"A comprehensive oral evaluation performed by our lead dental surgeon. Includes a 32-point visual exam of teeth, periodontal pocket depth screening, gum health review, and customized preventive dental counsel.",
		duration: "30 mins",
		price: "800 ETB",
		features: [
			"Comprehensive 32-point dental exam",
			"Gum health & periodontal screening",
			"Early decay & bite diagnostics",
		],
		note: "Best for catching subtle dental issues before pain or tooth damage occurs.",
	},
	{
		title: "Tooth restoration",
		description:
			"Repair a damaged or decayed tooth with a comfortable tooth-coloured filling.",
		detailedDescription:
			"Direct biocompatible composite restoration to repair decay, chipped edges, or fractured enamel. Carefully sculpted and cured to match the precise color, translucency, and functional bite of your natural tooth.",
		duration: "60 mins",
		price: "From 1,500 ETB",
		features: [
			"Gentle cavity cleaning & disinfection",
			"Natural tooth-shade composite resin",
			"Comfortable local anesthesia available",
		],
		note: "Restores chewing strength and blends seamlessly with your smile.",
	},
	{
		title: "Teeth whitening",
		description:
			"Brighten your smile with a professional whitening consultation and treatment.",
		detailedDescription:
			"In-clinic light-activated whitening treatment designed to lift years of deep intrinsic discoloration by up to 6–8 shades. Formulated with gentle desensitizers to preserve enamel comfort and maximize luster.",
		duration: "60 mins",
		price: "From 2,500 ETB",
		features: [
			"Pre-treatment shade matching",
			"Protective gingival barrier application",
			"Light-activated brightening session",
		],
		note: "Great before weddings, special events, or to reverse coffee & tea discoloration.",
	},
];

export default dentalServices;
