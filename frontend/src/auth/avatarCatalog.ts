export type LocalAvatarOption = {
  id: string;
  label: string;
  className: string;
  background: string;
};

export const LOCAL_AVATARS: readonly LocalAvatarOption[] = [
  { id: "avatar-01", label: "Nebula", className: "avatar-nebula", background: "linear-gradient(135deg, #7c3aed, #db2777)" },
  { id: "avatar-02", label: "Aurora", className: "avatar-aurora", background: "linear-gradient(135deg, #0f766e, #22d3ee)" },
  { id: "avatar-03", label: "Nova", className: "avatar-nova", background: "linear-gradient(135deg, #1d4ed8, #7c3aed)" },
  { id: "avatar-04", label: "Eclipse", className: "avatar-eclipse", background: "linear-gradient(135deg, #312e81, #4f46e5)" },
  { id: "avatar-05", label: "Comet", className: "avatar-comet", background: "linear-gradient(135deg, #9d174d, #f97316)" },
  { id: "avatar-06", label: "Pulse", className: "avatar-pulse", background: "linear-gradient(135deg, #047857, #84cc16)" },
] as const;

export const DEFAULT_LOCAL_AVATAR_ID = LOCAL_AVATARS[0].id;

export function getLocalAvatarOption(value: string | null | undefined) {
  return LOCAL_AVATARS.find((avatar) => avatar.id === value) || LOCAL_AVATARS[0];
}
