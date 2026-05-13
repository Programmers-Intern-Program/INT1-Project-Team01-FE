import { apiFetch } from "../api-client";

export interface MemberAvatarColors {
  skin: string;
  hair: string;
  shirt: string;
}

export interface MemberProfile {
  memberId?: number;
  displayName: string;
  avatarKind: string;
  avatarColors: MemberAvatarColors;
}

export interface UpdateMemberProfileReq {
  displayName: string;
  avatarKind: string;
  avatarColors: MemberAvatarColors;
}

export function getMyMemberProfile() {
  return apiFetch<MemberProfile>("/api/v1/members/me/profile");
}

export function updateMyMemberProfile(body: UpdateMemberProfileReq) {
  return apiFetch<MemberProfile>("/api/v1/members/me/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
