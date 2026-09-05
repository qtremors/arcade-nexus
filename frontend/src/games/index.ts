import { getDescriptor } from "./descriptors";
export const loadGame = (slug: string) => getDescriptor(slug).load();
