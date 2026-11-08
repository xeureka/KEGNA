import React from "react";
import Svg, { Path } from "react-native-svg";
import { colors } from "../constants/colors";
import { Text } from "./Text";

export const Icon = ({
	children,
	size = 20,
	color = colors.primary,
}: {
	children: string;
	size?: number;
	color?: string;
}) => (
	<Text
		style={{ color, fontSize: size, lineHeight: size + 2, fontWeight: "700" }}
	>
		{children}
	</Text>
);

export const Bell1 = ({ size = 22 }: { size?: number }) => (
	<Svg width={size} height={(size * 25) / 24} viewBox="0 0 24 25" fill="none">
		<Path
			d="M12.7516 3.00098C12.7516 2.58676 12.4158 2.25098 12.0016 2.25098C11.5874 2.25098 11.2516 2.58676 11.2516 3.00098V3.78801C7.46161 4.1643 4.5016 7.36197 4.5016 11.251V14.365L3.80936 16.2109C3.25776 17.6819 4.34514 19.251 5.9161 19.251H18.0871C19.658 19.2509 20.7454 17.6819 20.1938 16.2109L19.5016 14.365V11.251C19.5016 7.36197 16.5416 4.1643 12.7516 3.78801V3.00098Z"
			fill={colors.accent}
		/>
		<Path
			d="M14.8735 20.251H9.1261C9.55865 21.418 10.6823 22.2495 11.9998 22.2495C13.3173 22.2495 14.441 21.418 14.8735 20.251Z"
			fill={colors.accent}
		/>
	</Svg>
);

export const ToothIcon = ({
	size = 22,
	color = colors.primary,
}: {
	size?: number;
	color?: string;
}) => (
	<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
		<Path
			d="M7 2C4 2 2 5 2 8c0 2.11 1 5 2 6 1 1 2 8 4 8 4.54 0 2-7 4-7s-.54 7 4 7c2 0 3-7 4-8 1-1 2-3.89 2-6 0-3-2-6-5-6-3 0-3 1-5 1s-2-1-5-1Z"
			fill={color}
		/>
	</Svg>
);

export const Glyph = ({
	d,
	size = 22,
	color,
}: {
	d: string;
	size?: number;
	color: string;
}) => (
	<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
		<Path d={d} fill={color} />
	</Svg>
);

export const icons = {
	home: (size = 22, color = colors.muted) => (
		<Glyph
			size={size}
			color={color}
			d="M12 3.2 3.8 9.7c-.3.2-.4.7-.2 1 .2.4.7.5 1.1.3V20c0 .6.4 1 1 1h4.4c.5 0 1-.4 1-1v-5.2h2.8V20c0 .6.4 1 1 1H19.3c.5 0 1-.4 1-1v-9c.4.2.9 0 1.1-.3.2-.4.1-.8-.2-1L12 3.2Z"
		/>
	),
	visits: (size = 22, color = colors.muted) => (
		<Glyph
			size={size}
			color={color}
			d="M8 2.5c.6 0 1 .4 1 1V5h6V3.5c0-.6.4-1 1-1s1 .4 1 1V5h1.5c1.4 0 2.5 1.1 2.5 2.5v12c0 1.4-1.1 2.5-2.5 2.5h-13C4.1 22 3 20.9 3 19.5v-12C3 6.1 4.1 5 5.5 5H7V3.5c0-.6.4-1 1-1Zm11 8.5H5v8.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V11Zm-9.2 2.3 1.5 1.5 3.4-3.4c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-4.1 4.1c-.4.4-1 .4-1.4 0l-2.2-2.2c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0Z"
		/>
	),
	card: (size = 22, color = colors.muted) => (
		<Glyph
			size={size}
			color={color}
			d="M4.5 5h15A2.5 2.5 0 0 1 22 7.5v9A2.5 2.5 0 0 1 19.5 19h-15A2.5 2.5 0 0 1 2 16.5v-9A2.5 2.5 0 0 1 4.5 5Zm1.3 4.2v1.6h5.4V9.2H5.8Zm0 3.2v1.5h7.8v-1.5H5.8Zm11.7-2.4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Z"
		/>
	),
	pay: (size = 22, color = colors.muted) => (
		<Glyph
			size={size}
			color={color}
			d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"
		/>
	),
	profile: (size = 22, color = colors.muted) => (
		<Glyph
			size={size}
			color={color}
			d="M12 2.5A4.8 4.8 0 1 1 12 12a4.8 4.8 0 0 1 0-9.5ZM4.2 20.2c.6-3.3 3.7-5.7 7.8-5.7s7.2 2.4 7.8 5.7c.1.6-.3 1.3-1 1.3H5.2c-.7 0-1.1-.7-1-1.3Z"
		/>
	),
	person: (size = 22, color = colors.primary) => (
		<Glyph
			size={size}
			color={color}
			d="M12 3a4.2 4.2 0 1 1 0 8.4A4.2 4.2 0 0 1 12 3Zm0 10.2c3.8 0 7 2.2 7.6 5.3.1.6-.3 1.2-.9 1.2H5.3c-.6 0-1-.6-.9-1.2.6-3.1 3.8-5.3 7.6-5.3Z"
		/>
	),
	clinic: (size = 22, color = colors.primary) => (
		<Glyph
			size={size}
			color={color}
			d="M11 2.5h2c.4 0 .7.3.7.7V5h1.8c.4 0 .7.3.7.7V7h.8c.9 0 1.7.8 1.7 1.7V20c0 .6-.4 1-1 1H6.3c-.6 0-1-.4-1-1V8.7C5.3 7.8 6 7 6.9 7h.8V5.7c0-.4.3-.7.7-.7H11V3.2c0-.4.3-.7.7-.7Zm.3 8.2v1.8H9.5v1.7h1.8v1.8h1.4v-1.8h1.8v-1.7h-1.8V10.7h-1.4Z"
		/>
	),
	lock: (size = 22, color = colors.primary) => (
		<Glyph
			size={size}
			color={color}
			d="M8.2 9.2V7.6a3.8 3.8 0 1 1 7.6 0v1.6h.9c.9 0 1.6.7 1.6 1.6v8c0 .9-.7 1.6-1.6 1.6H7.3c-.9 0-1.6-.7-1.6-1.6v-8c0-.9.7-1.6 1.6-1.6h.9Zm1.8 0h4V7.6a2 2 0 1 0-4 0v1.6Z"
		/>
	),
	help: (size = 22, color = colors.primary) => (
		<Glyph
			size={size}
			color={color}
			d="M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6Zm0 13.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm0-8.6c-1.8 0-3.1 1.2-3.1 2.9 0 .5.4.9.9.9s.9-.4.9-.9c0-.7.5-1.1 1.3-1.1.8 0 1.3.4 1.3 1.1 0 .5-.2.8-.8 1.3l-.5.4c-.8.6-1.2 1.2-1.2 2.2v.2c0 .5.4.9.9.9s.9-.4.9-.9v-.1c0-.4.2-.7.8-1.2l.5-.4c1.1-.8 1.6-1.6 1.6-2.8 0-1.8-1.4-3-3.2-3Z"
		/>
	),
	book: (size = 22, color = colors.primary) => (
		<Glyph
			size={size}
			color={color}
			d="M8 2.5c.6 0 1 .4 1 1V5h6V3.5c0-.6.4-1 1-1s1 .4 1 1V5h1.5c1.4 0 2.5 1.1 2.5 2.5v12c0 1.4-1.1 2.5-2.5 2.5h-13C4.1 22 3 20.9 3 19.5v-12C3 6.1 4.1 5 5.5 5H7V3.5c0-.6.4-1 1-1ZM19 11H5v8.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V11Zm-8.2 2.2h1.4v1.6h1.6v1.4h-1.6v1.6h-1.4v-1.6H9.2v-1.4h1.6v-1.6Z"
		/>
	),
	tooth: (size = 22, color = colors.primary) => (
		<ToothIcon size={size} color={color} />
	),
};

export default icons;
