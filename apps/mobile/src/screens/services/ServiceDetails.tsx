import React from "react";
import { Services } from "./Services";
import type { Screen } from "../../types";

export function ServiceDetails({ go }: { go: (screen: Screen) => void }) {
	return <Services go={go} />;
}

export default ServiceDetails;
