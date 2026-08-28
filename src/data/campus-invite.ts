/**
 * æ ¡åºåå·¥éè¯?â?Mock æ°æ®å±?
 */
import type {
  AcceptCampusInviteResult,
  CampusInviteItem,
  CampusInvitePreview,
  CampusInviteRoleCode,
  CreateCampusInviteInput,
  CreateCampusInviteResult,
  ListCampusInvitesQuery,
} from '@/services/campus-invite';

const MOCK_INVITES: CampusInviteItem[] = [
  {
    id: 'mock-invite-1',
    inviteCode: 'TEACHMOCK1',
    campusId: 'campus-1',
    campusName: 'æ»åº',
    roleCode: 'campus_teacher',
    campusRole: 'TEACHER',
    status: 'PENDING',
    expireAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 10; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function resolveExpireAt(input: CreateCampusInviteInput): Date {
  if (input.expireMinutes != null) {
    return new Date(Date.now() + input.expireMinutes * 60 * 1000);
  }
  const days = input.expireDays ?? 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const ROLE_LABEL: Record<CampusInviteRoleCode, string> = {
  campus_teacher: 'æè¯¾æå¸',
  campus_principal: 'æ ¡åºæ ¡é¿',
  campus_reception: 'åå°',
};

export async function mockPreviewCampusInvite(inviteCode: string): Promise<CampusInvitePreview> {
  await delay();
  const code = inviteCode.trim().toUpperCase();
  const found = MOCK_INVITES.find((i) => i.inviteCode === code);
  if (!found || found.status !== 'PENDING' || new Date(found.expireAt).getTime() <= Date.now()) {
    throw new Error('éè¯·ç æ ææå·²è¿æ');
  }
  return {
    id: found.id,
    inviteCode: found.inviteCode,
    campusId: found.campusId,
    campusName: found.campusName,
    organizationId: 'org-1',
    organizationName: 'æ¾ææè¯¾',
    roleCode: found.roleCode,
    campusRole: found.campusRole,
    status: found.status,
    expireAt: found.expireAt,
    roleLabel: ROLE_LABEL[found.roleCode],
  };
}

export async function mockCreateCampusInvite(
  input: CreateCampusInviteInput,
): Promise<CreateCampusInviteResult> {
  await delay();
  const inviteCode = generateCode();
  const expireAt = resolveExpireAt(input);
  const item: CampusInviteItem = {
    id: `mock-invite-${Date.now()}`,
    inviteCode,
    campusId: input.campusId,
    campusName: 'æ»åº',
    roleCode: input.roleCode,
    campusRole:
      input.roleCode === 'campus_principal'
        ? 'PRINCIPAL'
        : input.roleCode === 'campus_reception'
          ? 'RECEPTION'
          : 'TEACHER',
    status: 'PENDING',
    expireAt: expireAt.toISOString(),
    createdAt: new Date().toISOString(),
  };
  MOCK_INVITES.unshift(item);
  return {
    ...item,
    roleLabel: ROLE_LABEL[input.roleCode],
  };
}

export async function mockListCampusInvites(
  query?: ListCampusInvitesQuery,
): Promise<CampusInviteItem[]> {
  await delay();
  let list = [...MOCK_INVITES];
  if (query?.status) {
    list = list.filter((i) => i.status === query.status);
  }
  return list;
}

export async function mockAcceptCampusInvite(inviteCode: string): Promise<AcceptCampusInviteResult> {
  await delay();
  const code = inviteCode.trim().toUpperCase();
  const found = MOCK_INVITES.find((i) => i.inviteCode === code);
  if (!found) {
    throw new Error('邀请码不存在');
  }
  if (found.status === 'USED') {
    return {
      alreadyJoined: true,
      organizationId: 'org-1',
      campusId: found.campusId,
      campusName: found.campusName,
      roleCode: found.roleCode,
      campusRole: found.campusRole,
      profileRole: found.campusRole === 'PRINCIPAL' ? 'PRINCIPAL' : 'TEACHER',
    };
  }
  found.status = 'USED';
  found.usedAt = new Date().toISOString();
  return {
    alreadyJoined: false,
    organizationId: 'org-1',
    campusId: found.campusId,
    campusName: found.campusName,
    roleCode: found.roleCode,
    campusRole: found.campusRole,
    profileRole: found.campusRole === 'PRINCIPAL' ? 'PRINCIPAL' : 'TEACHER',
    acceptedAt: found.usedAt,
  };
}

export async function mockCancelCampusInvite(id: string): Promise<void> {
  await delay();
  const found = MOCK_INVITES.find((i) => i.id === id);
  if (found && found.status === 'PENDING') {
    found.status = 'CANCELLED';
  }
}
