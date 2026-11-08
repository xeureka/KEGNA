import { createContext, useContext } from "react";

export const AvatarContext = createContext<{
	avatarUri?: string;
	setAvatarUri: (uri?: string) => void;
}>({
	avatarUri: undefined,
	setAvatarUri: () => undefined,
});

export const useAvatar = () => useContext(AvatarContext);

export default AvatarContext;
