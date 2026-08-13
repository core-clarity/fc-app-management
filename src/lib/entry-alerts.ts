export type AlertLevel = "info" | "warning";

export type EntryAlert = {
  code: string;
  level: AlertLevel;
  message: string;
};

export type MemberLike = {
  id: string;
  label: string;
  name: string;
  canPassIdVerification: boolean;
};

export type ExistingEntryLike = {
  id: string;
  performanceId: string;
  memberId: string;
  companionType: "fc_member" | "general_email" | "none";
  companionMemberId: string | null;
};

type BuildAlertsInput = {
  productionIdVerification: "none" | "face_auth" | "other";
  companionTiming: "at_entry" | "before_show";
  member: MemberLike | null;
  companionMember: MemberLike | null;
  companionType: "fc_member" | "general_email" | "none";
  performanceId: string;
  /** 同一ツアー内の既存エントリ（今回の performance 含む全公演） */
  tourEntries: ExistingEntryLike[];
};

export function buildEntryAlerts(input: BuildAlertsInput): EntryAlert[] {
  const alerts: EntryAlert[] = [];
  const { member, companionMember, companionType, performanceId, tourEntries } =
    input;

  if (!member) return alerts;

  // 顔認証
  if (input.productionIdVerification === "face_auth") {
    if (!member.canPassIdVerification) {
      alerts.push({
        code: "face_auth_applicant",
        level: "warning",
        message: `申込名義「${member.label}（${member.name}）」は顔認証を通過できない設定です。この公演では通常使用できません（保存は可能です）。`,
      });
    }
    if (
      companionType === "fc_member" &&
      companionMember &&
      !companionMember.canPassIdVerification
    ) {
      alerts.push({
        code: "face_auth_companion",
        level: "warning",
        message: `同行者「${companionMember.label}（${companionMember.name}）」は顔認証を通過できない設定です（保存は可能です）。`,
      });
    }
  }

  // 同一公演×同一名義の既存エントリ
  const duplicate = tourEntries.find(
    (e) => e.performanceId === performanceId && e.memberId === member.id
  );
  if (duplicate) {
    alerts.push({
      code: "duplicate_entry",
      level: "warning",
      message: `この公演にはすでに名義「${member.label}」のエントリがあります。保存すると UNIQUE 制約で失敗する可能性があります。`,
    });
  }

  // 一本釣り情報（当該ツアー×名義の他エントリ有無）
  const sameMemberInTour = tourEntries.filter((e) => e.memberId === member.id);
  if (sameMemberInTour.length === 0) {
    alerts.push({
      code: "ikkonzuri_candidate",
      level: "info",
      message: `名義「${member.label}」はこのツアーでまだ他のエントリがありません。この1件だけなら一本釣り状態になります。`,
    });
  } else {
    alerts.push({
      code: "not_ikkonzuri",
      level: "info",
      message: `名義「${member.label}」はこのツアーですでに ${sameMemberInTour.length} 件のエントリがあります（一本釣りではありません）。`,
    });
  }

  // at_entry 時の同一ツアー内同行者重複
  if (
    input.companionTiming === "at_entry" &&
    companionType === "fc_member" &&
    companionMember
  ) {
    const companionDup = tourEntries.find(
      (e) =>
        e.companionType === "fc_member" &&
        e.companionMemberId === companionMember.id
    );
    if (companionDup) {
      alerts.push({
        code: "companion_duplicate_in_tour",
        level: "warning",
        message: `同行者「${companionMember.label}」は、このツアーの他のエントリですでに同行者に指定されています（アラートのみ・保存は通します）。`,
      });
    }
  }

  return alerts;
}
